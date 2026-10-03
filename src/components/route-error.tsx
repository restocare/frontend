"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * What a route's error.tsx shows when rendering throws: the exact error in
 * the browser console (with Next's digest, which matches the server log
 * line), and a way to retry or leave instead of a blank page.
 */
export function RouteError({
  error,
  reset,
  where,
  showDetail = false,
  homeHref = "/",
  homeLabel = "Back to home",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Which page broke, for the log line. */
  where: string;
  /** Print the error message on screen (admin pages). */
  showDetail?: boolean;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(`[${where}] render failed${error.digest ? ` (digest ${error.digest})` : ""}:`, error);
  }, [error, where]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">Something went wrong on this page</h1>
      <p className="mt-2 text-sm text-gray-500">
        It&apos;s not you. Try again, and if it keeps happening, let us know.
      </p>
      {showDetail ? (
        <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-100 px-4 py-3 text-left text-xs text-gray-700">
          {error.message || String(error)}
          {error.digest ? `\n(digest ${error.digest})` : ""}
        </pre>
      ) : error.digest ? (
        <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Try again
        </button>
        <Link
          href={homeHref}
          className="inline-flex items-center rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
