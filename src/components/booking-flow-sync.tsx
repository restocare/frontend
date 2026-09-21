"use client";

import { useEffect } from "react";
import { applyBookingFlowFromUrl } from "@/src/lib/booking-flow";

/**
 * Mounted once in Providers. Lets `?flow=1` / `?flow=2` on any URL switch the
 * storefront booking flow for this browser (see src/lib/booking-flow.ts).
 */
export function BookingFlowSync() {
  useEffect(() => {
    const apply = () => applyBookingFlowFromUrl(window.location.search);
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);
  return null;
}
