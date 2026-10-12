/**
 * What an hourly service charges: the single source for its rate, minimum
 * hours and minimum price. Pure: reuses the booking flow's own primitives.
 */

import { hourlyRate } from "./draft";
import { round2 } from "./pricing";
import { minShiftMinutes } from "./schedule";

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
