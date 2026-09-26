"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatcherApi,
  queryKeys,
  type PayoutRequestRow,
  type PayoutStatus,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SearchIcon, SpinnerIcon, WalletIcon } from "@/src/components/icons";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type StatusTab = PayoutStatus | "ALL";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const STATUS_STYLES: Record<PayoutStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-danger/15 text-danger",
};

function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

type ResolveTarget = { payout: PayoutRequestRow; mode: "approve" | "reject" };

export default function PartnerPayoutsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // Default to the pending queue — the requests awaiting admin action.
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [notice, setNotice] = useState<string | null>(null);
  const [resolve, setResolve] = useState<ResolveTarget | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.payouts(search.trim(), statusTab),
    queryFn: () => dispatcherApi.listPayouts(search.trim() || undefined, statusTab),
    placeholderData: keepPreviousData,
  });

  const { data: counts } = useQuery({
    queryKey: queryKeys.payoutStatusCounts,
    queryFn: () => dispatcherApi.payoutStatusCounts(),
  });

  const payouts = data ?? [];
  const pendingTotal = payouts
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Withdrawal requests from service partners. Approve to pay out (debits their wallet) or
          reject with a reason.
        </p>
      </div>

      {/* Summary + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
            <WalletIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {isLoading ? "—" : inr(pendingTotal)}
            </p>
            <p className="text-sm text-muted-foreground">
              {statusTab === "PENDING"
                ? `Awaiting payout across ${payouts.length} request${payouts.length === 1 ? "" : "s"}`
                : `Pending amount in view`}
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by partner name, email or mobile"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* Status tabs — Pending is the queue admins act on first. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.key;
          const count = counts?.[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`relative -mb-px flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-b-2 border-primary text-primary"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    tab.key === "PENDING" && !active
                      ? "bg-warning/15 text-warning"
                      : active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {isFetching && (
          <span className="ml-auto pb-2 text-xs text-muted-foreground">updating…</span>
        )}
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2.5 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load payout requests.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : payouts.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <WalletIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search
                ? "No payout requests match your search."
                : statusTab === "PENDING"
                  ? "No pending payout requests."
                  : "No payout requests here yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Wallet balance</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 font-medium">Requested</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.payoutRequestId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.email ?? p.mobile ?? p.city ?? "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground">{inr(p.amount)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{inr(p.walletBalance)}</td>
                    <td className="px-5 py-3 max-w-[16rem]">
                      {p.status === "REJECTED" && p.adminNote ? (
                        <span className="text-danger">{p.adminNote}</span>
                      ) : p.note ? (
                        <span className="text-muted-foreground">{p.note}</span>
                      ) : p.adminNote ? (
                        <span className="text-muted-foreground">{p.adminNote}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3">
                      <PayoutStatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {p.status === "PENDING" ? (
                          <>
                            <button
                              onClick={() => setResolve({ payout: p, mode: "approve" })}
                              className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/20"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setResolve({ payout: p, mode: "reject" })}
                              className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(p.processedAt)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolve && (
        <ResolvePayoutModal
          target={resolve}
          onClose={() => setResolve(null)}
          onDone={(msg) => {
            setNotice(msg);
            setResolve(null);
            queryClient.invalidateQueries({ queryKey: ["dispatcher", "payouts"] });
            // A payout also changes the partner's wallet balance.
            queryClient.invalidateQueries({ queryKey: ["dispatcher", "wallets"] });
          }}
        />
      )}
    </div>
  );
}

function ResolvePayoutModal({
  target,
  onClose,
  onDone,
}: {
  target: ResolveTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { payout, mode } = target;
  const isApprove = mode === "approve";
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const insufficient = isApprove && payout.walletBalance < payout.amount;

  const mutation = useMutation({
    mutationFn: () =>
      isApprove
        ? dispatcherApi.approvePayout(payout.payoutRequestId, text.trim() || undefined)
        : dispatcherApi.rejectPayout(payout.payoutRequestId, text.trim() || undefined),
    onSuccess: () =>
      onDone(
        isApprove
          ? `Approved ${inr(payout.amount)} payout to ${payout.name}.`
          : `Rejected ${payout.name}'s ${inr(payout.amount)} payout request.`,
      ),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not update the payout request."),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!isApprove && !text.trim()) {
      setError("Please give the partner a reason for the rejection.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">
          {isApprove ? "Approve payout" : "Reject payout"}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {payout.name} · requested{" "}
          <span className="font-medium text-foreground">{inr(payout.amount)}</span> · wallet{" "}
          <span className="font-medium text-foreground">{inr(payout.walletBalance)}</span>
        </p>

        {isApprove && (
          <p className="mt-3 rounded-xl bg-accent px-4 py-3 text-sm text-muted-foreground">
            Approving debits {inr(payout.amount)} from {payout.name}&apos;s wallet and records the
            payout as paid. Transfer the funds through your bank/UPI, then confirm here.
          </p>
        )}
        {insufficient && (
          <p className="mt-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            The partner&apos;s wallet balance is lower than the requested amount, so this payout
            can&apos;t be approved right now.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {isApprove ? "Payment reference (optional)" : "Reason for rejection"}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isApprove ? "e.g. Paid via NEFT, ref TXN123456" : "e.g. Bank details missing"
              }
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || insufficient}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${
                isApprove ? "bg-success" : "bg-danger"
              }`}
            >
              {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
              {isApprove ? "Approve & pay out" : "Reject request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
