"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskApi, type TaskPriority, type TaskStatus } from "@/src/api/api";
import { TaskDetailDrawer } from "@/src/components/dashboard/task-detail-drawer";
import { TaskFormModal } from "@/src/components/tasks/task-form";
import { TaskTable } from "@/src/components/tasks/task-table";
import {
  PRIORITIES,
  STATUSES,
  STATUS_ACCENT,
  STATUS_LABEL,
  STATUS_TEXT,
} from "@/src/components/tasks/task-meta";
import { SearchIcon, SpinnerIcon, PlusIcon } from "@/src/components/icons";

const EMPTY_COUNTS: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0, BLOCKED: 0 };

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<number | "">("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const params = { search: search.trim() || undefined, priority: priority || undefined, limit: 300 };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", params],
    queryFn: () => taskApi.list(params),
    placeholderData: keepPreviousData,
  });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  // Employees who currently have tasks in the list, for the filter dropdown.
  const employees = useMemo(() => {
    const byId = new Map<number, string>();
    for (const t of tasks) byId.set(t.assigneeId, t.assignee.name);
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // A search or priority change can drop the picked employee from the list;
  // treat that pick as cleared rather than showing an empty grid for no reason.
  const activeAssignee = employees.some((e) => e.id === assigneeFilter) ? assigneeFilter : "";

  // Status boxes count within the chosen employee, so they answer
  // "how many pending / done for this person" directly.
  const scoped = useMemo(
    () => (activeAssignee === "" ? tasks : tasks.filter((t) => t.assigneeId === activeAssignee)),
    [tasks, activeAssignee],
  );
  const counts = useMemo(() => {
    const c = { ...EMPTY_COUNTS };
    for (const t of scoped) c[t.status] += 1;
    return c;
  }, [scoped]);
  const visible = useMemo(
    () => (statusFilter ? scoped.filter((t) => t.status === statusFilter) : scoped),
    [scoped, statusFilter],
  );

  const moveStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      taskApi.update(taskId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const filtersActive = statusFilter !== null || activeAssignee !== "";
  const clearFilters = () => {
    setStatusFilter(null);
    setAssigneeFilter("");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">Assign work to employees and track it to done.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Status boxes — one strip, each cell is also the status filter. */}
      <div
        role="group"
        aria-label="Filter by status"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5"
      >
        {STATUSES.map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(active ? null : s)}
              className={`relative flex flex-col gap-1 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 ${
                active ? "bg-muted" : "bg-card hover:bg-muted"
              }`}
            >
              <span
                className={`absolute inset-x-0 top-0 h-0.5 ${STATUS_ACCENT[s]} ${active ? "opacity-100" : "opacity-0"}`}
              />
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${STATUS_ACCENT[s]}`} />
                {STATUS_LABEL[s]}
              </span>
              <span className={`text-2xl font-semibold tabular-nums ${active ? STATUS_TEXT[s] : "text-foreground"}`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, description or assignee"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority | "")}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          value={activeAssignee}
          onChange={(e) => setAssigneeFilter(e.target.value ? Number(e.target.value) : "")}
          aria-label="Filter by employee"
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {filtersActive ? `${visible.length} of ${tasks.length} tasks` : `${tasks.length} tasks`}
        </span>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Couldn’t load tasks.</p>
          <button onClick={() => refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Retry
          </button>
        </div>
      ) : (
        <TaskTable
          tasks={visible}
          pendingTaskId={moveStatus.isPending ? (moveStatus.variables?.taskId ?? null) : null}
          onOpen={setOpenId}
          onMove={(taskId, status) => moveStatus.mutate({ taskId, status })}
          emptyMessage={tasks.length === 0 ? "No tasks yet. Create one to get started." : "No tasks match these filters."}
          onClearFilters={filtersActive ? clearFilters : undefined}
        />
      )}

      {creating && <TaskFormModal onClose={() => setCreating(false)} />}
      {openId != null && <TaskDetailDrawer taskId={openId} mode="manage" onClose={() => setOpenId(null)} />}
    </div>
  );
}
