"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  queryKeys,
  type AllocationMethod,
  type AllocationSettings,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

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
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-success" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Auto Allocation
        </h1>
        <p className="text-sm text-muted-foreground">
          How new booking leads are pushed to service partners. Changes apply to
          the next booking.
        </p>
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

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        {/* Master switch */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Auto allocation
            </p>
            <p className="text-sm text-muted-foreground">
              When off, new bookings are <strong>not</strong> broadcast — leads
              must be handled manually.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => setForm({ ...form, enabled: !form.enabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              form.enabled ? "bg-success" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                form.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Method */}
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            Allocation method
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {METHODS.map((m) => {
              const active = form.method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setForm({ ...form, method: m.key })}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-ring/30"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
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

        {/* Numbers */}
        <div className="grid gap-4 sm:grid-cols-2">
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
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RADIUS_PRESETS.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setForm({ ...form, radiusKm: km })}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    form.radiusKm === km
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {radiusGuide(form.radiusKm)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rule of thumb: the distance a partner will actually travel for one
              job — not the size of the city.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Max partners per lead
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.maxAgents}
              disabled={capDisabled}
              onChange={(e) =>
                setForm({ ...form, maxAgents: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {capDisabled
                ? "Broadcast always reaches everyone in range."
                : "0 = no cap. Applies to Nearest first and Round robin."}
            </p>
          </div>
        </div>

        {/* Geofence restriction */}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Restrict to geofence
            </p>
            <p className="text-sm text-muted-foreground">
              When a booking lands inside an active zone, only that zone’s
              partners (or its team) get the lead. Bookings outside every zone
              fall back to the radius rule.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.restrictToGeofence}
            onClick={() =>
              setForm({ ...form, restrictToGeofence: !form.restrictToGeofence })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              form.restrictToGeofence ? "bg-success" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                form.restrictToGeofence ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Radius inside zones */}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Apply the radius inside zones too
            </p>
            <p className="text-sm text-muted-foreground">
              Off, a zone’s team receives the lead however far away they are —
              putting a team on a zone counts as a deliberate assignment that
              outranks distance. Turn on for large zones where travel time
              matters: a team member beyond {form.radiusKm} km then stops being
              alarmed.
            </p>
          </div>
          <Toggle
            checked={form.radiusInsideZone}
            onChange={() =>
              setForm({ ...form, radiusInsideZone: !form.radiusInsideZone })
            }
          />
        </div>

        {/* Partners without coordinates */}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Include partners with no saved location
            </p>
            <p className="text-sm text-muted-foreground">
              A partner who registered without GPS has no measurable distance,
              so the radius can neither include nor exclude them. On, they are
              alarmed anyway so their leads are not silently lost. Off makes the
              radius strict — they receive nothing until a location is captured.
            </p>
          </div>
          <Toggle
            checked={form.includeUnlocatedPartners}
            onChange={() =>
              setForm({
                ...form,
                includeUnlocatedPartners: !form.includeUnlocatedPartners,
              })
            }
          />
        </div>

        {/* Ring again */}
        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">
            Ring again if not answered
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A lead used to alert each partner exactly once. Sound it again, a
            few seconds apart, for anyone who has not accepted or rejected it
            yet — a missed first alert no longer means a missed job. Partners
            who answered, or went off duty, are not rung again.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Extra rings
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RING_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, leadRingRepeatCount: n })}
                    className={`rounded-lg border px-3 py-1 text-xs transition ${
                      form.leadRingRepeatCount === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {n === 0 ? "Off" : n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {ringGuide(form.leadRingRepeatCount)}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Seconds between rings
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={form.leadRingRepeatSeconds}
                disabled={form.leadRingRepeatCount === 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    leadRingRepeatSeconds: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.leadRingRepeatCount === 0
                  ? "Set at least one extra ring to use this."
                  : `A partner who has not answered hears the lead ${form.leadRingRepeatCount + 1} times over about ${form.leadRingRepeatSeconds * form.leadRingRepeatCount} seconds.`}
              </p>
            </div>
          </div>
        </div>

        {/* Retry */}
        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">
            Retry unaccepted leads
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            If every partner lets the alarm ring out, offer the lead again.
            Without this a booking nobody accepts stays pending with no one
            assigned and nothing to flag it.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Extra attempts
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RETRY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, leadRetryCount: n })}
                    className={`rounded-lg border px-3 py-1 text-xs transition ${
                      form.leadRetryCount === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {n === 0 ? "Off" : n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {retryGuide(form.leadRetryCount)}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Wait before retrying (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={form.leadRetryAfterMinutes}
                disabled={form.leadRetryCount === 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    leadRetryAfterMinutes: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.leadRetryCount === 0
                  ? "Set at least one attempt to use this."
                  : `A lead rings unanswered for ${form.leadRetryAfterMinutes} minutes before being offered again. Total ${form.leadRetryCount + 1} attempts over about ${form.leadRetryAfterMinutes * form.leadRetryCount} minutes.`}
              </p>
            </div>
          </div>
        </div>

        {/* Arrival gate */}
        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">
            Start-service distance
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How close a partner must be to the customer before the app lets them
            enter the OTP and start the job. Stops a partner starting from home
            to lock in the earning.
          </p>
          <div className="mt-3 max-w-sm">
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Distance (metres)
            </label>
            <input
              type="number"
              min={25}
              max={5000}
              step={25}
              value={form.startRadiusMeters}
              onChange={(e) =>
                setForm({ ...form, startRadiusMeters: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              A partner farther than {form.startRadiusMeters} m cannot enter the
              OTP. Set it wide enough to absorb the GPS error a phone reports at
              the property, and narrow enough that a partner in the next street
              cannot start the job from there.
            </p>
          </div>
        </div>

        {/* Duty presence */}
        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-foreground">Duty time</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Going on duty is the partner&rsquo;s choice and stays until they
            switch off. These control only how duty <em>hours</em> are counted —
            a partner whose app has gone quiet keeps receiving leads through the
            call alarm, but is not credited hours nobody can vouch for.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Pause hours after silence (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={form.presenceStaleMinutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    presenceStaleMinutes: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                After {form.presenceStaleMinutes} minutes without a heartbeat
                from the app, the partner&rsquo;s current duty session closes at
                the last moment it was heard. They stay on duty; hours start
                again when the app is next seen.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Longest single session (hours)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={form.dutySessionMaxHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dutySessionMaxHours: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                No single session can be worth more than{" "}
                {form.dutySessionMaxHours} hours, so an abandoned one can never
                inflate the duty-time report.
              </p>
            </div>
          </div>
        </div>

        {/* Plain-English readback of the rules above, so the interaction between
            the radius and the geofence is never left to be inferred. */}
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            What happens with these settings
          </p>
          <ul className="mt-2 space-y-1.5">
            {summaryLines.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
          {data && (
            <span className="text-xs text-muted-foreground">
              Last saved{" "}
              {new Date(data.updatedAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => mutation.mutate(form)}
            disabled={
              mutation.isPending ||
              form.radiusKm < 0.5 ||
              form.startRadiusMeters < 25 ||
              form.presenceStaleMinutes < 5 ||
              form.dutySessionMaxHours < 1 ||
              form.leadRingRepeatSeconds < 10
            }
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
