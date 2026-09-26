"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  contactApi,
  queryKeys,
  type ContactStatus,
  type ContactSubmission,
} from "@/src/api/api";
import { MailIcon, SearchIcon, SpinnerIcon } from "@/src/components/icons";

const STATUS_LABELS: Record<ContactStatus, string> = {
  UNREAD: "Unread",
  READ: "Read",
  RESOLVED: "Resolved",
};

const STATUS_STYLES: Record<ContactStatus, string> = {
  UNREAD: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  READ: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  RESOLVED: "bg-green-50 text-green-700 ring-1 ring-green-200",
};

function truncate(text: string, max = 80) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.contactSubmissions(search.trim()),
    queryFn: () => contactApi.list(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const submissions = data ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ContactStatus }) =>
      contactApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Contact Enquiries
        </h1>
        <p className="text-sm text-muted-foreground">
          Messages submitted via the website contact form.
        </p>
      </div>

      {/* Search + count */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or subject"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {submissions.length} enquir{submissions.length === 1 ? "y" : "ies"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn&apos;t load contact submissions.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <MailIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No submissions match your search." : "No contact submissions yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Subject</th>
                  <th className="px-5 py-3 font-medium">Message</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s: ContactSubmission) => (
                  <tr
                    key={s.enquiryId}
                    className="border-t border-border transition-colors hover:bg-muted/40 cursor-pointer"
                    onClick={() => setExpanded(expanded === s.enquiryId ? null : s.enquiryId)}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{s.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={"mailto:" + s.email}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.email}
                      </a>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {s.subject ?? <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-xs">
                      {expanded === s.enquiryId ? (
                        <p className="whitespace-pre-wrap text-foreground">{s.message}</p>
                      ) : (
                        <span className="line-clamp-2">{truncate(s.message)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {s.user ? (
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">{s.user.name ?? "—"}</p>
                          {s.user.restaurantName && (
                            <p className="truncate text-xs text-muted-foreground">{s.user.restaurantName}</p>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-xs opacity-50">Guest</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " + STATUS_STYLES[s.status]}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {s.status === "UNREAD" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({ id: s.enquiryId, status: "READ" })
                            }
                            disabled={statusMutation.isPending}
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                          >
                            Mark Read
                          </button>
                        )}
                        {s.status !== "RESOLVED" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({ id: s.enquiryId, status: "RESOLVED" })
                            }
                            disabled={statusMutation.isPending}
                            className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
