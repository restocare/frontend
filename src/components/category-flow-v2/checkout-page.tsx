"use client";

/**
 * Checkout of the new category flow (NEXT_PUBLIC_RC_CATEGORY_FLOW=2), opened
 * by "Next" on the category page's cart.
 *
 *   1. Your details   2. Date & time   3. Address   4. Payment  |  Price details
 *
 * Editing details, changing and adding an address open in pop-ups. "Date & time" is either
 * Instant (today) or Schedule (any day this week):
 *   - Hourly categories (Chef, Helpers & Waiter), billed rate × hours, pick a
 *     start and an end time in both.
 *   - Everything else: Instant asks nothing (today, earliest start, filled in
 *     automatically); Schedule asks for a date and a start time.
 *
 * One booking is created per person or item.
 *   - Pay online: nothing is booked until Razorpay's payment is verified by
 *     the server; until then the order is only held in the cart. Cancelling
 *     or a failed payment books nothing, so the customer can retry.
 *   - COD: the bookings are created straight away.
 * A coupon rides on the first booking only (codes are single use), with the
 * same maths as the other flows. Once anything is booked, the cart is emptied.
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion, MotionConfig, type Variants } from "framer-motion";
import {
  bookingApi,
  categoryTreeApi,
  couponsApi,
  paymentsApi,
  queryKeys,
  userApi,
  type CategoryTreeService,
  type CreateBookingPayload,
  type CustomerCoupon,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { categoryHref } from "@/lib/category-slugs";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { TAX_RATE, formatInr, round2 } from "@/src/lib/booking-v2/pricing";
import { useCleaningCart, type CartLine } from "@/src/lib/booking-v2/cleaning-cart";
import { hourlyRate } from "@/src/lib/booking-v2/draft";
import {
  DAY_END,
  DAY_START,
  MAX_MINUTES,
  clockNow,
  dayIsBookable,
  earliestStart,
  fmtDateLong,
  fmtDuration,
  fmtTime,
  getDays,
  latestStart,
  minShiftMinutes,
  monthShort,
  pickShiftVariant,
  snapToStep,
  timeOptions,
  toHHmm,
} from "@/src/lib/booking-v2/schedule";
import { loadRazorpayScript, openRazorpay } from "@/src/lib/razorpay";
import { AddressPicker, hasPin, useAddressBook } from "@/src/components/booking-v2/address-picker";
import { Card, CheckGlyph, StorefrontShell } from "@/src/components/booking-v2/shell";
import { SafeImage } from "@/src/components/booking-v2/cleaning-catalog";
import { emojiForCategory } from "@/src/components/booking-v2/category-page-v2";
import {
  ArrowRightIcon,
  BoltIcon,
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  PencilIcon,
  MapPinIcon as PinIcon,
  PhoneIcon,
  SpinnerIcon,
  StoreIcon,
  UserCircleIcon,
  WalletIcon,
} from "@/src/components/icons";

/** A fixed-price job blocks this long after its start (no duration in the catalogue yet). */
const FIXED_JOB_MINUTES = 4 * 60;
const DEFAULT_START = 11 * 60;

type PaymentMode = "RAZORPAY" | "COD";
type WhenMode = "instant" | "schedule";

interface Picked {
  date?: string;
  start?: number;
  end?: number;
}

interface Done {
  ids: number[];
  failed: string[];
  total: number;
  mode: PaymentMode;
  paymentProblem: string | null;
  /** Razorpay payment id, shown so support can trace an online payment. */
  paymentId?: string;
  /** Date and time, kept because the cart is emptied once booked. */
  when: string;
  /** Coupon saving that went through, GST included. */
  saved: number;
  couponCode?: string;
  /** What was in the cart, kept for the summary once the cart is emptied. */
  items: { name: string; image: string | null; quantity: number; line: string }[];
  where: string;
}

/* ------------------------------ small parts ----------------------------- */

const STAGGER: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const RISE: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message || fallback : fallback;
}

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-rc-yellow focus:ring-4 focus:ring-rc-yellow/20 disabled:bg-gray-50 disabled:text-gray-500";

/** Centered dialog on desktop, bottom sheet on phones; portalled to <body>. */
function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-rc-ink/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={`relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
              wide ? "max-w-2xl" : "max-w-lg"
            }`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 className="m-0 text-lg font-bold text-gray-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Numbered step badge that turns into a tick once the step is complete. */
function StepBadge({ n, done, current }: { n: number; done: boolean; current?: boolean }) {
  return (
    <motion.span
      animate={{ scale: done ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.3 }}
      className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
        done
          ? "bg-rc-yellow text-rc-ink"
          : current
            ? "bg-rc-ink text-white"
            : "border-2 border-gray-300 bg-white text-gray-500"
      }`}
      aria-hidden
    >
      {done ? <CheckGlyph className="h-3.5 w-3.5" /> : n}
    </motion.span>
  );
}

function Step({
  n,
  title,
  note,
  done,
  current,
  action,
  children,
}: {
  n: number;
  title: string;
  note?: ReactNode;
  done: boolean;
  /** The first step still to do: outlined so the eye lands on it. */
  current?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.div variants={RISE}>
      <Card
        className={`px-4 py-3.5 transition-shadow sm:px-5 ${
          current ? "border-rc-yellow ring-2 ring-rc-yellow/40" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <StepBadge n={n} done={done} current={current} />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold leading-tight text-gray-900">
              {title}
              {current ? (
                <span className="rounded-full bg-rc-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Up next
                </span>
              ) : null}
            </h2>
            {note ? <p className="m-0 text-xs text-gray-500">{note}</p> : null}
          </div>
          {action}
        </div>
        <div className="mt-3 pl-0 sm:pl-9">{children}</div>
      </Card>
    </motion.div>
  );
}

function LinkAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-rc-yellow-deep transition hover:underline"
    >
      <PencilIcon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

/* --------------------------------- page --------------------------------- */

export function CategoryCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = Number(searchParams.get("category"));
  const { user, isLoggedIn, isHydrating, updateUser } = useCustomerAuth();

  // Not signed in: log in first, then come straight back here.
  const here = `/booking/checkout?category=${categoryId}`;
  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace(`/account/login?redirect=${encodeURIComponent(here)}`);
  }, [isHydrating, isLoggedIn, router, here]);

  const tree = useQuery({
    queryKey: queryKeys.categoryTreeAt(null),
    queryFn: () => categoryTreeApi.tree(null),
  });
  const category = tree.data?.find((c) => c.categoryId === categoryId);
  const hourly = categoryUsesSlots(category?.name);
  const servicesById = useMemo(
    () =>
      new Map<number, CategoryTreeService>(
        (category ? [...category.services, ...category.groups.flatMap((g) => g.services)] : []).map((s) => [
          s.serviceId,
          s,
        ]),
      ),
    [category],
  );

  const { cart, update, hydrated } = useCleaningCart(categoryId, category?.name ?? "");
  const lines = cart.lines;
  const book = useAddressBook(cart.address);
  const address = book.selected;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addressListOpen, setAddressListOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  /* --------------------------------- when -------------------------------- */

  const clock = useMemo(() => clockNow(), []);
  const days = useMemo(() => getDays(), []);
  // Hourly: the longest minimum among the people booked. Fixed: one job slot.
  const minMinutes = hourly
    ? Math.max(5 * 60, ...lines.map((l) => minShiftMinutes(servicesById.get(l.serviceId)?.variants ?? [])))
    : FIXED_JOB_MINUTES;
  const instantOk = dayIsBookable(clock.dateISO, minMinutes, clock);
  const [modeWanted, setMode] = useState<WhenMode>("instant");
  const mode: WhenMode = modeWanted === "instant" && !instantOk ? "schedule" : modeWanted;
  const [picked, setPicked] = useState<Picked>({});

  const date =
    mode === "instant"
      ? clock.dateISO
      : picked.date && dayIsBookable(picked.date, minMinutes, clock)
        ? picked.date
        : (days.find((d) => dayIsBookable(d.value, minMinutes, clock))?.value ?? days[0].value);
  const earliest = earliestStart(date, clock);
  const latest = latestStart(minMinutes);
  // Instant fixed-price jobs ask nothing: today, at the earliest start.
  // Everyone else picks a start (default: the earliest today, 11 AM ahead).
  const autoStart = mode === "instant" && !hourly;
  const start = autoStart
    ? earliest
    : Math.min(
        Math.max(snapToStep(picked.start ?? (mode === "instant" ? earliest : DEFAULT_START)), earliest),
        latest,
      );
  const minHours = minMinutes / 60;
  const maxEnd = Math.min(start + MAX_MINUTES, DAY_END);
  const end = hourly
    ? Math.min(Math.max(snapToStep(picked.end ?? start + minMinutes), start + minMinutes), maxEnd)
    : start + FIXED_JOB_MINUTES;
  const hours = hourly ? (end - start) / 60 : FIXED_JOB_MINUTES / 60;
  const whenLabel = autoStart
    ? "Today · as soon as possible"
    : `${mode === "instant" ? "Today" : fmtDateLong(date)} · ${fmtTime(start)}${hourly ? ` to ${fmtTime(end)}` : ""}`;

  // A new start keeps the same length of booking where it can.
  const pickStart = (v: number) =>
    setPicked((p) => ({ ...p, start: v, end: hourly ? v + (end - start) : p.end }));

  /* -------------------------------- price -------------------------------- */

  /** Pre-tax price of one person / item on this line, for the chosen time. */
  const unitOf = (l: CartLine) => {
    const svc = servicesById.get(l.serviceId);
    return hourly && svc ? round2(hourlyRate(svc) * hours) : l.unitPrice;
  };
  const subtotal = round2(lines.reduce((sum, l) => sum + unitOf(l) * l.quantity, 0));
  const tax = round2(subtotal * TAX_RATE);

  /* -------------------------------- coupon ------------------------------- */

  // Retried, and its error shown, so a failed load never reads as "no coupons".
  const queryClient = useQueryClient();
  const couponsKey = ["checkout-coupons", user?.id ?? null] as const;
  const couponsQuery = useQuery({
    queryKey: couponsKey,
    queryFn: async () => {
      try {
        const res = await couponsApi.list();
        const list = parseCoupons(res);
        if (!list.length && process.env.NODE_ENV !== "production") {
          console.info("[checkout] GET /v1/coupons returned no usable coupons:", res);
        }
        return list;
      } catch (e) {
        if (process.env.NODE_ENV !== "production") console.warn("[checkout] GET /v1/coupons failed:", e);
        throw e;
      }
    },
    enabled: !!user?.id,
    retry: 2,
    staleTime: 30_000,
  });
  const coupons = useMemo(() => couponsQuery.data ?? [], [couponsQuery.data]);
  // undefined = nothing picked here yet: use the one the server says is applied.
  const [couponPick, setApplied] = useState<CustomerCoupon | null | undefined>(undefined);
  const applied =
    couponPick === undefined ? (coupons.find((c) => c.isApplied && !c.isUsed) ?? null) : couponPick;
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      if (applied && applied.code !== trimmed) {
        await couponsApi.remove(applied.couponId).catch(() => undefined);
        setApplied(null);
      }
      const res = await couponsApi.apply(trimmed);
      setApplied(parseCoupon(res) ?? { ...res, code: res?.code ?? trimmed });
      setCouponInput("");
    } catch (e) {
      setCouponError(messageOf(e, `${trimmed} is not a valid code.`));
    } finally {
      setCouponBusy(false);
    }
  };
  const removeCoupon = async () => {
    if (!applied) return;
    setCouponBusy(true);
    try {
      await couponsApi.remove(applied.couponId);
    } catch {
      // Best effort: the booking simply won't carry the code.
    } finally {
      setApplied(null);
      setCouponBusy(false);
    }
  };

  // Same rules as the other flows: a percentage comes off the first
  // booking's pre-tax price; a flat-total coupon fixes that booking's price
  // (GST included) and the server prices it.
  const couponBase = lines.length ? unitOf(lines[0]) : 0;
  const flatOf = (c: CustomerCoupon) => c.discountType === "FLAT_TOTAL" && c.flatTotal != null;
  const baseDiscountOf = (c: CustomerCoupon | null) =>
    c && !flatOf(c) && c.discountPercent > 0 ? round2((couponBase * c.discountPercent) / 100) : 0;
  const savingOf = (c: CustomerCoupon | null) =>
    !c || !lines.length
      ? 0
      : flatOf(c)
        ? Math.max(0, round2(couponBase * (1 + TAX_RATE) - (c.flatTotal as number)))
        : round2(baseDiscountOf(c) * (1 + TAX_RATE));
  const isFlat = !!applied && flatOf(applied);
  const couponBaseDiscount = baseDiscountOf(applied);
  const couponSaving = savingOf(applied);
  const total = Math.max(0, round2(subtotal + tax - couponSaving));
  // Coupons the customer can still use: applied first, then the biggest saving.
  const available = coupons
    .filter((c) => !c.isUsed)
    .sort(
      (a, b) =>
        Number(b.couponId === applied?.couponId) - Number(a.couponId === applied?.couponId) ||
        savingOf(b) - savingOf(a),
    );

  /* ------------------------------- payment ------------------------------- */

  const [payment, setPayment] = useState<PaymentMode | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const detailsOk = !!text(user?.name) && !!text(user?.restaurantName);
  const addressOk = !!address && hasPin(address);
  const steps = [detailsOk, true, addressOk, !!payment];
  const stepsDone = steps.filter(Boolean).length;
  const currentStep = steps.findIndex((d) => !d);
  const couponNeedsPrepay = !!applied?.prepaidOnly && payment === "COD";
  const ready = lines.length > 0 && stepsDone === steps.length && !placing && !couponNeedsPrepay;

  const missing = !lines.length
    ? "Your cart is empty."
    : !detailsOk
      ? "Add your name and restaurant name."
      : !addressOk
        ? "Pick an address with a map pin."
        : !payment
          ? "Choose how to pay."
          : couponNeedsPrepay
            ? `Coupon ${applied?.code} only works with online payment.`
            : null;

  const place = async () => {
    if (!ready || !user?.id || !address) return;
    setPlacing(true);
    setError(null);
    const userId = Number(user.id);
    const online = payment === "RAZORPAY";

    // One booking per person or item, all for the same slot and address.
    const payloadFor = (l: CartLine): CreateBookingPayload => {
      const svc = servicesById.get(l.serviceId);
      return {
        userId,
        professionalId: null,
        serviceId: l.serviceId,
        variantId: hourly && svc ? pickShiftVariant(svc.variants, start, end) : l.variantId,
        bookingDate: date,
        startTime: toHHmm(start),
        endTime: toHHmm(end),
        totalAmount: unitOf(l),
        serviceLat: address.lat ?? 0,
        serviceLng: address.lng ?? 0,
        serviceCity: address.city,
        serviceAddress: address.address,
        paymentMode: online ? "RAZORPAY" : "COD",
      };
    };

    /** Creates every booking; returns what went through and what didn't. */
    const bookAll = async () => {
      const ids: number[] = [];
      const failed: string[] = [];
      let bookedTotal = 0;
      let saved = 0;
      let couponLeft = !!applied;
      for (const l of lines) {
        const payload = payloadFor(l);
        const base = unitOf(l);
        for (let i = 0; i < l.quantity; i++) {
          // The coupon rides on the first booking only: codes are single use.
          const coupon = couponLeft ? applied : null;
          couponLeft = false;
          const body: CreateBookingPayload = coupon
            ? {
                ...payload,
                couponCode: coupon.code,
                totalAmount: isFlat ? base : round2(base - couponBaseDiscount),
              }
            : payload;
          try {
            const res = await bookingApi.create(body);
            ids.push(res.bookingId);
            bookedTotal += round2(base * (1 + TAX_RATE) - (coupon ? couponSaving : 0));
            if (coupon) saved = couponSaving;
          } catch (e) {
            failed.push(`${l.name}: ${messageOf(e, "booking failed")}`);
          }
        }
      }
      return {
        ids,
        failed,
        // Everything booked: the exact figure on screen; otherwise what did.
        bookedTotal: failed.length ? round2(bookedTotal) : total,
        saved,
      };
    };

    /** Booked: the cart starts empty next time. Failed items are listed on the done screen. */
    const emptyCart = () => {
      update({ lines: [], date: null, windowId: null, paymentMode: null });
      void queryClient.invalidateQueries({ queryKey: couponsKey });
    };
    const when = whenLabel;
    const couponCode = applied?.code;
    const items = lines.map((l) => {
      const svc = servicesById.get(l.serviceId);
      return {
        name: l.name,
        image: l.image,
        quantity: l.quantity,
        line: hourly && svc ? `${hours} hrs × ${formatInr(hourlyRate(svc))}` : formatInr(unitOf(l)),
      };
    });
    const where = [address.label || address.restaurantName, address.address, address.city].filter(Boolean).join(", ");

    try {
      if (!online) {
        const { ids, failed, bookedTotal, saved } = await bookAll();
        if (!ids.length) {
          setError(`We couldn't place the booking. ${failed.join("; ")}`);
          return;
        }
        emptyCart();
        setDone({ ids, failed, total: bookedTotal, mode: "COD", paymentProblem: null, when, saved, couponCode, items, where });
        window.scrollTo(0, 0);
        return;
      }

      // Pay online: take and verify the payment first. Nothing is booked yet,
      // so a cancelled or failed payment leaves no booking behind.
      let paymentId: string;
      try {
        if (!(await loadRazorpayScript())) throw new Error("Could not load the payment gateway.");
        const order = await paymentsApi.createOrder(total, "INR");
        if (!order?.id || !order?.keyId) throw new Error("Could not start the payment.");
        const signature = await openRazorpay(
          order,
          {
            name: user.name ?? undefined,
            email: user.email ?? undefined,
            contact: user.mobile ?? user.phone ?? undefined,
          },
          `${category?.name ?? "Booking"}, ${fmtDateLong(date)}`,
        );
        const verification = await paymentsApi.verify(signature);
        if (!verification?.success) throw new Error(verification?.message || "The payment could not be verified.");
        paymentId = signature.razorpay_payment_id;
      } catch (e) {
        setError(
          `${messageOf(e, "The payment did not go through.")} No booking was made. Try again, or choose COD.`,
        );
        return;
      }

      // Paid and verified: now confirm the bookings. The cart is emptied even
      // if some fail, so the customer is never charged twice; support books
      // or refunds those from the payment ID shown.
      const { ids, failed, bookedTotal, saved } = await bookAll();
      emptyCart();
      const problem = failed.length
        ? `Your payment went through (payment ID ${paymentId}), but ${
            ids.length ? "some services" : "the booking"
          } could not be booked. Our team will book ${ids.length ? "them" : "it"} for you or refund you; you can also call support with this payment ID.`
        : null;
      setDone({
        ids,
        failed,
        total: ids.length ? bookedTotal : total,
        mode: "RAZORPAY",
        paymentProblem: problem,
        paymentId,
        when,
        saved,
        couponCode,
        items,
        where,
      });
      window.scrollTo(0, 0);
    } catch (e) {
      setError(messageOf(e, "Booking failed. Please try again."));
    } finally {
      setPlacing(false);
    }
  };

  /* -------------------------------- render ------------------------------- */

  if (isHydrating || !isLoggedIn || tree.isLoading || !hydrated) {
    return (
      <StorefrontShell>
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </StorefrontShell>
    );
  }

  if (done) {
    return (
      <StorefrontShell>
        <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="overflow-hidden">
              {/* Header: the confirmation */}
              <div className="bg-rc-yellow-tint/60 px-6 pb-6 pt-8 text-center sm:px-10">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
                  className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-rc-green text-white shadow-[0_8px_20px_rgba(30,142,62,0.3)]"
                >
                  <CheckGlyph className="h-8 w-8" />
                </motion.div>
                <h1 className="m-0 text-2xl font-bold tracking-tight">
                  {done.ids.length ? "Booking confirmed" : "Payment received"}
                </h1>
                {done.ids.length ? (
                  <p className="m-0 mt-1.5 text-sm text-gray-600">
                    Booking {done.ids.length > 1 ? "IDs" : "ID"}{" "}
                    <strong className="text-gray-900">{done.ids.map((id) => `#${id}`).join(", ")}</strong>
                  </p>
                ) : null}
                {done.paymentId ? (
                  <p className="m-0 mt-1 text-xs text-gray-500">Payment ID {done.paymentId}</p>
                ) : null}
              </div>

              <div className="px-5 py-5 sm:px-8">
                {/* When, where, payment */}
                <dl className="m-0 grid gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      [CalendarIcon, "When", done.when],
                      [PinIcon, "Where", done.where],
                      [
                        done.mode === "COD" ? BoltIcon : WalletIcon,
                        "Payment",
                        done.mode === "COD" ? `${formatInr(done.total)} · COD after the service` : `${formatInr(done.total)} · paid online`,
                      ],
                    ] as const
                  ).map(([Icon, label, value]) => (
                    <div key={label} className="flex gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-rc-yellow-deep ring-1 ring-gray-100">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold text-gray-500">{label}</dt>
                        <dd className="m-0 text-[13px] font-semibold leading-snug text-gray-900">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>

                {/* What was booked */}
                {done.items.length ? (
                  <ul className="m-0 mt-4 list-none divide-y divide-gray-100 rounded-xl border border-gray-100 p-0">
                    {done.items.map((it) => (
                      <li key={it.name} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-rc-yellow-tint">
                          <SafeImage
                            src={it.image}
                            alt=""
                            className="h-full w-full object-cover"
                            fallback={<span className="grid h-full w-full place-items-center text-lg">{emojiForCategory(category?.name ?? "")}</span>}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-sm font-semibold text-gray-900">{it.name}</p>
                          <p className="m-0 text-xs text-gray-500">{it.line}</p>
                        </div>
                        {it.quantity > 1 ? (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">× {it.quantity}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {done.saved > 0 ? (
                  <p className="m-0 mt-3 flex items-center gap-1.5 text-sm font-semibold text-rc-green">
                    <TagIcon className="h-4 w-4" />
                    You saved {formatInr(done.saved)} with {done.couponCode}.
                  </p>
                ) : null}
                {done.paymentProblem ? (
                  <p className="m-0 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-rc-red">{done.paymentProblem}</p>
                ) : null}
                {done.failed.length ? (
                  <p className="m-0 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-rc-red">
                    Not booked: {done.failed.join("; ")}
                  </p>
                ) : null}

                {/* What happens next */}
                {done.ids.length ? (
                  <div className="mt-5 rounded-xl border border-dashed border-rc-yellow-deep/40 bg-rc-yellow-tint/30 px-4 py-3">
                    <p className="m-0 text-[13px] font-bold text-gray-900">What happens next</p>
                    <ol className="m-0 mt-2 list-none space-y-1.5 p-0 text-[13px] text-gray-700">
                      {[
                        `We assign your ${hourly ? (/chef/i.test(category?.name ?? "") ? "chef" : "staff") : "professional"} and the status updates in My Bookings.`,
                        done.mode === "COD"
                          ? `Pay ${formatInr(done.total)} after the service, by cash or UPI.`
                          : "You're all paid up. Nothing more to pay on the day.",
                        "Need to change or cancel? Open the booking in My Bookings.",
                      ].map((t, i) => (
                        <li key={t} className="flex gap-2.5">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rc-yellow text-[11px] font-bold text-rc-ink">
                            {i + 1}
                          </span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/account/orders"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 shadow-[0_6px_16px_rgba(244,180,0,0.28)] transition hover:brightness-95 sm:flex-1"
                  >
                    View my bookings
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    href={categoryHref(categoryId)}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 sm:flex-1"
                  >
                    Book more
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        </main>
      </StorefrontShell>
    );
  }

  // Not launched yet ("Coming soon" on the home page): no checkout, even from
  // a cart filled earlier or a direct link.
  if (category && category.isPublished === false) {
    return (
      <StorefrontShell>
        <div className="mx-auto flex h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <h1 className="m-0 text-xl font-bold sm:text-2xl">{category.name} is coming soon</h1>
          <p className="m-0 mt-2 text-gray-500">We&apos;re not taking bookings for this category yet.</p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-gray-900 px-6 text-sm font-semibold text-white"
          >
            Back to home
          </Link>
        </div>
      </StorefrontShell>
    );
  }

  if (!category || !lines.length) {
    return (
      <StorefrontShell>
        <div className="mx-auto flex h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <h1 className="m-0 text-xl font-bold sm:text-2xl">Your cart is empty</h1>
          <p className="m-0 mt-2 text-gray-500">Add a service, then press Next.</p>
          <Link
            href={category ? categoryHref(categoryId) : "/"}
            className="mt-6 inline-flex h-11 items-center rounded-full bg-gray-900 px-6 text-sm font-semibold text-white"
          >
            {category ? `Browse ${category.name}` : "Back to home"}
          </Link>
        </div>
      </StorefrontShell>
    );
  }

  const emoji = emojiForCategory(category.name);
  const phone = text(user?.mobile) || text(user?.phone);
  const savedPinned = book.saved;

  return (
    <MotionConfig reducedMotion="user">
      <StorefrontShell>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-6">
          {/* Heading with progress through the four steps */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Link href={categoryHref(categoryId)} className="text-xs text-gray-500 hover:text-gray-900">
                ← {category.name}
              </Link>
              <h1 className="m-0 text-xl font-bold tracking-tight sm:text-2xl">Checkout</h1>
            </div>
            <div className="w-full max-w-60">
              <div className="mb-1 flex justify-between gap-3 text-[11px] font-semibold text-gray-500">
                <span className="shrink-0">
                  {stepsDone} of {steps.length} done
                </span>
                <span className="truncate">{ready ? "Ready to book" : missing}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                <motion.div
                  className="h-full rounded-full bg-rc-yellow"
                  initial={false}
                  animate={{ width: `${(stepsDone / steps.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 22 }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
            <motion.div variants={STAGGER} initial="hidden" animate="show" className="min-w-0 space-y-3">
              {/* 1. Details: one line */}
              <Step
                n={1}
                title="Your details"
                done={detailsOk}
                current={currentStep === 0}
                action={<LinkAction onClick={() => setDetailsOpen(true)}>{detailsOk ? "Update" : "Add"}</LinkAction>}
              >
                {detailsOk ? (
                  <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <UserCircleIcon className="h-4 w-4 text-rc-yellow-deep" />
                      <span className="font-semibold text-gray-900">{text(user?.name)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="h-4 w-4 text-rc-yellow-deep" />
                      {phone ? `+91 ${phone}` : "—"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <StoreIcon className="h-4 w-4 text-rc-yellow-deep" />
                      {text(user?.restaurantName)}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(true)}
                    className="text-sm font-semibold text-rc-yellow-deep hover:underline"
                  >
                    Add your name and restaurant name
                  </button>
                )}
              </Step>

              {/* 2. Date & time */}
              <Step
                n={2}
                title="Date & time"
                done
                note={hourly ? `Minimum ${minHours} hours, same time for everyone.` : undefined}
              >
                <LayoutGroup>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Booking type">
                    {(
                      [
                        {
                          id: "instant",
                          Icon: BoltIcon,
                          title: "Instant",
                          sub: !instantOk
                            ? "Closed for today"
                            : hourly
                              ? `Today, from ${fmtTime(earliestStart(clock.dateISO, clock))}`
                              : "Today, as soon as possible",
                        },
                        { id: "schedule", Icon: CalendarIcon, title: "Schedule", sub: "Pick a day and time" },
                      ] as const
                    ).map((m) => {
                      const on = mode === m.id;
                      const disabled = m.id === "instant" && !instantOk;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={disabled}
                          onClick={() => setMode(m.id)}
                          className="relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {on ? (
                            <motion.span
                              layoutId="when-pill"
                              className="absolute inset-0 rounded-lg bg-white shadow-sm"
                              transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            />
                          ) : null}
                          <span
                            className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                              on ? "bg-rc-yellow text-rc-ink" : "text-gray-500"
                            }`}
                          >
                            <m.Icon className="h-4 w-4" />
                          </span>
                          <span className="relative min-w-0">
                            <span className="block text-sm font-bold leading-tight text-gray-900">{m.title}</span>
                            <span className="block truncate text-[11px] text-gray-500">{m.sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    {mode === "schedule" ? (
                      <div
                        className="-mx-1 mt-3 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none sm:grid sm:grid-cols-7 sm:overflow-visible"
                        role="radiogroup"
                        aria-label="Date"
                      >
                        {days.map((d, i) => {
                          const selected = d.value === date;
                          const ok = dayIsBookable(d.value, minMinutes, clock);
                          return (
                            <motion.button
                              key={d.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              aria-label={fmtDateLong(d.value)}
                              disabled={!ok}
                              whileTap={ok ? { scale: 0.94 } : undefined}
                              onClick={() => setPicked((p) => ({ ...p, date: d.value }))}
                              className={`flex h-14 w-13 shrink-0 snap-start flex-col items-center justify-center rounded-lg border transition-colors disabled:opacity-40 sm:w-auto ${
                                selected ? "border-rc-yellow bg-rc-yellow" : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <span className={`text-[10px] uppercase ${selected ? "text-gray-700" : "text-gray-400"}`}>
                                {d.weekday}
                              </span>
                              <span className="text-base font-bold leading-tight tabular-nums">{d.day}</span>
                              <span className={`text-[9px] leading-none ${selected ? "text-gray-700" : "text-gray-400"}`}>
                                {i === 0 || d.day === "1" ? monthShort(d.value) : " "}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    ) : !hourly ? (
                      <p className="m-0 mt-3 flex items-center gap-2 text-sm text-gray-700">
                        <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                          <motion.span
                            className="absolute inset-0 rounded-full bg-rc-yellow/40"
                            animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                          />
                          <span className="relative grid h-5 w-5 place-items-center rounded-full bg-rc-yellow text-rc-ink">
                            <BoltIcon className="h-3 w-3" />
                          </span>
                        </span>
                        The team comes <span className="font-semibold text-gray-900">today, as soon as possible</span>.
                      </p>
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                {autoStart ? null : (
                  <div
                    className={`mt-3 grid items-end gap-2 ${hourly ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "max-w-56"}`}
                  >
                    <TimeField
                      id="start-time"
                      label="Start time"
                      value={start}
                      onChange={pickStart}
                      options={timeOptions(DAY_START, latest).map((t) => ({ value: t, disabled: t < earliest }))}
                    />
                    {hourly ? (
                      <>
                        <div className="flex flex-col items-center gap-1 pb-2.5" aria-hidden>
                          <span className="rounded-full bg-rc-yellow px-2 py-0.5 text-[11px] font-bold text-rc-ink">
                            {fmtDuration(end - start)}
                          </span>
                          <ArrowRightIcon className="h-4 w-4 text-gray-300" />
                        </div>
                        <TimeField
                          id="end-time"
                          label="End time"
                          value={end}
                          onChange={(v) => setPicked((p) => ({ ...p, start, end: v }))}
                          options={timeOptions(start + minMinutes, maxEnd).map((t) => ({ value: t }))}
                        />
                      </>
                    ) : null}
                  </div>
                )}
              </Step>

              {/* 3. Address: the chosen one, change or add in a pop-up */}
              <Step
                n={3}
                title="Address"
                done={addressOk}
                current={currentStep === 2}
                action={
                  savedPinned.length ? (
                    <LinkAction onClick={() => setAddressListOpen(true)}>Change</LinkAction>
                  ) : null
                }
              >
                {address ? (
                  <div className="flex items-start gap-2.5 text-sm">
                    <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-rc-yellow-deep" />
                    <p className="m-0 min-w-0 text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {address.label}
                        {address.restaurantName ? `, ${address.restaurantName}` : ""}
                      </span>
                      <span className="block truncate text-gray-500">
                        {[address.address, `${address.city}${address.zipCode ? ` ${address.zipCode}` : ""}`]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="m-0 text-sm text-gray-500">No address yet.</p>
                )}
                <button
                  type="button"
                  onClick={() => setAddressOpen(true)}
                  className="mt-2.5 text-sm font-semibold text-rc-yellow-deep hover:underline"
                >
                  + Add a new address
                </button>
              </Step>

              {/* 4. Payment */}
              <Step n={4} title="Payment method" done={!!payment} current={currentStep === 3}>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {(
                    [
                      { id: "RAZORPAY", Icon: WalletIcon, title: "Pay online", sub: "UPI, cards, netbanking" },
                      { id: "COD", Icon: BoltIcon, title: "COD", sub: "Cash or UPI after the service" },
                    ] as const
                  ).map((m) => {
                    const on = payment === m.id;
                    return (
                      <motion.button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPayment(m.id)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          on ? "border-rc-yellow bg-rc-yellow-tint/60" : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                            on ? "bg-rc-yellow text-rc-ink" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <m.Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-tight text-gray-900">{m.title}</span>
                          <span className="block text-[11px] text-gray-500">{m.sub}</span>
                        </span>
                        <span
                          className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border-2 ${
                            on ? "border-rc-yellow-deep bg-rc-yellow-deep text-white" : "border-gray-300"
                          }`}
                          aria-hidden
                        >
                          {on ? <CheckGlyph className="h-2.5 w-2.5" /> : null}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </Step>
            </motion.div>

            {/* Right: price details */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="min-w-0 lg:sticky lg:top-24 lg:self-start"
            >
              <Card className="overflow-hidden">
                <div className="border-b border-gray-100 bg-rc-yellow-tint/60 px-4 py-3">
                  <h2 className="m-0 text-sm font-bold text-gray-900">Price details</h2>
                  <p className="m-0 mt-0.5 text-[11px] text-gray-600">{whenLabel}</p>
                </div>
                <ul className="m-0 max-h-64 list-none divide-y divide-gray-100 overflow-y-auto p-0 px-4">
                  {lines.map((l) => {
                    const svc = servicesById.get(l.serviceId);
                    const unit = unitOf(l);
                    return (
                      <li key={l.key} className="flex items-center gap-2.5 py-2">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-rc-yellow-tint">
                          <SafeImage
                            src={l.image}
                            alt=""
                            className="h-full w-full object-cover"
                            fallback={<span className="grid h-full w-full place-items-center text-sm">{emoji}</span>}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-[13px] font-semibold leading-tight text-gray-900">{l.name}</p>
                          <p className="m-0 text-[11px] text-gray-500">
                            {hourly && svc ? `${hours} hrs × ${formatInr(hourlyRate(svc))}` : formatInr(unit)}
                            {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                          </p>
                        </div>
                        <p className="m-0 text-[13px] font-semibold tabular-nums text-gray-900">
                          {formatInr(round2(unit * l.quantity))}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <CouponList
                  loading={couponsQuery.isLoading}
                  loadError={couponsQuery.isError ? messageOf(couponsQuery.error, "Could not load your coupons.") : null}
                  onRetry={() => void queryClient.invalidateQueries({ queryKey: couponsKey })}
                  coupons={available}
                  appliedId={applied?.couponId ?? null}
                  savingOf={savingOf}
                  busy={couponBusy}
                  payOnline={payment === "RAZORPAY"}
                  onApply={applyCoupon}
                  onRemove={removeCoupon}
                  entry={
                    <CouponBox
                      applied={applied}
                      saving={couponSaving}
                      input={couponInput}
                      onInput={setCouponInput}
                      busy={couponBusy}
                      error={couponError}
                      onApply={applyCoupon}
                      onRemove={removeCoupon}
                      appliesTo={applied && lines.length > 1 ? lines[0].name : null}
                    />
                  }
                />
                <dl className="m-0 space-y-1.5 border-t border-gray-100 px-4 py-3 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Item total</dt>
                    <dd className="m-0 tabular-nums">{formatInr(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">GST ({Math.round(TAX_RATE * 100)}%)</dt>
                    <dd className="m-0 tabular-nums">{formatInr(tax)}</dd>
                  </div>
                  {applied && couponSaving > 0 ? (
                    <div className="flex justify-between font-semibold text-rc-green">
                      <dt>Coupon {applied.code}</dt>
                      <dd className="m-0 tabular-nums">−{formatInr(couponSaving)}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-baseline justify-between border-t border-gray-100 pt-2">
                    <dt className="text-sm font-bold text-gray-900">Total</dt>
                    <motion.dd
                      key={total}
                      initial={{ opacity: 0.4, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="m-0 text-lg font-bold tabular-nums text-gray-900"
                    >
                      {formatInr(total)}
                    </motion.dd>
                  </div>
                </dl>
                <div className="hidden px-4 pb-4 lg:block">
                  <PlaceButton ready={ready} placing={placing} onClick={place} />
                  <p
                    className={`m-0 mt-1.5 text-center text-[11px] ${
                      error ? "font-medium text-rc-red" : missing ? "font-medium text-rc-yellow-deep" : "text-gray-500"
                    }`}
                  >
                    {error ?? missing ?? "By placing the booking you agree to our terms."}
                  </p>
                </div>
              </Card>
            </motion.aside>
          </div>
        </main>

        {/* Phones: total and the button stay in reach */}
        <div
          data-bottom-bar
          className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 leading-tight">
              <p className="m-0 text-base font-bold tabular-nums">{formatInr(total)}</p>
              <p className={`m-0 truncate text-xs ${error ? "text-rc-red" : "text-gray-500"}`}>
                {error ?? missing ?? "GST included"}
              </p>
            </div>
            <div className="w-44 shrink-0">
              <PlaceButton ready={ready} placing={placing} onClick={place} />
            </div>
          </div>
        </div>

        <Modal open={detailsOpen} title="Your details" onClose={() => setDetailsOpen(false)}>
          <DetailsForm
            name={text(user?.name)}
            restaurant={text(user?.restaurantName)}
            phone={phone}
            onCancel={() => setDetailsOpen(false)}
            onSave={async (patch) => {
              if (!user?.id) return;
              await userApi.updateProfile(user.id, patch);
              updateUser(patch);
              setDetailsOpen(false);
            }}
          />
        </Modal>

        <Modal open={addressListOpen} title="Choose an address" onClose={() => setAddressListOpen(false)}>
          <ul className="m-0 list-none space-y-2 p-0" role="radiogroup" aria-label="Saved addresses">
            {savedPinned.map((a) => {
              const on = address?.id === a.id;
              const pinned = hasPin(a);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!pinned}
                    onClick={() => {
                      update({ address: a });
                      setAddressListOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-50 ${
                      on ? "border-rc-yellow bg-rc-yellow-tint/60" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border-2 ${
                        on ? "border-rc-yellow-deep bg-rc-yellow-deep text-white" : "border-gray-300"
                      }`}
                      aria-hidden
                    >
                      {on ? <CheckGlyph className="h-2.5 w-2.5" /> : null}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-semibold text-gray-900">
                        {a.label}
                        {a.restaurantName ? `, ${a.restaurantName}` : ""}
                      </span>
                      <span className="block text-gray-500">
                        {[a.address, `${a.city}${a.zipCode ? ` ${a.zipCode}` : ""}`].filter(Boolean).join(", ")}
                      </span>
                      {!pinned ? (
                        <span className="block text-xs text-rc-red">No map pin. Add it again with its location.</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setAddressListOpen(false);
              setAddressOpen(true);
            }}
            className="mt-3 h-11 w-full rounded-xl border border-dashed border-rc-yellow-deep text-sm font-semibold text-rc-yellow-deep transition hover:bg-rc-yellow-tint/40"
          >
            + Add a new address
          </button>
        </Modal>

        <Modal open={addressOpen} title="Add a new address" onClose={() => setAddressOpen(false)} wide>
          <AddressPicker
            book={book}
            noun={hourly ? "staff" : "team"}
            formOnly
            onSelect={(a) => update({ address: a })}
            onFormClose={() => setAddressOpen(false)}
          />
        </Modal>
      </StorefrontShell>
    </MotionConfig>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

/* ------------------------------- coupons ------------------------------- */

/** The first list found in a response: a bare array, or one under data / coupons / items. */
function findList(v: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object" || depth > 3) return null;
  for (const k of ["data", "coupons", "items", "results", "result", "rows"]) {
    const found = findList((v as Record<string, unknown>)[k], depth + 1);
    if (found) return found;
  }
  return null;
}

/** One coupon, whatever the field names (couponId or id, code or couponCode, status or isUsed). */
function parseCoupon(v: unknown): CustomerCoupon | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const code = String(r.code ?? r.couponCode ?? "").trim();
  const couponId = Number(r.couponId ?? r.id);
  if (!code || !Number.isFinite(couponId)) return null;
  const status = String(r.status ?? "").toUpperCase();
  const pct = Number(r.discountPercent ?? r.discount ?? r.percent ?? 0);
  const flat = r.flatTotal == null ? null : Number(r.flatTotal);
  return {
    ...r,
    couponId,
    code,
    description: typeof r.description === "string" ? r.description : null,
    discountPercent: Number.isFinite(pct) ? pct : 0,
    isApplied: r.isApplied === true,
    isUsed: r.isUsed === true || status === "USED" || !!r.usedAt,
    expiresAt: String(r.expiresAt ?? r.validTill ?? r.expiryDate ?? ""),
    prepaidOnly: r.prepaidOnly === true,
    discountType: r.discountType === "FLAT_TOTAL" ? "FLAT_TOTAL" : r.discountType === "PERCENT" ? "PERCENT" : undefined,
    flatTotal: flat != null && Number.isFinite(flat) ? flat : null,
  };
}

/** Usable coupons from GET /v1/coupons: not used, not expired. */
function parseCoupons(res: unknown): CustomerCoupon[] {
  const now = Date.now();
  return (findList(res) ?? [])
    .map(parseCoupon)
    .filter((c): c is CustomerCoupon => !!c)
    .filter((c) => {
      if (c.isUsed || String((c as { status?: unknown }).status ?? "").toUpperCase() === "EXPIRED") return false;
      const t = Date.parse(c.expiresAt);
      return Number.isNaN(t) || t >= now;
    });
}

/** "20% off one booking" or "₹199 for one booking". */
function couponTerms(c: CustomerCoupon): string {
  return c.discountType === "FLAT_TOTAL" && c.flatTotal != null
    ? `${formatInr(c.flatTotal)} for one booking`
    : c.discountPercent
      ? `${c.discountPercent}% off one booking`
      : (c.description ?? "");
}

function fmtExpiry(iso: string): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** The customer's coupons, folded under a "View coupons" button: tap Apply on one. */
function CouponList({
  coupons,
  appliedId,
  savingOf,
  busy,
  payOnline,
  onApply,
  onRemove,
  entry,
  loading,
  loadError,
  onRetry,
}: {
  coupons: CustomerCoupon[];
  appliedId: number | null;
  savingOf: (c: CustomerCoupon) => number;
  busy: boolean;
  payOnline: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  /** The code box, shown above the list. */
  entry: ReactNode;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <TagIcon className="h-3.5 w-3.5 text-rc-yellow-deep" />
        <h3 className="m-0 flex-1 text-[13px] font-bold text-gray-900">Coupons</h3>
        {coupons.length ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="coupon-list"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-rc-yellow-deep/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-rc-yellow-deep transition hover:bg-rc-yellow-tint"
          >
            {open ? "Hide" : "View"} {coupons.length} {coupons.length === 1 ? "coupon" : "coupons"}
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden className="text-[10px] leading-none">
              ▼
            </motion.span>
          </button>
        ) : null}
      </div>
      {entry}
      {coupons.length ? null : loading ? (
        <p className="m-0 flex items-center gap-2 px-4 pb-3 pt-2 text-[11px] text-gray-500">
          <SpinnerIcon className="h-3.5 w-3.5" /> Loading your coupons…
        </p>
      ) : loadError ? (
        <p className="m-0 px-4 pb-3 pt-2 text-[11px] text-rc-red">
          Could not load your coupons: {loadError}{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-rc-yellow-deep hover:underline">
            Try again
          </button>
        </p>
      ) : (
        <p className="m-0 px-4 pb-3 pt-2 text-[11px] text-gray-500">
          No coupons for your account right now. Have a code? Enter it above.
        </p>
      )}
      <AnimatePresence initial={false}>
        {open && coupons.length ? (
          <motion.ul
            id="coupon-list"
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="m-0 list-none overflow-hidden p-0"
          >
            <div className="max-h-56 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
        {coupons.map((c) => {
          const on = c.couponId === appliedId;
          const saving = savingOf(c);
          const expiry = c.expiresAt ? fmtExpiry(c.expiresAt) : null;
          const terms = couponTerms(c);
          // Skip a description that only repeats the terms ("20% off").
          const description =
            c.description && !terms.toLowerCase().startsWith(c.description.trim().toLowerCase()) ? c.description : null;
          return (
            <motion.li
              key={c.couponId}
              layout
              className={`relative flex items-stretch overflow-hidden rounded-xl border border-dashed transition-colors ${
                on ? "border-rc-green/60 bg-[#E6F4EA]" : "border-rc-yellow-deep/50 bg-white"
              }`}
            >
              {/* Ticket stub */}
              <div
                className={`grid w-11 shrink-0 place-items-center ${on ? "bg-rc-green text-white" : "bg-rc-yellow-tint text-rc-yellow-deep"}`}
              >
                {on ? <CheckGlyph className="h-4 w-4" /> : <TagIcon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1 px-3 py-2 leading-tight">
                <p className="m-0 text-[13px] font-bold tracking-wide text-gray-900">{c.code}</p>
                <p className="m-0 mt-0.5 text-[11px] text-gray-600">{couponTerms(c)}</p>
                {description ? <p className="m-0 mt-0.5 truncate text-[11px] text-gray-500">{description}</p> : null}
                <p className="m-0 mt-1 text-[10px] text-gray-400">
                  {[
                    c.prepaidOnly ? (payOnline ? "Online payment only" : "Pay online to use it") : null,
                    expiry ? `Valid till ${expiry}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-center gap-1 pr-3">
                {saving > 0 ? (
                  <span className={`text-[11px] font-bold ${on ? "text-rc-green" : "text-gray-900"}`}>
                    Save {formatInr(saving)}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (on) onRemove();
                    else {
                      onApply(c.code);
                      setOpen(false);
                    }
                  }}
                  className={`h-7 rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${
                    on
                      ? "text-rc-yellow-deep hover:underline"
                      : "bg-rc-yellow text-gray-900 hover:brightness-95"
                  }`}
                >
                  {on ? "Remove" : "Apply"}
                </button>
              </div>
            </motion.li>
          );
        })}
            </div>
          </motion.ul>
        ) : null}
      </AnimatePresence>
      {!open && coupons.length ? <div className="pb-3" /> : null}
    </div>
  );
}

/** Coupon code entry, at the top of the coupon card. */
function CouponBox({
  applied,
  saving,
  input,
  onInput,
  busy,
  error,
  onApply,
  onRemove,
  appliesTo,
}: {
  applied: CustomerCoupon | null;
  saving: number;
  input: string;
  onInput: (v: string) => void;
  busy: boolean;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
  appliesTo: string | null;
}) {
  return (
    <div className="px-3 pt-2">
      <AnimatePresence mode="wait" initial={false}>
        {applied ? (
          <motion.div
            key="applied"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-rc-green/50 bg-[#E6F4EA] px-3 py-2"
          >
            <TagIcon className="h-4 w-4 shrink-0 text-rc-green" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="m-0 text-[13px] font-bold text-rc-green">{applied.code} applied</p>
              <p className="m-0 truncate text-[11px] text-gray-600">
                {saving > 0 ? `You save ${formatInr(saving)}` : couponTerms(applied)}
                {appliesTo ? ` on ${appliesTo}` : ""}
                {applied.prepaidOnly ? ", pay online" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="shrink-0 text-xs font-semibold text-rc-yellow-deep hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </motion.div>
        ) : (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                onApply(input);
              }}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1 pl-3 pr-1 focus-within:border-rc-yellow-deep"
            >
              <TagIcon className="h-4 w-4 shrink-0 text-gray-400" />
              <label htmlFor="checkout-coupon" className="sr-only">
                Coupon code
              </label>
              <input
                id="checkout-coupon"
                value={input}
                onChange={(e) => onInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                autoComplete="off"
                spellCheck={false}
                className="h-8 min-w-0 flex-1 bg-transparent text-[13px] font-semibold uppercase tracking-wide text-gray-900 outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="h-8 shrink-0 rounded-lg px-3 text-[13px] font-bold text-rc-yellow-deep transition hover:bg-rc-yellow-tint disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                {busy ? <SpinnerIcon className="h-4 w-4" /> : "Apply"}
              </button>
            </form>
            {error ? (
              <p role="alert" className="m-0 mt-1.5 text-[11px] font-medium text-rc-red">
                {error}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A time picker: a native select (phones get their own picker) dressed with a clock and a chevron. */
function TimeField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; disabled?: boolean }[];
}) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-gray-500">{label}</span>
      <span className="relative block">
        <ClockIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rc-yellow-deep sm:left-3" />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white pl-8 pr-7 text-sm font-semibold sm:pl-9 sm:pr-9 sm:text-[15px] text-gray-900 outline-none transition hover:border-gray-300 focus:border-rc-yellow focus:ring-4 focus:ring-rc-yellow/20"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {fmtTime(o.value)}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 sm:right-3"
          aria-hidden
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </span>
    </label>
  );
}

function PlaceButton({ ready, placing, onClick }: { ready: boolean; placing: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      disabled={!ready}
      onClick={onClick}
      whileTap={ready ? { scale: 0.97 } : undefined}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 shadow-[0_6px_16px_rgba(244,180,0,0.28)] transition-[filter,opacity] hover:brightness-95 disabled:opacity-50 disabled:shadow-none"
    >
      {placing ? <SpinnerIcon className="h-5 w-5" /> : "Place booking"}
    </motion.button>
  );
}

/* ------------------------------ details form ---------------------------- */

function DetailsForm({
  name,
  restaurant,
  phone,
  onSave,
  onCancel,
}: {
  name: string;
  restaurant: string;
  phone: string;
  onSave: (patch: { name: string; restaurantName: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ name, restaurant });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.restaurant.trim()) {
      setError("Enter your name and restaurant name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: form.name.trim(), restaurantName: form.restaurant.trim() });
    } catch (err) {
      setError(messageOf(err, "Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-gray-600">Your name</span>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Owner or manager"
          autoFocus
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-gray-600">Mobile number</span>
        <input value={phone ? `+91 ${phone}` : ""} disabled className={inputCls} />
        <span className="mt-1 block text-xs text-gray-400">Your login number. To change it, contact support.</span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-gray-600">Restaurant name</span>
        <input
          value={form.restaurant}
          onChange={(e) => setForm((f) => ({ ...f, restaurant: e.target.value }))}
          placeholder="e.g. Govardhan, Karol Bagh"
          className={inputCls}
        />
      </label>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="m-0 overflow-hidden text-sm text-rc-red"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 transition hover:brightness-95 disabled:opacity-60"
        >
          {saving ? <SpinnerIcon className="h-4 w-4" /> : "Save details"}
        </button>
      </div>
    </form>
  );
}
