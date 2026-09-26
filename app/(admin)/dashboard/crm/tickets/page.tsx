"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  crmRestaurantsApi,
  crmTicketsApi,
  customersApi,
  queryKeys,
  rbacApi,
  type TicketBody,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
  fmtTime,
  inputCls,
  statusTone,
} from "@/src/components/crm/ui";
import { PlusIcon, SearchIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const CATEGORIES: TicketCategory[] = [
  "WORKFORCE_ISSUE",
  "BILLING_ISSUE",
  "SERVICE_COMPLAINT",
  "TECHNICAL_ISSUE",
  "OTHER",
];
const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// "WORKFORCE_ISSUE" → "Workforce issue"
const pretty = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// 90 → "1h 30m", 2900 → "2d 0h", null → "—"
const fmtMinutes = (m: number | null | undefined) => {
  if (m == null) return "—";
  const mins = Math.round(m);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

const priorityTone = (p: TicketPriority) =>
  p === "URGENT" || p === "HIGH" ? "danger" : p === "MEDIUM" ? "warning" : "muted";

// statusTone has no OPEN entry — open tickets need attention, so tint warning.
const ticketStatusTone = (s: TicketStatus) => (s === "OPEN" ? "warning" : statusTone(s));

const dateTime = (d: string | null | undefined) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : "—");

// Allowed workflow transitions per current status.
const NEXT_STATUSES: Record<TicketStatus, { status: TicketStatus; label: string }[]> = {
  OPEN: [
    { status: "IN_PROGRESS", label: "Start progress" },
    { status: "RESOLVED", label: "Resolve" },
    { status: "CLOSED", label: "Close" },
  ],
  IN_PROGRESS: [
    { status: "RESOLVED", label: "Resolve" },
    { status: "CLOSED", label: "Close" },
    { status: "OPEN", label: "Reopen" },
  ],
  RESOLVED: [
    { status: "CLOSED", label: "Close" },
    { status: "IN_PROGRESS", label: "Back to progress" },
  ],
  CLOSED: [{ status: "OPEN", label: "Reopen" }],
};

export default function CrmTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("ALL");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const canView = hasPermission("tickets.view");
  const canCreate = hasPermission("tickets.create");
  const canUpdate = hasPermission("tickets.update");
  const canDelete = hasPermission("tickets.delete");

  // Deep link: /dashboard/crm/tickets?new=1 opens the raise-ticket form.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("new") === "1" && hasPermission("tickets.create")) setCreating(true);
  }, []);

  const params = {
    search: search || undefined,
    status: statusTab !== "ALL" ? statusTab : undefined,
    category: category || undefined,
    priority: priority || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const summaryQ = useQuery({
    queryKey: crmQueryKeys.ticketSummary,
    queryFn: crmTicketsApi.summary,
    enabled: canView,
  });
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.tickets(params),
    queryFn: () => crmTicketsApi.list(params),
    placeholderData: keepPreviousData,
    enabled: canView,
  });

  const summary = summaryQ.data;
  const allCount =
    summary != null ? summary.open + summary.inProgress + summary.resolved + summary.closed : undefined;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (!canView) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title="Support Tickets" subtitle="Workflow: Open → In Progress → Resolved → Closed" />
        <Card className="p-5 text-sm text-muted-foreground">
          You don&apos;t have permission to view support tickets.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Support Tickets"
        subtitle="Workflow: Open → In Progress → Resolved → Closed"
        action={
          canCreate ? (
            <Btn
              onClick={() => {
                setNotice("");
                setCreating(true);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              Raise ticket
            </Btn>
          ) : undefined
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Open", summary?.open],
            ["In progress", summary?.inProgress],
            ["Resolved", summary?.resolved],
            ["Closed", summary?.closed],
          ] as [string, number | undefined][]
        ).map(([label, count]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{count ?? "…"}</div>
          </Card>
        ))}
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Avg first response</div>
          <div className="mt-1 text-xl font-semibold text-foreground">
            {summary ? fmtMinutes(summary.avgFirstResponseMinutes) : "…"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Avg resolution</div>
          <div className="mt-1 text-xl font-semibold text-foreground">
            {summary ? fmtMinutes(summary.avgResolutionMinutes) : "…"}
          </div>
        </Card>
      </div>

      <Tabs
        tabs={[
          { key: "ALL", label: "All", count: allCount },
          { key: "OPEN", label: "Open", count: summary?.open },
          { key: "IN_PROGRESS", label: "In progress", count: summary?.inProgress },
          { key: "RESOLVED", label: "Resolved", count: summary?.resolved },
          { key: "CLOSED", label: "Closed", count: summary?.closed },
        ]}
        active={statusTab}
        onChange={(k) => {
          setStatusTab(k);
          setPage(1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search subject, description or contact…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={`${inputCls} w-auto`}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {pretty(c)}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} w-auto`}
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {pretty(p)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <TableShell
          head={["#", "Subject", "Category", "Priority", "Status", "Restaurant", "Raised by", "Assigned", "Messages", "Created"]}
        >
          {isLoading && <EmptyRow cols={10} label="Loading…" />}
          {!isLoading && !data?.tickets.length && <EmptyRow cols={10} label="No tickets found" />}
          {data?.tickets.map((t) => (
            <tr key={t.ticketId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3 text-muted-foreground">#{t.ticketId}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(t.ticketId)}
                  className="text-left font-medium text-foreground transition-colors hover:text-primary hover:underline"
                >
                  {t.subject}
                </button>
              </td>
              <td className="px-4 py-3">
                <Badge tone="muted">{pretty(t.category)}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={priorityTone(t.priority)}>{pretty(t.priority)}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={ticketStatusTone(t.status)}>{pretty(t.status)}</Badge>
              </td>
              {/* The actual restaurant only — the raiser gets their own column,
                  so a person's name never masquerades as a restaurant. */}
              <td className="px-4 py-3 text-muted-foreground">
                {t.restaurant?.name ?? t.customer?.restaurantName ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t.raisedByName ?? t.customer?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{t.assignedTo?.name ?? "—"}</td>
              <td className="px-4 py-3 text-foreground">{t._count?.messages ?? 0}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.createdAt)}</td>
            </tr>
          ))}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Btn>
            <Btn tone="ghost" small disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {creating && (
        <CreateTicketModal
          onClose={() => setCreating(false)}
          onCreated={(subject) => {
            setCreating(false);
            setNotice(`Ticket “${subject}” raised.`);
          }}
        />
      )}
      {openId != null && (
        <TicketDetailModal
          ticketId={openId}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ➕ Raise a support ticket. Restaurant/assignee selects degrade gracefully —
// if the current user cannot list restaurants or staff, the field is hidden.
function CreateTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (subject: string) => void;
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [restaurantId, setRestaurantId] = useState("");
  const [raisedByName, setRaisedByName] = useState("");
  const [raisedByContact, setRaisedByContact] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [err, setErr] = useState("");

  const restaurantsQ = useQuery({
    queryKey: crmQueryKeys.restaurants({ limit: 100 }),
    queryFn: () => crmRestaurantsApi.list({ limit: 100 }),
    retry: false,
  });
  // Booking customers ARE the restaurants in practice — their restaurantName is
  // captured at first booking. The CRM Restaurant table (above) is the separate
  // sales-pipeline list, which is often empty, so this is the picker's main source.
  const customersQ = useQuery({
    queryKey: queryKeys.customers(""),
    queryFn: () => customersApi.list(),
    retry: false,
  });
  const customerRestaurants = (customersQ.data ?? []).filter((c) => c.restaurantName);
  const staffQ = useQuery({
    queryKey: crmQueryKeys.rbacStaff,
    queryFn: rbacApi.staff,
    retry: false,
  });

  const create = useMutation({
    mutationFn: (body: TicketBody & { subject: string; description: string }) =>
      crmTicketsApi.create(body),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["crm", "tickets"] });
      onCreated(row.subject);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not raise the ticket."),
  });

  return (
    <Modal title="Raise ticket" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          if (!subject.trim()) return setErr("Subject is required.");
          if (!description.trim()) return setErr("Description is required.");
          // The picker mixes two sources: "c:<userId>" is a booking customer
          // (their restaurantName is the restaurant), "r:<id>" a CRM client.
          create.mutate({
            subject: subject.trim(),
            description: description.trim(),
            category,
            priority,
            customerId: restaurantId.startsWith("c:")
              ? Number(restaurantId.slice(2))
              : undefined,
            restaurantId: restaurantId.startsWith("r:")
              ? Number(restaurantId.slice(2))
              : undefined,
            raisedByName: raisedByName.trim() || undefined,
            raisedByContact: raisedByContact.trim() || undefined,
            assignedToId: assignedToId ? Number(assignedToId) : undefined,
          });
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Subject">
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputCls}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {pretty(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              className={inputCls}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {pretty(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!(restaurantsQ.isError && customersQ.isError) && (
          <Field label="Restaurant" hint="Optional — link this ticket to the restaurant it is about.">
            <select
              className={inputCls}
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
            >
              <option value="">No restaurant</option>
              {/* Booking customers — restaurantName captured at first booking. */}
              {customerRestaurants.map((c) => (
                <option key={`c:${c.userId}`} value={`c:${c.userId}`}>
                  {c.restaurantName}
                  {c.name ? ` — ${c.name}` : ""}
                  {c.mobile ? ` (${c.mobile})` : ""}
                </option>
              ))}
              {/* CRM client list (sales pipeline) — kept for tickets about those. */}
              {restaurantsQ.data?.restaurants.map((r) => (
                <option key={`r:${r.restaurantId}`} value={`r:${r.restaurantId}`}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Raised by name">
            <input
              className={inputCls}
              value={raisedByName}
              onChange={(e) => setRaisedByName(e.target.value)}
            />
          </Field>
          <Field label="Raised by contact">
            <input
              className={inputCls}
              value={raisedByContact}
              onChange={(e) => setRaisedByContact(e.target.value)}
            />
          </Field>
        </div>
        {!staffQ.isError && (
          <Field label="Assign to">
            <select
              className={inputCls}
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {staffQ.data?.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {s.name ?? s.email ?? `#${s.userId}`}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={create.isPending}>
            Raise ticket
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

// 🎫 Ticket detail — status workflow, triage (assignee/priority) and the
// conversation thread. The original description is the opening message.
function TicketDetailModal({
  ticketId,
  canUpdate,
  canDelete,
  onClose,
}: {
  ticketId: number;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");

  const { data: t, isLoading } = useQuery({
    queryKey: crmQueryKeys.ticket(ticketId),
    queryFn: () => crmTicketsApi.get(ticketId),
  });
  const staffQ = useQuery({
    queryKey: crmQueryKeys.rbacStaff,
    queryFn: rbacApi.staff,
    retry: false,
  });

  // Refresh the open ticket, every list page and the summary cards.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: crmQueryKeys.ticket(ticketId) });
    qc.invalidateQueries({ queryKey: ["crm", "tickets"] });
  };

  const update = useMutation({
    mutationFn: (body: TicketBody) => crmTicketsApi.update(ticketId, body),
    onSuccess: () => {
      setErr("");
      invalidate();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Update failed."),
  });

  const sendReply = useMutation({
    mutationFn: (body: string) => crmTicketsApi.addMessage(ticketId, body),
    onSuccess: () => {
      setErr("");
      setReply("");
      invalidate();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not send the reply."),
  });

  const del = useMutation({
    mutationFn: () => crmTicketsApi.remove(ticketId),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete the ticket."),
  });

  return (
    <Modal title={`Ticket #${ticketId}`} onClose={onClose} wide>
      {err && (
        <div className="mb-4">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
      {t && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{t.subject}</h3>
              <Badge tone={ticketStatusTone(t.status)}>{pretty(t.status)}</Badge>
              <Badge tone="muted">{pretty(t.category)}</Badge>
              <Badge tone={priorityTone(t.priority)}>{pretty(t.priority)}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.restaurant?.name ?? t.customer?.restaurantName ?? "No restaurant"} · Raised by{" "}
              {t.raisedByName ?? t.customer?.name ?? "—"}
              {t.raisedByContact
                ? ` (${t.raisedByContact})`
                : t.customer?.mobile
                  ? ` (${t.customer.mobile})`
                  : ""}{" "}
              · Assigned to{" "}
              {t.assignedTo?.name ?? "—"} · Created {fmtDate(t.createdAt)} {fmtTime(t.createdAt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              First response: {dateTime(t.firstResponseAt)} · Resolved: {dateTime(t.resolvedAt)}
            </p>
          </div>

          {canUpdate && (
            <div className="flex flex-wrap items-center gap-2">
              {NEXT_STATUSES[t.status].map((a) => (
                <Btn
                  key={a.status}
                  small
                  tone={a.status === "RESOLVED" ? "success" : a.status === "CLOSED" ? "ghost" : "primary"}
                  busy={update.isPending && update.variables?.status === a.status}
                  onClick={() => update.mutate({ status: a.status })}
                >
                  {a.label}
                </Btn>
              ))}
            </div>
          )}

          {canUpdate && (
            <div className="grid grid-cols-2 gap-4">
              {!staffQ.isError && (
                <Field label="Assignee">
                  <select
                    className={inputCls}
                    value={t.assignedToId ?? ""}
                    disabled={update.isPending}
                    onChange={(e) => {
                      if (e.target.value) update.mutate({ assignedToId: Number(e.target.value) });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {staffQ.data?.map((s) => (
                      <option key={s.userId} value={s.userId}>
                        {s.name ?? s.email ?? `#${s.userId}`}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Priority">
                <select
                  className={inputCls}
                  value={t.priority}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ priority: e.target.value })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {pretty(p)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium text-foreground">Conversation</h4>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              <div className="rounded-xl border border-border bg-accent/30 p-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t.raisedByName ?? t.customer?.name ?? t.restaurant?.name ?? "Reporter"}
                  </span>
                  <span>
                    {fmtDate(t.createdAt)} {fmtTime(t.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{t.description}</p>
              </div>
              {t.messages?.map((m) => (
                <div key={m.messageId} className="rounded-xl border border-border bg-accent/30 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {m.author?.name ?? "Unknown"}
                      {m.author?.role ? (
                        <span className="ml-1 font-normal text-muted-foreground">· {m.author.role}</span>
                      ) : null}
                    </span>
                    <span>
                      {fmtDate(m.createdAt)} {fmtTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
                </div>
              ))}
            </div>
            {canUpdate &&
              (t.status === "CLOSED" ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  This ticket is closed. Reopen to reply.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    className={inputCls}
                    rows={2}
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Btn
                      small
                      busy={sendReply.isPending}
                      disabled={!reply.trim()}
                      onClick={() => sendReply.mutate(reply.trim())}
                    >
                      Send
                    </Btn>
                  </div>
                </div>
              ))}
          </div>

          {canDelete && (
            <div className="flex justify-end border-t border-border pt-4">
              <Btn
                tone="danger"
                small
                busy={del.isPending}
                onClick={() => {
                  if (window.confirm("Delete this ticket and its full conversation? This cannot be undone.")) {
                    del.mutate();
                  }
                }}
              >
                Delete ticket
              </Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
