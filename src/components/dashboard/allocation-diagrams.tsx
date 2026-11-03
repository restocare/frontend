"use client";

/**
 * Small plan-view drawings for the Auto Allocation page.
 *
 * Every setting here is a sentence about geometry or about time, and a reader
 * meets the sentence only after they have already flipped the switch. These
 * draw the consequence next to the control, and they read from the live form
 * values — a timeline with three marks means three rings, not a stock picture.
 *
 * All of them are read-only and own no state.
 */

import type { ReactNode } from "react";

function Frame({
  children,
  w,
  h,
  label,
  className = "",
}: {
  children: ReactNode;
  w: number;
  h: number;
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

/**
 * One glyph per allocation method, sitting on its own card. The job is to make
 * the three cards distinguishable at a glance, before the prose is read.
 */
export function MethodGlyph({
  method,
  active,
}: {
  method: "BROADCAST" | "NEAREST" | "ROUND_ROBIN";
  active: boolean;
}) {
  const on = active ? "text-primary" : "text-muted-foreground";
  const off = active ? "text-primary/30" : "text-muted-foreground/30";

  if (method === "ROUND_ROBIN") {
    // A queue ordered by how much work each partner already holds.
    const jobs = [0, 2, 3, 5];
    return (
      <Frame
        w={108}
        h={40}
        label="Round robin: the partner holding the fewest jobs is offered first"
      >
        {jobs.map((n, i) => {
          const x = 14 + i * 27;
          const picked = i === 0;
          return (
            <g key={i} className={picked ? on : off}>
              <circle cx={x} cy={12} r={6} fill="currentColor" />
              {Array.from({ length: 5 }).map((_, b) => (
                <rect
                  key={b}
                  x={x - 7 + b * 3.2}
                  y={24}
                  width={2}
                  height={8}
                  rx={1}
                  fill="currentColor"
                  fillOpacity={b < n ? 0.85 : 0.18}
                />
              ))}
            </g>
          );
        })}
      </Frame>
    );
  }

  // Broadcast and Nearest share a hub-and-spoke picture; what differs is how
  // many spokes carry the lead.
  // The frame is wider than it is tall, so the ring is flattened vertically
  // to keep every dot inside it.
  const SQUASH = 0.36;
  const spokes = [
    { a: 200, r: 26, near: true },
    { a: 340, r: 24, near: true },
    { a: 20, r: 38, near: false },
    { a: 150, r: 40, near: false },
    { a: 285, r: 42, near: false },
  ];
  return (
    <Frame
      w={108}
      h={40}
      label={
        method === "BROADCAST"
          ? "Broadcast: every partner in range is alarmed at once"
          : "Nearest first: the closest partners are alarmed, the rest wait"
      }
    >
      {spokes.map((s, i) => {
        const rad = ((s.a - 90) * Math.PI) / 180;
        const x = 54 + s.r * Math.cos(rad);
        const y = 20 + s.r * SQUASH * Math.sin(rad);
        const lit = method === "BROADCAST" || s.near;
        return (
          <g key={i} className={lit ? on : off}>
            <line
              x1={54}
              y1={20}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={1.2}
              strokeOpacity={lit ? 0.55 : 0.3}
              strokeDasharray={lit ? undefined : "2 3"}
            />
            <circle cx={x} cy={y} r={lit ? 5 : 4} fill="currentColor" />
          </g>
        );
      })}
      <circle cx={54} cy={20} r={4} className={on} fill="currentColor" />
      <circle
        cx={54}
        cy={20}
        r={8}
        className={on}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.4}
      />
    </Frame>
  );
}

/**
 * The one rule on this page that cannot be held in the head from prose alone:
 * inside a zone, distance stops mattering — unless you ask for it back.
 */
export function ZoneGlyph({
  restrictToGeofence,
  radiusInsideZone,
  radiusKm,
}: {
  restrictToGeofence: boolean;
  radiusInsideZone: boolean;
  radiusKm: number;
}) {
  if (!restrictToGeofence) {
    return (
      <Frame w={280} h={96} label="Zones ignored: only the radius decides">
        <circle
          cx={70}
          cy={48}
          r={34}
          className="text-foreground"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
        <circle cx={70} cy={48} r={4} className="text-primary" fill="currentColor" />
        {[
          [48, 34],
          [92, 40],
          [64, 72],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={5.5}
            className="text-primary"
            fill="currentColor"
          />
        ))}
        {[
          [126, 26],
          [138, 66],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={5.5}
            className="text-muted-foreground/30"
            fill="currentColor"
          />
        ))}
        <text x={70} y={11} className="fill-muted-foreground text-[9px]" textAnchor="middle">
          {radiusKm} km
        </text>
        <text x={162} y={44} className="fill-muted-foreground text-[10px]">
          Inside the ring
        </text>
        <text x={162} y={58} className="fill-muted-foreground text-[10px]">
          rings. Outside
        </text>
        <text x={162} y={72} className="fill-muted-foreground text-[10px]">
          stays silent.
        </text>
      </Frame>
    );
  }

  return (
    <Frame
      w={280}
      h={96}
      label={
        radiusInsideZone
          ? "Zone members beyond the radius stop being alarmed"
          : "Every zone member is alarmed, at any distance"
      }
    >
      <path
        d="M 20 14 L 92 8 L 118 54 L 74 86 L 16 66 Z"
        className="text-primary"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {/* The radius, drawn solid only when it governs inside the zone. */}
      <circle
        cx={60}
        cy={48}
        r={26}
        className="text-foreground"
        fill="none"
        stroke="currentColor"
        strokeOpacity={radiusInsideZone ? 0.35 : 0.12}
        strokeWidth={1.5}
        strokeDasharray={radiusInsideZone ? undefined : "2 4"}
      />
      <circle cx={60} cy={48} r={4} className="text-primary" fill="currentColor" />
      {/* Two inside the radius, two in the zone but far away. */}
      {[
        [44, 34, 1],
        [76, 60, 1],
        [104, 26, 0],
        [86, 76, 0],
      ].map(([x, y, near], i) => {
        const lit = !radiusInsideZone || near === 1;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={5.5}
            className={lit ? "text-primary" : "text-muted-foreground/30"}
            fill="currentColor"
          />
        );
      })}
      <text x={162} y={38} className="fill-muted-foreground text-[10px]">
        {radiusInsideZone ? "Zone team, but" : "Whole zone team,"}
      </text>
      <text x={162} y={52} className="fill-muted-foreground text-[10px]">
        {radiusInsideZone ? `within ${radiusKm} km only.` : "however far away."}
      </text>
      <text x={162} y={70} className="fill-muted-foreground text-[10px]">
        Dashed = the zone.
      </text>
    </Frame>
  );
}

/**
 * Skill matching in one picture: who a Tandoor booking reaches once services
 * carry skills, and who keeps hearing everything.
 */
export function SkillGlyph({ enabled }: { enabled: boolean }) {
  const rows = [
    { key: "tandoor", label: "Declared Tandoor", rings: true },
    { key: "general", label: "Declared no skill", rings: true },
    { key: "conti", label: "Declared Continental", rings: false },
  ];
  return (
    <Frame
      w={300}
      h={96}
      label={
        enabled
          ? "A Tandoor booking reaches Tandoor partners and generalists only"
          : "Skills ignored: the booking reaches every chef"
      }
    >
      <rect
        x={2}
        y={32}
        width={86}
        height={32}
        rx={8}
        className="text-primary"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.35}
      />
      <text
        x={45}
        y={47}
        className="fill-foreground text-[10px] font-semibold"
        textAnchor="middle"
      >
        Tandoor
      </text>
      <text x={45} y={58} className="fill-muted-foreground text-[9px]" textAnchor="middle">
        booking
      </text>

      {rows.map((r, i) => {
        const y = 20 + i * 28;
        const lit = !enabled || r.rings;
        return (
          <g key={r.key} className={lit ? "text-primary" : "text-muted-foreground/35"}>
            <path
              d={`M 90 48 C 118 48, 118 ${y}, 142 ${y}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              strokeOpacity={lit ? 0.5 : 0.3}
              strokeDasharray={lit ? undefined : "3 3"}
            />
            <circle cx={148} cy={y} r={6} fill="currentColor" />
            {enabled && !r.rings && (
              <path
                d={`M 145.4 ${y - 2.6} L 150.6 ${y + 2.6} M 150.6 ${y - 2.6} L 145.4 ${y + 2.6}`}
                className="text-background"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            )}
            <text
              x={162}
              y={y + 3.5}
              className={`text-[10px] ${lit ? "fill-foreground" : "fill-muted-foreground"}`}
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

/** One offer, heard once or several times, drawn on the seconds it occupies. */
export function RingTimeline({ count, seconds }: { count: number; seconds: number }) {
  const marks = count + 1;
  const W = 300;
  const x0 = 14;
  const x1 = W - 58;
  const step = marks > 1 ? (x1 - x0) / (marks - 1) : 0;

  return (
    <Frame w={W} h={52} label={`The lead sounds ${marks} time${marks > 1 ? "s" : ""}`}>
      <line
        x1={x0}
        y1={24}
        x2={count > 0 ? x1 : x0 + 40}
        y2={24}
        className="text-border"
        stroke="currentColor"
        strokeWidth={2}
      />
      {Array.from({ length: marks }).map((_, i) => {
        const x = x0 + step * i;
        return (
          <g key={i} className="text-primary">
            <circle cx={x} cy={24} r={6} fill="currentColor" fillOpacity={1 - i * 0.18} />
            <text x={x} y={12} className="fill-muted-foreground text-[9px]" textAnchor="middle">
              {i === 0 ? "0s" : `${seconds * i}s`}
            </text>
          </g>
        );
      })}
      {count > 0 && (
        <text x={x1 + 12} y={28} className="fill-muted-foreground text-[10px]">
          stops
        </text>
      )}
      <text x={x0 - 4} y={46} className="fill-muted-foreground text-[10px]">
        {count === 0
          ? "Sounds once. A missed alert is a missed job."
          : `Sounds ${marks} times, then stops.`}
      </text>
    </Frame>
  );
}

/** The whole life of an unanswered lead, in minutes. */
export function RetryTimeline({ count, minutes }: { count: number; minutes: number }) {
  const attempts = count + 1;
  const W = 300;
  const x0 = 14;
  const span = W - 76 - x0;
  const slot = span / attempts;

  return (
    <Frame w={W} h={58} label={`${attempts} attempt${attempts > 1 ? "s" : ""} in total`}>
      {Array.from({ length: attempts }).map((_, i) => {
        const x = x0 + slot * i;
        return (
          <g key={i}>
            <rect
              x={x}
              y={20}
              width={slot * 0.6}
              height={14}
              rx={4}
              className="text-primary"
              fill="currentColor"
              fillOpacity={1 - i * 0.22}
            />
            <text x={x} y={13} className="fill-muted-foreground text-[9px]">
              {i === 0 ? "0 min" : `${minutes * i}m`}
            </text>
            <line
              x1={x + slot * 0.6}
              y1={27}
              x2={x + slot}
              y2={27}
              className="text-muted-foreground/40"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          </g>
        );
      })}
      <g className="text-warning">
        <circle cx={W - 56} cy={27} r={7} fill="currentColor" fillOpacity={0.2} />
        <path
          d={`M ${W - 56} 23.5 L ${W - 56} 27.5`}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={W - 56} cy={30.5} r={0.9} fill="currentColor" />
      </g>
      <text x={W - 46} y={30} className="fill-muted-foreground text-[10px]">
        manual
      </text>
      <text x={x0 - 4} y={50} className="fill-muted-foreground text-[10px]">
        {count === 0
          ? "One offer, then the booking waits for an admin."
          : `${attempts} offers over about ${minutes * count} minutes, then an admin.`}
      </text>
    </Frame>
  );
}

/**
 * How close is close enough to start the job. Schematic, not to scale: the
 * ring grows with the setting so 50 m and 2 km look different, on a sqrt
 * curve so the frame still holds the largest value.
 */
export function ArrivalGate({ metres }: { metres: number }) {
  const r = 18 + Math.min(Math.sqrt(Math.max(metres, 0)) * 1.1, 22);
  // Clear of the door even at the smallest ring, inside it at every size.
  const okX = 76 - Math.max(r * 0.6, 17);
  const okY = 48 + Math.max(r * 0.45, 13);
  const noX = 76 + r + 18;

  return (
    <Frame w={300} h={96} label={`A partner must be within ${metres} metres to start`}>
      <circle
        cx={76}
        cy={48}
        r={r}
        className="text-success"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {/* The customer's door. */}
      <path
        d="M 68 52 L 76 44 L 84 52 L 84 60 L 68 60 Z"
        className="text-foreground"
        fill="currentColor"
        fillOpacity={0.7}
      />
      <g className="text-success">
        <circle cx={okX} cy={okY} r={6.5} fill="currentColor" />
        <path
          d={`M ${okX - 2.8} ${okY} l 2.1 2.3 l 3.6 -4.2`}
          className="text-background"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="text-danger">
        <circle cx={noX} cy={32} r={6.5} fill="currentColor" />
        <path
          d={`M ${noX - 2.6} 29.4 L ${noX + 2.6} 34.6 M ${noX + 2.6} 29.4 L ${noX - 2.6} 34.6`}
          className="text-background"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </g>
      <text x={190} y={40} className="fill-muted-foreground text-[10px]">
        Within {metres} m the
      </text>
      <text x={190} y={54} className="fill-muted-foreground text-[10px]">
        OTP opens. Beyond it
      </text>
      <text x={190} y={68} className="fill-muted-foreground text-[10px]">
        the job cannot start.
      </text>
    </Frame>
  );
}

/** Duty hours: what counts, what pauses, and where the cap falls. */
export function DutyRibbon({
  staleMinutes,
  maxHours,
}: {
  staleMinutes: number;
  maxHours: number;
}) {
  const W = 300;
  return (
    <Frame
      w={W}
      h={72}
      label="Duty hours pause while the app is silent and resume when it is heard again"
    >
      <text x={14} y={13} className="fill-muted-foreground text-[9px]">
        goes on duty
      </text>
      <text x={W - 14} y={13} className="fill-muted-foreground text-[9px]" textAnchor="end">
        switches off
      </text>

      <rect
        x={14}
        y={20}
        width={96}
        height={16}
        rx={5}
        className="text-success"
        fill="currentColor"
        fillOpacity={0.7}
      />
      <rect
        x={112}
        y={20}
        width={62}
        height={16}
        rx={5}
        className="text-muted-foreground"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeDasharray="4 3"
      />
      <rect
        x={176}
        y={20}
        width={110}
        height={16}
        rx={5}
        className="text-success"
        fill="currentColor"
        fillOpacity={0.7}
      />

      <path
        d="M 112 42 L 112 48 L 174 48 L 174 42"
        className="text-muted-foreground/50"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <text x={62} y={60} className="fill-muted-foreground text-[9px]" textAnchor="middle">
        counted
      </text>
      <text x={143} y={60} className="fill-muted-foreground text-[9px]" textAnchor="middle">
        silent {staleMinutes} min
      </text>
      <text x={231} y={60} className="fill-muted-foreground text-[9px]" textAnchor="middle">
        counted, capped at {maxHours} h
      </text>
      <text x={143} y={70} className="fill-muted-foreground text-[9px]" textAnchor="middle">
        hours paused
      </text>
    </Frame>
  );
}
