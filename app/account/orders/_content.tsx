"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { useCart } from "@/src/lib/cart";
import { bookingApi, queryKeys, type BookingRecord } from "@/src/api/api";
import { openInvoice } from "@/src/lib/invoice";
import { SpinnerIcon } from "@/src/components/icons";
import { SHOW_BOOKING_ANIMATIONS } from "@/src/lib/features";
import { bookingActivity } from "@/src/lib/booking-activity";
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check,
  ChefHat, Clock3, CreditCard, FileText, KeyRound, Phone,
  RotateCcw, ShoppingBag, X,
} from "lucide-react";

const BookingActivityPanel = dynamic(() => import("@/src/components/orders/booking-activity").then((module) => module.BookingActivityPanel));
const WaitingForPartner = dynamic(() => import("@/src/components/orders/booking-activity").then((module) => module.WaitingForPartner));

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-yellow focus-visible:ring-offset-2";

function bookingDateLabel(date?: string): string {
  if (!date) return "Date to be confirmed";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function inr(n: number): string {
  return `₹ ${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const normalizeStatus = (status?: string) =>
  status?.toLowerCase().trim().replace(/[_\s]+/g, "-") || "";

const isPastStatus = (status?: string) =>
  /cancel|reject|complete|finished|done/.test(normalizeStatus(status));

const PROGRESS_LABELS = ["Confirmed", "Accepted", "On the way", "Completed"];

function progressStep(status?: string): number {
  const s = normalizeStatus(status);
  if (/complete|finished|done/.test(s)) return 4;
  if (/on-the-way|started|in-progress|inprogress|arrived|progress/.test(s)) return 3;
  if (/accepted/.test(s)) return 2;
  if (/pending|confirmed|assigned/.test(s)) return 1;
  return 1;
}

const showProgress = (status?: string) =>
  /pending|confirmed|assigned|accepted|on-the-way|started|in-progress|inprogress|arrived|progress|complete|finished|done/.test(
    normalizeStatus(status),
  );

/** A booking is "accepted by a professional" once it's past the pending stage. */
const isAccepted = (status?: string) =>
  /accepted|on-the-way|started|in-progress|inprogress|arrived|progress|complete|finished|done/.test(
    normalizeStatus(status),
  );

/** Show the start OTP once a professional has accepted, and hide it the
 *  moment the service starts / finishes (same rule as the customer app). */
const shouldShowStartOtp = (b: BookingRecord) =>
  normalizeStatus(b.status) === "accepted" && !b.otpVerified && b.otp != null && b.otp !== "";

/** Friendly label for the current status. */
function statusLabel(status?: string): string {
  const s = normalizeStatus(status);
  if (/on-the-way/.test(s)) return "On the way";
  if (/in-progress|inprogress|started|progress|arrived/.test(s)) return "In progress";
  if (/complete|finished|done/.test(s)) return "Completed";
  if (/accepted/.test(s)) return "Accepted";
  if (/cancel/.test(s)) return "Cancelled";
  if (/reject/.test(s)) return "Rejected";
  if (/assigned/.test(s)) return "Assigned";
  if (/confirmed/.test(s)) return "Confirmed";
  return "Pending";
}

// Preset cancellation reasons, mirroring the customer app. One must be chosen —
// a cancellation with no explanation tells operations nothing.
const CANCEL_REASONS = [
  "Booked by mistake",
  "Price is too high",
  "Change of plan",
  "Booked wrong date or time",
  "Found a better option",
  "Service no longer needed",
  "Other",
] as const;

/**
 * The orders list. On its own page it brings the site header and footer;
 * `embedded` drops those so the account page can show it in its right pane.
 */
export function MyBookingsContent({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoggedIn, isHydrating } = useCustomerAuth();
  const { addItemAsync } = useCart();

  const [tab, setTab] = useState<"ACTIVE" | "PAST">("ACTIVE");
  const [notice, setNotice] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace("/account/login?redirect=/account/orders");
  }, [isHydrating, isLoggedIn, router]);

  const bookingsQuery = useQuery({
    queryKey: user?.id ? queryKeys.userBookings(user.id) : ["bookings", "user", "none"],
    queryFn: () => bookingApi.listByUser(user!.id),
    enabled: !!user?.id,
    refetchInterval: 10000, // surface professional status changes without a manual refresh
  });

  // Cancelling requires a reason — same presets as the customer app, so
  // cancellations from web and app read the same in the admin panel.
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelChoice, setCancelChoice] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const cancelTitleId = useId();
  const cancelDescriptionId = useId();

  useEffect(() => {
    const dialog = cancelDialogRef.current;
    if (!dialog) return;
    if (cancelTarget != null && !dialog.open) dialog.showModal();
    if (cancelTarget == null && dialog.open) dialog.close();
  }, [cancelTarget]);

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason: string }) =>
      bookingApi.cancel(bookingId, reason),
    onSuccess: () => {
      setCancelTarget(null);
      setTab("PAST");
      if (user?.id) queryClient.invalidateQueries({ queryKey: queryKeys.userBookings(user.id) });
    },
    onError: (e) => {
      setCancelTarget(null);
      setNotice(e instanceof Error ? e.message : "Unable to cancel booking.");
    },
  });

  // "Other" carries only the typed note, so it must not be empty.
  const cancelNoteTrimmed = cancelNote.trim();
  const cancelReasonValid =
    cancelChoice != null && (cancelChoice !== "Other" || cancelNoteTrimmed.length > 0);

  const confirmCancel = () => {
    if (cancelTarget == null || !cancelReasonValid) return;
    const reason =
      cancelChoice === "Other"
        ? cancelNoteTrimmed
        : cancelNoteTrimmed
          ? `${cancelChoice} — ${cancelNoteTrimmed}`
          : String(cancelChoice);
    cancelMutation.mutate({ bookingId: cancelTarget, reason });
  };

  const handleRepeat = async (b: BookingRecord) => {
    const serviceId = b.serviceId ?? b.service?.serviceId;
    const variantId = b.variantId ?? b.variant?.variantId ?? undefined;
    if (!serviceId) {
      setNotice("Booking is missing a valid service.");
      return;
    }
    setRepeatingId(Number(b.bookingId ?? b.id));
    try {
      await addItemAsync(serviceId, variantId);
      router.push("/checkout");
    } catch {
      setNotice("Unable to repeat this booking.");
    } finally {
      setRepeatingId(null);
    }
  };

  const bookings = bookingsQuery.data?.bookings ?? [];
  const filtered = bookings.filter((b) =>
    tab === "ACTIVE" ? !isPastStatus(b.status) : isPastStatus(b.status),
  );
  const activeCount = bookings.filter((b) => !isPastStatus(b.status)).length;
  const pastCount = bookings.length - activeCount;
  const ContentContainer = embedded ? "section" : "main";

  if (isHydrating || !isLoggedIn) {
    return (
      <div data-theme="light" className={embedded ? "" : "min-h-dvh bg-rc-ground"}>
        {!embedded && <LandingHeader search="" onSearchChange={() => {}} />}
        <div role="status" className="flex h-[60vh] items-center justify-center text-rc-muted">
          <SpinnerIcon className="h-7 w-7" />
          <span className="sr-only">Loading your bookings</span>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="light" className={embedded ? "" : "min-h-dvh bg-rc-ground"}>
      {!embedded && <LandingHeader search="" onSearchChange={() => {}} />}

      <ContentContainer className={embedded ? "min-w-0" : "mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10"}>
        <div className="mb-6 flex items-start gap-3">
          {!embedded && (
            <Link href="/account" className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rc-line bg-white text-rc-ink transition hover:bg-rc-yellow-tint ${focusRing}`} aria-label="Back to account">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-rc-ink sm:text-3xl">My Bookings</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-rc-ink-2">Keep track of your bookings, all in one place.</p>
          </div>
        </div>

        <div className="mb-6 flex gap-1 rounded-2xl border border-rc-line bg-white p-1.5" role="group" aria-label="Filter bookings">
          {(["ACTIVE", "PAST"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors ${focusRing} ${
                tab === t ? "bg-rc-ink text-white" : "text-rc-ink-2 hover:bg-rc-ground"
              }`}
            >
              {t === "ACTIVE" ? "Active Bookings" : "Past Bookings"}
              {bookingsQuery.isSuccess && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums ${tab === t ? "bg-rc-yellow text-rc-ink" : "bg-rc-ground text-rc-ink-2"}`}>
                  {t === "ACTIVE" ? activeCount : pastCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {SHOW_BOOKING_ANIMATIONS && tab === "ACTIVE" && bookingsQuery.isSuccess && (
          <BookingActivityPanel bookings={bookings} restaurantName={typeof user?.restaurantName === "string" ? user.restaurantName : undefined} />
        )}

        {notice && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rc-red/20 bg-rc-red/5 p-4 text-sm text-rc-red">
            <p className="pt-1">{notice}</p>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-rc-red/10 ${focusRing}`}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {bookingsQuery.isLoading ? (
          <div role="status" className="space-y-4">
            <span className="sr-only">Loading your bookings</span>
            {[0, 1].map((n) => (
              <div key={n} aria-hidden="true" className="rounded-2xl border border-rc-line bg-white p-5 motion-safe:animate-pulse sm:p-6">
                <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-rc-ground" /><div className="h-4 w-1/2 rounded bg-rc-ground" /></div>
                <div className="my-6 h-16 rounded-xl bg-rc-ground" />
                <div className="h-12 rounded-xl bg-rc-ground" />
              </div>
            ))}
          </div>
        ) : bookingsQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-rc-line bg-white px-6 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rc-yellow-tint text-rc-ink"><RotateCcw className="h-6 w-6" aria-hidden="true" /></span>
            <h2 className="mt-4 text-lg font-bold text-rc-ink">We couldn&apos;t load your bookings</h2>
            <p className="mt-2 text-sm text-rc-ink-2">Please try again in a moment.</p>
            <button onClick={() => bookingsQuery.refetch()} disabled={bookingsQuery.isFetching} className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-rc-yellow px-5 text-sm font-bold text-rc-ink hover:brightness-95 disabled:opacity-60 ${focusRing}`}>
              {bookingsQuery.isFetching && <SpinnerIcon className="h-4 w-4" />}
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-rc-line bg-white px-6 py-12 text-center sm:py-16">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rc-yellow-tint text-rc-ink"><ShoppingBag className="h-7 w-7" aria-hidden="true" /></span>
            <h2 className="mt-5 text-lg font-bold text-rc-ink">No {tab.toLowerCase()} bookings yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-rc-ink-2">
              {tab === "ACTIVE" ? "Your next booking will appear here, ready to track." : "Your completed and cancelled bookings will appear here."}
            </p>
            <Link href="/" className={`mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-rc-yellow px-5 text-sm font-bold text-rc-ink hover:brightness-95 ${focusRing}`}>
              Browse services <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((b) => {
              const id = Number(b.bookingId ?? b.id);
              if (!id) return null;
              const serviceName = b.service?.name || b.serviceName || "Service";
              const variantName = b.variant?.name || b.variantName || "Variant";
              const step = progressStep(b.status);
              const endedEarly = /cancel|reject/.test(normalizeStatus(b.status));
              const completed = statusLabel(b.status) === "Completed";
              const proName = b.professional?.user?.name?.trim();
              const proMobile = b.professional?.user?.mobile?.trim();
              const accepted = isAccepted(b.status) && Boolean(b.professionalId || b.professional);
              const ServiceIcon = /chef|cook/i.test(serviceName) ? ChefHat : BriefcaseBusiness;
              return (
                <article key={id} id={`booking-${id}`} aria-labelledby={`order-${id}-title`} className="scroll-mt-24 overflow-hidden rounded-2xl border border-rc-line bg-white shadow-[0_2px_8px_rgba(28,26,23,0.03)]">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rc-yellow-tint text-rc-ink sm:h-12 sm:w-12">
                          <ServiceIcon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium text-rc-ink-2">Booking #{id}</p>
                          <h2 id={`order-${id}-title`} className="text-base font-bold leading-snug text-rc-ink sm:text-lg">{serviceName}</h2>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${endedEarly ? "bg-rc-red/10 text-rc-red" : completed ? "bg-rc-green/10 text-rc-green" : "bg-rc-yellow-tint text-rc-ink"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${endedEarly ? "bg-rc-red" : completed ? "bg-rc-green" : "bg-rc-yellow"}`} aria-hidden="true" />
                        {statusLabel(b.status)}
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-rc-ground px-4 py-3">
                      <p className="text-sm font-medium leading-relaxed text-rc-ink-2">{variantName}</p>
                      <span className="shrink-0 rounded-lg border border-rc-line bg-white px-2.5 py-1 text-xs font-semibold text-rc-ink-2">Qty: 1</span>
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-[1.2fr_1fr_auto]">
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-rc-ink-2"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Booking date</dt>
                        <dd className="mt-1.5 text-sm font-semibold text-rc-ink">{bookingDateLabel(b.bookingDate)}</dd>
                        {b.startTime && <dd className="mt-1 flex items-center gap-1.5 text-xs text-rc-ink-2"><Clock3 className="h-3 w-3" aria-hidden="true" />{b.startTime}</dd>}
                      </div>
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-rc-ink-2"><CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Payment method</dt>
                        <dd className="mt-1.5 break-words text-sm font-semibold text-rc-ink">{b.paymentMode || "Cash on Delivery"}</dd>
                      </div>
                      <div className="col-span-2 flex items-center justify-between border-t border-rc-line pt-3 sm:col-span-1 sm:block sm:border-0 sm:pt-0 sm:text-right">
                        <dt className="text-xs text-rc-ink-2">Booking total</dt>
                        <dd className="text-lg font-bold tabular-nums text-rc-ink sm:mt-1">{inr(b.totalAmount || 0)}</dd>
                      </div>
                    </dl>

                    {SHOW_BOOKING_ANIMATIONS && tab === "ACTIVE" && bookingActivity(b) === "waiting" && (
                      <WaitingForPartner />
                    )}

                    {accepted && (
                      <div className="mt-5 flex items-center gap-3 rounded-xl border border-rc-green/15 bg-rc-green/5 p-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rc-green/10 text-sm font-bold text-rc-green">{(proName || "P").slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-rc-ink-2">{completed ? "Service completed by" : "Your professional"}</p>
                          <p className="mt-0.5 truncate text-sm font-bold text-rc-ink">{proName || `Professional #${b.professionalId ?? ""}`}</p>
                        </div>
                        {proMobile && <a href={`tel:${proMobile}`} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-rc-green/20 bg-white px-3 text-xs font-semibold text-rc-green hover:bg-rc-green/5 ${focusRing}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />Call</a>}
                      </div>
                    )}

                    {shouldShowStartOtp(b) && (
                      <div className="mt-4 rounded-xl border border-rc-yellow/30 bg-rc-yellow-tint p-4 text-center">
                        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-rc-ink"><KeyRound className="h-4 w-4" aria-hidden="true" />Start OTP</p>
                        <p className="mt-2 break-all text-3xl font-bold tracking-[0.3em] text-rc-ink">{String(b.otp)}</p>
                        <p className="mt-2 text-xs leading-relaxed text-rc-ink-2">Share this code with the professional to start the service.</p>
                      </div>
                    )}

                    {showProgress(b.status) && (
                      <div className="mt-5 border-t border-rc-line pt-4">
                        <p className="mb-4 text-xs font-semibold text-rc-ink-2">Booking progress</p>
                        <ol aria-label={`Booking ${id} progress`} className="grid grid-cols-4">
                          {PROGRESS_LABELS.map((label, i) => {
                            const n = i + 1;
                            const active = n <= step;
                            const done = n < step || completed;
                            return (
                              <li key={label} aria-current={n === step ? "step" : undefined} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
                                {n < 4 && <span aria-hidden="true" className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-0.5 ${n < step ? "bg-rc-yellow" : "bg-rc-line"}`} />}
                                <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-rc-yellow text-rc-ink" : "border border-rc-line bg-white text-rc-ink-2"} ${n === step && !completed ? "ring-4 ring-rc-yellow/15" : ""}`} aria-hidden="true">
                                  {done ? <Check className="h-4 w-4" /> : n}
                                </span>
                                <span className={`px-1 text-[10px] leading-snug sm:text-xs ${active ? "font-semibold text-rc-ink" : "text-rc-ink-2"}`}>{label}</span>
                                <span className="sr-only">{done ? "Complete" : n === step ? "Current step" : "Upcoming"}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rc-line bg-rc-ground/50 px-4 py-3 sm:px-6">
                    <span className="text-xs text-rc-ink-2">1 service in this booking</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {tab === "ACTIVE" ? (
                        <button onClick={() => { setCancelChoice(null); setCancelNote(""); setCancelTarget(id); }} disabled={cancelMutation.isPending} aria-label={`Cancel booking ${id}`} className={`min-h-11 rounded-full border border-rc-line bg-white px-4 text-xs font-semibold text-rc-red transition hover:border-rc-red/30 hover:bg-rc-red/5 disabled:opacity-60 ${focusRing}`}>
                          Cancel booking
                        </button>
                      ) : (
                        <>
                          {completed && (
                            <button onClick={() => openInvoice(b, { name: user?.name, email: user?.email, mobile: user?.mobile })} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-rc-line bg-white px-3 text-xs font-semibold text-rc-ink transition hover:bg-rc-yellow-tint ${focusRing}`}>
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />Download Invoice
                            </button>
                          )}
                          <button onClick={() => handleRepeat(b)} disabled={repeatingId !== null} aria-label={`Repeat booking ${id}`} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-rc-yellow px-4 text-xs font-bold text-rc-ink transition hover:brightness-95 disabled:opacity-60 ${focusRing}`}>
                            {repeatingId === id ? <SpinnerIcon className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                            {repeatingId === id ? "Adding…" : "Book again"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ContentContainer>

      <dialog
        ref={cancelDialogRef}
        aria-labelledby={cancelTitleId}
        aria-describedby={cancelDescriptionId}
        onCancel={(event) => { if (cancelMutation.isPending) event.preventDefault(); else setCancelTarget(null); }}
        onClick={(event) => { if (event.target === event.currentTarget && !cancelMutation.isPending) setCancelTarget(null); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-rc-line bg-white p-0 text-rc-ink shadow-2xl backdrop:bg-rc-ink/50 backdrop:backdrop-blur-sm"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-rc-ink-2">Booking #{cancelTarget}</p>
              <h2 id={cancelTitleId} className="text-xl font-bold">Cancel this booking?</h2>
            </div>
            <button type="button" onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending} aria-label="Close cancellation dialog" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rc-ink-2 hover:bg-rc-ground disabled:opacity-60 ${focusRing}`}><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <p id={cancelDescriptionId} className="mt-2 text-sm leading-relaxed text-rc-ink-2">This cannot be undone. Please pick a reason so we can improve.</p>
          <fieldset disabled={cancelMutation.isPending} className="mt-5">
            <legend className="mb-2 text-sm font-semibold">Reason for cancellation</legend>
            <div className="space-y-2">
              {CANCEL_REASONS.map((reason) => (
                <label key={reason} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${cancelChoice === reason ? "border-rc-yellow bg-rc-yellow-tint font-medium" : "border-rc-line hover:bg-rc-ground"}`}>
                  <input type="radio" name={`cancel-reason-${cancelTitleId}`} value={reason} checked={cancelChoice === reason} onChange={() => setCancelChoice(reason)} className="h-4 w-4 shrink-0 accent-rc-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-yellow" />
                  {reason}
                </label>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-semibold">{cancelChoice === "Other" ? "Tell us what happened (required)" : "Additional details (optional)"}</span>
              <textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} rows={3} maxLength={300} required={cancelChoice === "Other"} placeholder="Tell us a little more…" className="mt-2 w-full resize-y rounded-xl border border-rc-line px-3 py-2 text-sm outline-none placeholder:text-rc-muted focus:border-rc-yellow focus:ring-2 focus:ring-rc-yellow/20" />
            </label>
          </fieldset>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending} className={`min-h-11 flex-1 rounded-full border border-rc-line px-3 text-sm font-semibold hover:bg-rc-ground disabled:opacity-60 ${focusRing}`}>Keep booking</button>
            <button onClick={confirmCancel} disabled={!cancelReasonValid || cancelMutation.isPending} title={cancelReasonValid ? undefined : "Pick a reason first"} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rc-red px-3 text-sm font-bold text-white hover:brightness-95 disabled:opacity-45 ${focusRing}`}>
              {cancelMutation.isPending && <SpinnerIcon className="h-4 w-4" />}
              {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
            </button>
          </div>
        </div>
      </dialog>

      {!embedded && <Footer />}
    </div>
  );
}
