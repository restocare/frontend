"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hrPlanApi,
  type HrLead,
  type HrLeadStatus,
  type HrTask,
  type HrTaskType,
} from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  PageHeader,
  Tabs,
  TableShell,
} from "@/src/components/crm/ui";
import {
  canManage,
  ErrorBox,
  errorText,
  FormModal,
  initialParam,
  Loading,
  OrgSelect,
  Pager,
  Select,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { SearchIcon } from "@/src/components/icons";
import { istDateTime, pretty } from "@/src/lib/hr-format";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<HrTaskType, string> = {
  escalation: "Shift not marked",
  unfilled_replacement: "Replacement not filled",
  issue: "Issue reported",
  change_request: "Change request",
  leave_concern: "Leave concern",
};

export default function TasksPage() {
  // Sales leads sit beside the task queue: the app's "Request a call" lands here.
  const [section, setSection] = useState(() => (initialParam("tab") === "leads" ? "leads" : "tasks"));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="What needs a person at Restocare: shifts nobody marked, replacements nobody took, issues and requests from restaurants, and people asking for a call about the plan."
      />
      <Tabs
        tabs={[
          { key: "tasks", label: "Tasks" },
          { key: "leads", label: "Sales leads (Request a call)" },
        ]}
        active={section}
        onChange={(k) => {
          setSection(k);
          window.history.replaceState(null, "", k === "leads" ? "?tab=leads" : window.location.pathname);
        }}
      />
      {section === "tasks" ? <TaskQueue /> : <Leads />}
    </div>
  );
}

function taskLink(t: HrTask): { href: string; label: string } | null {
  if (t.shiftId && t.shiftDate) return { href: `/dashboard/hr/today?date=${t.shiftDate}`, label: "Open the board" };
  if (t.leaveRequestId) return { href: "/dashboard/hr/leave", label: "Open leave" };
  return null;
}

function TaskQueue() {
  const [status, setStatus] = useState("active");
  const [type, setType] = useState("");
  const [assignee, setAssignee] = useState("");
  const [orgId, setOrgId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<HrTask | null>(null);
  const q = useDebounced(search);
  const refresh = useRefreshHr();
  const manage = canManage();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "tasks", { status, type, assignee, orgId, q, page }],
    queryFn: () =>
      hrPlanApi.tasks({
        status,
        type: type || undefined,
        assignee: assignee || undefined,
        orgId: orgId || undefined,
        q: q || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const ops = useQuery({
    queryKey: ["hr", "ops-users"],
    queryFn: () => hrPlanApi.opsUsers(),
    staleTime: 5 * 60_000,
  });

  async function act(task: HrTask, label: string, work: () => Promise<unknown>) {
    setBusyId(task.taskId);
    try {
      await work();
      await refresh();
      toast.success(label);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <Card>
        <Toolbar>
          <Select value={status} onChange={reset(setStatus)} className="w-52" ariaLabel="Status">
            <option value="active">Open and in progress</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Closed</option>
            <option value="all">All</option>
          </Select>
          <Select value={type} onChange={reset(setType)} className="w-52" ariaLabel="Type">
            <option value="">Any type</option>
            {(Object.keys(TYPE_LABEL) as HrTaskType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select value={assignee} onChange={reset(setAssignee)} className="max-w-[11rem]" ariaLabel="Assignee">
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
          </Select>
          <OrgSelect value={orgId} onChange={reset(setOrgId)} allLabel="All organizations" className="max-w-[14rem]" />
          <div className="relative w-full max-w-[14rem]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="Search"
              className={`${inputCls} pl-9`}
            />
          </div>
        </Toolbar>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Task", "About", "Raised", "Assigned to", "Status", ""]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={6} label={status === "active" ? "Nothing waiting. The queue is clear." : "No tasks match."} />
              )}
              {data?.items.map((t) => {
                const link = taskLink(t);
                const busy = busyId === t.taskId;
                return (
                  <tr key={t.taskId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{TYPE_LABEL[t.type]}</div>
                      <div className="mt-1 max-w-md whitespace-pre-line text-xs text-muted-foreground">{t.note ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-foreground">{t.org.name}</div>
                      <div className="text-muted-foreground">
                        {[t.outlet?.name, t.staff?.name].filter(Boolean).join(" · ")}
                      </div>
                      {link && (
                        <Link href={link.href} className="text-primary">
                          {link.label}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{istDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 text-xs">{t.assignee ? (t.assignee.name ?? `User ${t.assignee.userId}`) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {manage && (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                          {t.status !== "done" ? (
                            <>
                              <Btn
                                tone="ghost"
                                small
                                busy={busy}
                                onClick={() => act(t, "Assigned to you", () => hrPlanApi.assignTask(t.taskId))}
                              >
                                Take it
                              </Btn>
                              <select
                                aria-label="Assign to"
                                value=""
                                disabled={busy}
                                onChange={(e) => {
                                  const id = Number(e.target.value);
                                  if (id) act(t, "Assigned", () => hrPlanApi.assignTask(t.taskId, id));
                                }}
                                className="rounded-xl border border-border bg-card px-2 py-1.5 text-xs"
                              >
                                <option value="">Assign to…</option>
                                {ops.data?.users.map((u) => (
                                  <option key={u.userId} value={u.userId}>
                                    {u.name ?? `User ${u.userId}`}
                                  </option>
                                ))}
                              </select>
                              <Btn tone="success" small disabled={busy} onClick={() => setClosing(t)}>
                                Close
                              </Btn>
                            </>
                          ) : (
                            <Btn
                              tone="ghost"
                              small
                              busy={busy}
                              onClick={() => act(t, "Reopened", () => hrPlanApi.reopenTask(t.taskId))}
                            >
                              Reopen
                            </Btn>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>
      {closing && (
        <CloseTaskModal
          task={closing}
          onClose={() => setClosing(null)}
          onClosed={() => {
            setClosing(null);
            refresh();
            toast.success("Task closed");
          }}
        />
      )}
    </>
  );
}

function CloseTaskModal({
  task,
  onClose,
  onClosed,
}: {
  task: HrTask;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <FormModal
      title={`Close: ${TYPE_LABEL[task.type]}`}
      submitLabel="Close task"
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.closeTask(task.taskId, note.trim() || undefined);
        onClosed();
      }}
    >
      <p className="whitespace-pre-line text-sm text-muted-foreground">{task.note}</p>
      <Field label="What was done (optional)" hint="Kept on the task.">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} autoFocus />
      </Field>
    </FormModal>
  );
}

const LEAD_STATUSES: HrLeadStatus[] = ["new", "contacted", "won", "lost"];
const KIND_LABEL = { staff_plan: "Staff plan", deep_cleaning: "Deep cleaning add-on" } as const;

function Leads() {
  const [status, setStatus] = useState("new");
  const [page, setPage] = useState(1);
  const [noting, setNoting] = useState<HrLead | null>(null);
  const refresh = useRefreshHr();
  const manage = canManage();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "leads", { status, page }],
    queryFn: () => hrPlanApi.leads({ status, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  async function setLeadStatus(lead: HrLead, next: HrLeadStatus) {
    try {
      await hrPlanApi.updateLead(lead.leadId, { status: next });
      await refresh();
      toast.success(`Marked ${next}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <>
      <Tabs
        tabs={[
          { key: "new", label: "New" },
          { key: "contacted", label: "Contacted" },
          { key: "won", label: "Won" },
          { key: "lost", label: "Lost" },
          { key: "all", label: "All" },
        ]}
        active={status}
        onChange={(k) => {
          setStatus(k);
          setPage(1);
        }}
      />
      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Customer", "Asked about", "Note", "Received", "Status"]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={5} label="No leads here. They appear when a customer taps Request a call in the app." />
              )}
              {data?.items.map((l) => (
                <tr key={l.leadId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{l.customer.name ?? "Customer"}</div>
                    {l.customer.restaurantName && (
                      <div className="text-xs text-muted-foreground">{l.customer.restaurantName}</div>
                    )}
                    {l.customer.mobile && (
                      <a href={`tel:${l.customer.mobile}`} className="text-xs text-primary">
                        {l.customer.mobile}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">{KIND_LABEL[l.kind]}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs text-xs text-muted-foreground">{l.note ?? "—"}</div>
                    {manage && (
                      <button type="button" className="text-xs text-primary" onClick={() => setNoting(l)}>
                        {l.note ? "Edit note" : "Add note"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{istDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    {manage ? (
                      <Select
                        value={l.status}
                        onChange={(v) => setLeadStatus(l, v as HrLeadStatus)}
                        className="max-w-[9rem]"
                        ariaLabel="Lead status"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {pretty(s)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <StatusBadge status={l.status} />
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>
      {noting && (
        <LeadNoteModal
          lead={noting}
          onClose={() => setNoting(null)}
          onSaved={() => {
            setNoting(null);
            refresh();
            toast.success("Note saved");
          }}
        />
      )}
    </>
  );
}

function LeadNoteModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: HrLead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(lead.note ?? "");
  return (
    <FormModal
      title={`Note for ${lead.customer.name ?? "the customer"}`}
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.updateLead(lead.leadId, { note: note.trim() });
        onSaved();
      }}
    >
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={inputCls} autoFocus />
      </Field>
    </FormModal>
  );
}
