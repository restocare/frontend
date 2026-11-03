"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  queryKeys,
  type AllocationMethod,
  type AllocationSettings,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";
import { AllocationPreview } from "@/src/components/dashboard/allocation-preview";
import {
  ArrivalGate,
  DutyRibbon,
  MethodGlyph,
  RetryTimeline,
  RingTimeline,
  SkillGlyph,
  ZoneGlyph,
} from "@/src/components/dashboard/allocation-diagrams";

const METHODS: { key: AllocationMethod; label: string; description: string }[] =
  [
    {
      key: "BROADCAST",
      label: "Broadcast",
      description:
        "Every eligible partner in range gets the lead at the same time.",
    },
    {
      key: "NEAREST",
      label: "Nearest first",
      description:
        "Closest partners get the lead, capped at the max partners below.",
    },
    {
      key: "ROUND_ROBIN",
      label: "Round robin",
      description:
        "Partners with the fewest jobs get the lead first, so work rotates fairly.",
    },
  ];

const RADIUS_PRESETS = [5, 10, 20, 30, 40];

/**
 * What a given radius means in practice. The number alone tells an admin
 * nothing — 20 km is generous in a dense city core and barely adequate across
 * a spread-out metro — so say which situation it suits.
 */
function radiusGuide(km: number): string {
  if (km <= 7)
    return "Tight. Suits a dense core where several partners cover each neighbourhood. Few partners see any one lead, so thin areas need zones to fill the gaps.";
  if (km <= 15)
    return "City-wide. A sensible default once coverage across the city is steady.";
  if (km <= 25)
    return "Metro and suburbs. The usual choice for Delhi NCR — most partners can still reach the job within about an hour.";
  if (km <= 40)
    return "Wide. Use where partners are thin on the ground and one job is worth the travel.";
  return "Very wide. Close to every partner seeing every lead — reasonable only while building coverage in a new city.";
}

const RETRY_OPTIONS = [0, 1, 2, 3];

/** What a retry count means in practice, so the number is not just a number. */
function retryGuide(n: number): string {
  if (n === 0)
    return "Off. A lead is broadcast once — if nobody accepts, the booking stays pending until someone allocates it by hand.";
  if (n === 1)
    return "One extra attempt. Catches partners who were briefly away from their phone.";
  if (n === 2)
    return "Two extra attempts. A reasonable default — most leads are taken on the first or second offer.";
  return "Aggressive. Worth it only where coverage is thin: the same partners are alarmed again and again, which teaches them to ignore the alarm.";
}
const RING_OPTIONS = [0, 1, 2, 3];

/** What repeat rings mean for the partner holding the phone. */
function ringGuide(n: number): string {
  if (n === 0)
    return "Off. Each partner is alerted once per offer. If that one alert is missed — phone between networks, app just reopened — the lead is silent for them.";
  if (n === 1)
    return "One more ring. Covers a first alert that was delayed or missed.";
  if (n === 2)
    return "Two more rings. A reasonable default — the lead sounds three times, like a call that keeps ringing until it is answered or declined.";
  return "Persistent. The alarm keeps sounding; partners who have already answered or gone off duty are never rung again.";
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  /** For a switch that only means anything while another one is on. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-success" : "bg-muted"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------- scaffolding */

/**
 * One group of related settings. The heading answers "which part of the
 * journey is this?", the aside carries the picture of the rule, and the
 * controls sit beside it rather than under a wall of prose.
 */
function Section({
  title,
  lede,
  figure,
  children,
}: {
  title: string;
  lede: string;
  /** The live drawing for this group, when the rule has a shape. */
  figure?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{lede}</p>
      </header>
      {figure ? (
        <div className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="mx-auto max-w-md">{figure}</div>
        </div>
      ) : null}
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** A switch with its explanation, laid out the same way every time. */
function SwitchRow({
  title,
  children,
  checked,
  onChange,
  disabled = false,
  dimmed = false,
}: {
  title: string;
  children: ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** For a row that only applies while another switch is on. */
  dimmed?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 px-5 py-4">
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold ${
            dimmed ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
          {children}
        </p>
      </div>
      <div className="pt-0.5">
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

/** A labelled number input with its hint, so every field reads alike. */
function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint: ReactNode;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** The small preset pills under radius, rings and retries. */
function Pills({
  options,
  value,
  onChange,
  format,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`rounded-lg border px-3 py-1 text-xs transition ${
            value === n
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          {format(n)}
        </button>
      ))}
    </div>
  );
}

type FormState = Pick<
  AllocationSettings,
  | "enabled"
  | "method"
  | "radiusKm"
  | "maxAgents"
  | "restrictToGeofence"
  | "radiusInsideZone"
  | "includeUnlocatedPartners"
  | "leadRetryCount"
  | "leadRetryAfterMinutes"
  | "startRadiusMeters"
  | "presenceStaleMinutes"
  | "dutySessionMaxHours"
  | "leadRingRepeatCount"
  | "leadRingRepeatSeconds"
  | "tagMatchingEnabled"
  | "tagFallbackToCategory"
>;

export default function AutoAllocationPage() {
  const queryClient = useQueryClient();
  // Local edits overlay the server copy; null = no unsaved edits.
  const [edits, setEdits] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.allocationSettings,
    queryFn: () => dispatchApi.getAllocationSettings(),
  });

  const form: FormState | null =
    edits ??
    (data
      ? {
          enabled: data.enabled,
          method: data.method,
          radiusKm: data.radiusKm,
          maxAgents: data.maxAgents,
          restrictToGeofence: data.restrictToGeofence,
          radiusInsideZone: data.radiusInsideZone,
          includeUnlocatedPartners: data.includeUnlocatedPartners,
          leadRetryCount: data.leadRetryCount,
          leadRetryAfterMinutes: data.leadRetryAfterMinutes,
          startRadiusMeters: data.startRadiusMeters,
          presenceStaleMinutes: data.presenceStaleMinutes,
          dutySessionMaxHours: data.dutySessionMaxHours,
          leadRingRepeatCount: data.leadRingRepeatCount,
          leadRingRepeatSeconds: data.leadRingRepeatSeconds,
          tagMatchingEnabled: data.tagMatchingEnabled,
          tagFallbackToCategory: data.tagFallbackToCategory,
        }
      : null);
  const setForm = (next: FormState) => setEdits(next);

  const mutation = useMutation({
    mutationFn: (body: FormState) => dispatchApi.updateAllocationSettings(body),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.allocationSettings, saved);
      setEdits(null);
      setNotice({
        kind: "ok",
        text: "Allocation settings saved. New bookings use them immediately.",
      });
    },
    onError: (e) =>
      setNotice({
        kind: "error",
        text:
          e instanceof ApiError ? e.message : "Could not save the settings.",
      }),
  });

  if (isLoading || (!form && !isError)) {
    return (
      <div className="flex h-72 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">
          Couldn’t load allocation settings.
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

  const capDisabled = form.method === "BROADCAST";
  const dirty = edits !== null;
  const saveBlocked =
    mutation.isPending ||
    form.radiusKm < 0.5 ||
    form.startRadiusMeters < 25 ||
    form.presenceStaleMinutes < 5 ||
    form.dutySessionMaxHours < 1 ||
    form.leadRingRepeatSeconds < 10;

  // Spell out what the combination of switches actually does. The radius and
  // the geofence interact in a way no single field can express: inside a zone
  // the radius is skipped unless asked for, and a partner with no coordinates
  // sits outside the radius rule entirely.
  const summaryLines: string[] = !form.enabled
    ? [
        "Auto allocation is off. No lead is broadcast — every booking must be assigned by hand.",
      ]
    : [
        ...(form.restrictToGeofence
          ? [
              form.radiusInsideZone
                ? `Booking inside a zone → that zone’s team, but only the members within ${form.radiusKm} km.`
                : `Booking inside a zone → every partner on that zone’s team, at any distance. The ${form.radiusKm} km radius does not apply here.`,
              `Booking outside every zone → partners within ${form.radiusKm} km.`,
            ]
          : [
              `Zones are ignored → partners within ${form.radiusKm} km, wherever the booking falls.`,
            ]),
        form.includeUnlocatedPartners
          ? "Partners with no saved location receive every lead as well, because their distance cannot be measured."
          : "Partners with no saved location receive nothing until a location is captured.",
        form.tagMatchingEnabled
          ? `Within that set, a service that names a skill reaches the partners who declared it, plus the generalists — anyone who declared no skill, or only the trade itself. A service that names NO skill reaches the generalists alone, so a specialist is never rung for unspecified work.${
              form.tagFallbackToCategory
                ? " If either case leaves nobody, the whole category is rung instead."
                : " If either case leaves nobody, the booking waits for a manual allocation."
            }`
          : "Skills are ignored → a lead reaches everyone in the category, whatever they specialise in.",
        `A partner can enter the OTP and start the job only within ${form.startRadiusMeters} m of the customer.`,
        `A partner stays on duty until they switch off themselves. If their app is silent for ${form.presenceStaleMinutes} minutes, duty hours pause — and resume the moment the app is heard from again. One session is worth at most ${form.dutySessionMaxHours} hours.`,
        form.leadRingRepeatCount > 0
          ? `Each offer rings a partner ${form.leadRingRepeatCount + 1} times, ${form.leadRingRepeatSeconds} seconds apart, until they accept, reject or go off duty. Only partners who are on duty are alerted; the alert reaches a closed app too.`
          : "Each offer rings a partner once. Only partners who are on duty are alerted; the alert reaches a closed app too.",
        form.leadRetryCount > 0
          ? `Nobody accepts → the lead is offered again up to ${form.leadRetryCount} more time${
              form.leadRetryCount > 1 ? "s" : ""
            }, ${form.leadRetryAfterMinutes} minutes apart.`
          : "Nobody accepts → the booking stays pending until an admin allocates it by hand.",
        form.method === "BROADCAST"
          ? "Everyone eligible is alarmed at once, highest-rated first."
          : `${form.method === "NEAREST" ? "Closest" : "Fewest-jobs"} partners go first${
              form.maxAgents > 0
                ? `, capped at ${form.maxAgents} per lead`
                : " (no cap)"
            }.`,
      ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Auto Allocation
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How a new booking finds a partner. Changes apply to the next
            booking.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            form.enabled
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              form.enabled ? "bg-success" : "bg-warning"
            }`}
          />
          {form.enabled ? "Dispatching automatically" : "Manual allocation only"}
        </span>
      </div>

      {notice ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm ${
            notice.kind === "ok"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="hover:opacity-70">
            ✕
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ------------------------------------------------- the settings */}
        <div className="min-w-0 space-y-6">
          <Section
            title="Who gets the lead"
            lede="The master switch, and how the eligible partners are picked out of the ones in range."
          >
            <SwitchRow
              title="Auto allocation"
              checked={form.enabled}
              onChange={() => setForm({ ...form, enabled: !form.enabled })}
            >
              When off, new bookings are <strong>not</strong> broadcast — leads
              must be handled manually.
            </SwitchRow>

            <div className="px-5 py-4">
              <p className="mb-2.5 text-sm font-semibold text-foreground">
                Allocation method
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {METHODS.map((m) => {
                  const active = form.method === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm({ ...form, method: m.key })}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-ring/30"
                          : "border-border bg-background hover:border-primary/40"
                      }`}
                    >
                      <div className="mb-2 h-9">
                        <MethodGlyph method={m.key} active={active} />
                      </div>
                      <p
                        className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}
                      >
                        {m.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Service radius (km)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={500}
                  step={0.5}
                  value={form.radiusKm}
                  onChange={(e) =>
                    setForm({ ...form, radiusKm: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <div className="mt-2">
                  <Pills
                    options={RADIUS_PRESETS}
                    value={form.radiusKm}
                    onChange={(km) => setForm({ ...form, radiusKm: km })}
                    format={(km) => `${km} km`}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {radiusGuide(form.radiusKm)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rule of thumb: the distance a partner will actually travel for
                  one job — not the size of the city.
                </p>
              </div>
              <NumberField
                label="Max partners per lead"
                value={form.maxAgents}
                onChange={(n) => setForm({ ...form, maxAgents: n })}
                min={0}
                max={100}
                disabled={capDisabled}
                hint={
                  capDisabled
                    ? "Broadcast always reaches everyone in range."
                    : "0 = no cap. Applies to Nearest first and Round robin."
                }
              />
            </div>
          </Section>

          <Section
            title="Zones and distance"
            lede="A zone is a deliberate assignment. Decide whether it outranks the radius or works with it."
            figure={
              <ZoneGlyph
                restrictToGeofence={form.restrictToGeofence}
                radiusInsideZone={form.radiusInsideZone}
                radiusKm={form.radiusKm}
              />
            }
          >
            <SwitchRow
              title="Restrict to geofence"
              checked={form.restrictToGeofence}
              onChange={() =>
                setForm({
                  ...form,
                  restrictToGeofence: !form.restrictToGeofence,
                })
              }
            >
              When a booking lands inside an active zone, only that zone’s
              partners (or its team) get the lead. Bookings outside every zone
              fall back to the radius rule.
            </SwitchRow>

            <SwitchRow
              title="Apply the radius inside zones too"
              checked={form.radiusInsideZone}
              onChange={() =>
                setForm({ ...form, radiusInsideZone: !form.radiusInsideZone })
              }
            >
              Off, a zone’s team receives the lead however far away they are —
              putting a team on a zone counts as a deliberate assignment that
              outranks distance. Turn on for large zones where travel time
              matters: a team member beyond {form.radiusKm} km then stops being
              alarmed.
            </SwitchRow>

            <SwitchRow
              title="Include partners with no saved location"
              checked={form.includeUnlocatedPartners}
              onChange={() =>
                setForm({
                  ...form,
                  includeUnlocatedPartners: !form.includeUnlocatedPartners,
                })
              }
            >
              A partner who registered without GPS has no measurable distance,
              so the radius can neither include nor exclude them. On, they are
              alarmed anyway so their leads are not silently lost. Off makes the
              radius strict — they receive nothing until a location is captured.
            </SwitchRow>
          </Section>

          <Section
            title="Skill matching"
            lede="Whether a tandoor booking wakes every chef, or only the ones who do tandoor."
            figure={<SkillGlyph enabled={form.tagMatchingEnabled} />}
          >
            <SwitchRow
              title="Match leads on skill tags"
              checked={form.tagMatchingEnabled}
              onChange={() =>
                setForm({
                  ...form,
                  tagMatchingEnabled: !form.tagMatchingEnabled,
                })
              }
            >
              Off, a lead goes to everyone in the category — booking an Indian
              curry chef alarms every chef. On, it goes to the partners who
              declared that skill. A partner who has declared no skills keeps
              receiving every lead in their category either way, but a partner
              who has declared one is rung only for work that asks for it —
              including services that name no skill at all. Tag your services
              before switching this on. Check Skill Tags → Coverage first: a tag
              with no partners online turns its services into leads nobody can
              take.
            </SwitchRow>

            <SwitchRow
              title="Fall back to the whole category"
              dimmed={!form.tagMatchingEnabled}
              checked={form.tagFallbackToCategory}
              disabled={!form.tagMatchingEnabled}
              onChange={() =>
                setForm({
                  ...form,
                  tagFallbackToCategory: !form.tagFallbackToCategory,
                })
              }
            >
              Only applies while skill matching is on. If every partner in range
              has declared skills and none of them fits, the lead rings the
              whole category rather than being dropped — a served customer beats
              a perfect match. Turn off once coverage is good and you would
              rather see the gap than hide it.
            </SwitchRow>
          </Section>

          <Section
            title="If nobody answers"
            lede="How hard one offer tries, and how many offers a booking is worth before a human steps in."
          >
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-foreground">
                Ring again if not answered
              </p>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                A lead used to alert each partner exactly once. Sound it again,
                a few seconds apart, for anyone who has not accepted or rejected
                it yet — a missed first alert no longer means a missed job.
                Partners who answered, or went off duty, are not rung again.
              </p>
              <div className="my-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="mx-auto max-w-md">
                  <RingTimeline
                    count={form.leadRingRepeatCount}
                    seconds={form.leadRingRepeatSeconds}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Extra rings
                  </label>
                  <Pills
                    options={RING_OPTIONS}
                    value={form.leadRingRepeatCount}
                    onChange={(n) =>
                      setForm({ ...form, leadRingRepeatCount: n })
                    }
                    format={(n) => (n === 0 ? "Off" : String(n))}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ringGuide(form.leadRingRepeatCount)}
                  </p>
                </div>
                <NumberField
                  label="Seconds between rings"
                  value={form.leadRingRepeatSeconds}
                  onChange={(n) =>
                    setForm({ ...form, leadRingRepeatSeconds: n })
                  }
                  min={10}
                  max={120}
                  disabled={form.leadRingRepeatCount === 0}
                  hint={
                    form.leadRingRepeatCount === 0
                      ? "Set at least one extra ring to use this."
                      : `A partner who has not answered hears the lead ${form.leadRingRepeatCount + 1} times over about ${form.leadRingRepeatSeconds * form.leadRingRepeatCount} seconds.`
                  }
                />
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-foreground">
                Retry unaccepted leads
              </p>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                If every partner lets the alarm ring out, offer the lead again.
                Without this a booking nobody accepts stays pending with no one
                assigned and nothing to flag it.
              </p>
              <div className="my-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="mx-auto max-w-md">
                  <RetryTimeline
                    count={form.leadRetryCount}
                    minutes={form.leadRetryAfterMinutes}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Extra attempts
                  </label>
                  <Pills
                    options={RETRY_OPTIONS}
                    value={form.leadRetryCount}
                    onChange={(n) => setForm({ ...form, leadRetryCount: n })}
                    format={(n) => (n === 0 ? "Off" : String(n))}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {retryGuide(form.leadRetryCount)}
                  </p>
                </div>
                <NumberField
                  label="Wait before retrying (minutes)"
                  value={form.leadRetryAfterMinutes}
                  onChange={(n) =>
                    setForm({ ...form, leadRetryAfterMinutes: n })
                  }
                  min={1}
                  max={120}
                  disabled={form.leadRetryCount === 0}
                  hint={
                    form.leadRetryCount === 0
                      ? "Set at least one attempt to use this."
                      : `A lead rings unanswered for ${form.leadRetryAfterMinutes} minutes before being offered again. Total ${form.leadRetryCount + 1} attempts over about ${form.leadRetryAfterMinutes * form.leadRetryCount} minutes.`
                  }
                />
              </div>
            </div>
          </Section>

          <Section
            title="On the job"
            lede="What happens after a partner accepts: where they may start, and which hours count."
          >
            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-foreground">
                Start-service distance
              </p>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                How close a partner must be to the customer before the app lets
                them enter the OTP and start the job. Stops a partner starting
                from home to lock in the earning.
              </p>
              <div className="my-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="mx-auto max-w-md">
                  <ArrivalGate metres={form.startRadiusMeters} />
                </div>
              </div>
              <div className="max-w-sm">
                <NumberField
                  label="Distance (metres)"
                  value={form.startRadiusMeters}
                  onChange={(n) => setForm({ ...form, startRadiusMeters: n })}
                  min={25}
                  max={5000}
                  step={25}
                  hint={`A partner farther than ${form.startRadiusMeters} m cannot enter the OTP. Set it wide enough to absorb the GPS error a phone reports at the property, and narrow enough that a partner in the next street cannot start the job from there.`}
                />
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm font-semibold text-foreground">Duty time</p>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                Going on duty is the partner&rsquo;s choice and stays until they
                switch off. These control only how duty <em>hours</em> are
                counted — a partner whose app has gone quiet keeps receiving
                leads through the call alarm, but is not credited hours nobody
                can vouch for.
              </p>
              <div className="my-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="mx-auto max-w-md">
                  <DutyRibbon
                    staleMinutes={form.presenceStaleMinutes}
                    maxHours={form.dutySessionMaxHours}
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <NumberField
                  label="Pause hours after silence (minutes)"
                  value={form.presenceStaleMinutes}
                  onChange={(n) => setForm({ ...form, presenceStaleMinutes: n })}
                  min={5}
                  max={1440}
                  hint={`After ${form.presenceStaleMinutes} minutes without a heartbeat from the app, the partner’s current duty session closes at the last moment it was heard. They stay on duty; hours start again when the app is next seen.`}
                />
                <NumberField
                  label="Longest single session (hours)"
                  value={form.dutySessionMaxHours}
                  onChange={(n) => setForm({ ...form, dutySessionMaxHours: n })}
                  min={1}
                  max={24}
                  hint={`No single session can be worth more than ${form.dutySessionMaxHours} hours, so an abandoned one can never inflate the duty-time report.`}
                />
              </div>
            </div>
          </Section>
        </div>

        {/* --------------------------------- the consequence, always in view */}
        {/* Pinned below the 4rem topbar, with its own scroll so a long summary
            never pushes the Save button off the screen. */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:pb-1">
          <AllocationPreview
            enabled={form.enabled}
            method={form.method}
            radiusKm={form.radiusKm}
            maxAgents={form.maxAgents}
            restrictToGeofence={form.restrictToGeofence}
            radiusInsideZone={form.radiusInsideZone}
            includeUnlocatedPartners={form.includeUnlocatedPartners}
            tagMatchingEnabled={form.tagMatchingEnabled}
          />

          {/* Plain-English readback of the rules above, so the interaction
              between the radius and the geofence is never left to be inferred. */}
          <div className="rounded-2xl border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              What happens with these settings
            </p>
            <ul className="space-y-2 px-4 py-3">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span aria-hidden className="text-primary">
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {dirty ? (
                  <span className="font-medium text-warning">
                    Unsaved changes
                  </span>
                ) : data ? (
                  <>
                    Last saved{" "}
                    {new Date(data.updatedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => mutation.mutate(form)}
                disabled={saveBlocked}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
                Save Settings
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
