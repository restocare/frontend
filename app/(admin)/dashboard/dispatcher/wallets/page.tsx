"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatcherApi, queryKeys, type WalletRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SearchIcon, SpinnerIcon, WalletIcon } from "@/src/components/icons";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

type AdjustTarget = { wallet: WalletRow; mode: "credit" | "debit" };

export default function PartnerWalletsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // Same buckets as the partners list, so "Active" means the same on both.
  const [status, setStatus] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.partnerWallets(search.trim(), status),
    queryFn: () => dispatcherApi.listWallets(search.trim() || undefined, status),
    placeholderData: keepPreviousData,
  });

  const wallets = data?.wallets ?? [];
  const totalBalance = data?.totalBalance ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Partner Wallets</h1>
        <p className="text-sm text-muted-foreground">
          Wallet balances held by service partners. Credit or deduct balance below.
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
              {isLoading ? "—" : inr(totalBalance)}
            </p>
            <p className="text-sm text-muted-foreground">
              Total held across {wallets.length} partner{wallets.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile or city"
              className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter wallets by partner status"
            className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          >
            <option value="ALL">All partners</option>
            <option value="ACTIVE">Active</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
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
            <p className="text-muted-foreground">Couldn’t load wallets.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : wallets.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <WalletIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No partners match your search." : "No partners yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Mobile</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Transactions</th>
                  <th className="px-5 py-3 font-medium">Balance</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w: WalletRow) => (
                  <tr
                    key={w.professionalId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{w.name}</p>
                      {w.email && (
                        <p className="text-xs text-muted-foreground">{w.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{w.mobile ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{w.city ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{w.transactionCount}</td>
                    <td className="px-5 py-3 font-semibold text-foreground">{inr(w.balance)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setAdjust({ wallet: w, mode: "credit" })}
                          className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/20"
                        >
                          + Credit
                        </button>
                        <button
                          onClick={() => setAdjust({ wallet: w, mode: "debit" })}
                          className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20"
                        >
                          − Deduct
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjust && (
        <AdjustWalletModal
          target={adjust}
          onClose={() => setAdjust(null)}
          onDone={(msg) => {
            setNotice(msg);
            setAdjust(null);
            queryClient.invalidateQueries({ queryKey: ["dispatcher", "wallets"] });
          }}
        />
      )}
    </div>
  );
}

function AdjustWalletModal({
  target,
  onClose,
  onDone,
}: {
  target: AdjustTarget;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { wallet, mode } = target;
  const isCredit = mode === "credit";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: number) =>
      isCredit
        ? dispatcherApi.creditWallet(wallet.professionalId, value, note.trim() || undefined)
        : dispatcherApi.debitWallet(wallet.professionalId, value, note.trim() || undefined),
    onSuccess: () =>
      onDone(
        `${isCredit ? "Credited" : "Deducted"} ₹${Number(amount).toLocaleString("en-IN")} ${
          isCredit ? "to" : "from"
        } ${wallet.name}'s wallet.`,
      ),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not update the wallet."),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!isCredit && value > wallet.balance) {
      setError(`Amount exceeds the current balance of ₹${Math.round(wallet.balance).toLocaleString("en-IN")}.`);
      return;
    }
    mutation.mutate(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">
          {isCredit ? "Credit wallet" : "Deduct from wallet"}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {wallet.name} · current balance{" "}
          <span className="font-medium text-foreground">{inr(wallet.balance)}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Amount (₹)</label>
            <input
              autoFocus
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isCredit ? "e.g. Bonus payout" : "e.g. Penalty adjustment"}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
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
              disabled={mutation.isPending}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 ${
                isCredit ? "bg-success" : "bg-danger"
              }`}
            >
              {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
              {isCredit ? "Add balance" : "Deduct balance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
