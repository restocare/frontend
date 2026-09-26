"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmOpsApi, crmQueryKeys } from "@/src/api/api";
import {
  Badge,
  Card,
  EmptyRow,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  fmtTime,
} from "@/src/components/crm/ui";
import { SpinnerIcon } from "@/src/components/icons";

const bookingTone: Record<string, string> = {
  PENDING: "warning",
  ASSIGNED: "primary",
  ACCEPTED: "primary",
  ON_THE_WAY: "primary",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export default function CrmOperationsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: crmQueryKeys.opsBoard,
    queryFn: crmOpsApi.board,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <SpinnerIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title="Live Operations" />
        <Notice kind="error">
          {error instanceof ApiError ? error.message : "Could not load the operations board."}
        </Notice>
      </div>
    );
  }

  const { bookings, alerts, workforce } = data;
  const items = statusFilter
    ? bookings.items.filter((b) => b.status === statusFilter)
    : bookings.items;

  const stats = [
    {
      label: "Partners online",
      value: workforce.partnersOnline,
      sub: `of ${workforce.partnersActive} active partners`,
    },
    {
      label: "Employees checked in",
      value: `${workforce.checkedIn} / ${workforce.employeesActive}`,
      sub: `${workforce.checkedOut} checked out`,
    },
    {
      label: "Late check-ins",
      value: workforce.lateCheckIns.length,
      sub: `after ${workforce.lateAfter} IST`,
      warn: workforce.lateCheckIns.length > 0,
    },
    {
      label: "Delayed acceptance",
      value: alerts.staleAssignments.length,
      sub: `assigned > ${alerts.staleAssignmentMinutes} min, not accepted`,
      danger: alerts.staleAssignments.length > 0,
    },
    {
      label: "Cancelled after assign",
      value: alerts.emergencyReplacements.length,
      sub: "today — may need replacements",
      danger: alerts.emergencyReplacements.length > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Live Operations"
        subtitle={`${fmtDate(data.date)} · refreshes every 30s · last update ${fmtTime(new Date(dataUpdatedAt))}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card
            key={s.label}
            className={`p-5 ${s.danger ? "border-danger/40" : s.warn ? "border-warning/40" : ""}`}
          >
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <div
              className={`mt-2 text-3xl font-semibold ${
                s.danger ? "text-danger" : s.warn ? "text-warning" : "text-foreground"
              }`}
            >
              {s.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Today's bookings */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <span className="mr-2 text-sm font-medium text-foreground">
            Today&apos;s bookings ({bookings.items.length})
          </span>
          {Object.entries(bookings.byStatus).map(([status, count]) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {status} {count}
            </button>
          ))}
        </div>
        <TableShell head={["#", "Time", "Customer", "Service", "Partner", "Status"]}>
          {!items.length && (
            <EmptyRow
              cols={6}
              label={statusFilter ? `No ${statusFilter} bookings today.` : "No bookings scheduled today."}
            />
          )}
          {items.map((b) => (
            <tr key={b.bookingId} className="text-foreground">
              <td className="px-4 py-3 text-muted-foreground">#{b.bookingId}</td>
              <td className="px-4 py-3">
                {b.startTime}
                {b.endTime ? `–${b.endTime}` : ""}
              </td>
              <td className="px-4 py-3 font-medium">{b.user?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{b.service?.name ?? "—"}</td>
              <td className="px-4 py-3">
                {b.professional?.user?.name ?? (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone={bookingTone[b.status] ?? "muted"}>{b.status}</Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {/* Alerts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-foreground">
            Delayed acceptance (&gt; {alerts.staleAssignmentMinutes} min)
          </h2>
          <div className="mt-3 space-y-3">
            {!alerts.staleAssignments.length && (
              <p className="text-sm text-muted-foreground">None — all assignments accepted in time.</p>
            )}
            {alerts.staleAssignments.map((b) => (
              <div
                key={b.bookingId}
                className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    #{b.bookingId} · {b.user?.name ?? "—"} · {b.service?.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    assigned {fmtTime(b.assignedAt)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Partner: {b.professional?.user?.name ?? "—"}
                  {b.professional?.user?.mobile ? ` · ${b.professional.user.mobile}` : ""} — nudge or
                  reallocate from Bookings.
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-foreground">Cancelled after assignment (today)</h2>
          <div className="mt-3 space-y-3">
            {!alerts.emergencyReplacements.length && (
              <p className="text-sm text-muted-foreground">None today.</p>
            )}
            {alerts.emergencyReplacements.map((b) => (
              <div
                key={b.bookingId}
                className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  #{b.bookingId} · {b.user?.name ?? "—"} · {b.service?.name ?? "—"}
                </span>
                <div className="mt-1 text-xs text-muted-foreground">
                  Was assigned to {b.professional?.user?.name ?? "—"} — client may need an emergency
                  replacement.
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Attendance */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-foreground">
            Late check-ins (after {workforce.lateAfter} IST)
          </h2>
          <div className="mt-3 space-y-2">
            {!workforce.lateCheckIns.length && (
              <p className="text-sm text-muted-foreground">None.</p>
            )}
            {workforce.lateCheckIns.map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {e.name}
                  {e.designation && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{e.designation}</span>
                  )}
                </span>
                <Badge tone="warning">{fmtTime(e.checkInAt)}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-foreground">Not checked in yet</h2>
          <div className="mt-3 space-y-2">
            {!workforce.notCheckedIn.length && (
              <p className="text-sm text-muted-foreground">Everyone has checked in.</p>
            )}
            {workforce.notCheckedIn.map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.designation ?? ""}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
