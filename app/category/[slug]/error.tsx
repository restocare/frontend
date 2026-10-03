"use client";

import { RouteError } from "@/src/components/route-error";

export default function CategoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} where="category page" />;
}
