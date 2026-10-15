"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  marketingLeadKeys,
  marketingLeadsApi,
  type LeadImportPreview,
  type LeadImportResult,
  type LeadMasterRow,
  type LeadMasterType,
  type MarketingLeadBody,
  type MarketingLeadListParams,
  type MarketingLeadRow,
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
} from "@/src/components/crm/ui";
import {
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/src/components/icons";
import { SendLeadCampaignModal } from "@/src/components/crm/send-lead-campaign-modal";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZES = [25, 50, 100];

/* Filters live in the URL so a filtered view can be shared/reloaded. Read once
   on mount, written back with replaceState — same approach as the ?new=1
   deep-link on the sales-leads page, no router re-render loops. */
type Filters = {
  q: string;
  platformId: string;
  staffCategoryId: string;
  callerId: string;
  callStatusId: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  platformId: "",
  staffCategoryId: "",
  callerId: "",
  callStatusId: "",
  dateFrom: "",
  dateTo: "",
  sort: "createdAt",
  order: "desc",
  page: 1,
  limit: 25,
};

function readFiltersFromUrl(): Filters {
  const sp = new URLSearchParams(window.location.search);
  const get = (k: string) => sp.get(k) ?? "";
  return {
    ...DEFAULT_FILTERS,
    q: get("q"),
    platformId: get("platformId"),
    staffCategoryId: get("staffCategoryId"),
    callerId: get("callerId"),
    callStatusId: get("callStatusId"),
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
    sort: get("sort") || DEFAULT_FILTERS.sort,
    order: get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(get("page")) || 1),
    limit: PAGE_SIZES.includes(Number(get("limit"))) ? Number(get("limit")) : 25,
  };
}

function writeFiltersToUrl(f: Filters) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const def = DEFAULT_FILTERS[k as keyof Filters];
    if (v !== def && v !== "" && v != null) sp.set(k, String(v));
  }
  const qs = sp.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const toListParams = (f: Filters): MarketingLeadListParams => ({
  q: f.q || undefined,
  platformId: f.platformId ? Number(f.platformId) : undefined,
  staffCategoryId: f.staffCategoryId ? Number(f.staffCategoryId) : undefined,
  callerId: f.callerId ? Number(f.callerId) : undefined,
  callStatusId: f.callStatusId ? Number(f.callStatusId) : undefined,
  dateFrom: f.dateFrom || undefined,
  dateTo: f.dateTo || undefined,
  sort: f.sort,
  order: f.order,
  page: f.page,
  limit: f.limit,
});

const fmtIst = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

function useMasters(type: LeadMasterType) {
  return useQuery({
    queryKey: marketingLeadKeys.masters(type),
    queryFn: () => marketingLeadsApi.masters.list(type),
    staleTime: 5 * 60 * 1000,
  });
}

export default function LeadsPage() {
  const qc = useQueryClient();
  // Lazy init from the URL: the server render uses the defaults, the client
  // picks up shared/reloaded filters without an extra effect pass.
  const [filters, setFilters] = useState<Filters>(() =>
    typeof window === "undefined" ? DEFAULT_FILTERS : readFiltersFromUrl(),
  );
  const [searchDraft, setSearchDraft] = useState(() => filters.q);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MarketingLeadRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [campaigning, setCampaigning] = useState(false);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canCreate = hasPermission("marketing-leads.create");
  const canUpdate = hasPermission("marketing-leads.update");
  const canDelete = hasPermission("marketing-leads.delete");
  const canMasters = hasPermission("marketing-leads.masters");
  // Sending is a campaigns power, not a leads one — the same key the Customers
  // page's bulk WhatsApp send needs.
  const canCampaign = hasPermission("campaigns.manage");

  // Debounced search → filters.q (400 ms).
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === searchDraft ? f : { ...f, q: searchDraft, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // Keep the filters shareable in the URL.
  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const platforms = useMasters("platforms");
  const categories = useMasters("staff-categories");
  const callers = useMasters("callers");
  const statuses = useMasters("call-statuses");

  const params = toListParams(filters);
  const { data, isLoading, error } = useQuery({
    queryKey: marketingLeadKeys.leads(params),
    queryFn: () => marketingLeadsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["marketing-leads", "list"] });
    qc.invalidateQueries({ queryKey: ["marketing-leads", "detail"] });
  };

  const set = (patch: Partial<Filters>) => {
    setSelected(new Set());
    setFilters((f) => ({ ...f, page: 1, ...patch }));
  };

  const sortBy = (column: string) =>
    setFilters((f) => ({
      ...f,
      sort: column,
      order: f.sort === column && f.order === "desc" ? "asc" : "desc",
      page: 1,
    }));

  const del = useMutation({
    mutationFn: (id: number) => marketingLeadsApi.remove(id),
    onSuccess: () => {
      setActionError(null);
      setNotice("Lead deleted.");
      invalidate();
    },
    onError: (e) => setActionError(errMsg(e, "Could not delete lead.")),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => marketingLeadsApi.bulkDelete(ids),
    onSuccess: (r) => {
      setActionError(null);
      setNotice(`${r.deleted} leads deleted.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e) => setActionError(errMsg(e, "Bulk delete failed.")),
  });

  const bulkUpdate = useMutation({
    mutationFn: (body: { ids: number[]; callerId?: number; callStatusId?: number }) =>
      marketingLeadsApi.bulkUpdate(body),
    onSuccess: (r) => {
      setActionError(null);
      setNotice(`${r.updated} leads updated.`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e) => setActionError(errMsg(e, "Bulk update failed.")),
  });

  const quickEdit = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof marketingLeadsApi.updateCall>[1] }) =>
      marketingLeadsApi.updateCall(id, body),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (e) => setActionError(errMsg(e, "Could not update the lead.")),
  });

  const exportCsv = async (onlySelected: boolean) => {
    setExporting(true);
    setActionError(null);
    try {
      const blob = await marketingLeadsApi.exportCsv({
        ...params,
        page: undefined,
        limit: undefined,
        ids: onlySelected ? [...selected] : undefined,
      });
      saveBlob(blob, `leads_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setActionError(errMsg(e, "Export failed."));
    } finally {
      setExporting(false);
    }
  };

  const leads = data?.leads ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / filters.limit)) : 1;
  const pageIds = leads.map((l) => l.leadId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePage = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const activeCallers = (callers.data ?? []).filter((c) => c.isActive);
  const activeStatuses = (statuses.data ?? []).filter((s) => s.isActive);

  const sortHint = (column: string) =>
    filters.sort === column ? (filters.order === "desc" ? " ↓" : " ↑") : "";

  const head: { label: string; sort?: string }[] = [
    { label: "S.No.", sort: "leadId" },
    { label: "Timestamp", sort: "createdAt" },
    { label: "Platform", sort: "platform" },
    { label: "Full name", sort: "fullName" },
    { label: "Phone", sort: "phoneNumber" },
    { label: "Restaurant", sort: "restaurantName" },
    { label: "Location", sort: "location" },
    { label: "Staff requirement" },
    { label: "Caller", sort: "caller" },
    { label: "Call status", sort: "callStatus" },
    { label: "Remarks" },
    { label: "" },
  ];

  return (
    <div className="mx-auto max-w-384 space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Ad and call-centre leads — search, assign callers and track call outcomes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
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
            )}
            {canCreate && (
              <Btn tone="ghost" onClick={() => setImporting(true)}>
                Import CSV
              </Btn>
            )}
            <Btn tone="ghost" busy={exporting} onClick={() => exportCsv(false)}>
              Export CSV
            </Btn>
            {canMasters && (
              <Link
                href="/dashboard/leads/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
            )}
          </div>
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search name, phone, restaurant or location…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <select
          className={`${inputCls} w-auto`}
          value={filters.platformId}
          onChange={(e) => set({ platformId: e.target.value })}
        >
          <option value="">All platforms</option>
          {(platforms.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} w-auto`}
          value={filters.staffCategoryId}
          onChange={(e) => set({ staffCategoryId: e.target.value })}
        >
          <option value="">All staff requirements</option>
          {(categories.data ?? []).map((main) => (
            <optgroup key={main.id} label={main.name}>
              <option value={main.id}>{main.name} (any)</option>
              {(main.children ?? []).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {main.name} &gt; {sub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          className={`${inputCls} w-auto`}
          value={filters.callerId}
          onChange={(e) => set({ callerId: e.target.value })}
        >
          <option value="">All callers</option>
          {(callers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} w-auto`}
          value={filters.callStatusId}
          onChange={(e) => set({ callStatusId: e.target.value })}
        >
          <option value="">All call statuses</option>
          {(statuses.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className={`${inputCls} w-auto`}
          value={filters.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
          title="From date"
        />
        <input
          type="date"
          className={`${inputCls} w-auto`}
          value={filters.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
          title="To date"
        />
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">{selected.size} selected</span>
          {canUpdate && (
            <select
              className={`${inputCls} w-auto`}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  bulkUpdate.mutate({ ids: [...selected], callerId: Number(e.target.value) });
              }}
            >
              <option value="">Assign caller…</option>
              {activeCallers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {canUpdate && (
            <select
              className={`${inputCls} w-auto`}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  bulkUpdate.mutate({ ids: [...selected], callStatusId: Number(e.target.value) });
              }}
            >
              <option value="">Change status…</option>
              {activeStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {canCampaign && (
            <Btn
              tone="success"
              small
              onClick={() => {
                setActionError(null);
                setNotice(null);
                setCampaigning(true);
              }}
            >
              WhatsApp campaign
            </Btn>
          )}
          <Btn tone="ghost" small busy={exporting} onClick={() => exportCsv(true)}>
            Export selected
          </Btn>
          {canDelete && (
            <Btn
              tone="danger"
              small
              busy={bulkDelete.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${selected.size} leads?`))
                  bulkDelete.mutate([...selected]);
              }}
            >
              Delete
            </Btn>
          )}
          <button
            type="button"
            className="text-muted-foreground underline hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    aria-label="Select page"
                  />
                </th>
                {head.map((h) => (
                  <th key={h.label || "actions"} className="px-4 py-3 font-medium">
                    {h.sort ? (
                      <button
                        type="button"
                        className="uppercase tracking-wide hover:text-foreground"
                        onClick={() => sortBy(h.sort!)}
                      >
                        {h.label}
                        {sortHint(h.sort)}
                      </button>
                    ) : (
                      h.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <EmptyRow cols={13} label="Loading…" />}
              {!isLoading && !leads.length && <EmptyRow cols={13} label="No leads found" />}
              {leads.map((l) => (
                <tr key={l.leadId} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(l.leadId)}
                      onChange={() => toggleOne(l.leadId)}
                      aria-label={`Select lead ${l.leadId}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">#{l.leadId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {fmtIst(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="muted">{l.platform.name}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{l.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:+91${l.phoneNumber}`}
                        className="text-foreground hover:text-primary hover:underline"
                        title="Call"
                      >
                        {l.phoneNumber}
                      </a>
                      <a
                        href={`https://wa.me/91${l.phoneNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open WhatsApp chat"
                        className="rounded-lg p-1 text-success transition-colors hover:bg-success/10"
                      >
                        <PhoneIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.restaurantName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {l.requirements.length
                        ? l.requirements.map((r) => (
                            <Badge key={r.categoryId} tone="primary">
                              {r.label}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canUpdate ? (
                      <select
                        className={`${inputCls} w-auto min-w-28 py-1.5 text-xs`}
                        value={l.callerId ?? ""}
                        onChange={(e) =>
                          quickEdit.mutate({
                            id: l.leadId,
                            body: { callerId: e.target.value ? Number(e.target.value) : null },
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {activeCallers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        {l.caller && !activeCallers.some((c) => c.id === l.callerId) && (
                          <option value={l.caller.callerId}>{l.caller.name}</option>
                        )}
                      </select>
                    ) : (
                      (l.caller?.name ?? "—")
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canUpdate ? (
                      <select
                        className={`${inputCls} w-auto min-w-32 py-1.5 text-xs`}
                        style={
                          l.callStatus?.color
                            ? { borderColor: l.callStatus.color, color: l.callStatus.color }
                            : undefined
                        }
                        value={l.callStatusId ?? ""}
                        onChange={(e) =>
                          quickEdit.mutate({
                            id: l.leadId,
                            body: { callStatusId: e.target.value ? Number(e.target.value) : null },
                          })
                        }
                      >
                        <option value="">—</option>
                        {activeStatuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                        {l.callStatus && !activeStatuses.some((s) => s.id === l.callStatusId) && (
                          <option value={l.callStatus.statusId}>{l.callStatus.name}</option>
                        )}
                      </select>
                    ) : l.callStatus ? (
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                        style={
                          l.callStatus.color
                            ? { backgroundColor: `${l.callStatus.color}1a`, color: l.callStatus.color }
                            : undefined
                        }
                      >
                        {l.callStatus.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="block max-w-40 truncate" title={l.callRemarks ?? undefined}>
                      {l.callRemarks ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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
                            if (window.confirm(`Delete lead "${l.fullName}"?`)) del.mutate(l.leadId);
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            {data ? `${data.total} leads · page ${filters.page} of ${totalPages}` : "…"}
          </span>
          <div className="flex items-center gap-2">
            <select
              className={`${inputCls} w-auto py-1.5 text-xs`}
              value={filters.limit}
              onChange={(e) => set({ limit: Number(e.target.value) })}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <Btn
              tone="ghost"
              small
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Prev
            </Btn>
            <Btn
              tone="ghost"
              small
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {(adding || editing) && (
        <LeadFormModal
          lead={editing}
          canMasters={canMasters}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(name, created) => {
            setAdding(false);
            setEditing(null);
            setActionError(null);
            setNotice(`Lead “${name}” ${created ? "created" : "updated"}.`);
            invalidate();
          }}
        />
      )}
      {campaigning && (
        <SendLeadCampaignModal
          leadIds={[...selected]}
          sampleName={leads.find((l) => selected.has(l.leadId))?.fullName ?? null}
          onClose={() => setCampaigning(false)}
          onStarted={(campaignName, queued) => {
            setCampaigning(false);
            setSelected(new Set());
            setNotice(
              <>
                Campaign “{campaignName}” started — {queued} message
                {queued === 1 ? "" : "s"} queued.{" "}
                <Link href="/dashboard/crm/campaigns" className="font-medium underline">
                  Watch progress
                </Link>
              </>,
            );
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(r) => {
            setNotice(
              `Import finished: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped, ${r.failed} failed.`,
            );
            invalidate();
            qc.invalidateQueries({ queryKey: ["marketing-leads", "masters"] });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Create / edit ----------------------------- */

/** Select with an inline "+ Add new" row — the add-on feature. Creating an
 *  entry refreshes the master list and selects the new id. */
function AddableSelect({
  label,
  type,
  options,
  value,
  onChange,
  canAdd,
  allowEmpty,
}: {
  label: string;
  type: LeadMasterType;
  options: LeadMasterRow[];
  value: string;
  onChange: (v: string) => void;
  canAdd: boolean;
  allowEmpty?: boolean;
}) {
  const qc = useQueryClient();
  const [addingNew, setAddingNew] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () => marketingLeadsApi.masters.create(type, { name: name.trim() }),
    onSuccess: (row) => {
      setErr("");
      setAddingNew(false);
      setName("");
      qc.invalidateQueries({ queryKey: marketingLeadKeys.masters(type) });
      onChange(String(row.id));
    },
    onError: (e) => setErr(errMsg(e, "Could not create the entry.")),
  });

  return (
    <Field label={label}>
      <div className="space-y-2">
        <select
          className={inputCls}
          value={value}
          onChange={(e) => {
            if (e.target.value === "__add__") {
              setAddingNew(true);
            } else {
              onChange(e.target.value);
            }
          }}
        >
          {allowEmpty && <option value="">—</option>}
          {options
            .filter((o) => o.isActive || String(o.id) === value)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          {canAdd && <option value="__add__">+ Add new…</option>}
        </select>
        {addingNew && (
          <div className="flex items-center gap-2">
            <input
              className={inputCls}
              placeholder="New entry name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Btn small busy={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>
              Add
            </Btn>
            <Btn small tone="ghost" onClick={() => setAddingNew(false)}>
              Cancel
            </Btn>
          </div>
        )}
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
    </Field>
  );
}

function LeadFormModal({
  lead,
  canMasters,
  onClose,
  onSaved,
}: {
  lead: MarketingLeadRow | null;
  canMasters: boolean;
  onClose: () => void;
  onSaved: (fullName: string, created: boolean) => void;
}) {
  const platforms = useMasters("platforms");
  const categories = useMasters("staff-categories");
  const callers = useMasters("callers");
  const statuses = useMasters("call-statuses");

  const [form, setForm] = useState({
    platformId: lead ? String(lead.platformId) : "",
    fullName: lead?.fullName ?? "",
    phoneNumber: lead?.phoneNumber ?? "",
    restaurantName: lead?.restaurantName ?? "",
    location: lead?.location ?? "",
    callerId: lead?.callerId != null ? String(lead.callerId) : "",
    callStatusId: lead?.callStatusId != null ? String(lead.callStatusId) : "",
    callRemarks: lead?.callRemarks ?? "",
  });
  const [catIds, setCatIds] = useState<Set<number>>(
    new Set(lead?.requirements.map((r) => r.categoryId) ?? []),
  );
  const [err, setErr] = useState("");
  const [duplicate, setDuplicate] = useState<{ id: number; name: string } | null>(null);

  // New leads default to the first active platform and the "Not Called"
  // status — derived here (not stored) so it applies as soon as masters load.
  const defaultPlatformId =
    !lead && platforms.data ? String(platforms.data.find((p) => p.isActive)?.id ?? "") : "";
  const defaultStatusId =
    !lead && statuses.data
      ? String(statuses.data.find((s) => s.name.toLowerCase() === "not called")?.id ?? "")
      : "";
  const platformId = form.platformId || defaultPlatformId;
  const callStatusId = form.callStatusId || defaultStatusId;

  const save = useMutation({
    mutationFn: ({ force }: { force: boolean }) => {
      const body: MarketingLeadBody = {
        platformId: Number(platformId),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        restaurantName: form.restaurantName.trim() || undefined,
        location: form.location.trim() || undefined,
        callerId: form.callerId ? Number(form.callerId) : null,
        callStatusId: callStatusId ? Number(callStatusId) : null,
        callRemarks: form.callRemarks.trim() || undefined,
        staffCategoryIds: [...catIds],
      };
      return lead
        ? marketingLeadsApi.update(lead.leadId, body, force)
        : marketingLeadsApi.create(body, force);
    },
    onSuccess: (row) => onSaved(row.fullName, !lead),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        const d = e.data as { existingLeadId?: number; existingLeadName?: string } | undefined;
        setDuplicate({ id: d?.existingLeadId ?? 0, name: d?.existingLeadName ?? "existing lead" });
        setErr("");
        return;
      }
      setDuplicate(null);
      setErr(errMsg(e, "Could not save lead."));
    },
  });

  const setF = (key: keyof typeof form) => (v: string) => {
    setDuplicate(null);
    setForm((f) => ({ ...f, [key]: v }));
  };

  const toggleCat = (id: number) =>
    setCatIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (force: boolean) => {
    setErr("");
    if (!platformId) return setErr("Lead platform is required.");
    if (!form.fullName.trim()) return setErr("Full name is required.");
    const digits = form.phoneNumber.replace(/\D/g, "");
    const ten =
      digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0")
          ? digits.slice(1)
          : digits;
    if (ten.length !== 10 || !/^[6-9]/.test(ten))
      return setErr("Phone must be a 10-digit Indian mobile starting 6-9.");
    save.mutate({ force });
  };

  return (
    <Modal title={lead ? `Edit lead #${lead.leadId}` : "Add lead"} onClose={onClose} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        {duplicate && (
          <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            <p>
              A lead with this phone already exists: #{duplicate.id} {duplicate.name}. Update that
              lead instead, or save this one anyway.
            </p>
            <Btn small tone="ghost" busy={save.isPending} onClick={() => submit(true)}>
              Save anyway
            </Btn>
          </div>
        )}
        {lead && (
          <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
            <div>S.No.: #{lead.leadId}</div>
            <div>Timestamp: {fmtIst(lead.createdAt)}</div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <AddableSelect
            label="Lead platform *"
            type="platforms"
            options={platforms.data ?? []}
            value={platformId}
            onChange={setF("platformId")}
            canAdd={canMasters}
          />
          <Field label="Full name *">
            <input
              className={inputCls}
              value={form.fullName}
              onChange={(e) => setF("fullName")(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Phone number *">
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="10-digit mobile"
              value={form.phoneNumber}
              onChange={(e) => setF("phoneNumber")(e.target.value)}
            />
          </Field>
          <Field label="Restaurant name">
            <input
              className={inputCls}
              value={form.restaurantName}
              onChange={(e) => setF("restaurantName")(e.target.value)}
            />
          </Field>
          <Field label="Location">
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => setF("location")(e.target.value)}
            />
          </Field>
          <AddableSelect
            label="Caller name"
            type="callers"
            options={callers.data ?? []}
            value={form.callerId}
            onChange={setF("callerId")}
            canAdd={canMasters}
            allowEmpty
          />
          <AddableSelect
            label="Call status"
            type="call-statuses"
            options={statuses.data ?? []}
            value={callStatusId}
            onChange={setF("callStatusId")}
            canAdd={canMasters}
            allowEmpty
          />
        </div>
        <Field label="Staff requirement">
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {(categories.data ?? [])
              .filter((m) => m.isActive || catIds.has(m.id))
              .map((main) => (
                <div key={main.id}>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={catIds.has(main.id)}
                      onChange={() => toggleCat(main.id)}
                    />
                    {main.name}
                  </label>
                  {(main.children ?? [])
                    .filter((s) => s.isActive || catIds.has(s.id))
                    .map((sub) => (
                      <label
                        key={sub.id}
                        className="ml-6 flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={catIds.has(sub.id)}
                          onChange={() => toggleCat(sub.id)}
                        />
                        {sub.name}
                      </label>
                    ))}
                </div>
              ))}
            {!categories.data?.length && (
              <p className="text-sm text-muted-foreground">No staff categories yet.</p>
            )}
          </div>
        </Field>
        <Field label="Call remarks">
          <textarea
            className={inputCls}
            rows={3}
            value={form.callRemarks}
            onChange={(e) => setF("callRemarks")(e.target.value)}
          />
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

/* --------------------------------- Import --------------------------------- */

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (result: LeadImportResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeadImportPreview | null>(null);
  const [result, setResult] = useState<LeadImportResult | null>(null);
  const [dupMode, setDupMode] = useState<"skip" | "update" | "create">("skip");
  const [err, setErr] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMut = useMutation({
    mutationFn: (f: File) => marketingLeadsApi.importPreview(f),
    onSuccess: (p) => {
      setErr("");
      setPreview(p);
    },
    onError: (e) => setErr(errMsg(e, "Could not read the file.")),
  });

  const confirmMut = useMutation({
    mutationFn: () => marketingLeadsApi.importConfirm(file!, dupMode),
    onSuccess: (r) => {
      setErr("");
      setResult(r);
      onImported(r);
    },
    onError: (e) => setErr(errMsg(e, "Import failed.")),
  });

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) return setErr("Only .csv files are accepted.");
    if (f.size > 5 * 1024 * 1024) return setErr("File is over the 5 MB limit.");
    setErr("");
    setFile(f);
    setPreview(null);
    setResult(null);
    previewMut.mutate(f);
  };

  const downloadTemplate = async () => {
    try {
      saveBlob(await marketingLeadsApi.importTemplate(), "leads-import-template.csv");
    } catch (e) {
      setErr(errMsg(e, "Could not download the template."));
    }
  };

  const downloadErrorRows = (rows: { row: number; reason: string }[]) => {
    const csv =
      "﻿" +
      [["Row", "Reason"], ...rows.map((r) => [String(r.row), r.reason])]
        .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "leads-import-errors.csv");
  };

  const step = result ? 3 : preview ? 2 : 1;
  const newMasterCount = preview
    ? preview.newMasters.platforms.length +
      preview.newMasters.callers.length +
      preview.newMasters.callStatuses.length +
      preview.newMasters.staffCategories.length
    : 0;

  return (
    <Modal title={`Import leads (step ${step} of 3)`} onClose={onClose} wide>
      <div className="space-y-4">
        {err && <Notice kind="error">{err}</Notice>}

        {step === 1 && (
          <>
            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center text-sm transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pick(e.dataTransfer.files?.[0]);
              }}
            >
              <p className="text-foreground">Drag and drop a .csv file here</p>
              <p className="text-muted-foreground">or</p>
              <Btn tone="ghost" busy={previewMut.isPending} onClick={() => inputRef.current?.click()}>
                Choose file
              </Btn>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm font-medium text-primary underline"
            >
              Download template
            </button>
          </>
        )}

        {step === 2 && preview && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Rows" value={preview.total} />
              <StatBox label="Valid" value={preview.valid} tone="text-success" />
              <StatBox label="Invalid" value={preview.invalid.length} tone="text-danger" />
              <StatBox label="Duplicates" value={preview.duplicates.length} tone="text-warning" />
            </div>
            {newMasterCount > 0 && (
              <Notice kind="success">
                {newMasterCount} new list values will be created:{" "}
                {[
                  ...preview.newMasters.platforms,
                  ...preview.newMasters.callers,
                  ...preview.newMasters.callStatuses,
                  ...preview.newMasters.staffCategories,
                ].join(", ")}
              </Notice>
            )}
            {preview.invalid.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.invalid.map((r) => (
                      <tr key={r.row}>
                        <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                        <td className="px-3 py-2 text-danger">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.duplicates.length > 0 && (
              <Field label="Duplicate phones — what should happen?">
                <div className="space-y-1 text-sm">
                  {(
                    [
                      ["skip", "Skip them (keep the existing lead)"],
                      ["update", "Update the existing lead with the file's data"],
                      ["create", "Create new leads anyway"],
                    ] as const
                  ).map(([mode, label]) => (
                    <label key={mode} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="dupMode"
                        checked={dupMode === mode}
                        onChange={() => setDupMode(mode)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Btn
                tone="ghost"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
              >
                Back
              </Btn>
              <Btn
                busy={confirmMut.isPending}
                disabled={preview.valid === 0}
                onClick={() => confirmMut.mutate()}
              >
                Import {preview.valid} rows
              </Btn>
            </div>
          </>
        )}

        {step === 3 && result && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Created" value={result.created} tone="text-success" />
              <StatBox label="Updated" value={result.updated} tone="text-primary" />
              <StatBox label="Skipped" value={result.skipped} tone="text-warning" />
              <StatBox label="Failed" value={result.failed} tone="text-danger" />
            </div>
            {result.newMasters.length > 0 && (
              <Notice kind="success">New list values created: {result.newMasters.join(", ")}</Notice>
            )}
            {result.failures.length > 0 && (
              <Btn tone="ghost" small onClick={() => downloadErrorRows(result.failures)}>
                Download error rows CSV
              </Btn>
            )}
            <div className="flex justify-end">
              <Btn onClick={onClose}>Done</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
