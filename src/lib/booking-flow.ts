"use client";

/**
 * Which customer booking flow the storefront shows.
 *
 * 1 = the earlier pages (variant picker → shift page → cart → checkout).
 * 2 = the hourly flow (banner category page → three-step wizard).
 *
 * HARDCODED TO 2. Both readers below return `FLOW`, so the env default, the
 * stored preference and `?flow=` no longer decide anything: every browser gets
 * the hourly flow, including one left on flow 1 by earlier testing.
 *
 * To put the switch back: make `FLOW` the env default again
 * (`parse(process.env.NEXT_PUBLIC_BOOKING_FLOW) ?? 1`), have `readBookingFlow`
 * read `BOOKING_FLOW_KEY` from localStorage, and drive `useBookingFlow` from
 * `useSyncExternalStore` over the storage + `rc:booking-flow` events again.
 */

export type BookingFlow = 1 | 2;

export const BOOKING_FLOW_KEY = "rc.bookingFlow";
const CHANGE_EVENT = "rc:booking-flow";

/** The one place the storefront's booking flow is decided. */
const FLOW: BookingFlow = 2;

function parse(value: string | null | undefined): BookingFlow | null {
  if (value === "1") return 1;
  if (value === "2") return 2;
  return null;
}

export function readBookingFlow(): BookingFlow {
  return FLOW;
}

/**
 * Still records the preference so the switch is one edit away, but nothing
 * reads it while the flow is hardcoded.
 */
export function writeBookingFlow(flow: BookingFlow): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKING_FLOW_KEY, String(flow));
  } catch {
    /* storage unavailable: the hardcoded flow stays */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Honour `?flow=1|2` on the current URL. Stored only; see `writeBookingFlow`. */
export function applyBookingFlowFromUrl(search: string): BookingFlow | null {
  const wanted = parse(new URLSearchParams(search).get("flow"));
  if (wanted) writeBookingFlow(wanted);
  return wanted;
}

/** The same value on the server and the client, so hydration never mismatches. */
export function useBookingFlow(): BookingFlow {
  return FLOW;
}
