"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  queryKeys,
  type PaymentSettings,
  type PaymentSettingsInput,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

/**
 * Dispatcher → Payment Settings: the two numbers that decide what a job costs a
 * partner and what they keep. Same singleton pattern as Auto Allocation.
 *
 * A booking copies the rates in force when it is created, so a change here
 * applies to NEW bookings only — a job already accepted at ₹30 / 80% is never
 * re-priced, and the fee refunded on a cancel is the one that was charged.
 */

/** Hard bounds, mirrored from the backend DTO: a typo here is a financial incident. */
const LEAD_FEE = { min: 0, max: 500 };
const SHARE = { min: 50, max: 100 };

/** The worked example is priced on a round ₹1,000 pre-tax job. */
const EXAMPLE_BASE = 1000;

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Number typed into a field, or null when it is not one. */
function parse(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const [leadFee, setLeadFee] = useState("");
  const [share, setShare] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Safe at render: the dashboard shell mounts pages only after the client auth check.
  const canManage = hasPermission("dispatcher.manage");

  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.paymentSettings,
    queryFn: () => dispatchApi.getPaymentSettings(),
  });

  // Seed the inputs once settings arrive (adjust-during-render pattern).
  const [seeded, setSeeded] = useState(false);
  if (settings && !seeded) {
    setLeadFee(String(settings.leadFeeRupees));
    setShare(String(settings.partnerSharePercent));
    setSeeded(true);
  }

  const save = useMutation({
    mutationFn: (body: PaymentSettingsInput) =>
      dispatchApi.updatePaymentSettings(body),
    onSuccess: (res: PaymentSettings) => {
      setError(null);
      setNotice(
        `Saved — lead fee ${inr(res.leadFeeRupees)}, partner keeps ${res.partnerSharePercent}%, company ${res.commissionPercent}%. Applies to bookings created from now on.`,
      );
      queryClient.setQueryData(queryKeys.paymentSettings, res);
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSettings });
    },
    onError: (e) => {
      setNotice(null);
      setError(
        e instanceof ApiError ? e.message : "Could not save the settings.",
      );
    },
  });

  const fee = parse(leadFee);
  const pct = parse(share);
  const feeProblem =
    fee === null
      ? "Enter the lead fee in rupees."
      : fee < LEAD_FEE.min || fee > LEAD_FEE.max
        ? `Lead fee must be between ₹${LEAD_FEE.min} and ₹${LEAD_FEE.max}.`
        : null;
  const shareProblem =
    pct === null
      ? "Enter the partner's share in percent."
      : pct < SHARE.min || pct > SHARE.max
        ? `Partner share must be between ${SHARE.min}% and ${SHARE.max}%.`
        : null;
  const valid = !feeProblem && !shareProblem;
  const dirty =
    !!settings &&
    (fee !== settings.leadFeeRupees || pct !== settings.partnerSharePercent);

  // The example follows what is typed, so the admin sees the effect before saving.
  const exFee = fee ?? settings?.leadFeeRupees ?? 0;
  const exShare = pct ?? settings?.partnerSharePercent ?? 0;
  const exCommission = Math.round((100 - exShare) * 100) / 100;
  const partnerGross = (EXAMPLE_BASE * exShare) / 100;
  const companyCommission = EXAMPLE_BASE - partnerGross;

  const submit = () => {
    if (!valid || fee === null || pct === null) return;
    const body: PaymentSettingsInput = {};
    if (fee !== settings?.leadFeeRupees) body.leadFeeRupees = fee;
    if (pct !== settings?.partnerSharePercent) body.partnerSharePercent = pct;
    if (Object.keys(body).length === 0) return;
    save.mutate(body);
  };

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">
          Couldn’t load the payment settings.
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Payment Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          What a lead costs a partner and how the job’s value is split. Changes
          apply to bookings created from now on — a job already booked keeps the
          rates it was booked under.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Rules */}
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Partner money rules
            </h2>
            <p className="text-sm text-muted-foreground">
              Both are charged against the partner’s wallet: the lead fee when
              they accept, the commission when the job completes.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Lead fee (₹ per accepted lead)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={LEAD_FEE.min}
                max={LEAD_FEE.max}
                step={1}
                value={leadFee}
                onChange={(e) => setLeadFee(e.target.value)}
                disabled={!canManage || save.isPending}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Debited on accept, refunded if the job is cancelled before it
                starts.
                {feeProblem ? (
                  <span className="block text-danger">{feeProblem}</span>
                ) : null}
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Partner share of the base amount (%)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={SHARE.min}
                max={SHARE.max}
                step={0.5}
                value={share}
                onChange={(e) => setShare(e.target.value)}
                disabled={!canManage || save.isPending}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                The rest —{" "}
                <strong className="text-foreground">{exCommission}%</strong> —
                is the company’s commission, charged at completion on the
                pre-tax base.
                {shareProblem ? (
                  <span className="block text-danger">{shareProblem}</span>
                ) : null}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {canManage ? (
              <button
                onClick={submit}
                disabled={!valid || !dirty || save.isPending}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {save.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
                Save changes
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Requires the dispatcher.manage permission to edit.
              </span>
            )}
            {dirty && valid && canManage ? (
              <button
                type="button"
                onClick={() => {
                  setLeadFee(String(settings.leadFeeRupees));
                  setShare(String(settings.partnerSharePercent));
                  setError(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
            ) : null}
            <p className="ml-auto text-xs text-muted-foreground">
              Last updated {fmtDate(settings.updatedAt)}
            </p>
          </div>

          {notice ? <p className="text-sm text-success">{notice}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </section>

        {/* Worked example, live from the inputs */}
        <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              On a {inr(EXAMPLE_BASE)} job
            </h2>
            <p className="text-sm text-muted-foreground">
              Pre-tax base. GST is charged to the customer on top and is not
              part of this split.
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Base amount" value={inr(EXAMPLE_BASE)} />
            <Row
              label={`Partner keeps ${exShare}%`}
              value={inr(partnerGross)}
            />
            <Row label="Lead fee on accept" value={`− ${inr(exFee)}`} muted />
            <Row
              label="Partner takes home"
              value={inr(partnerGross - exFee)}
              strong
            />
          </dl>

          <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <Row
              label={`Commission ${exCommission}%`}
              value={inr(companyCommission)}
            />
            <Row label="Lead fee" value={inr(exFee)} />
            <Row
              label="Company receives"
              value={inr(companyCommission + exFee)}
              strong
            />
          </dl>

          <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            A cancelled job refunds the lead fee it was charged. A job booked
            under the old rates keeps them even after you save.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          strong
            ? "text-base font-semibold text-foreground"
            : muted
              ? "text-muted-foreground"
              : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
