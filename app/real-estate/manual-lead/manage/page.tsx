"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Pencil, Trash2, X,
  MessageSquare, Clock, User, Phone, Building2, Wallet,
  UserCheck, Users, Send, Loader2, AlertTriangle, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/Pagination";
import {
  manualLeadsApi, ManualLead, SummaryEntry, LEAD_STATUS_OPTIONS,
} from "@/app/api/manualLeadsApi";
import { projectApi, type ApiProject } from "@/app/api/api";
import { unwrapList } from "@/app/api/unwrapList";
import { ProjectDropdown } from "../ProjectDropdown";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/app/api/errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

type StatusValue = typeof LEAD_STATUS_OPTIONS[number]["value"];

const STATUS_STYLE: Record<string, string> = {
  interested:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  followup:        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  site_visit:      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  not_interested:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  deal_closed:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  lost:            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  not_initiated:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function statusLabel(value: string) {
  return LEAD_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function referenceLabel(type: string | null, name: string | null) {
  if (!type) return "—";
  if (type === "walk_in") return "Walk-in";
  if (type === "referral") return name ? `Referral (${name})` : "Referral";
  return type;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"}`}>
      {statusLabel(status)}
    </span>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ lead, onClose }: { lead: ManualLead; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery<{ id: string; projectName: string }[]>({
    queryKey: ["projects"],
    queryFn: async () =>
      unwrapList<ApiProject>(await projectApi.getProjects()).map((p) => ({
        id: p.id,
        projectName: p.projectName ?? p.project_name ?? "",
      })),
  });
  const [fields, setFields] = useState({
    customerName: lead.customerName,
    phoneNumber: lead.phoneNumber,
    projectId: lead.projectId,
    budget: lead.budget ?? "",
    referenceType: (lead.referenceType ?? "") as "" | "walk_in" | "referral",
    referralName: lead.referralName ?? "",
    agentName: lead.agentName ?? "",
    status: lead.status as StatusValue,
    siteVisitDate: lead.siteVisitDate ?? "",
  });
  const [statusTouched, setStatusTouched] = useState(!!lead.siteVisitDate);
  const [newSummary, setNewSummary] = useState("");

  const summaries: SummaryEntry[] = Array.isArray(lead.summaries) ? lead.summaries : [];

  const updateMutation = useMutation({
    mutationFn: () =>
      manualLeadsApi.update(lead.id, {
        ...fields,
        referenceType: fields.referenceType || undefined,
        referralName: fields.referenceType === "referral" ? fields.referralName || undefined : undefined,
        siteVisitDate: fields.siteVisitDate || undefined,
        newSummaryEntry: newSummary.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Lead updated successfully!");
      qc.invalidateQueries({ queryKey: ["manual-leads"] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Update failed"));
    },
  });

  const handleSave = () => {
    if (!fields.customerName.trim()) { toast.error("Customer name is required"); return; }
    if (!fields.phoneNumber.trim()) { toast.error("Phone number is required"); return; }
    if (!fields.projectId) { toast.error("Please select a project"); return; }
    if (fields.referenceType === "referral" && !fields.referralName.trim()) {
      toast.error("Please enter the referral person's name"); return;
    }
    updateMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">Edit Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <User className="size-3 text-muted-foreground" />Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input value={fields.customerName} onChange={(e) => setFields((p) => ({ ...p, customerName: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Phone className="size-3 text-muted-foreground" />Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input value={fields.phoneNumber}
                onChange={(e) => setFields((p) => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") }))}
                type="tel" maxLength={15} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Building2 className="size-3 text-muted-foreground" />Project Name <span className="text-destructive">*</span>
              </Label>
              <ProjectDropdown value={fields.projectId} onChange={(v) => setFields((p) => ({ ...p, projectId: v }))} projects={projects} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Wallet className="size-3 text-muted-foreground" />Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input value={fields.budget} onChange={(e) => setFields((p) => ({ ...p, budget: e.target.value }))} className="pl-6" placeholder="e.g. 50 Lakh" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <UserCheck className="size-3 text-muted-foreground" />Agent Name
              </Label>
              <Input value={fields.agentName} onChange={(e) => setFields((p) => ({ ...p, agentName: e.target.value }))} />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                value={fields.status}
                onChange={(e) => { setFields((p) => ({ ...p, status: e.target.value as StatusValue, siteVisitDate: "" })); setStatusTouched(true); }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {LEAD_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {statusTouched && (
                <div className="mt-2 space-y-1.5">
                  <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" />{LEAD_STATUS_OPTIONS.find((o) => o.value === fields.status)?.label ?? "Status"} Date
                  </Label>
                  <input
                    type="date"
                    value={fields.siteVisitDate}
                    onChange={(e) => setFields((p) => ({ ...p, siteVisitDate: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <Users className="size-3 text-muted-foreground" />Reference / Source
            </Label>
            <div className="flex gap-2 flex-wrap">
              {(["walk_in", "referral"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFields((p) => ({ ...p, referenceType: type, referralName: "" }))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    fields.referenceType === type
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {type === "walk_in" ? "Walk-in" : "Referral"}
                </button>
              ))}
            </div>
            {fields.referenceType === "referral" && (
              <Input
                value={fields.referralName}
                onChange={(e) => setFields((p) => ({ ...p, referralName: e.target.value }))}
                placeholder="Name of person who referred" className="mt-2"
              />
            )}
          </div>

          {/* Existing Summaries (read-only) */}
          {summaries.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <MessageSquare className="size-3 text-muted-foreground" />Conversation History (read-only)
              </Label>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {summaries.map((s, i) => (
                  <div key={i} className="px-4 py-3 bg-muted/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Summary Entry */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              <Send className="size-3 text-muted-foreground" />Add New Conversation Entry
            </Label>
            <textarea
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              rows={4}
              placeholder="Write the latest conversation summary — it will be saved with the current date &amp; time and appended to the history above…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground">Previous entries cannot be edited or deleted.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 min-w-25">
            {updateMutation.isPending ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ lead, onClose }: { lead: ManualLead; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => manualLeadsApi.remove(lead.id),
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["manual-leads"] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Delete failed"));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delete Lead</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <span className="font-medium text-foreground">{lead.customerName}</span>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="gap-2">
            {deleteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Expandable Row ─────────────────────────────────────────────────────────────

function LeadRow({
  lead,
  onEdit,
  onDelete,
}: {
  lead: ManualLead;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-sm text-foreground leading-snug">{lead.customerName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{lead.phoneNumber}</div>
      </td>
      <td className="px-4 py-3 text-sm text-foreground max-w-40 truncate">{lead.projectName}</td>
      <td className="px-4 py-3 text-sm text-foreground">{lead.budget ? `₹ ${lead.budget}` : "—"}</td>
      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
      <td className="px-4 py-3 text-sm text-foreground">{lead.agentName || "—"}</td>
      <td className="px-4 py-3 text-sm text-foreground max-w-36 truncate">{referenceLabel(lead.referenceType, lead.referralName)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(lead.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Edit">
            <Pencil className="size-4" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageManualLeadPage() {
  const [search, setSearch] = useState("");
  const [editLead, setEditLead] = useState<ManualLead | null>(null);
  const [deleteLead, setDeleteLead] = useState<ManualLead | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const { data: leads = [], isLoading, isError } = useQuery<ManualLead[]>({
    queryKey: ["manual-leads"],
    queryFn: manualLeadsApi.getAll,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        l.customerName.toLowerCase().includes(q) ||
        l.phoneNumber.includes(q) ||
        l.projectName.toLowerCase().includes(q) ||
        (l.agentName ?? "").toLowerCase().includes(q);
      const matchesStatus = !statusFilter || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, safePage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Manage Manual Leads</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {leads.length} lead{leads.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, phone, project, agent…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground min-w-36"
        >
          <option value="">All Statuses</option>
          {LEAD_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading leads…</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm">Failed to load leads. Please refresh.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Search className="size-8 opacity-30" />
            <p className="text-sm">{leads.length === 0 ? "No leads added yet. Add your first lead!" : "No leads match your search."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Customer", "Project", "Budget", "Status", "Agent", "Reference", "Added On", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onEdit={() => setEditLead(lead)}
                    onDelete={() => setDeleteLead(lead)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
          />
        )}
      </div>

      {/* Modals */}
      {editLead && <EditModal lead={editLead} onClose={() => setEditLead(null)} />}
      {deleteLead && <DeleteModal lead={deleteLead} onClose={() => setDeleteLead(null)} />}
    </div>
  );
}
