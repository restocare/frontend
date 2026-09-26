"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taskApi } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";

const GROUPS: { key: "day" | "week" | "month"; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

const STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
};
const STATUS_COLOR: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  IN_REVIEW: "bg-indigo-500",
  DONE: "bg-emerald-500",
  BLOCKED: "bg-rose-500",
};

function bucketLabel(period: string, group: "day" | "week" | "month"): string {
  if (group === "month") {
    const [y, m] = period.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  const d = new Date(`${period}T00:00:00`);
  const base = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return group === "week" ? `w/o ${base}` : base;
}

export default function TaskReportsPage() {
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["task-report", { group }],
    queryFn: () => taskApi.report({ group }),
    placeholderData: keepPreviousData,
  });

  const summary = data?.summary;
  const maxBucket = Math.max(1, ...(data?.buckets ?? []).flatMap((b) => [b.assigned, b.completed]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Task Reports</h1>
          <p className="text-sm text-muted-foreground">Completion trends and per-employee performance.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroup(g.key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                group === g.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError || !data || !summary ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Couldn’t load the report.</p>
          <button onClick={() => refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total tasks" value={summary.total} />
            <Kpi label="Completed" value={summary.completed} tone="text-emerald-600" />
            <Kpi label="Pending" value={summary.pending} tone="text-amber-600" />
            <Kpi label="Overdue" value={summary.overdue} tone="text-rose-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Status breakdown */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">By status</h3>
              <div className="space-y-3">
                {Object.keys(STATUS_LABEL).map((s) => {
                  const n = summary.byStatus[s] ?? 0;
                  const pct = summary.total ? Math.round((n / summary.total) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[s]}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-muted">
                        <div className={`h-full rounded ${STATUS_COLOR[s]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-medium text-foreground">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assigned vs completed over time */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-1 text-sm font-semibold text-foreground">Assigned vs completed</h3>
              <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500" /> Assigned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
                </span>
              </div>
              {data.buckets.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period.</p>
              ) : (
                <div className="flex h-40 items-end gap-2 overflow-x-auto">
                  {data.buckets.map((b) => (
                    <div key={b.period} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
                      <div className="flex h-32 w-full items-end justify-center gap-1">
                        <div
                          className="w-1/2 rounded-t bg-sky-500/80"
                          style={{ height: `${(b.assigned / maxBucket) * 100}%` }}
                          title={`${b.assigned} assigned`}
                        />
                        <div
                          className="w-1/2 rounded-t bg-emerald-500/80"
                          style={{ height: `${(b.completed / maxBucket) * 100}%` }}
                          title={`${b.completed} completed`}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{bucketLabel(b.period, group)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">Employee performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Employee</th>
                    <th className="px-5 py-3 font-medium">Assigned</th>
                    <th className="px-5 py-3 font-medium">Completed</th>
                    <th className="px-5 py-3 font-medium">Pending</th>
                    <th className="px-5 py-3 font-medium">Overdue</th>
                    <th className="px-5 py-3 font-medium">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                        No tasks assigned yet.
                      </td>
                    </tr>
                  ) : (
                    data.leaderboard.map((r) => (
                      <tr key={r.employeeId} className="border-t border-border">
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{r.name}</p>
                          {r.designation && <p className="text-xs text-muted-foreground">{r.designation}</p>}
                        </td>
                        <td className="px-5 py-3 text-foreground">{r.assigned}</td>
                        <td className="px-5 py-3 font-medium text-emerald-600">{r.completed}</td>
                        <td className="px-5 py-3 text-amber-600">{r.pending}</td>
                        <td className="px-5 py-3 text-rose-600">{r.overdue}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded bg-muted">
                              <div className="h-full rounded bg-primary" style={{ width: `${r.completionRate}%` }} />
                            </div>
                            <span className="text-xs font-medium text-foreground">{r.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className={`text-3xl font-bold tracking-tight ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
