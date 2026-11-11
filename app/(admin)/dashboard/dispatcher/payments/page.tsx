"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentsAdminApi, queryKeys, type PaymentEventRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "ORPHANED", label: "Paid, not booked" },
  { value: "BOOKING_PAID", label: "Booking paid" },
  { value: "WALLET_CREDITED", label: "Wallet credited" },
  { value: "FAILED", label: "Failed" },
  { value: "ERROR", label: "Errors" },
];

const OUTCOME_LABEL: Record<string, string> = {
  RECORDED: "Waiting for booking",
  BOOKING_PAID: "Booking paid",
  WALLET_CREDITED: "Wallet credited",
  ORPHANED: "Paid, not booked",
  FAILED: "Payment failed",
  NO_ACTION: "No action",
  ERROR: "Error",
  REFUNDED: "Refunded",
  BOOKED_BY_SUPPORT: "Booked by support",
};

const OUTCOME_TONE: Record<string, string> = {
  ORPHANED: "bg-danger/10 text-danger",
  ERROR: "bg-danger/10 text-danger",
  FAILED: "bg-muted text-muted-foreground",
  BOOKING_PAID: "bg-success/10 text-success",
  WALLET_CREDITED: "bg-success/10 text-success",
  REFUNDED: "bg-primary/10 text-primary",
  BOOKED_BY_SUPPORT: "bg-primary/10 text-primary",
};

const PURPOSE_LABEL: Record<string, string> = {
  BOOKING_CHECKOUT: "Checkout",
  BOOKING_PAY: "Pay now",
  WALLET_RECHARGE: "Wallet recharge",
};

const rupees = (n: number | null) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PaymentsPage() {
  const canManage = hasPermission("dispatcher.manage");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.paymentEvents(filter),
    queryFn: () => paymentsAdminApi.events(filter || undefined),
    refetchInterval: 60_000,
  });

  const done = (message: string) => {
    setNotice(message);
    queryClient.invalidateQueries({ queryKey: ["dispatcher", "payments"] });
  };
  const failed = (e: unknown, fallback: string) =>
    setNotice(e instanceof ApiError ? e.message : fallback);

  const refund = useMutation({
    mutationFn: (id: number) => paymentsAdminApi.refund(id),
    onSuccess: () => done("Refunded in Razorpay. The customer gets the money back in 5–7 working days."),
    onError: (e) => failed(e, "Could not refund."),
  });
  const resolve = useMutation({
    mutationFn: ({ id, outcome }: { id: number; outcome: "REFUNDED" | "BOOKED_BY_SUPPORT" }) =>
      paymentsAdminApi.resolve(id, outcome),
    onSuccess: () => done("Closed."),
    onError: (e) => failed(e, "Could not close this event."),
  });

  const events = data?.events ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Payments</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every payment Razorpay reported, and what the server did with it. A payment that was
            captured but never turned into a booking is listed as <strong>Paid, not booked</strong>:
            book it for the customer or refund it.
          </p>
        </div>
        {data && data.orphaned > 0 ? (
          <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
            {data.orphaned} paid, not booked
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-foreground" role="status">
          {notice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load payments.</p>
            <button onClick={() => refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-center">
            <p className="text-muted-foreground">
              {filter ? "Nothing with this outcome." : "No payment events yet. They arrive once the Razorpay webhook is configured."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Received</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">For</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Outcome</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: PaymentEventRow) => (
                  <tr key={e.paymentEventId} className="border-t border-border transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3 text-muted-foreground">{when(e.receivedAt)}</td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-foreground">{e.razorpayPaymentId ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{e.event}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {e.purpose ? PURPOSE_LABEL[e.purpose] : "—"}
                      {e.bookingIds.length ? ` · #${e.bookingIds.join(", #")}` : ""}
                      {e.professionalId ? ` · partner ${e.professionalId}` : ""}
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground">{rupees(e.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME_TONE[e.outcome] ?? "bg-muted text-muted-foreground"}`}>
                        {OUTCOME_LABEL[e.outcome] ?? e.outcome}
                      </span>
                      {e.error ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{e.error}</p> : null}
                    </td>
                    <td className="px-5 py-3">
                      {canManage && e.outcome === "ORPHANED" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (window.confirm(`Refund ${rupees(e.amount)} to the customer in Razorpay?`)) refund.mutate(e.paymentEventId);
                            }}
                            disabled={refund.isPending}
                            className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-60"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => resolve.mutate({ id: e.paymentEventId, outcome: "BOOKED_BY_SUPPORT" })}
                            disabled={resolve.isPending}
                            className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/20 disabled:opacity-60"
                          >
                            Booked by hand
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
