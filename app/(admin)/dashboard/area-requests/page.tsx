"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { areaRequestsApi, queryKeys } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Out-of-area demand (BUG-011): rows the customer app records when someone
 * outside every active zone taps "Notify me when you launch here". These
 * replaced the old fake out-of-service-area bookings — call these people back
 * when a zone opens near them.
 */
export default function AreaRequestsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.areaRequests(page),
    queryFn: () => areaRequestsApi.list(page),
  });

  const rows = data?.requests ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Area Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customers outside every active service zone who asked to be notified when we launch
          there. No booking exists for these — call them back once their area opens.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 justify-center text-gray-500">
          <SpinnerIcon className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-gray-500">
          Could not load the requests.{" "}
          <button className="text-indigo-600 underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500">
          No requests yet. They appear here when someone out of area taps “Notify me”.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Wanted</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.requestId} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{when(r.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.customer}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.mobile ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.serviceName ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-gray-600">{r.address ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <a
                      className="text-indigo-600 hover:underline"
                      href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} requests
          </span>
          <div className="flex gap-2">
            <button
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
