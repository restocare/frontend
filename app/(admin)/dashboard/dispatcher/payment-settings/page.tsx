"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryApi,
  dispatchApi,
  queryKeys,
  type PaymentSettings,
  type PaymentSettingsInput,
  type PlatformFeeMode,
  type TaxModel,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

/**
 * Dispatcher → Payment Settings: three independent groups of rules, each
 * saved on its own — the partner's money (lead fee, share), the platform fee,
 * and GST. One settings row on the server (same singleton pattern as Auto
 * Allocation); each section sends only its own fields.
 *
 * A booking copies the rates in force when it is created, so a change here
 * applies to NEW bookings only — a job already accepted at ₹30 / 80% / 18% is
 * never re-priced, and the fee refunded on a cancel is the one that was charged.
 */

/** Hard bounds, mirrored from the backend DTO: a typo here is a financial incident. */
const LEAD_FEE = { min: 0, max: 500 };
const SHARE = { min: 50, max: 100 };
const GST = { min: 0, max: 28 };
const PLATFORM_FEE = { min: 0, max: 500 };
const CONVEYANCE_RATE = { min: 0, max: 100 };
const CONVEYANCE_MAX_KM = { min: 0, max: 200 };
const SHORT_DUTY_HOURS = { min: 0, max: 24 };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The conveyance example is a partner this far from the job. */
const EXAMPLE_KM = 12;
/** What the customer app still displays on its own (the website reads GET /v1/pricing/rates). */
const GST_SHOWN_BY_CLIENTS = 18;

/** The worked example is priced on a round ₹1,000 pre-tax job. */
const EXAMPLE_BASE = 1000;

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50";

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

/** A rupee / percent field: the parsed number and what is wrong with it, if anything. */
function field(
  raw: string,
  bounds: { min: number; max: number },
  what: string,
  unit: "₹" | "%",
): { value: number | null; problem: string | null } {
  const value = parse(raw);
  if (value === null) return { value, problem: `Enter ${what}.` };
  if (value < bounds.min || value > bounds.max) {
    const lo = unit === "₹" ? `₹${bounds.min}` : `${bounds.min}%`;
    const hi = unit === "₹" ? `₹${bounds.max}` : `${bounds.max}%`;
    return { value, problem: `Must be between ${lo} and ${hi}.` };
  }
  return { value, problem: null };
}

/** What is typed on the page, as strings so a half-typed number is not clobbered. */
interface Draft {
  leadFee: string;
  share: string;
  platformFee: string;
  platformFeeMode: PlatformFeeMode;
  gst: string;
  taxModel: TaxModel;
  conveyanceRate: string;
  conveyanceAfter: string;
  conveyanceMaxKm: string;
  /** Hours, as typed; the server stores minutes. */
  shortDutyHours: string;
  shortDutyCategoryIds: number[];
}

/** The server's row as a draft. Tolerates a backend that predates a field. */
function draftOf(s: PaymentSettings): Draft {
  return {
    leadFee: String(s.leadFeeRupees),
    share: String(s.partnerSharePercent),
    platformFee: String(s.platformFeeRupees ?? 0),
    platformFeeMode: s.platformFeeMode ?? "PER_BOOKING",
    gst: String(s.gstPercent ?? GST_SHOWN_BY_CLIENTS),
    taxModel: s.taxModel ?? "ON_BASE",
    conveyanceRate: String(s.conveyanceRatePerKm ?? 0),
    conveyanceAfter: s.conveyanceAfterTime ?? "22:00",
    conveyanceMaxKm: String(s.conveyanceMaxKm ?? 0),
    shortDutyHours: String((s.conveyanceShortDutyMaxMinutes ?? 0) / 60),
    shortDutyCategoryIds: s.conveyanceShortDutyCategoryIds ?? [],
  };
}

/** Two lists of ids hold the same categories, in any order. */
function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * One section's save: its own pending state, notice and error, so saving the
 * platform fee never greys out or reports on the GST section.
 */
function useSectionSave(label: (res: PaymentSettings) => string) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (body: PaymentSettingsInput) =>
      dispatchApi.updatePaymentSettings(body),
    onSuccess: (res: PaymentSettings) => {
      setError(null);
      setNotice(`${label(res)} Applies to bookings created from now on.`);
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
  return {
    save: (body: PaymentSettingsInput) => mutation.mutate(body),
    pending: mutation.isPending,
    notice,
    error,
    clear: () => {
      setNotice(null);
      setError(null);
    },
  };
}

export default function PaymentSettingsPage() {
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

  // Seed the draft once settings arrive (adjust-during-render pattern). Kept on
  // the page, not per section, because the worked example reads every field.
  const [draft, setDraft] = useState<Draft | null>(null);
  if (settings && draft === null) setDraft(draftOf(settings));
  const patch = (p: Partial<Draft>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));

  if (isLoading || (settings && !draft)) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !settings || !draft) {
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

  // Parsed once here; the sections validate and the example prices from these.
  const leadFee = field(draft.leadFee, LEAD_FEE, "the lead fee in rupees", "₹");
  const share = field(
    draft.share,
    SHARE,
    "the partner's share in percent",
    "%",
  );
  const platformFee = field(
    draft.platformFee,
    PLATFORM_FEE,
    "the platform fee in rupees (0 for none)",
    "₹",
  );
  const gst = field(draft.gst, GST, "the GST rate in percent", "%");

  // The example follows what is typed, so the admin sees the effect before saving.
  const exFee = leadFee.value ?? settings.leadFeeRupees;
  const exShare = share.value ?? settings.partnerSharePercent;
  const exGst = gst.value ?? settings.gstPercent ?? GST_SHOWN_BY_CLIENTS;
  const exPlatformFee = platformFee.value ?? settings.platformFeeRupees ?? 0;
  const exCommission = Math.round((100 - exShare) * 100) / 100;
  const partnerGross = (EXAMPLE_BASE * exShare) / 100;
  const companyCommission = EXAMPLE_BASE - partnerGross;
  const onCommission = draft.taxModel === "ON_COMMISSION";
  // What the GST lands on: the whole base, or only the company's commission.
  const taxedAmount = onCommission ? companyCommission : EXAMPLE_BASE;
  // GST on the base's taxed share, plus GST on the platform fee (the company's
  // own supply, taxed in full under either model). Same maths as the server.
  const customerGst =
    Math.round((taxedAmount + exPlatformFee) * exGst * 100) / 10000;
  const customerPays = EXAMPLE_BASE + exPlatformFee + customerGst;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Payment Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          What a lead costs a partner, how the job’s value is split, the
          platform fee and the GST the customer is charged. Each section saves
          on its own. Changes apply to bookings created from now on — a job
          already booked keeps the rates it was booked under.
        </p>
        <p className="text-xs text-muted-foreground">
          Last updated {fmtDate(settings.updatedAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <PartnerRulesSection
            settings={settings}
            draft={draft}
            patch={patch}
            canManage={canManage}
            leadFee={leadFee}
            share={share}
            exCommission={exCommission}
          />
          <PlatformFeeSection
            settings={settings}
            draft={draft}
            patch={patch}
            canManage={canManage}
            platformFee={platformFee}
            exGst={exGst}
          />
          <GstSection
            settings={settings}
            draft={draft}
            patch={patch}
            canManage={canManage}
            gst={gst}
            exCommission={exCommission}
            taxedAmount={taxedAmount}
            exPlatformFee={exPlatformFee}
            customerGst={customerGst}
            customerPays={customerPays}
          />
          <ConveyanceSection
            settings={settings}
            draft={draft}
            patch={patch}
            canManage={canManage}
          />
        </div>

        {/* Worked example, live from every section's inputs */}
        <aside className="h-fit space-y-4 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              On a {inr(EXAMPLE_BASE)} job
            </h2>
            <p className="text-sm text-muted-foreground">
              Pre-tax base. GST is charged to the customer on top and is not
              part of the partner split. Follows what is typed, saved or not.
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Base amount" value={inr(EXAMPLE_BASE)} />
            {exPlatformFee > 0 ? (
              <Row
                label="Platform fee"
                value={`+ ${inr(exPlatformFee)}`}
                muted
              />
            ) : null}
            <Row
              label={
                onCommission
                  ? `GST ${exGst}% on the ${exCommission}% commission (${inr(taxedAmount)})${exPlatformFee > 0 ? " + fee" : ""}`
                  : `GST ${exGst}% on the whole base${exPlatformFee > 0 ? " + fee" : ""}`
              }
              value={`+ ${inr(customerGst)}`}
              muted
            />
            <Row label="Customer pays" value={inr(customerPays)} strong />
          </dl>

          <dl className="space-y-2 border-t border-border pt-3 text-sm">
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
            {exPlatformFee > 0 ? (
              <Row label="Platform fee" value={inr(exPlatformFee)} />
            ) : null}
            <Row
              label="Company receives"
              value={inr(companyCommission + exFee + exPlatformFee)}
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

/* ----------------------------- the sections ----------------------------- */

interface SectionProps {
  settings: PaymentSettings;
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  canManage: boolean;
}

function PartnerRulesSection({
  settings,
  draft,
  patch,
  canManage,
  leadFee,
  share,
  exCommission,
}: SectionProps & {
  leadFee: ReturnType<typeof field>;
  share: ReturnType<typeof field>;
  exCommission: number;
}) {
  const s = useSectionSave(
    (res) =>
      `Saved — lead fee ${inr(res.leadFeeRupees)}, partner keeps ${res.partnerSharePercent}%, company ${res.commissionPercent}%.`,
  );
  const valid = !leadFee.problem && !share.problem;
  const dirty =
    leadFee.value !== settings.leadFeeRupees ||
    share.value !== settings.partnerSharePercent;
  const disabled = !canManage || s.pending;

  const submit = () => {
    if (!valid || leadFee.value === null || share.value === null) return;
    const body: PaymentSettingsInput = {};
    if (leadFee.value !== settings.leadFeeRupees)
      body.leadFeeRupees = leadFee.value;
    if (share.value !== settings.partnerSharePercent)
      body.partnerSharePercent = share.value;
    if (Object.keys(body).length) s.save(body);
  };
  const discard = () => {
    patch({
      leadFee: String(settings.leadFeeRupees),
      share: String(settings.partnerSharePercent),
    });
    s.clear();
  };

  return (
    <Section
      title="Partner money rules"
      intro="Both are charged against the partner’s wallet: the lead fee when they accept, the commission when the job completes."
      canManage={canManage}
      valid={valid}
      dirty={dirty}
      pending={s.pending}
      notice={s.notice}
      error={s.error}
      onSave={submit}
      onDiscard={discard}
    >
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
            value={draft.leadFee}
            onChange={(e) => patch({ leadFee: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={leadFee.problem}>
            Debited on accept, refunded if the job is cancelled before it
            starts.
          </Hint>
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
            value={draft.share}
            onChange={(e) => patch({ share: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={share.problem}>
            The rest —{" "}
            <strong className="text-foreground">{exCommission}%</strong> — is
            the company’s commission, charged at completion on the pre-tax base.
          </Hint>
        </label>
      </div>
    </Section>
  );
}

function PlatformFeeSection({
  settings,
  draft,
  patch,
  canManage,
  platformFee,
  exGst,
}: SectionProps & { platformFee: ReturnType<typeof field>; exGst: number }) {
  const s = useSectionSave((res) =>
    res.platformFeeRupees > 0
      ? `Saved — platform fee ${inr(res.platformFeeRupees)} ${res.platformFeeMode === "PER_ORDER" ? "once per checkout" : "per service"}.`
      : "Saved — no platform fee.",
  );
  const valid = !platformFee.problem;
  const dirty =
    platformFee.value !== (settings.platformFeeRupees ?? 0) ||
    draft.platformFeeMode !== (settings.platformFeeMode ?? "PER_BOOKING");
  const disabled = !canManage || s.pending;
  const perOrder = draft.platformFeeMode === "PER_ORDER";

  const submit = () => {
    if (!valid || platformFee.value === null) return;
    const body: PaymentSettingsInput = {};
    if (platformFee.value !== settings.platformFeeRupees)
      body.platformFeeRupees = platformFee.value;
    if (draft.platformFeeMode !== settings.platformFeeMode)
      body.platformFeeMode = draft.platformFeeMode;
    if (Object.keys(body).length) s.save(body);
  };
  const discard = () => {
    patch({
      platformFee: String(settings.platformFeeRupees ?? 0),
      platformFeeMode: settings.platformFeeMode ?? "PER_BOOKING",
    });
    s.clear();
  };

  return (
    <Section
      title="Platform fee"
      intro="A flat amount added to the customer’s bill and kept by the company. It does not touch the partner’s share; on cash jobs the partner hands it back from their wallet at completion."
      canManage={canManage}
      valid={valid}
      dirty={dirty}
      pending={s.pending}
      notice={s.notice}
      error={s.error}
      onSave={submit}
      onDiscard={discard}
      warning={
        (platformFee.value ?? 0) > 0
          ? "The website shows this fee at checkout. The customer app does not read it yet: there a fee is charged but not shown until the app is updated."
          : null
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 block text-xs font-medium text-muted-foreground">
          Charged
        </legend>
        <ModelOption
          name="platformFeeMode"
          checked={!perOrder}
          disabled={disabled}
          onSelect={() => patch({ platformFeeMode: "PER_BOOKING" })}
          title="Per service"
          detail="On every booking. A checkout with three services pays it three times."
        />
        <ModelOption
          name="platformFeeMode"
          checked={perOrder}
          disabled={disabled}
          onSelect={() => patch({ platformFeeMode: "PER_ORDER" })}
          title="Once per checkout"
          detail="However many services the customer books together, the fee is charged once — on the first booking of that checkout."
        />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Platform fee (₹ {perOrder ? "per checkout" : "per service"})
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={PLATFORM_FEE.min}
            max={PLATFORM_FEE.max}
            step={1}
            value={draft.platformFee}
            onChange={(e) => patch({ platformFee: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={platformFee.problem}>
            0 means no fee. GST ({exGst}%) is charged on it like on the
            commission.
          </Hint>
        </label>
      </div>
    </Section>
  );
}

function GstSection({
  settings,
  draft,
  patch,
  canManage,
  gst,
  exCommission,
  taxedAmount,
  exPlatformFee,
  customerGst,
  customerPays,
}: SectionProps & {
  gst: ReturnType<typeof field>;
  exCommission: number;
  taxedAmount: number;
  exPlatformFee: number;
  customerGst: number;
  customerPays: number;
}) {
  const s = useSectionSave(
    (res) =>
      `Saved — GST ${res.gstPercent}% on ${res.taxModel === "ON_COMMISSION" ? `the ${res.commissionPercent}% commission` : "the whole base"}.`,
  );
  const valid = !gst.problem;
  const dirty =
    gst.value !== (settings.gstPercent ?? GST_SHOWN_BY_CLIENTS) ||
    draft.taxModel !== (settings.taxModel ?? "ON_BASE");
  const disabled = !canManage || s.pending;
  const onCommission = draft.taxModel === "ON_COMMISSION";
  const exGst = gst.value ?? settings.gstPercent ?? GST_SHOWN_BY_CLIENTS;

  // The website prices from GET /v1/pricing/rates, but the customer app still
  // prices with its own 18% on the whole base: any other rate or model here
  // charges app customers one amount and shows them another until the app reads
  // the setting. Said loudly rather than silently allowed.
  const mismatch =
    onCommission || (gst.value !== null && gst.value !== GST_SHOWN_BY_CLIENTS);

  const submit = () => {
    if (!valid || gst.value === null) return;
    const body: PaymentSettingsInput = {};
    if (gst.value !== settings.gstPercent) body.gstPercent = gst.value;
    if (draft.taxModel !== settings.taxModel) body.taxModel = draft.taxModel;
    if (Object.keys(body).length) s.save(body);
  };
  const discard = () => {
    patch({
      gst: String(settings.gstPercent ?? GST_SHOWN_BY_CLIENTS),
      taxModel: settings.taxModel ?? "ON_BASE",
    });
    s.clear();
  };

  return (
    <Section
      title="GST"
      intro="Charged to the customer on top of the price. On cash jobs the partner hands it back from their wallet at completion."
      canManage={canManage}
      valid={valid}
      dirty={dirty}
      pending={s.pending}
      notice={s.notice}
      error={s.error}
      onSave={submit}
      onDiscard={discard}
      warning={
        mismatch
          ? `The website shows this rate and model at checkout. The customer app still shows ${GST_SHOWN_BY_CLIENTS}% on the whole base on its own, so app customers are charged one amount and shown another until the app is updated.`
          : null
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 block text-xs font-medium text-muted-foreground">
          GST is charged on
        </legend>
        <ModelOption
          name="taxModel"
          checked={onCommission}
          disabled={disabled}
          onSelect={() => patch({ taxModel: "ON_COMMISSION" })}
          title={`The company’s commission only (${exCommission}% of the base)`}
          detail="The partner’s share is their own supply and carries no GST of ours. Whatever is left after the partner’s share is what the GST applies to."
        />
        <ModelOption
          name="taxModel"
          checked={!onCommission}
          disabled={disabled}
          onSelect={() => patch({ taxModel: "ON_BASE" })}
          title="The whole base amount (100%)"
          detail="How every booking was priced before November 2026."
        />
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            GST rate (%)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={GST.min}
            max={GST.max}
            step={0.5}
            value={draft.gst}
            onChange={(e) => patch({ gst: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={gst.problem}>
            Applies to{" "}
            <strong className="text-foreground">
              {onCommission ? exCommission : 100}%
            </strong>{" "}
            of the base{onCommission ? " — the company’s commission." : "."}
          </Hint>
        </label>

        <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          On a {inr(EXAMPLE_BASE)} job: GST {exGst}% of{" "}
          {inr(taxedAmount + exPlatformFee)}
          {exPlatformFee > 0
            ? ` (${inr(taxedAmount)} + ${inr(exPlatformFee)} platform fee)`
            : ""}{" "}
          = <strong className="text-foreground">{inr(customerGst)}</strong>. The
          customer pays{" "}
          <strong className="text-foreground">{inr(customerPays)}</strong>.
        </div>
      </div>
    </Section>
  );
}

function ConveyanceSection({
  settings,
  draft,
  patch,
  canManage,
}: SectionProps) {
  const s = useSectionSave((res) =>
    res.conveyanceRatePerKm > 0
      ? `Saved — conveyance ${inr(res.conveyanceRatePerKm)}/km for duties ending at or after ${res.conveyanceAfterTime}${res.conveyanceMaxKm > 0 ? `, up to ${res.conveyanceMaxKm} km` : ""}.`
      : "Saved — no conveyance.",
  );
  const rate = field(
    draft.conveyanceRate,
    CONVEYANCE_RATE,
    "the rate in rupees per km (0 for none)",
    "₹",
  );
  const maxKm = field(
    draft.conveyanceMaxKm,
    CONVEYANCE_MAX_KM,
    "the most km paid per job (0 for no cap)",
    "₹",
  );
  const after = draft.conveyanceAfter.trim();
  const afterProblem = HHMM.test(after)
    ? null
    : "Enter a time as HH:mm, 24-hour (for example 22:00).";
  const shortHours = field(
    draft.shortDutyHours,
    SHORT_DUTY_HOURS,
    "the longest duty, in hours, that earns it (0 for off)",
    "%",
  );
  // Whole minutes on the server; half hours are fine (4.5 h = 270 min).
  const shortMinutes =
    shortHours.value === null ? null : Math.round(shortHours.value * 60);
  const savedShortMinutes = settings.conveyanceShortDutyMaxMinutes ?? 0;
  const savedCategoryIds = settings.conveyanceShortDutyCategoryIds ?? [];
  const valid =
    !rate.problem && !maxKm.problem && !afterProblem && !shortHours.problem;
  const dirty =
    rate.value !== (settings.conveyanceRatePerKm ?? 0) ||
    after !== (settings.conveyanceAfterTime ?? "22:00") ||
    maxKm.value !== (settings.conveyanceMaxKm ?? 0) ||
    shortMinutes !== savedShortMinutes ||
    !sameIds(draft.shortDutyCategoryIds, savedCategoryIds);
  const disabled = !canManage || s.pending;

  // The categories the short-duty trigger can be limited to.
  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => categoryApi.list(),
  });
  const toggleCategory = (id: number) =>
    patch({
      shortDutyCategoryIds: draft.shortDutyCategoryIds.includes(id)
        ? draft.shortDutyCategoryIds.filter((x) => x !== id)
        : [...draft.shortDutyCategoryIds, id],
    });

  // Live example: a partner EXAMPLE_KM from the job, duty ending after the cut-off.
  const exRate = rate.value ?? settings.conveyanceRatePerKm ?? 0;
  const exCap = maxKm.value ?? settings.conveyanceMaxKm ?? 0;
  const paidKm = exCap > 0 ? Math.min(EXAMPLE_KM, exCap) : EXAMPLE_KM;
  const exAmount = Math.round(paidKm * exRate * 100) / 100;

  const submit = () => {
    if (
      !valid ||
      rate.value === null ||
      maxKm.value === null ||
      shortMinutes === null
    )
      return;
    const body: PaymentSettingsInput = {};
    if (rate.value !== settings.conveyanceRatePerKm)
      body.conveyanceRatePerKm = rate.value;
    if (after !== settings.conveyanceAfterTime)
      body.conveyanceAfterTime = after;
    if (maxKm.value !== settings.conveyanceMaxKm)
      body.conveyanceMaxKm = maxKm.value;
    if (shortMinutes !== savedShortMinutes)
      body.conveyanceShortDutyMaxMinutes = shortMinutes;
    if (!sameIds(draft.shortDutyCategoryIds, savedCategoryIds))
      body.conveyanceShortDutyCategoryIds = draft.shortDutyCategoryIds;
    if (Object.keys(body).length) s.save(body);
  };
  const discard = () => {
    patch({
      conveyanceRate: String(settings.conveyanceRatePerKm ?? 0),
      conveyanceAfter: settings.conveyanceAfterTime ?? "22:00",
      conveyanceMaxKm: String(settings.conveyanceMaxKm ?? 0),
      shortDutyHours: String(savedShortMinutes / 60),
      shortDutyCategoryIds: savedCategoryIds,
    });
    s.clear();
  };

  return (
    <Section
      title="Conveyance"
      intro="Paid by the company to the partner — the trip home. Measured per km from the partner’s registered base to the job, worked out when they take the job and credited to their wallet at completion. Two separate triggers, either one earns it: a duty that ends late, or a short duty in the categories you pick. It is not charged to the customer."
      canManage={canManage}
      valid={valid}
      dirty={dirty}
      pending={s.pending}
      notice={s.notice}
      error={s.error}
      onSave={submit}
      onDiscard={discard}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Rate (₹ per km)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={CONVEYANCE_RATE.min}
            max={CONVEYANCE_RATE.max}
            step={0.5}
            value={draft.conveyanceRate}
            onChange={(e) => patch({ conveyanceRate: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={rate.problem}>0 means no conveyance.</Hint>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Duty ends at or after
          </span>
          <input
            type="time"
            value={draft.conveyanceAfter}
            onChange={(e) => patch({ conveyanceAfter: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={afterProblem}>
            Trigger 1 — any duty, whatever its length, that ends at or after
            this. One running past midnight always earns it.
          </Hint>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Most km paid per job
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={CONVEYANCE_MAX_KM.min}
            max={CONVEYANCE_MAX_KM.max}
            step={1}
            value={draft.conveyanceMaxKm}
            onChange={(e) => patch({ conveyanceMaxKm: e.target.value })}
            disabled={disabled}
            className={INPUT}
          />
          <Hint problem={maxKm.problem}>0 means no cap.</Hint>
        </label>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Short duties
          </h3>
          <p className="text-xs text-muted-foreground">
            Trigger 2 — a short booking earns conveyance at any hour, so a
            partner is not out of pocket on a 5-hour job. Pick which categories
            this applies to.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Duty of up to (hours)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={SHORT_DUTY_HOURS.min}
              max={SHORT_DUTY_HOURS.max}
              step={0.5}
              value={draft.shortDutyHours}
              onChange={(e) => patch({ shortDutyHours: e.target.value })}
              disabled={disabled}
              className={INPUT}
            />
            <Hint problem={shortHours.problem}>
              0 turns this trigger off. 5 means bookings of 5 hours or less.
            </Hint>
          </label>

          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-muted-foreground">
              Applies to
            </legend>
            {categories.isLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading categories…
              </p>
            ) : categories.isError || !categories.data ? (
              <p className="text-xs text-danger">
                Couldn’t load the categories. Saved choices are kept.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.data.map((c) => {
                  const on = draft.shortDutyCategoryIds.includes(c.categoryId);
                  return (
                    <label
                      key={c.categoryId}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground"
                      } ${disabled ? "cursor-default opacity-60" : "hover:border-primary/60"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggleCategory(c.categoryId)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {draft.shortDutyCategoryIds.length === 0
                ? "None picked: applies to every category."
                : `${draft.shortDutyCategoryIds.length} picked.`}
            </p>
          </fieldset>
        </div>
      </div>

      <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        {exRate > 0 ? (
          <>
            A partner {EXAMPLE_KM} km from a job whose duty ends at or after{" "}
            {after || "the cut-off"} is paid{" "}
            <strong className="text-foreground">{inr(exAmount)}</strong>
            {paidKm < EXAMPLE_KM ? ` (capped at ${paidKm} km)` : ""} at
            completion, on cash and online jobs alike
            {(shortMinutes ?? 0) > 0
              ? ` — and so is any booking of ${(shortMinutes ?? 0) / 60} hours or less${draft.shortDutyCategoryIds.length ? " in the picked categories" : ""}, whatever the time`
              : ""}
            .
          </>
        ) : (
          <>No conveyance is paid while the rate is 0.</>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------ the pieces ------------------------------ */

/** A card with its own Save / Discard footer, notice and error. */
function Section({
  title,
  intro,
  canManage,
  valid,
  dirty,
  pending,
  notice,
  error,
  warning,
  onSave,
  onDiscard,
  children,
}: {
  title: string;
  intro: string;
  canManage: boolean;
  valid: boolean;
  dirty: boolean;
  pending: boolean;
  notice: string | null;
  error: string | null;
  warning?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>

      {children}

      {warning ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {warning}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {canManage ? (
          <button
            onClick={onSave}
            disabled={!valid || !dirty || pending}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <SpinnerIcon className="h-4 w-4" /> : null}
            Save {title.toLowerCase()}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Requires the dispatcher.manage permission to edit.
          </span>
        )}
        {dirty && canManage && !pending ? (
          <button
            type="button"
            onClick={onDiscard}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Discard
          </button>
        ) : null}
        {notice ? (
          <p className="basis-full text-sm text-success">{notice}</p>
        ) : null}
        {error ? (
          <p className="basis-full text-sm text-danger">{error}</p>
        ) : null}
      </div>
    </section>
  );
}

/** The line under an input: its explanation, or what is wrong with it. */
function Hint({
  problem,
  children,
}: {
  problem: string | null;
  children: React.ReactNode;
}) {
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {children}
      {problem ? <span className="block text-danger">{problem}</span> : null}
    </span>
  );
}

function ModelOption({
  name,
  checked,
  disabled,
  onSelect,
  title,
  detail,
}: {
  /** The radio group — each fieldset needs its own, or they deselect each other. */
  name: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
        checked ? "border-primary bg-primary/5" : "border-border"
      } ${disabled ? "cursor-default opacity-60" : "hover:border-primary/60"}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 accent-primary"
      />
      <span className="block">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
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
