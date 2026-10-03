"use client";

import { RouteError } from "@/src/components/route-error";

/** Covers /booking/[serviceId] and /booking/cart. A cart lives in the browser, so retrying keeps it. */
export default function BookingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} where="booking" />;
}
