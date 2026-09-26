"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  crmSalesApi,
  rbacApi,
  type RestaurantRow,
  type SalesFollowUpRow,
  type SalesLeadBody,
  type SalesLeadRow,
  type SalesLeadSource,
  type SalesLeadStage,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  fmtTime,
} from "@/src/components/crm/ui";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const STAGES: SalesLeadStage[] = [
  "NEW",
  "CONTACTED",
  "DEMO_SCHEDULED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const SOURCES: SalesLeadSource[] = [
  "WEBSITE",
  "INSTAGRAM",
  "LINKEDIN",
  "REFERRAL",
  "COLD_CALLING",
  "GOOGLE_ADS",
  "OTHER",
];

const stageLabels: Record<SalesLeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  DEMO_SCHEDULED: "Demo",
  PROPOSAL_SENT: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

const stageTones: Record<SalesLeadStage, string> = {
  NEW: "primary",
  CONTACTED: "warning",
  DEMO_SCHEDULED: "warning",
  PROPOSAL_SENT: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "danger",
};

const pretty = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const fmtValue = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtValueCompact = (n: number) =>
  `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`;

const isPast = (d: string) => new Date(d).getTime() < Date.now();

const followUpOverdue = (f: SalesFollowUpRow) => f.status === "PENDING" && isPast(f.dueAt);

// Every mutation touches the list, the per-lead detail and the pipeline stats.
const invalidateLeads = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ["crm", "sales-leads"] });
  qc.invalidateQueries({ queryKey: ["crm", "sales-lead"] });
  qc.invalidateQueries({ queryKey: crmQueryKeys.salesPipeline });
};

export default function SalesLeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<SalesLeadStage | "">("");
  const [source, setSource] = useState<SalesLeadSource | "">("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SalesLeadRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canCreate = hasPermission("sales-leads.create");
  const canUpdate = hasPermission("sales-leads.update");
  const canDelete = hasPermission("sales-leads.delete");

  // `?new=1` deep-link opens the create modal on mount.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setAdding(true);
  }, []);

  const params = {
    search: search || undefined,
    stage: stage || undefined,
    source: source || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const pipeline = useQuery({
    queryKey: crmQueryKeys.salesPipeline,
    queryFn: () => crmSalesApi.pipeline(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.salesLeads(params),
    queryFn: () => crmSalesApi.list(params),
    placeholderData: keepPreviousData,
  });

  const del = useMutation({
    mutationFn: (id: number) => crmSalesApi.remove(id),
    onSuccess: () => {
      setActionError(null);
      setNotice("Lead deleted.");
      invalidateLeads(qc);
    },
    onError: (e) => setActionError(e instanceof ApiError ? e.message : "Could not delete lead."),
  });

  const byStage = new Map((pipeline.data?.byStage ?? []).map((r) => [r.stage, r]));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Sales Leads"
        subtitle="Pipeline: New → Contacted → Demo → Proposal → Negotiation → Won / Lost"
        action={
          canCreate ? (
            <Btn
              onClick={() => {
                setNotice(null);
                setActionError(null);
                setAdding(true);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              Add lead
            </Btn>
          ) : undefined
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {/* Pipeline bar — clicking a stage card toggles the stage filter */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {STAGES.map((s) => {
          const row = byStage.get(s);
          const active = stage === s;
          return (
            <button
              key={s}
              type="button"
              className="text-left"
              onClick={() => {
                setStage(active ? "" : s);
                setPage(1);
              }}
            >
              <Card
                className={`p-4 transition-colors ${
                  active ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                }`}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stageLabels[s]}
                </div>
                <div className="mt-1 text-xl font-semibold text-foreground">{row?.count ?? 0}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtValueCompact(row?.value ?? 0)}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
      {pipeline.data && pipeline.data.overdueFollowUps > 0 && (
        <Notice kind="error">{pipeline.data.overdueFollowUps} follow-ups overdue</Notice>
      )}
      {pipeline.data && pipeline.data.upcomingFollowUps > 0 && (
        <p className="text-sm text-muted-foreground">
          {pipeline.data.upcomingFollowUps} due in the next 7 days
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search restaurant, contact or city…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={`${inputCls} w-auto`}
          value={source}
          onChange={(e) => {
            setSource(e.target.value as SalesLeadSource | "");
            setPage(1);
          }}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {pretty(s)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <TableShell
          head={[
            "Restaurant",
            "Contact",
            "City",
            "Source",
            "Stage",
            "Value",
            "Expected close",
            "Assigned to",
            "Next follow-up",
            "",
          ]}
        >
          {isLoading && <EmptyRow cols={10} label="Loading…" />}
          {!isLoading && !data?.leads.length && <EmptyRow cols={10} label="No leads found" />}
          {data?.leads.map((l) => {
            const closePast =
              l.expectedCloseAt &&
              isPast(l.expectedCloseAt) &&
              l.stage !== "WON" &&
              l.stage !== "LOST";
            return (
              <tr key={l.leadId} className="transition-colors hover:bg-accent/50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDetailId(l.leadId)}
                    className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {l.restaurantName}
                  </button>
                  <div className="text-xs text-muted-foreground">#{l.leadId}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{l.contactName ?? "—"}</div>
                  <div className="text-xs">{l.phone ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.city ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone="muted">{pretty(l.source)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stageTones[l.stage]}>{stageLabels[l.stage]}</Badge>
                </td>
                <td className="px-4 py-3 text-foreground">{fmtValue(l.leadValue)}</td>
                <td className={`px-4 py-3 ${closePast ? "text-danger" : "text-muted-foreground"}`}>
                  {fmtDate(l.expectedCloseAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.assignedTo?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {l.nextFollowUp ? (
                    <span
                      className={
                        followUpOverdue(l.nextFollowUp) ? "text-danger" : "text-muted-foreground"
                      }
                    >
                      {fmtDate(l.nextFollowUp.dueAt)} {fmtTime(l.nextFollowUp.dueAt)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => setEditing(l)}
                        title="Edit lead"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete lead "${l.restaurantName}"?`))
                            del.mutate(l.leadId);
                        }}
                        title="Delete lead"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Btn>
            <Btn
              tone="ghost"
              small
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {(adding || editing) && (
        <LeadFormModal
          lead={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(name, created) => {
            setAdding(false);
            setEditing(null);
            setActionError(null);
            setNotice(`Lead “${name}” ${created ? "created" : "updated"}.`);
            invalidateLeads(qc);
          }}
        />
      )}
      {detailId != null && (
        <LeadDetailModal
          leadId={detailId}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClose={() => setDetailId(null)}
          onEdit={(lead) => {
            setDetailId(null);
            setEditing(lead);
          }}
          onDeleted={() => {
            setDetailId(null);
            setActionError(null);
            setNotice("Lead deleted.");
          }}
          onConverted={(r) => {
            setActionError(null);
            setNotice(
              <>
                Lead converted to restaurant.{" "}
                <Link
                  href={`/dashboard/crm/restaurants/${r.restaurantId}`}
                  className="font-medium underline"
                >
                  Open {r.name}
                </Link>
              </>,
            );
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Create / edit ----------------------------- */

type LeadForm = {
  restaurantName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  source: SalesLeadSource;
  stage: SalesLeadStage;
  leadValue: string;
  expectedCloseAt: string;
  assignedToId: string;
  notes: string;
  lostReason: string;
};

function LeadFormModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: SalesLeadRow | null;
  onClose: () => void;
  onSaved: (restaurantName: string, created: boolean) => void;
}) {
  const [form, setForm] = useState<LeadForm>({
    restaurantName: lead?.restaurantName ?? "",
    contactName: lead?.contactName ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    city: lead?.city ?? "",
    source: lead?.source ?? "WEBSITE",
    stage: lead?.stage ?? "NEW",
    leadValue: lead?.leadValue ? String(lead.leadValue) : "",
    expectedCloseAt: lead?.expectedCloseAt ? lead.expectedCloseAt.slice(0, 10) : "",
    assignedToId: lead?.assignedToId != null ? String(lead.assignedToId) : "",
    notes: lead?.notes ?? "",
    lostReason: lead?.lostReason ?? "",
  });
  const [err, setErr] = useState("");

  // Staff picker — the user may lack staff.view, in which case we fall back
  // to a plain userId input instead of a select.
  const staff = useQuery({
    queryKey: crmQueryKeys.rbacStaff,
    queryFn: () => rbacApi.staff(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (body: SalesLeadBody & { restaurantName: string }) =>
      lead ? crmSalesApi.update(lead.leadId, body) : crmSalesApi.create(body),
    onSuccess: (row) => onSaved(row.restaurantName, !lead),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save lead."),
  });

  const set =
    (key: keyof LeadForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal title={lead ? `Edit lead #${lead.leadId}` : "Add lead"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          const restaurantName = form.restaurantName.trim();
          if (!restaurantName) return setErr("Restaurant name is required.");
          const body: SalesLeadBody & { restaurantName: string } = {
            restaurantName,
            source: form.source,
            stage: form.stage,
          };
          if (form.contactName.trim()) body.contactName = form.contactName.trim();
          if (form.phone.trim()) body.phone = form.phone.trim();
          if (form.email.trim()) body.email = form.email.trim();
          if (form.city.trim()) body.city = form.city.trim();
          if (form.leadValue.trim()) {
            const n = Number(form.leadValue);
            if (Number.isNaN(n) || n < 0) return setErr("Lead value must be a valid number.");
            body.leadValue = n;
          }
          if (form.expectedCloseAt)
            body.expectedCloseAt = new Date(form.expectedCloseAt).toISOString();
          if (form.assignedToId.trim()) {
            const id = Number(form.assignedToId);
            if (Number.isNaN(id)) return setErr("Assignee userId must be a number.");
            body.assignedToId = id;
          }
          if (form.notes.trim()) body.notes = form.notes.trim();
          if (form.stage === "LOST" && form.lostReason.trim())
            body.lostReason = form.lostReason.trim();
          save.mutate(body);
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Restaurant name *">
            <input
              className={inputCls}
              value={form.restaurantName}
              onChange={set("restaurantName")}
              autoFocus
            />
          </Field>
          <Field label="Contact name">
            <input className={inputCls} value={form.contactName} onChange={set("contactName")} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="City">
            <input className={inputCls} value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Source">
            <select className={inputCls} value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {pretty(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select className={inputCls} value={form.stage} onChange={set("stage")}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead value (₹)">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.leadValue}
              onChange={set("leadValue")}
            />
          </Field>
          <Field label="Expected closing date">
            <input
              className={inputCls}
              type="date"
              value={form.expectedCloseAt}
              onChange={set("expectedCloseAt")}
            />
          </Field>
          {staff.isError ? (
            <Field label="Assignee userId (optional)">
              <input
                className={inputCls}
                type="number"
                value={form.assignedToId}
                onChange={set("assignedToId")}
              />
            </Field>
          ) : (
            <Field label="Assigned sales executive">
              <select className={inputCls} value={form.assignedToId} onChange={set("assignedToId")}>
                <option value="">Unassigned</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.name ?? s.email ?? `#${s.userId}`}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {form.stage === "LOST" && (
          <Field label="Lost reason">
            <input className={inputCls} value={form.lostReason} onChange={set("lostReason")} />
          </Field>
        )}
        <Field label="Notes">
          <textarea className={inputCls} rows={3} value={form.notes} onChange={set("notes")} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {lead ? "Save changes" : "Create lead"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------- Detail --------------------------------- */

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

function LeadDetailModal({
  leadId,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onDeleted,
  onConverted,
}: {
  leadId: number;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (lead: SalesLeadRow) => void;
  onDeleted: () => void;
  onConverted: (restaurant: RestaurantRow) => void;
}) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");

  const { data: lead, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.salesLead(leadId),
    queryFn: () => crmSalesApi.get(leadId),
  });

  const refresh = () => invalidateLeads(qc);
  const onMutError = (e: unknown) =>
    setErr(e instanceof ApiError ? e.message : "Action failed.");

  const addFollowUp = useMutation({
    mutationFn: () =>
      crmSalesApi.addFollowUp(leadId, {
        dueAt: new Date(dueAt).toISOString(),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setErr("");
      setDueAt("");
      setNote("");
      refresh();
    },
    onError: onMutError,
  });

  const markDone = useMutation({
    mutationFn: (followUpId: number) => crmSalesApi.updateFollowUp(followUpId, { status: "DONE" }),
    onSuccess: () => {
      setErr("");
      refresh();
    },
    onError: onMutError,
  });

  const delFollowUp = useMutation({
    mutationFn: (followUpId: number) => crmSalesApi.removeFollowUp(followUpId),
    onSuccess: () => {
      setErr("");
      refresh();
    },
    onError: onMutError,
  });

  const convert = useMutation({
    mutationFn: () => crmSalesApi.convert(leadId),
    onSuccess: (restaurant) => {
      setErr("");
      refresh();
      onConverted(restaurant);
    },
    onError: onMutError,
  });

  const del = useMutation({
    mutationFn: () => crmSalesApi.remove(leadId),
    onSuccess: () => {
      refresh();
      onDeleted();
    },
    onError: onMutError,
  });

  return (
    <Modal title={lead ? lead.restaurantName : `Lead #${leadId}`} onClose={onClose} wide>
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
      {lead && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Info label="Contact">{lead.contactName ?? "—"}</Info>
            <Info label="Phone">{lead.phone ?? "—"}</Info>
            <Info label="Email">{lead.email ?? "—"}</Info>
            <Info label="City">{lead.city ?? "—"}</Info>
            <Info label="Source">
              <Badge tone="muted">{pretty(lead.source)}</Badge>
            </Info>
            <Info label="Stage">
              <Badge tone={stageTones[lead.stage]}>{stageLabels[lead.stage]}</Badge>
            </Info>
            <Info label="Lead value">{fmtValue(lead.leadValue)}</Info>
            <Info label="Expected close">{fmtDate(lead.expectedCloseAt)}</Info>
            <Info label="Assigned to">{lead.assignedTo?.name ?? "—"}</Info>
            <Info label="Won at">{fmtDate(lead.wonAt)}</Info>
            <Info label="Created">{fmtDate(lead.createdAt)}</Info>
          </div>
          {lead.notes && (
            <Info label="Notes">
              <span className="whitespace-pre-wrap">{lead.notes}</span>
            </Info>
          )}
          {lead.lostReason && (
            <Info label="Lost reason">
              <span className="text-danger">{lead.lostReason}</span>
            </Info>
          )}

          {/* Convert to restaurant */}
          <div className="rounded-xl border border-border p-4">
            {lead.convertedRestaurantId != null ? (
              <p className="text-sm text-muted-foreground">
                Converted →{" "}
                <Link
                  href={`/dashboard/crm/restaurants/${lead.convertedRestaurantId}`}
                  className="font-medium text-foreground underline"
                >
                  {lead.convertedRestaurant?.name ?? `Restaurant #${lead.convertedRestaurantId}`}
                </Link>
              </p>
            ) : canUpdate ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Create a restaurant client from this lead.
                </p>
                <Btn
                  tone="success"
                  small
                  busy={convert.isPending}
                  onClick={() => {
                    if (window.confirm(`Convert "${lead.restaurantName}" into a restaurant?`))
                      convert.mutate();
                  }}
                >
                  Convert to restaurant
                </Btn>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not converted yet.</p>
            )}
          </div>

          {/* Follow-ups */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Follow-ups ({lead.followUps?.length ?? 0})
            </h3>
            <div className="space-y-2">
              {!lead.followUps?.length && (
                <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
              )}
              {lead.followUps?.map((f) => (
                <div
                  key={f.followUpId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <span
                    className={`text-sm ${
                      followUpOverdue(f) ? "text-danger" : "text-foreground"
                    }`}
                  >
                    {fmtDate(f.dueAt)} {fmtTime(f.dueAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {f.note ?? "—"}
                  </span>
                  <Badge tone={f.status === "DONE" ? "success" : "warning"}>{f.status}</Badge>
                  {canUpdate && f.status === "PENDING" && (
                    <Btn
                      small
                      tone="success"
                      busy={markDone.isPending && markDone.variables === f.followUpId}
                      onClick={() => markDone.mutate(f.followUpId)}
                    >
                      Mark done
                    </Btn>
                  )}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => delFollowUp.mutate(f.followUpId)}
                      title="Delete follow-up"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {canUpdate && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputCls} w-auto`}
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                  <input
                    className={`${inputCls} min-w-0 flex-1`}
                    placeholder="Note…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Btn
                    small
                    busy={addFollowUp.isPending}
                    disabled={!dueAt}
                    onClick={() => addFollowUp.mutate()}
                  >
                    Add
                  </Btn>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            {canDelete && (
              <Btn
                tone="danger"
                busy={del.isPending}
                onClick={() => {
                  if (window.confirm(`Delete lead "${lead.restaurantName}"?`)) del.mutate();
                }}
              >
                Delete
              </Btn>
            )}
            {canUpdate && (
              <Btn tone="ghost" onClick={() => onEdit(lead)}>
                <PencilIcon className="h-4 w-4" />
                Edit
              </Btn>
            )}
            <Btn tone="ghost" onClick={onClose}>
              Close
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
