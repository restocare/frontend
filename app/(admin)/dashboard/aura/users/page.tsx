"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auraApi, queryKeys, type AuraUserRow } from "@/src/api/api";
import { SearchIcon, SpinnerIcon } from "@/src/components/icons";
import { Badge, Btn, EmptyRow, Modal, TableShell, fmtDate, inputCls } from "@/src/components/crm/ui";
import { formatMinutes } from "@/src/components/aura/ui";

type Filter = "all" | "active" | "suspended";

export default function AuraUsersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState<AuraUserRow | null>(null);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const params = {
    search: search.trim() || undefined,
    active: filter === "all" ? undefined : filter === "active",
    page,
    limit: 25,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.auraUsers(params),
    queryFn: () => auraApi.users(params),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive, reason }: { userId: number; isActive: boolean; reason?: string }) =>
      auraApi.setUserStatus(userId, { isActive, reason }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["aura"] });
      toast.success(variables.isActive ? "Access restored" : "User suspended");
      setSuspending(null);
      setReason("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email or mobile"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "active", "suspended"] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <TableShell
            head={["User", "Timezone", "Avg score (7d)", "Screen time (7d)", "Reminders", "Devices", "Last seen", "Status", ""]}
          >
            {rows.length === 0 ? (
              <EmptyRow cols={9} label="No Aura users match this filter yet." />
            ) : (
              rows.map((row) => (
                <tr key={row.userId} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/aura/users/${row.userId}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {row.displayName || row.name || `User #${row.userId}`}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.email || row.mobile || "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.timezone}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{row.averageScore7d}/100</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatMinutes(row.screenMinutes7d)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.activeReminders}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.devices}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={row.isActive ? "success" : "danger"}>
                      {row.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.isActive ? (
                      <Btn tone="danger" small onClick={() => setSuspending(row)}>
                        Suspend
                      </Btn>
                    ) : (
                      <Btn
                        tone="success"
                        small
                        busy={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: row.userId, isActive: true })}
                      >
                        Restore
                      </Btn>
                    )}
                  </td>
                </tr>
              ))
            )}
          </TableShell>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.pages} · {data.total} users{isFetching ? " · updating…" : ""}
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Btn>
            <Btn
              tone="ghost"
              small
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Btn>
          </div>
        </div>
      )}

      {suspending && (
        <Modal title={`Suspend ${suspending.displayName || suspending.name || "user"}`} onClose={() => setSuspending(null)}>
          <p className="mb-4 text-sm text-muted-foreground">
            They will stop receiving reminders and briefs, and the app will show them this reason
            instead of their dashboard. Their data is kept and restoring is instant.
          </p>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (shown to the user)"
            className={inputCls}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setSuspending(null)}>
              Cancel
            </Btn>
            <Btn
              tone="danger"
              busy={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  userId: suspending.userId,
                  isActive: false,
                  reason: reason.trim() || undefined,
                })
              }
            >
              Suspend access
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
