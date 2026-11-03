"use client";

/**
 * A plan view of the dispatch rules, drawn from the settings as they stand.
 *
 * Every rule on this page is correct prose, but "a booking inside a zone goes
 * to that zone's team at any distance" is a sentence about geometry — and the
 * reader only meets it after they have already changed something. The picture
 * puts the consequence next to the switch.
 *
 * Read-only: it renders the form state and owns none of it.
 */

export interface AllocationPreviewProps {
  enabled: boolean;
  method: "BROADCAST" | "NEAREST" | "ROUND_ROBIN";
  radiusKm: number;
  maxAgents: number;
  restrictToGeofence: boolean;
  radiusInsideZone: boolean;
  includeUnlocatedPartners: boolean;
  tagMatchingEnabled: boolean;
}

/**
 * A fixed cast, so the drawing is a stable thing to compare against rather
 * than a different picture every render. Distances are real kilometres; the
 * rules below are evaluated against them exactly as dispatch would.
 */
type SamplePartner = {
  id: string;
  km: number;
  /** Clock angle in degrees, 0 = up. */
  angle: number;
  /** Inside the zone covering the booking. */
  inZone: boolean;
  /** Declared a skill the booked service does not need. */
  wrongSkill?: boolean;
};

const PARTNERS: SamplePartner[] = [
  { id: "a", km: 3, angle: 24, inZone: true },
  { id: "b", km: 8, angle: 95, inZone: true },
  { id: "c", km: 8, angle: 300, inZone: true, wrongSkill: true },
  { id: "d", km: 16, angle: 160, inZone: true },
  { id: "e", km: 26, angle: 215, inZone: false },
  { id: "f", km: 38, angle: 340, inZone: false, wrongSkill: true },
  { id: "g", km: 62, angle: 60, inZone: false },
];

/** How far out the frame reaches, in km. */
const VIEW_KM = 70;
const CX = 190;
const CY = 124;
const MAX_R = 104;
/** It now owns a column of its own, so it can afford to be read at a glance. */
const VIEW_H = 252;

/**
 * Square-root scale, so 5 km and 60 km are both legible in one frame. A linear
 * scale would crush every near partner into the centre dot.
 */
function toPx(km: number): number {
  return MAX_R * Math.sqrt(Math.min(km, VIEW_KM) / VIEW_KM);
}

function place(p: SamplePartner): { x: number; y: number } {
  const rad = ((p.angle - 90) * Math.PI) / 180;
  const r = toPx(p.km);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

type Verdict = "rings" | "capped" | "silent";

/** Why each partner ends up where it does — the same order dispatch applies. */
function decide(form: AllocationPreviewProps) {
  if (!form.enabled) {
    return {
      located: PARTNERS.map((p) => ({ p, verdict: "silent" as Verdict })),
      unlocated: "silent" as Verdict,
      ringing: 0,
    };
  }

  const eligible = PARTNERS.filter((p) => {
    if (form.restrictToGeofence) {
      // A zone assignment outranks distance unless the radius is applied inside.
      if (!p.inZone) return p.km <= form.radiusKm;
      return form.radiusInsideZone ? p.km <= form.radiusKm : true;
    }
    return p.km <= form.radiusKm;
  }).filter((p) => !(form.tagMatchingEnabled && p.wrongSkill));

  // Nearest first and round robin send to a capped batch; broadcast does not.
  const capped =
    form.method !== "BROADCAST" && form.maxAgents > 0
      ? [...eligible].sort((a, b) => a.km - b.km).slice(0, form.maxAgents)
      : eligible;
  const sent = new Set(capped.map((p) => p.id));
  const inRange = new Set(eligible.map((p) => p.id));

  const located = PARTNERS.map((p) => ({
    p,
    verdict: (sent.has(p.id)
      ? "rings"
      : inRange.has(p.id)
        ? "capped"
        : "silent") as Verdict,
  }));

  const unlocated: Verdict = form.includeUnlocatedPartners ? "rings" : "silent";

  return {
    located,
    unlocated,
    ringing: located.filter((l) => l.verdict === "rings").length + (form.includeUnlocatedPartners ? 1 : 0),
  };
}

const DOT = {
  rings: "text-primary",
  capped: "text-primary/45",
  silent: "text-muted-foreground/30",
} as const;

export function AllocationPreview(form: AllocationPreviewProps) {
  const { located, unlocated, ringing } = decide(form);
  const ringR = Math.min(toPx(form.radiusKm), MAX_R);
  const beyondView = form.radiusKm > VIEW_KM;

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          Who this booking would reach
        </span>
        <span className="text-sm text-muted-foreground">
          {form.enabled ? (
            <>
              <span className="text-base font-semibold tabular-nums text-foreground">
                {ringing}
              </span>{" "}
              of {PARTNERS.length + 1} alarmed
            </>
          ) : (
            "Nobody — allocation is off"
          )}
        </span>
      </figcaption>

      <div className="bg-muted/30 p-4">
        <svg
          viewBox={`0 0 380 ${VIEW_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${ringing} of ${PARTNERS.length + 1} sample partners would be alarmed for a booking at the centre`}
        >
          {/* Zone: only drawn when it governs anything. */}
          {form.restrictToGeofence && (
            <path
              d={`M ${CX - 90} ${CY - 76} L ${CX + 38} ${CY - 94} L ${CX + 84} ${CY - 5}
                  L ${CX + 32} ${CY + 83} L ${CX - 70} ${CY + 69} Z`}
              className="text-primary transition-opacity duration-200 motion-reduce:transition-none"
              fill="currentColor"
              fillOpacity={0.07}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          {/* Service radius. */}
          <circle
            cx={CX}
            cy={CY}
            r={ringR}
            className="text-foreground transition-all duration-300 ease-out motion-reduce:transition-none"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.28}
            strokeWidth={1.5}
            strokeDasharray={beyondView ? "2 6" : undefined}
          />

          {/* The booking. */}
          <circle cx={CX} cy={CY} r={5} className="text-primary" fill="currentColor" />
          <circle
            cx={CX}
            cy={CY}
            r={11}
            className="text-primary"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4}
          />

          {located.map(({ p, verdict }) => {
            const { x, y } = place(p);
            return (
              <g
                key={p.id}
                className={`${DOT[verdict]} transition-colors duration-200 motion-reduce:transition-none`}
              >
                <circle cx={x} cy={y} r={7} fill={verdict === "capped" ? "none" : "currentColor"} />
                {verdict === "capped" && (
                  <circle cx={x} cy={y} r={7} fill="none" stroke="currentColor" strokeWidth={2} />
                )}
                {form.tagMatchingEnabled && p.wrongSkill && (
                  <path
                    d={`M ${x - 3.5} ${y - 3.5} L ${x + 3.5} ${y + 3.5} M ${x + 3.5} ${y - 3.5} L ${x - 3.5} ${y + 3.5}`}
                    className="text-background"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}

          {/* No GPS: no position to draw, so it sits outside the frame. */}
          <g
            className={`${DOT[unlocated]} transition-colors duration-200 motion-reduce:transition-none`}
          >
            <circle cx={348} cy={VIEW_H - 24} r={7} fill="currentColor" />
          </g>
          <text
            x={336}
            y={VIEW_H - 42}
            className="fill-muted-foreground text-[10px]"
            textAnchor="middle"
          >
            no GPS
          </text>

          {/* The radius, labelled on the ring itself. */}
          <text
            x={CX}
            y={CY - ringR - 7}
            className="fill-muted-foreground text-[11px]"
            textAnchor="middle"
          >
            {beyondView ? `${form.radiusKm} km — past this view` : `${form.radiusKm} km`}
          </text>
        </svg>

      </div>

      <div className="space-y-2 border-t border-border px-4 py-3 text-xs">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-1">
          <Key tone="rings" label="Alarmed" />
          <Key
            tone="capped"
            label={
              form.method === "BROADCAST" || form.maxAgents === 0
                ? "In range, not sent"
                : `Over the ${form.maxAgents}-partner cap`
            }
          />
          <Key tone="silent" label="Not alarmed" />
        </dl>
        {form.restrictToGeofence && (
          <p className="text-muted-foreground">
            The dashed outline is the zone covering the booking.
          </p>
        )}
        {form.tagMatchingEnabled && (
          <p className="text-muted-foreground">
            A cross marks a partner whose declared skill this job does not need.
          </p>
        )}
        <p className="text-muted-foreground">
          A fixed sample, not your live roster — seven partners between 3 and
          62 km, plus one who registered without GPS.
        </p>
      </div>
    </figure>
  );
}

function Key({ tone, label }: { tone: Verdict; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${DOT[tone]}`} aria-hidden>
        <circle
          cx={8}
          cy={8}
          r={6}
          fill={tone === "capped" ? "none" : "currentColor"}
          stroke="currentColor"
          strokeWidth={tone === "capped" ? 2 : 0}
        />
      </svg>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
