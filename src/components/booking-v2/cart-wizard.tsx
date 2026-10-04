"use client";

/**
 * Checkout for the Deep Cleaning cart on flow 2, at /booking/cart?category=ID.
 * Three steps in the wizard shell: date and arrival window, address, review
 * and pay. Every cart line becomes its own booking on the same date, window
 * and address.
 *
 * Failure handling: the cart is checked against the live catalog on entry
 * (removed packages drop out, changed prices update, with a note); a window
 * that closes while the page is open sends the customer back to pick
 * another; when one booking of several fails, the ones that went through are
 * listed and leave the cart, so trying again only books what's left.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  bookingApi,
  categoryTreeApi,
  couponsApi,
  paymentsApi,
  queryKeys,
  type CategoryTreeService,
  type CustomerCoupon,
} from "@/src/api/api";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { TAX_RATE, formatInr, round2 } from "@/src/lib/booking-v2/pricing";
import { clockNow, fmtDateLong, fmtTime, getDays, monthShort } from "@/src/lib/booking-v2/schedule";
import {
  ARRIVAL_WINDOWS,
  buildCartPayloads,
  computeCartBill,
  reconcileLines,
  useCleaningCart,
  windowById,
  windowOpen,
  type CartLine,
  type CleaningCart,
  type PaymentMode,
} from "@/src/lib/booking-v2/cleaning-cart";
import { loadRazorpayScript, openRazorpay } from "@/src/lib/razorpay";
import { SpinnerIcon } from "@/src/components/icons";
import { AddressPicker, hasPin, useAddressBook } from "./address-picker";
import { AddControl } from "./cleaning-catalog";
import {
  BillRow,
  Card,
  CheckGlyph,
  ChoiceCard,
  Hint,
  LinkButton,
  PinGlyph,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StorefrontShell,
  WizardLayout,
  inputClass,
} from "./shell";

type Step = "slot" | "address" | "review";

function parseStep(value: string | null): Step {
  return value === "address" || value === "review" ? value : "slot";
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** The first date (from `days`) with an arrival window still open. */
function firstOpenDay(days: { value: string }[], clock: ReturnType<typeof clockNow>): string | null {
  return days.find((d) => ARRIVAL_WINDOWS.some((w) => windowOpen(d.value, w, clock)))?.value ?? null;
}

interface StepCommon {
  cart: CleaningCart;
  update: (patch: Partial<CleaningCart>) => boolean;
  setQuantity: (key: string, quantity: number) => boolean;
  goTo: (step: Step) => void;
  backToCategory: () => void;
  /** The order went through (fully or partly): show the confirmation. */
  onDone: (outcome: Outcome) => void;
}

export function CartWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryId = Number(searchParams.get("category"));
  const requested = parseStep(searchParams.get("step"));

  const tree = useQuery({
    queryKey: queryKeys.categoryTreeAt(null),
    queryFn: () => categoryTreeApi.tree(null),
    enabled: Number.isInteger(categoryId) && categoryId > 0,
  });
  const category = tree.data?.find((c) => c.categoryId === categoryId);
  const { cart, update, setQuantity, hydrated } = useCleaningCart(categoryId, category?.name ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  // Held here, not in the review step: placing the order empties the cart,
  // and the confirmation must survive that.
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Check the stored cart against the live catalog once it has loaded.
  useEffect(() => {
    if (!hydrated || !category || checked) return;
    const index = new Map<number, CategoryTreeService>();
    for (const s of [...category.services, ...category.groups.flatMap((g) => g.services)]) index.set(s.serviceId, s);
    const { lines, removed, repriced } = reconcileLines(cart.lines, (serviceId, variantId) => {
      const service = index.get(serviceId);
      if (!service) return null;
      return {
        service,
        variant: variantId != null ? (service.variants.find((v) => v.variantId === variantId) ?? null) : null,
      };
    });
    if (removed.length || repriced.length) {
      update({ lines });
      const parts = [
        removed.length ? `${removed.join(", ")} left your cart (no longer available)` : "",
        repriced.length ? `the price of ${repriced.join(", ")} changed` : "",
      ].filter(Boolean);
      queueMicrotask(() => setNotice(`Heads up: ${parts.join("; ")}.`));
    }
    queueMicrotask(() => setChecked(true));
  }, [hydrated, category, cart.lines, checked, update]);

  const goTo = useCallback(
    (step: Step) => {
      const base = `/booking/cart?category=${categoryId}`;
      router.push(step === "slot" ? base : `${base}&step=${step}`);
    },
    [router, categoryId],
  );
  const backToCategory = useCallback(() => router.push(`/category/${categoryId}`), [router, categoryId]);

  if (outcome) {
    return (
      <StorefrontShell>
        <Done outcome={outcome} backToCategory={backToCategory} />
      </StorefrontShell>
    );
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return <Message title="Nothing to book" text="Open a category and add packages to your cart first." href="/" link="Back to home" />;
  }
  if (!hydrated || tree.isLoading || (category && !checked)) {
    return (
      <StorefrontShell>
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </StorefrontShell>
    );
  }
  if (tree.isError) {
    return (
      <Message
        title="Something went wrong"
        text={`We couldn't load the catalog (${messageOf(tree.error, "network error")}). Your cart is safe; try again.`}
        action={{ label: "Try again", onClick: () => void tree.refetch() }}
        href={`/category/${categoryId}`}
        link="Back to the category"
      />
    );
  }
  if (!category) {
    return <Message title="Category not found" text="This category doesn't exist any more." href="/" link="Back to home" />;
  }
  if (!cart.lines.length) {
    return (
      <Message
        title="Your cart is empty"
        text={notice ?? "Add the packages you need, then come back here to book them together."}
        href={`/category/${categoryId}`}
        link={`Browse ${category.name}`}
      />
    );
  }

  // A later step needs what earlier steps produce.
  const slotChosen = !!cart.date && !!windowById(cart.windowId);
  const step: Step =
    requested !== "slot" && !slotChosen ? "slot" : requested === "review" && !cart.address ? "address" : requested;
  const props: StepCommon = { cart, update, setQuantity, goTo, backToCategory, onDone: setOutcome };

  return (
    <StorefrontShell>
      {notice ? (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-rc-yellow-deep/30 bg-rc-yellow-tint/50 px-4 py-3 text-sm text-gray-800"
          >
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-gray-500">
              ✕
            </button>
          </div>
        </div>
      ) : null}
      {step === "slot" ? <StepSlot {...props} /> : step === "address" ? <StepCartAddress {...props} /> : <StepCartReview {...props} />}
    </StorefrontShell>
  );
}

/* -------------------------------- pieces -------------------------------- */

function Message({
  title,
  text,
  href,
  link,
  action,
}: {
  title: string;
  text: string;
  href: string;
  link: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <StorefrontShell>
      <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-2 text-gray-500">{text}</p>
        <div className="mt-6 flex gap-3">
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              {action.label}
            </button>
          ) : null}
          <Link
            href={href}
            className="inline-flex items-center rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            {link}
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}

function lineLabel(l: CartLine): string {
  return l.variantName ? `${l.name} (${l.variantName})` : l.name;
}

function whenText(cart: CleaningCart): string {
  const w = windowById(cart.windowId);
  if (!cart.date || !w) return "Not chosen";
  return `${fmtDateLong(cart.date)}, ${w.label} ${fmtTime(w.start)} to ${fmtTime(w.end)}`;
}

/** The order summary on the right: lines, bill, the step's action. */
function CartSidebar({
  cart,
  coupon,
  details,
  action,
  note,
  onEdit,
}: {
  cart: CleaningCart;
  coupon?: CustomerCoupon | null;
  details?: { label: string; value: string }[];
  action: React.ReactNode;
  note?: React.ReactNode;
  onEdit: () => void;
}) {
  const bill = computeCartBill(cart.lines, coupon ?? null);
  const items = cart.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-bold">{cart.categoryName || "Your cart"}</h2>
          <p className="m-0 mt-0.5 text-sm text-gray-500">
            {items} item{items === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton onClick={onEdit}>Edit cart</LinkButton>
      </div>
      <ul className="m-0 mt-4 list-none space-y-2 border-t border-gray-100 p-0 pt-4">
        {cart.lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 text-gray-700">
              {lineLabel(l)}
              {l.quantity > 1 ? <span className="text-gray-500"> × {l.quantity}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatInr(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>
      {details?.length ? (
        <dl className="m-0 mt-4 grid gap-1.5 border-t border-gray-100 pt-4">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-gray-500">{d.label}</dt>
              <dd className="m-0 text-right font-medium text-gray-900">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <dl className="m-0 mt-4 grid gap-2 border-t border-gray-100 pt-4">
        <BillRow label="Item total" value={formatInr(bill.subtotal)} />
        {coupon && bill.couponSaving > 0 ? (
          <BillRow label={`Coupon ${coupon.code}`} value={`−${formatInr(bill.couponSaving)}`} tone="discount" />
        ) : null}
        <BillRow label="Taxes (18%)" value={formatInr(bill.tax)} />
        <BillRow label="Total" value={formatInr(bill.total)} tone="total" />
      </dl>
      <div className="mt-5 hidden lg:block">{action}</div>
      {note ? <p className="m-0 mt-3 text-center text-xs text-gray-500">{note}</p> : null}
    </Card>
  );
}

const CRUMB_HOME = { label: "Home", href: "/" };

/* ------------------------------ step 1: slot ---------------------------- */

function StepSlot({ cart, update, goTo, backToCategory }: StepCommon) {
  const clock = useMemo(() => clockNow(), []);
  const days = useMemo(() => getDays(), []);
  const bookableDays = days.filter((d) => ARRIVAL_WINDOWS.some((w) => windowOpen(d.value, w, clock)));
  // Derived, never trusted from storage: the stored day may have passed.
  const date =
    cart.date && bookableDays.some((d) => d.value === cart.date) ? cart.date : firstOpenDay(days, clock);
  const chosen = windowById(cart.windowId);
  const windowValid = !!date && !!chosen && windowOpen(date, chosen, clock);
  const bill = computeCartBill(cart.lines, null);

  const next = () => {
    if (!date || !windowValid) return;
    update({ date });
    goTo("address");
  };
  const action = (
    <PrimaryButton onClick={next} disabled={!windowValid} wide>
      Next: address
    </PrimaryButton>
  );

  return (
    <WizardLayout
      current={0}
      title="Book your deep clean"
      crumbs={[CRUMB_HOME, { label: cart.categoryName || "Category", onClick: backToCategory }, { label: "Date & time" }]}
      sidebar={
        <CartSidebar
          cart={cart}
          onEdit={backToCategory}
          details={[{ label: "Arrival", value: windowValid ? whenText({ ...cart, date }) : "Not chosen" }]}
          action={action}
          note="Taxes included in the total. You choose how to pay at the last step."
        />
      }
      bar={{ total: formatInr(bill.total), note: "taxes included", action }}
    >
      <Card className="p-5 sm:p-6">
        <SectionTitle note="Bookings open up to a week ahead.">Choose a date</SectionTitle>
        {bookableDays.length === 0 ? (
          <Hint error>No dates are open right now. Please try again later.</Hint>
        ) : (
          <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-3 sm:px-0" role="radiogroup" aria-label="Date">
            {days.map((d, i) => {
              const selected = d.value === date;
              const open = bookableDays.some((b) => b.value === d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={fmtDateLong(d.value)}
                  disabled={!open}
                  onClick={() => update({ date: d.value })}
                  className={`flex h-19.5 w-17 shrink-0 flex-col items-center justify-center gap-0.75 rounded-2xl border text-gray-900 transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${
                    selected ? "border-rc-yellow bg-rc-yellow" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className={`text-[11px] uppercase tracking-wide ${selected ? "text-gray-700" : "text-gray-400"}`}>
                    {d.weekday}
                  </span>
                  <span className="text-[22px] font-bold leading-none tabular-nums">{d.day}</span>
                  <span className={`min-h-3.25 text-[10.5px] ${selected ? "text-gray-700" : "text-gray-400"}`}>
                    {i === 0 || d.day === "1" ? monthShort(d.value) : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle note="The crew arrives within the window you pick.">Arrival time</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Arrival window">
          {ARRIVAL_WINDOWS.map((w) => {
            const open = !!date && windowOpen(date, w, clock);
            return (
              <ChoiceCard
                key={w.id}
                selected={cart.windowId === w.id && open}
                disabled={!open}
                onSelect={() => update({ windowId: w.id, date: date ?? cart.date })}
                title={w.label}
                lines={`${fmtTime(w.start)} to ${fmtTime(w.end)}`}
                meta={open ? undefined : "Not available for this day"}
              />
            );
          })}
        </div>
        {cart.windowId && !windowValid ? (
          <Hint error>That arrival time has passed for this day. Pick another.</Hint>
        ) : null}
      </Card>
    </WizardLayout>
  );
}

/* ----------------------------- step 2: address -------------------------- */

function useRequireLogin(categoryId: number, step: Step) {
  const router = useRouter();
  const auth = useCustomerAuth();
  const loginUrl = `/account/login?redirect=${encodeURIComponent(`/booking/cart?category=${categoryId}&step=${step}`)}`;
  useEffect(() => {
    if (!auth.isHydrating && !auth.isLoggedIn) router.replace(loginUrl);
  }, [auth.isHydrating, auth.isLoggedIn, router, loginUrl]);
  return { ...auth, loginUrl };
}

function StepCartAddress({ cart, update, goTo, backToCategory }: StepCommon) {
  const { isLoggedIn, isHydrating } = useRequireLogin(cart.categoryId, "address");
  const book = useAddressBook(cart.address);
  const { selected } = book;
  const canContinue = !!selected && hasPin(selected);
  const bill = computeCartBill(cart.lines, null);

  const next = () => {
    if (!selected || !hasPin(selected)) return;
    update({ address: selected });
    goTo("review");
  };
  const action = (
    <PrimaryButton onClick={next} disabled={!canContinue} wide>
      Next: review
    </PrimaryButton>
  );

  return (
    <WizardLayout
      current={1}
      title="Book your deep clean"
      crumbs={[
        CRUMB_HOME,
        { label: cart.categoryName || "Category", onClick: backToCategory },
        { label: "Date & time", onClick: () => goTo("slot") },
        { label: "Address" },
      ]}
      sidebar={
        <CartSidebar
          cart={cart}
          onEdit={backToCategory}
          details={[
            { label: "Arrival", value: whenText(cart) },
            ...(selected ? [{ label: "Address", value: `${selected.label}, ${selected.city}` }] : []),
          ]}
          action={action}
          note={canContinue ? "Taxes included." : "Pick an address with a map pin to continue."}
        />
      }
      bar={{ total: formatInr(bill.total), note: whenText(cart), action }}
    >
      {isHydrating || !isLoggedIn ? (
        <div className="flex justify-center py-16 text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      ) : (
        <AddressPicker
          book={book}
          noun="crew"
          heading="Where should the crew come?"
          onSelect={(address) => update({ address })}
        />
      )}
    </WizardLayout>
  );
}

/* ------------------------------ step 3: review -------------------------- */

interface Outcome {
  booked: { label: string; id: number }[];
  failed: { label: string; reason: string }[];
  mode: PaymentMode;
  total: number;
  /** Arrival text, captured before the cart is cleared. */
  when: string;
  /** Online payment was chosen but didn't complete: why. */
  paymentProblem: string | null;
}

function StepCartReview({ cart, update, setQuantity, goTo, backToCategory, onDone }: StepCommon) {
  const { user, isLoggedIn, isHydrating, loginUrl } = useRequireLogin(cart.categoryId, "review");
  const router = useRouter();

  /* coupons: same endpoints and rules as the hourly review step */
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [applied, setApplied] = useState<CustomerCoupon | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    couponsApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setCoupons(list);
        const current = list.find((c) => c.isApplied);
        if (current) setApplied(current);
      })
      .catch(() => {
        // Coupons are optional: the booking works without them.
        if (!cancelled) setCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      setApplied(await couponsApi.apply(trimmed));
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

  const payment = cart.paymentMode;
  const bill = computeCartBill(cart.lines, applied);
  // Bookings are created "pay after the job" first (payment follows, priced
  // by the server), and the server refuses an online-only coupon on those.
  const couponNeedsPrepay = !!applied?.prepaidOnly;
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    if (!user?.id) return router.replace(loginUrl);
    if (!cart.address) return goTo("address");
    const w = windowById(cart.windowId);
    if (!cart.date || !w || !windowOpen(cart.date, w, clockNow())) {
      setError("That arrival time has passed. Pick a new one.");
      return goTo("slot");
    }
    if (!payment) return setError("Choose a payment method.");
    if (couponNeedsPrepay) {
      return setError(
        `Coupon ${applied?.code} only works when paying online at booking, which the cart doesn't support yet. Remove it to continue.`,
      );
    }

    setPlacing(true);
    const when = whenText(cart);
    try {
      const lines = cart.lines;
      // Created "pay after the job"; paying online follows, priced by the
      // server from these bookings, so an unpaid booking never reads as paid.
      const payloads = buildCartPayloads({ ...cart, paymentMode: "COD" }, Number(user.id), applied);

      // One booking per line. Keep going after a failure so one bad line
      // doesn't block the others, and report exactly what happened.
      const booked: Outcome["booked"] = [];
      const failed: Outcome["failed"] = [];
      const bookedKeys = new Set<string>();
      // What the bookings that went through cost, GST included (the coupon's
      // saving sits on its own line).
      let bookedTotal = 0;
      const lineTotal = (i: number) =>
        round2(bill.lineBases[i] * (1 + TAX_RATE) - (i === bill.couponLine ? bill.couponSaving : 0));
      for (let i = 0; i < payloads.length; i++) {
        try {
          const result = await bookingApi.create(payloads[i]);
          booked.push({
            label: `${lineLabel(lines[i])}${lines[i].quantity > 1 ? ` × ${lines[i].quantity}` : ""}`,
            id: result.bookingId,
          });
          bookedKeys.add(lines[i].key);
          bookedTotal += lineTotal(i);
        } catch (e) {
          failed.push({ label: lineLabel(lines[i]), reason: messageOf(e, "Booking failed.") });
        }
      }

      // Leave only what didn't book, so trying again won't double-book.
      update(
        failed.length
          ? { lines: lines.filter((l) => !bookedKeys.has(l.key)) }
          : { lines: [], date: null, windowId: null, paymentMode: null },
      );
      if (!booked.length) {
        setError(`We couldn't place the booking: ${failed.map((f) => `${f.label}: ${f.reason}`).join("; ")}`);
        return;
      }

      // Pay online for what booked: the server prices the order from those
      // bookings and re-checks the captured amount before marking them paid.
      let mode: PaymentMode = "COD";
      let total = round2(bookedTotal);
      let paymentProblem: string | null = null;
      if (payment === "RAZORPAY") {
        try {
          if (!(await loadRazorpayScript())) throw new Error("Could not load the payment gateway.");
          const order = await paymentsApi.createBookingOrder(Number(user.id), booked.map((b) => b.id));
          if (!order?.id || !order?.keyId) throw new Error("Could not start the payment.");
          const signature = await openRazorpay(
            order,
            { name: user.name ?? undefined, email: user.email ?? undefined, contact: user.mobile ?? user.phone ?? undefined },
            `${cart.categoryName}, ${fmtDateLong(cart.date)}`,
          );
          await paymentsApi.confirmBookingPayment({ ...signature, userId: Number(user.id), bookingIds: order.bookingIds });
          mode = "RAZORPAY";
          total = order.payableAmount;
        } catch (e) {
          paymentProblem = messageOf(e, "The payment did not go through.");
        }
      }
      onDone({ booked, failed, mode, total, when, paymentProblem });
      window.scrollTo(0, 0);
    } catch (e) {
      setError(messageOf(e, "Booking failed. Please try again."));
    } finally {
      setPlacing(false);
    }
  };

  const address = cart.address;
  const addressLine = address
    ? [address.address, `${address.city}${address.zipCode ? ` ${address.zipCode}` : ""}`].filter(Boolean).join(", ")
    : "";
  const payments: { id: PaymentMode; name: string; note: string }[] = [
    { id: "RAZORPAY", name: "Pay online", note: "UPI, cards and netbanking" },
    { id: "COD", name: "Pay after the job", note: "Cash or UPI to the crew" },
  ];
  const unusedCoupons = coupons.filter((c) => !c.isUsed && c.couponId !== applied?.couponId);

  const action = (
    <div className="space-y-2">
      <p className="text-center text-xs text-gray-400">
        By confirming, you agree to our{" "}
        <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-600">
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a href="/refund-cancellation-policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-600">
          Refund &amp; Cancellation Policy
        </a>
        .
      </p>
      <PrimaryButton onClick={confirm} disabled={!payment || !address || placing} wide>
        {placing ? <SpinnerIcon className="h-5 w-5" /> : `Confirm ${cart.lines.length > 1 ? `${cart.lines.length} bookings` : "booking"}`}
      </PrimaryButton>
    </div>
  );

  return (
    <WizardLayout
      current={2}
      title="Book your deep clean"
      crumbs={[
        CRUMB_HOME,
        { label: cart.categoryName || "Category", onClick: backToCategory },
        { label: "Date & time", onClick: () => goTo("slot") },
        { label: "Address", onClick: () => goTo("address") },
        { label: "Review" },
      ]}
      sidebar={
        <CartSidebar
          cart={cart}
          coupon={applied}
          onEdit={backToCategory}
          details={[
            { label: "Arrival", value: whenText(cart) },
            { label: "Payment", value: payments.find((p) => p.id === payment)?.name ?? "Not chosen" },
          ]}
          action={action}
          note={error ? <span className="font-medium text-rc-red">{error}</span> : payment ? "Taxes included." : "Choose a payment method to confirm."}
        />
      }
      bar={{ total: formatInr(bill.total), note: payment ? "amount payable, taxes included" : "choose a payment method", action }}
    >
      {isHydrating || !isLoggedIn ? (
        <div className="flex justify-center py-16 text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle note="Each item is booked separately, for the same day and arrival time.">Your items</SectionTitle>
              <LinkButton onClick={backToCategory}>Add more</LinkButton>
            </div>
            <ul className="m-0 mt-4 list-none divide-y divide-gray-100 p-0">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-semibold">{l.name}</p>
                    <p className="m-0 text-xs text-gray-500">
                      {[l.variantName, l.subtitle].filter(Boolean).join(" · ") || " "}
                    </p>
                  </div>
                  <AddControl quantity={l.quantity} onAdd={() => setQuantity(l.key, 1)} onChange={(n) => setQuantity(l.key, n)} label={lineLabel(l)} compact />
                  <p className="m-0 w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {l.isStartingPrice ? <span className="block text-[10px] font-normal text-gray-500">from</span> : null}
                    {formatInr(l.unitPrice * l.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            {cart.lines.some((l) => l.isStartingPrice) ? (
              <p className="m-0 mt-2 text-xs text-gray-500">
                &quot;From&quot; prices are the starting price for that size; the crew confirms the final price on site.
              </p>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gray-50 text-rc-yellow-deep" aria-hidden>
                <PinGlyph className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-base font-bold">{whenText(cart)}</h2>
                <p className="m-0 mt-1 text-sm text-gray-600">
                  {address ? `${address.label}${address.restaurantName ? `, ${address.restaurantName}` : ""}: ${addressLine}` : "No address yet"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <LinkButton onClick={() => goTo("slot")}>Change time</LinkButton>
                <LinkButton onClick={() => goTo("address")}>Change address</LinkButton>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle>Coupon</SectionTitle>
            {applied ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#E6F4EA] px-4 py-3 text-sm font-semibold text-rc-green">
                <span>
                  {applied.code} applied
                  {applied.discountType === "FLAT_TOTAL" && applied.flatTotal != null
                    ? `, ${formatInr(applied.flatTotal)} for one item`
                    : applied.discountPercent
                      ? `, ${applied.discountPercent}% off one item`
                      : ""}
                </span>
                <button type="button" onClick={removeCoupon} disabled={couponBusy} className="text-sm font-semibold text-rc-yellow-deep hover:underline disabled:opacity-50">
                  Remove
                </button>
              </div>
            ) : (
              <form
                className="mt-4 flex max-w-md gap-2"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void applyCoupon(couponInput);
                }}
              >
                <label htmlFor="cart-coupon" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="cart-coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputClass} min-w-0 flex-1 uppercase placeholder:normal-case`}
                />
                <SecondaryButton type="submit" disabled={couponBusy || !couponInput.trim()}>
                  {couponBusy ? "Applying…" : "Apply"}
                </SecondaryButton>
              </form>
            )}
            {couponError ? <Hint error>{couponError}</Hint> : null}
            {applied && cart.lines.length > 1 ? (
              <Hint>The coupon applies to {lineLabel(cart.lines[bill.couponLine])}.</Hint>
            ) : null}
            {!applied && unusedCoupons.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {unusedCoupons.map((c) => (
                  <button
                    key={c.couponId}
                    type="button"
                    disabled={couponBusy}
                    onClick={() => applyCoupon(c.code)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-rc-yellow-deep bg-rc-yellow-tint/30 px-3.5 py-2.5 text-left transition hover:bg-rc-yellow-tint/60 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{c.code}</span>
                      <span className="block text-xs text-gray-500">
                        {c.description || `${c.discountPercent}% off`}
                        {c.prepaidOnly ? " (online payment only)" : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-rc-yellow-deep">Apply</span>
                  </button>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle>Payment method</SectionTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              {payments.map((m) => (
                <ChoiceCard key={m.id} selected={payment === m.id} onSelect={() => update({ paymentMode: m.id })} title={m.name} meta={m.note} />
              ))}
            </div>
            {couponNeedsPrepay ? <Hint error>Coupon {applied?.code} only works with online payment.</Hint> : null}
            {error ? <Hint error>{error}</Hint> : null}
          </Card>
        </>
      )}
    </WizardLayout>
  );
}

function Done({ outcome, backToCategory }: { outcome: Outcome; backToCategory: () => void }) {
  const partial = outcome.failed.length > 0;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Card className="mx-auto max-w-xl p-8 text-center sm:p-10">
        <div
          className={`mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full text-white ${partial ? "bg-rc-yellow-deep" : "bg-rc-green"}`}
        >
          {partial ? <span className="text-4xl font-bold">!</span> : <CheckGlyph className="h-10 w-10" />}
        </div>
        <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">
          {partial ? (outcome.booked.length ? "Partly booked" : "Booking needs attention") : "Booking confirmed"}
        </h1>
        {outcome.booked.length ? (
          <ul className="m-0 mt-5 list-none space-y-1 p-0 text-left text-sm">
            {outcome.booked.map((b) => (
              <li key={b.id} className="flex justify-between gap-3">
                <span className="text-gray-700">{b.label}</span>
                <strong className="text-gray-900">#{b.id}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        {partial ? (
          <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-left text-sm text-rc-red" role="alert">
            <p className="m-0 font-semibold">Not booked:</p>
            <ul className="m-0 mt-1 list-disc pl-5">
              {outcome.failed.map((f) => (
                <li key={f.label}>
                  {f.label}: {f.reason}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-2 text-gray-700">They&apos;re still in your cart: go back and try them again.</p>
          </div>
        ) : null}
        {outcome.paymentProblem ? (
          <p className="m-0 mt-5 rounded-xl bg-rc-yellow-tint/60 px-4 py-3 text-left text-sm text-gray-800" role="alert">
            Payment didn&apos;t go through ({outcome.paymentProblem}). Your bookings are confirmed to pay after the job; you
            can also pay online any time from My orders.
          </p>
        ) : null}
        <p className="m-0 mt-5 text-[15px] leading-relaxed text-gray-600">
          {outcome.when}. {formatInr(outcome.total)} {outcome.mode === "COD" ? "to pay after the job." : "paid online."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/account/orders"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-rc-yellow px-7 text-sm font-bold text-gray-900 transition hover:brightness-95"
          >
            View my orders
          </Link>
          <button
            type="button"
            onClick={backToCategory}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-7 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
          >
            {partial ? "Back to the cart" : "Book more"}
          </button>
        </div>
      </Card>
    </main>
  );
}
