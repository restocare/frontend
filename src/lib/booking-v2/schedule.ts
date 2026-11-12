/**
 * Date and hours logic for the hourly booking flow. Pure: no DOM, no API.
 *
 * Times are minutes since midnight in IST. Starts run 6:00 AM to 11:00 PM in
 * one-hour steps; an end may run past midnight, as late as 6:00 AM the next
 * day (END_LIMIT, 1800), so an evening shift can be booked (7 PM – 2 AM). The shortest bookable length and the default
 * window come from the service's shift variants, whose names carry both,
 * e.g. "5 Hour Shift (11 AM – 4 PM)".
 */

import {
  getNextDays,
  istNow,
  parseTimeToken,
  parseVariantShift,
  type DayOption,
} from "../booking-shifts";

export const STEP_MINUTES = 60;
export const DAY_START = 6 * 60;
export const DAY_END = 24 * 60;
/** The latest an end may be: 6:00 AM the next day. */
export const END_LIMIT = DAY_END + DAY_START;
export const DAYS_AHEAD = 7;
/**
 * Notice before a start, in minutes: now + 2 hours, rounded to the NEAREST
 * hour (12:29 → 2 PM, 12:30 → 3 PM). The server allows what this can offer:
 * 1 hour 30 minutes.
 */
export const SAME_DAY_LEAD = 120;
/** Shortest and longest booking, whatever the variants say: 7 to 12 hours. The server refuses shorter. */
export const MIN_MINUTES = 7 * 60;
export const MAX_MINUTES = 12 * 60;

export interface Clock {
  dateISO: string;
  minutes: number;
}

export interface Window {
  start: number;
  end: number;
}

export interface NamedVariant {
  variantId: number;
  name: string;
  price?: number;
}

export function clockNow(): Clock {
  return istNow();
}

export function getDays(count = DAYS_AHEAD): DayOption[] {
  return getNextDays(count);
}

/** 660 → "11:00 AM"; 1440 → "12:00 AM". */
export function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** 300 → "5 hrs"; 330 → "5 hrs 30 min"; 60 → "1 hr". */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  let out = `${h} ${h === 1 ? "hr" : "hrs"}`;
  if (r) out += ` ${r} min`;
  return out;
}

/**
 * "HH:mm" for the API. Midnight becomes 23:59 so it stays on the same day;
 * a later end wraps to the next day's clock ("02:00"), which the server reads
 * as the next day whenever it is earlier than the start.
 */
export function toHHmm(minutes: number): string {
  if (minutes === DAY_END) return "23:59";
  const wrapped = minutes > DAY_END ? minutes - DAY_END : minutes;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** fmtTime, with "next day" after an end that runs past midnight: 1500 → "1:00 AM next day". */
export function fmtEndTime(minutes: number): string {
  return minutes > DAY_END ? `${fmtTime(minutes)} next day` : fmtTime(minutes);
}

export function earliestStart(dateISO: string, clock: Clock): number {
  if (dateISO !== clock.dateISO) return DAY_START;
  const soonest =
    Math.round((clock.minutes + SAME_DAY_LEAD) / STEP_MINUTES) * STEP_MINUTES;
  return Math.max(DAY_START, soonest);
}

/** Nearest step: a draft saved with the old half-hour steps lands on the hour. */
export function snapToStep(minutes: number): number {
  return Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
}

export function latestStart(minMinutes: number): number {
  return Math.min(END_LIMIT - minMinutes, DAY_END - STEP_MINUTES);
}

export function timeOptions(from: number, to: number): number[] {
  const out: number[] = [];
  for (let t = from; t <= to; t += STEP_MINUTES) out.push(t);
  return out;
}

export function dayIsBookable(dateISO: string, minMinutes: number, clock: Clock): boolean {
  return earliestStart(dateISO, clock) <= latestStart(minMinutes);
}

/** Minutes a shift variant lasts, from its name, or null for week-long ones. */
export function shiftMinutes(name: string): number | null {
  const { durationHours } = parseVariantShift(name);
  return durationHours && durationHours > 0 ? durationHours * 60 : null;
}

/** The shortest variant, floored at `MIN_MINUTES`; `MIN_MINUTES` when none states one. */
export function minShiftMinutes(variants: { name: string }[]): number {
  const mins = variants
    .map((v) => shiftMinutes(v.name))
    .filter((m): m is number => m != null);
  return mins.length ? Math.max(MIN_MINUTES, Math.min(...mins)) : MIN_MINUTES;
}

/** The window a shift variant's name states, e.g. "(11 AM – 4 PM)". */
export function shiftWindow(name: string): Window | null {
  const { timing, durationHours } = parseVariantShift(name);
  if (!timing) return null;
  const [a, b] = timing.split(/[–-]/);
  const startHour = parseTimeToken(a ?? "");
  if (startHour == null) return null;
  let endHour = parseTimeToken(b ?? "");
  if (endHour == null && durationHours) endHour = startHour + durationHours;
  if (endHour == null) return null;
  if (endHour <= startHour) endHour += 24;
  return { start: startHour * 60, end: Math.min(endHour * 60, END_LIMIT) };
}

/** First variant window that fits the day, else 11:00 for the minimum length. */
export function defaultWindow(variants: { name: string }[], minMinutes: number): Window {
  for (const v of variants) {
    const w = shiftWindow(v.name);
    if (w && w.end - w.start >= minMinutes && w.start >= DAY_START) return w;
  }
  return { start: 11 * 60, end: 11 * 60 + minMinutes };
}

/**
 * The shift variant that matches the chosen hours, so the booking record
 * keeps a shift label the ops panel understands. Same length and same start
 * wins; else any variant of the same length; else null.
 */
export function pickShiftVariant(
  variants: NamedVariant[],
  start: number,
  end: number,
): number | null {
  const wanted = end - start;
  let sameLength: number | null = null;
  for (const v of variants) {
    if (shiftMinutes(v.name) !== wanted) continue;
    const w = shiftWindow(v.name);
    if (w && w.start === start) return v.variantId;
    if (sameLength == null) sameLength = v.variantId;
  }
  return sameLength;
}

export type RangeProblem = "ok" | "too-short" | "too-long" | "passed";

export function validateRange(
  start: number,
  end: number,
  minMinutes: number,
  dateISO: string,
  clock: Clock,
): RangeProblem {
  if (end - start < minMinutes) return "too-short";
  if (end - start > MAX_MINUTES) return "too-long";
  if (start < earliestStart(dateISO, clock)) return "passed";
  return "ok";
}

/* ----------------------------- date labels ------------------------------ */

function atNoonUtc(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00Z`);
}

/** "Sep" */
export function monthShort(dateISO: string): string {
  return atNoonUtc(dateISO).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
}

/** "September 2026" */
export function monthLabel(dateISO: string): string {
  return atNoonUtc(dateISO).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Tue, 22 Sep 2026" */
export function fmtDateLong(dateISO: string): string {
  return atNoonUtc(dateISO).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Tue 22 Sep" */
export function fmtDateShort(dateISO: string): string {
  return atNoonUtc(dateISO).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
