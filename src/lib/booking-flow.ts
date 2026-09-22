"use client";

/**
 * Which customer booking flow the storefront shows.
 *
 * 1 = the existing pages (variant picker → shift page → cart → checkout).
 * 2 = the prototype flow (dark-hero category page → three-step wizard).
 *
 * The value lives in localStorage so it can be flipped per browser without
 * a deploy: open any page with `?flow=2` (or `?flow=1`). The env default
 * applies when nothing is stored, and is also the server-render value so
 * hydration never mismatches.
 */

import { useSyncExternalStore } from "react";

export type BookingFlow = 1 | 2;

export const BOOKING_FLOW_KEY = "rc.bookingFlow";
const CHANGE_EVENT = "rc:booking-flow";

function parse(value: string | null | undefined): BookingFlow | null {
  if (value === "1") return 1;
  if (value === "2") return 2;
  return null;
}

const DEFAULT_FLOW: BookingFlow =
  parse(process.env.NEXT_PUBLIC_BOOKING_FLOW) ?? 1;

export function readBookingFlow(): BookingFlow {
  if (typeof window === "undefined") return DEFAULT_FLOW;
  try {
    return parse(window.localStorage.getItem(BOOKING_FLOW_KEY)) ?? DEFAULT_FLOW;
  } catch {
    return DEFAULT_FLOW;
  }
}

export function writeBookingFlow(flow: BookingFlow): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKING_FLOW_KEY, String(flow));
  } catch {
    /* storage unavailable: the in-memory default stays */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Honour `?flow=1|2` on the current URL. Returns the flow it stored, if any. */
export function applyBookingFlowFromUrl(search: string): BookingFlow | null {
  const wanted = parse(new URLSearchParams(search).get("flow"));
  if (wanted) writeBookingFlow(wanted);
  return wanted;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getServerSnapshot(): BookingFlow {
  return DEFAULT_FLOW;
}

export function useBookingFlow(): BookingFlow {
  return useSyncExternalStore(subscribe, readBookingFlow, getServerSnapshot);
}
