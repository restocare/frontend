"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  referralApi,
  queryKeys,
  type ReferralRow,
  type ReferralSettings,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SearchIcon, SpinnerIcon, UsersIcon } from "@/src/components/icons";

const ONBOARDING_STYLES: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  VERIFIED: "bg-primary/10 text-primary",
  ACTIVE: "bg-success/10 text-success",
  REJECTED: "bg-danger/10 text-danger",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReferralsPage() {
  const [search, setSearch] = useState("");

  const { data: rows, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.referrals(search.trim()),
    queryFn: () => referralApi.list(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const referrals = rows ?? [];
  const rewarded = referrals.filter((r) => r.status === "REWARDED").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Partner Referrals
        </h1>
        <p className="text-sm text-muted-foreground">
          Partners who joined through a referral. The referrer is rewarded automatically when
          their referee completes a first booking.
        </p>
      </div>

      {/* Settings */}
      <SettingsCard />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total referrals" value={String(referrals.length)} />
        <Stat label="Rewarded" value={String(rewarded)} />
        <Stat label="Awaiting first booking" value={String(referrals.length - rewarded)} />
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partner, referrer or code"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {referrals.length} referral{referrals.length === 1 ? "" : "s"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load referrals.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No referrals match your search." : "No referrals yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Referred partner</th>
                  <th className="px-5 py-3 font-medium">Onboarding</th>
                  <th className="px-5 py-3 font-medium">Referred by</th>
                  <th className="px-5 py-3 font-medium">Code used</th>
                  <th className="px-5 py-3 font-medium">Completed jobs</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: ReferralRow) => (
                  <tr
                    key={r.professionalId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{r.name}</p>
                      {r.mobile && (
                        <p className="text-xs text-muted-foreground">{r.mobile}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          ONBOARDING_STYLES[r.onboardingStatus] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.onboardingStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground">{r.referrer?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.referrer?.referralCode ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {r.completedBookings}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(r.joinedAt)}</td>
                    <td className="px-5 py-3">
                      {r.status === "REWARDED" ? (
                        <span
                          className="inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                          title={r.rewardedAt ? `Paid ${fmtDate(r.rewardedAt)}` : undefined}
                        >
                          Rewarded{r.rewardedAt ? ` · ${fmtDate(r.rewardedAt)}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                          Pending
                        </span>
                      )}
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

// ⚙️ Referral program settings: master switch + reward amount.
function SettingsCard() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [canManage, setCanManage] = useState(false);
  useEffect(() => setCanManage(hasPermission("referrals.manage")), []);

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.referralSettings,
    queryFn: referralApi.settings,
  });

  // Seed the amount input once settings arrive (adjust-during-render pattern).
  const [seeded, setSeeded] = useState(false);
  if (settings && !seeded) {
    setAmount(String(settings.rewardAmount));
    setSeeded(true);
  }

  const save = useMutation({
    mutationFn: (body: { enabled?: boolean; rewardAmount?: number }) =>
      referralApi.updateSettings(body),
    onSuccess: (res: ReferralSettings) => {
      setError(null);
      setNotice(
        `Referral program ${res.enabled ? "enabled" : "disabled"} · reward ₹${res.rewardAmount}`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.referralSettings });
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : "Could not save settings.");
    },
  });

  const saveAmount = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter a reward amount of at least ₹1.");
      return;
    }
    save.mutate({ rewardAmount: n });
  };

  if (isLoading || !settings) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        <SpinnerIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Referral program</h2>
          <p className="text-sm text-muted-foreground">
            Reward paid to the referrer when a referred partner completes their first booking.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              settings.enabled ? "text-success" : "text-muted-foreground"
            }`}
          >
            {settings.enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            role="switch"
            aria-checked={settings.enabled}
            disabled={!canManage || save.isPending}
            onClick={() => save.mutate({ enabled: !settings.enabled })}
            title={
              canManage
                ? settings.enabled
                  ? "Disable referral rewards"
                  : "Enable referral rewards"
                : "Requires the referrals.manage permission"
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              settings.enabled ? "bg-success" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                settings.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Reward amount (₹)
          </span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!canManage}
            className="w-36 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          />
        </label>
        {canManage && (
          <button
            onClick={saveAmount}
            disabled={save.isPending || Number(amount) === settings.rewardAmount}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            Save amount
          </button>
        )}
        <p className="pb-2 text-xs text-muted-foreground">
          Last updated {fmtDate(settings.updatedAt)}
        </p>
      </div>

      {notice ? <p className="text-sm text-success">{notice}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
