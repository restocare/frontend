"use client";

import { RouteError } from "@/src/components/route-error";

/** Admins see the error text itself, to report or fix it. */
export default function CategoriesAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      where="admin categories"
      showDetail
      homeHref="/dashboard/categories"
      homeLabel="Back to categories"
    />
  );
}
