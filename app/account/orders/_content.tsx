"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { useCart } from "@/src/lib/cart";
import { bookingApi, queryKeys, type BookingRecord } from "@/src/api/api";
import { openInvoice } from "@/src/lib/invoice";
import { SpinnerIcon } from "@/src/components/icons";

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
      setNotice("Unable to repeat this order.");
    } finally {
      setRepeatingId(null);
    }
  };

  const bookings = bookingsQuery.data?.bookings ?? [];
  const filtered = bookings.filter((b) =>
    tab === "ACTIVE" ? !isPastStatus(b.status) : isPastStatus(b.status),
  );

  if (isHydrating || !isLoggedIn) {
    return (
      <div data-theme="light" className={embedded ? "" : "min-h-dvh bg-gray-50"}>
        {!embedded && <LandingHeader search="" onSearchChange={() => {}} />}
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </div>
    );
  }

  return (
    <div data-theme="light" className={embedded ? "" : "min-h-dvh bg-gray-50"}>
      {!embedded && <LandingHeader search="" onSearchChange={() => {}} />}

      <main className={embedded ? "" : "mx-auto max-w-3xl px-4 py-8 sm:px-6"}>
        <div className="mb-5 flex items-center gap-3">
          {!embedded && (
            <Link href="/account" className="text-2xl leading-none text-gray-900" aria-label="Back">
              ←
            </Link>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">My Orders</h1>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex border-b border-gray-200">
          {(["ACTIVE", "PAST"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 border-b-2 pb-3 text-sm font-semibold transition ${
                tab === t
                  ? "border-indigo-600 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "ACTIVE" ? "Active Orders" : "Past Orders"}
            </button>
          ))}
        </div>

        {notice ? (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{notice}</p>
        ) : null}

        {bookingsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <SpinnerIcon className="h-7 w-7 text-indigo-600" />
          </div>
        ) : bookingsQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-sm text-gray-500">Couldn&apos;t load your bookings.</p>
            <button
              onClick={() => bookingsQuery.refetch()}
              className="mt-4 rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-5xl">🧾</p>
            <p className="mt-3 text-sm text-gray-500">
              No {tab.toLowerCase()} orders yet.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Browse services
            </Link>
          </div>
        ) : ( 
          <div className="space-y-4"> 
            {filtered.map((b) => {
              const id = Number(b.bookingId ?? b.id);
              if (!id) return null;
              const serviceName = b.service?.name || b.serviceName || "Service";
              const variantName = b.variant?.name || b.variantName || "Variant";
              const step = progressStep(b.status);
              const cancelled = b.status?.toLowerCase().includes("cancel");
              const completed = statusLabel(b.status) === "Completed";
              const proName = b.professional?.user?.name?.trim();
              const proMobile = b.professional?.user?.mobile?.trim();
              const accepted = isAccepted(b.status) && Boolean(b.professionalId || b.professional);
              return (
                <div
                  key={id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  {/* Top */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
                        👨‍🍳
                      </span>
                      <p className="text-base font-bold text-gray-900">{serviceName}</p>
                    </div>
                    <div className="text-right">
                      {tab === "PAST" && (
                        <button
                          onClick={() => handleRepeat(b)}
                          disabled={repeatingId === id}
                          className="mb-1.5 inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {repeatingId === id ? (
                            <SpinnerIcon className="h-3 w-3" />
                          ) : (
                            "Repeat Order"
                          )}
                        </button>
                      )}
                      <p className="text-xs text-gray-400">Order ID: #{id}</p>
                      <p className="text-xs text-gray-400">
                        {b.bookingDate
                          ? new Date(b.bookingDate).toLocaleDateString("en-GB")
                          : ""}{" "}
                        {b.startTime || ""}
                      </p>
                    </div>
                  </div>

                  <div className="my-4 border-t border-dashed border-gray-200" />

                  {/* Middle */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Total items: 1</p>
                    {tab === "ACTIVE" ? (
                      <button
                        onClick={() => {
                          setCancelChoice(null);
                          setCancelNote("");
                          setCancelTarget(id);
                        }}
                        disabled={cancelMutation.isPending}
                        className="rounded-md border border-gray-300 bg-gray-50 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-gray-100 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span
                        className={`text-xs font-bold ${cancelled ? "text-red-600" : "text-gray-900"}`}
                      >
                        {statusLabel(b.status)}
                      </span>
                    )}
                  </div>
                  <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
                    <span>{variantName}</span>
                    <span className="font-medium">x 1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-gray-600">
                      💳 Payment: {b.paymentMode || "Cash on Delivery"}
                    </span>
                    <span className="text-base font-bold text-indigo-700">
                      {inr(b.totalAmount || 0)}
                    </span>
                  </div>

                  {/* Invoice — only for completed orders (incl. older ones). */}
                  {completed && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() =>
                          openInvoice(b, {
                            name: user?.name,
                            email: user?.email,
                            mobile: user?.mobile,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                      >
                        🧾 Download Invoice
                      </button>
                    </div>
                  )}

                  {/* Who accepted the booking */}
                  {accepted && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                        {(proName ?? "P").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-green-700">
                          {statusLabel(b.status) === "Completed"
                            ? "Service completed by"
                            : "Accepted by"}
                        </p>
                        <p className="truncate text-sm font-bold text-gray-900">
                          {proName || `Professional #${b.professionalId ?? ""}`}
                        </p>
                      </div>
                      {proMobile ? (
                        <a
                          href={`tel:${proMobile}`}
                          className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          📞 Call
                        </a>
                      ) : null}
                    </div>
                  )}

                  {/* Start OTP — shown after a professional accepts so the
                      customer can read it out to start the service. */}
                  {shouldShowStartOtp(b) && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                        🔑 Start OTP
                      </p>
                      <p className="mt-1 text-3xl font-bold tracking-[0.35em] text-gray-900">
                        {String(b.otp)}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">
                        Share this code with the professional to start the service
                      </p>
                    </div>
                  )}

                  {/* Progress */}
                  {showProgress(b.status) && (
                    <>
                      <div className="my-4 border-t border-dashed border-gray-200" />
                      <div className="flex items-center justify-center">
                        {PROGRESS_LABELS.map((_, i) => {
                          const n = i + 1;
                          const active = n <= step;
                          return (
                            <div key={n} className="flex items-center">
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
                                  active
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-gray-300 bg-white text-gray-400"
                                }`}
                              >
                                {n}
                              </span>
                              {n < 4 && (
                                <span
                                  className={`mx-1 h-0.5 w-8 sm:w-12 ${
                                    n < step ? "bg-indigo-600" : "bg-gray-300"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex justify-between px-1">
                        {PROGRESS_LABELS.map((label, i) => (
                          <span
                            key={label}
                            className={`flex-1 text-center text-[10px] font-medium ${
                              i + 1 <= step ? "text-indigo-600" : "text-gray-400"
                            }`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel: irreversible, so confirm and capture WHY in one step. */}
      {cancelTarget != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setCancelTarget(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">Cancel this booking?</h3>
            <p className="mt-1 text-sm text-gray-500">
              This cannot be undone. Please pick a reason so we can improve.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {CANCEL_REASONS.map((r) => {
                const on = cancelChoice === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCancelChoice(r)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      on
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder={
                cancelChoice === "Other" ? "Tell us what happened" : "Anything to add? (optional)"
              }
              className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                No, keep it
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelReasonValid || cancelMutation.isPending}
                title={cancelReasonValid ? undefined : "Pick a reason first"}
                className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-45"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!embedded && <Footer />}
    </div>
  );
}
