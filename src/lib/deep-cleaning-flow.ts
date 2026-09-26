/**
 * Which design the Deep Cleaning category shows. Independent of the chef
 * switch in booking-flow.ts, so the new cleaning design can be finished
 * while production keeps the current pages.
 *
 * 1 = the current production page (service cards → cart → checkout).
 * 2 = the new design (banner → sub-category tiles → package cards → wizard).
 *
 * Set NEXT_PUBLIC_DEEP_CLEANING_FLOW=1|2 per environment: .env.production
 * pins 1 for the live site, .env.local sets 2 for development. Unset means 1.
 * The value is inlined at build time and is the same on the server and the
 * client, so hydration never mismatches.
 */

export type DeepCleaningFlow = 1 | 2;

function parse(value: string | undefined): DeepCleaningFlow {
  return value === "2" ? 2 : 1;
}

export const DEEP_CLEANING_FLOW: DeepCleaningFlow = parse(
  process.env.NEXT_PUBLIC_DEEP_CLEANING_FLOW,
);

export function useDeepCleaningFlow(): DeepCleaningFlow {
  return DEEP_CLEANING_FLOW;
}
