/**
 * What an hourly service charges: the single source for its rate, minimum
 * hours and minimum price. Pure: reuses the booking flow's own primitives.
 */

import { hourlyRate } from "./draft";
import { round2 } from "./pricing";
import { minShiftMinutes, shiftMinutes, shiftWindow } from "./schedule";

export interface HourlyTerms {
  rate: number;
  minHours: number;
  minPrice: number;
}

interface HourlyService {
  price: number | null;
  variants: { name: string; price: number }[];
}

export function hourlyTerms(service: HourlyService): HourlyTerms {
  const rate = hourlyRate(service);
  const minHours = minShiftMinutes(service.variants) / 60;
  return { rate, minHours, minPrice: round2(rate * minHours) };
}

/**
 * Headline for a category's active services: the lowest hourly rate and the
 * cheapest minimum booking. Null when no service has a rate.
 */
export function categoryHourlyHeadline(services: HourlyService[]): HourlyTerms | null {
  const priced = services.map(hourlyTerms).filter((t) => t.rate > 0);
  if (!priced.length) return null;
  const cheapest = priced.reduce((best, t) => (t.rate * t.minHours < best.rate * best.minHours ? t : best));
  return {
    rate: Math.min(...priced.map((t) => t.rate)),
    minHours: cheapest.minHours,
    minPrice: cheapest.minPrice,
  };
}

/** Hours worked from this time of day on attract the night premium. */
export const NIGHT_START_MINUTES = 18 * 60;
const DAY_END_MINUTES = 24 * 60;

/** Hours of [start, end] (minutes since midnight) at or after 18:00 and before midnight. */
export function nightHoursIn(start: number, end: number): number {
  const from = Math.max(start, NIGHT_START_MINUTES);
  const to = Math.min(end, DAY_END_MINUTES);
  return Math.max(0, to - from) / 60;
}

/**
 * Per-hour night surcharge, read from the catalogue: the 5-hour shift starting
 * at/after 18:00 against the 5-hour shift ending at/before 18:00. 0 if either is missing.
 */
export function nightPremiumPerHour(variants: { name: string; price: number }[]): number {
  let night: number | null = null;
  let day: number | null = null;
  for (const v of variants) {
    if (shiftMinutes(v.name) !== 5 * 60) continue;
    const w = shiftWindow(v.name);
    if (!w) continue;
    if (w.start >= NIGHT_START_MINUTES) night ??= v.price;
    else if (w.end <= NIGHT_START_MINUTES) day ??= v.price;
  }
  if (night == null || day == null) return 0;
  return round2((night - day) / 5);
}

/**
 * What the wizard charges, pre-GST, for a shift variant: window hours at the
 * rate plus the night premium, charged only on night variants (window runs to
 * midnight); a week is 7 such days. Null when no window is stated.
 */
export function variantCharge(service: HourlyService, variantName: string): number | null {
  const w = shiftWindow(variantName);
  if (!w) return null;
  const rate = hourlyRate(service);
  const premium = nightPremiumPerHour(service.variants);
  const perDay = round2(((w.end - w.start) / 60) * rate + (w.end >= DAY_END_MINUTES ? nightHoursIn(w.start, w.end) : 0) * premium);
  return /\bweek\b/i.test(variantName) ? round2(perDay * 7) : perDay;
}
