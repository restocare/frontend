"use client";

import { Fragment, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown, ChevronDown, ChevronRight, Search, Bot, User,
  Pencil, X, Loader2, Calendar, MessageSquare, Send, Clock, Wallet,
} from "lucide-react";
import apiClient from "@/app/api/apiClient";
import { fetchAllFormAndWhatsappLeads, updateSubmissionAiMode } from "./lib/formLeads";
import {
  manualLeadsApi, LEAD_STATUS_OPTIONS,
  type ManualLead, type SummaryEntry,
} from "@/app/api/manualLeadsApi";
import { userApi } from "@/app/api/api";
import { useAuthStore } from "@/store/authStore";
import type { Lead } from "./types";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/app/api/errors";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fromLead,
  fromManualLead,
  SOURCE_CONFIG,
  type LeadSource,
  type UnifiedLead,
} from "./lib/unifiedLeads";

const CALL_STATUS_LABELS: Record<string, string> = {
  no_answer: "No Answer",
  busy: "Busy",
  interested: "Interested",
  not_interested: "Not Interested",
  callback: "Callback",
  voicemail: "Voicemail",
};

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fmtMeetingTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function referenceLabel(type: string | null, name: string | null): string {
  if (!type) return "—";
  if (type === "walk_in") return "Walk-in";
  if (type === "referral") return name ? `Referral (${name})` : "Referral";
  return type;
}

function SourceBadge({ source }: { source: LeadSource }) {
  const c = SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text} border ${c.border} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} border border-border rounded-lg p-4 hover:shadow-sm transition-shadow duration-200`}>
      <p className="text-[10px] font-semibold text-[#131517]/60 dark:text-foreground/60 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-[#131517] dark:text-foreground">{value}</p>
    </div>
  );
}

function SkeletonRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      {Array.from({ length: colSpan }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 rounded-md bg-muted animate-pulse" style={{ width: `${50 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── AI Mode Toggle ──────────────────────────────────────────────────────────

function AiModeToggle({
  enabled,
  loading,
  onClick,
}: {
  enabled: boolean;
  loading: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={enabled ? "AI Mode ON – click to switch to Manual" : "Manual Mode – click to enable AI"}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        enabled ? "bg-green-500" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Edit modal (Reference / Walk-in leads only) ────────────────────────────

function LeadEditModal({ lead, onClose }: { lead: ManualLead; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(lead.status);
  const [nextDate, setNextDate] = useState(lead.siteVisitDate ?? "");
  const [budget, setBudget] = useState(lead.budget ?? "");
  const [newSummary, setNewSummary] = useState("");

  const summaries: SummaryEntry[] = Array.isArray(lead.summaries) ? lead.summaries : [];

  const updateMutation = useMutation({
    mutationFn: () =>
      manualLeadsApi.update(lead.id, {
        status,
        siteVisitDate: nextDate || undefined,
        budget: budget || undefined,
        newSummaryEntry: newSummary.trim(),
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
    if (!newSummary.trim()) { toast.error("Summary is required"); return; }
    updateMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">Edit Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Locked info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={lead.customerName} disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={lead.phoneNumber} disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Input value={lead.projectName} disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reference</Label>
              <Input value={referenceLabel(lead.referenceType, lead.referralName)} disabled />
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {LEAD_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Calendar className="size-3 text-muted-foreground" />Next Date
              </Label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="flex items-center gap-2 text-xs">
                <Wallet className="size-3 text-muted-foreground" />Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} className="pl-6" placeholder="e.g. 50 Lakh" />
              </div>
            </div>
          </div>

          {/* Existing summaries (read-only) */}
          {summaries.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <MessageSquare className="size-3 text-muted-foreground" />Conversation History (read-only)
              </Label>
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border max-h-40 overflow-y-auto">
                {summaries.map((s, i) => (
                  <div key={i} className="px-4 py-2.5 bg-muted/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{fmtDateTime(s.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New summary — mandatory */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              <Send className="size-3 text-muted-foreground" />Summary <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              rows={4}
              placeholder="Write the latest conversation summary — it will be saved with the current date & time and appended to the history above…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

        </div>

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

// ─── Edit modal (Form / WhatsApp leads only) ────────────────────────────────

const CALL_STATUS_FORM_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "followup", label: "Follow-up" },
  { value: "site_visit", label: "Site Visit" },
  { value: "deal_closed", label: "Deal Closed" },
  { value: "not_interested", label: "Not Interested" },
  { value: "lost", label: "Lost" },
];

const LEAD_CLASS_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

function FormLeadEditModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const latestCall = lead.calls[0];

  const [status, setStatus] = useState(latestCall?.rawStatus ?? "");
  const [leadClass, setLeadClass] = useState(latestCall?.leadClass ?? "");
  const [score, setScore] = useState(latestCall?.score != null ? String(latestCall.score) : "");
  const [summary, setSummary] = useState(latestCall?.notes ?? "");
  const [nextDate, setNextDate] = useState(
    latestCall?.nextDate ? new Date(latestCall.nextDate).toISOString().slice(0, 16) : "",
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        status: status || undefined,
        leadClass: leadClass || undefined,
        score: score ? Number(score) : null,
        summary: summary || undefined,
        nextDate: nextDate || undefined,
      };
      return latestCall
        ? apiClient.patch(`/api/calls/${latestCall.id}`, payload)
        : apiClient.post(`/api/meta-forms/submissions/${lead.id}/call`, payload);
    },
    onSuccess: () => {
      toast.success("Lead updated successfully!");
      qc.invalidateQueries({ queryKey: ["form-whatsapp-leads-all"] });
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Update failed"));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">Edit Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Locked info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={lead.name} disabled />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={lead.phone} disabled />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Input value={lead.project} disabled />
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">— select —</option>
                {CALL_STATUS_FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lead Class</Label>
              <select
                value={leadClass}
                onChange={(e) => setLeadClass(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">— select —</option>
                {LEAD_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Score (1–10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="e.g. 7"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Calendar className="size-3 text-muted-foreground" />Next Follow-up
              </Label>
              <input
                type="datetime-local"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-xs">
              <Send className="size-3 text-muted-foreground" />Summary
            </Label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Brief summary of the conversation…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2 min-w-25">
            {saveMutation.isPending ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Expanded (accordion) row ────────────────────────────────────────────────

function ExpandedRow({ lead, colSpan }: { lead: UnifiedLead; colSpan: number }) {
  const isManual = lead.source === "reference" || lead.source === "walk_in";

  if (isManual) {
    const manual = lead.raw as ManualLead;
    const summaries = Array.isArray(manual.summaries) ? manual.summaries : [];
    return (
      <tr className="bg-accent/10">
        <td colSpan={colSpan} className="px-6 pb-4 pt-0">
          <div className="pt-3 border-t border-border/50 mt-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Conversation History</p>
            {summaries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No conversation entries yet</p>
            ) : (
              <div className="flex flex-col gap-2 max-w-2xl">
                {summaries.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                    <div>
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(s.createdAt)}</span>
                      <p className="text-xs text-foreground leading-relaxed mt-0.5">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }

  const l = lead.raw as Lead;
  return (
    <tr className="bg-accent/10">
      <td colSpan={colSpan} className="px-6 pb-4 pt-0">
        <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-border/50 mt-0">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Call Attempts</p>
            {l.calls.length === 0 ? (
              <p className="text-xs text-muted-foreground">No calls yet</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {l.calls.map((call) => (
                  <div key={call.id} className="flex items-start gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5 shrink-0">#{call.attemptNumber}</span>
                    <div>
                      <span className="text-xs font-medium text-foreground">{CALL_STATUS_LABELS[call.status] ?? call.status}</span>
                      {call.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{call.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Meeting</p>
            {l.meeting ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">{fmtDate(l.meeting.date)}</span>
                <span className="text-[11px] text-muted-foreground">{fmtMeetingTime(l.meeting.time)}</span>
                <span className="text-[10px] text-muted-foreground capitalize mt-0.5">{l.meeting.status.replace("_", " ")}</span>
                {l.meeting.notes && <span className="text-[11px] text-foreground mt-1">{l.meeting.notes}</span>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No meeting scheduled</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
            {l.notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {l.notes.map((note) => (
                  <p key={note.id} className="text-xs text-foreground leading-relaxed">{note.content}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AllLeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | LeadSource>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [editLead, setEditLead] = useState<ManualLead | null>(null);
  const [editFormLead, setEditFormLead] = useState<Lead | null>(null);

  // Track which lead IDs are currently being toggled (for loading state)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Global AI mode — persisted per-user on the backend, mirrored in the auth store
  const { user, setAiMode } = useAuthStore();
  const globalAiMode = user?.ai_mode ?? true;

  const toggleGlobalAiModeMutation = useMutation({
    mutationFn: (aiMode: boolean) => userApi.updateAiMode(user!.id, aiMode),
    onMutate: async (aiMode) => {
      const previousAiMode = user?.ai_mode;
      setAiMode(aiMode);
      return { previousAiMode };
    },
    onError: (err: unknown, _aiMode, context) => {
      if (context?.previousAiMode !== undefined) {
        setAiMode(context.previousAiMode);
      }
      toast.error(getApiErrorMessage(err, "Failed to update AI mode"));
    },
  });

  const { data: formAndWhatsappLeads = [], isLoading: formLoading } = useQuery({
    queryKey: ["form-whatsapp-leads-all"],
    queryFn: fetchAllFormAndWhatsappLeads,
    staleTime: 30 * 1000,
  });

  const { data: manualLeads = [], isLoading: manualLoading } = useQuery<ManualLead[]>({
    queryKey: ["manual-leads"],
    queryFn: manualLeadsApi.getAll,
  });

  const isLoading = formLoading || manualLoading;

  // Mutation to toggle individual manual (reference/walk-in) lead AI mode.
  // Flips the toggle immediately (optimistic) and rolls back on failure.
  const toggleManualAiModeMutation = useMutation({
    mutationFn: ({ rawId, aiMode }: { leadId: string; rawId: string; aiMode: boolean }) =>
      manualLeadsApi.update(rawId, { aiMode }),
    onMutate: async ({ leadId, rawId, aiMode }) => {
      setTogglingIds((prev) => new Set(prev).add(leadId));
      await queryClient.cancelQueries({ queryKey: ["manual-leads"] });
      const previousLeads = queryClient.getQueryData<ManualLead[]>(["manual-leads"]);
      if (previousLeads) {
        queryClient.setQueryData<ManualLead[]>(
          ["manual-leads"],
          previousLeads.map((l) => (l.id === rawId ? { ...l, aiMode } : l)),
        );
      }
      return { previousLeads };
    },
    onSuccess: (_, { leadId }) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    },
    onError: (err: unknown, { leadId }, context) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      if (context?.previousLeads) {
        queryClient.setQueryData(["manual-leads"], context.previousLeads);
      }
      toast.error(getApiErrorMessage(err, "Failed to update AI mode"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-leads"] });
    },
  });

  // Mutation to toggle individual form/WhatsApp lead AI mode.
  // Flips the toggle immediately (optimistic) and rolls back on failure.
  const toggleFormAiModeMutation = useMutation({
    mutationFn: ({ rawId, aiMode }: { leadId: string; rawId: string; aiMode: boolean }) =>
      updateSubmissionAiMode(rawId, aiMode),
    onMutate: async ({ leadId, rawId, aiMode }) => {
      setTogglingIds((prev) => new Set(prev).add(leadId));
      await queryClient.cancelQueries({ queryKey: ["form-whatsapp-leads-all"] });
      const previousLeads = queryClient.getQueryData<Lead[]>(["form-whatsapp-leads-all"]);
      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(
          ["form-whatsapp-leads-all"],
          previousLeads.map((l) => (l.id === rawId ? { ...l, aiMode } : l)),
        );
      }
      return { previousLeads };
    },
    onSuccess: (_, { leadId }) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    },
    onError: (err: unknown, { leadId }, context) => {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      if (context?.previousLeads) {
        queryClient.setQueryData(["form-whatsapp-leads-all"], context.previousLeads);
      }
      toast.error(getApiErrorMessage(err, "Failed to update AI mode"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["form-whatsapp-leads-all"] });
    },
  });

  const handleToggleLeadAiMode = useCallback(
    (e: React.MouseEvent, lead: UnifiedLead) => {
      e.stopPropagation();
      const rawId = (lead.raw as { id: string }).id;
      const newValue = !lead.aiMode;
      const isManual = lead.source === "reference" || lead.source === "walk_in";
      if (isManual) {
        toggleManualAiModeMutation.mutate({ leadId: lead.id, rawId, aiMode: newValue });
      } else {
        toggleFormAiModeMutation.mutate({ leadId: lead.id, rawId, aiMode: newValue });
      }
    },
    [toggleManualAiModeMutation, toggleFormAiModeMutation],
  );

  const allLeads = useMemo<UnifiedLead[]>(() => {
    const formSource = formAndWhatsappLeads.filter((l) => l.type === "form");
    const whatsappSource = formAndWhatsappLeads.filter((l) => l.type === "whatsapp");

    const merged: UnifiedLead[] = [
      ...formSource.map((l) => fromLead(l, "form")),
      ...whatsappSource.map((l) => fromLead(l, "whatsapp")),
      ...manualLeads.map(fromManualLead),
    ];
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [formAndWhatsappLeads, manualLeads]);

  const stats = useMemo(
    () => ({
      total: allLeads.length,
      form: allLeads.filter((l) => l.source === "form").length,
      whatsapp: allLeads.filter((l) => l.source === "whatsapp").length,
      call: allLeads.filter((l) => l.source === "call").length,
      reference: allLeads.filter((l) => l.source === "reference").length,
      walk_in: allLeads.filter((l) => l.source === "walk_in").length,
    }),
    [allLeads],
  );

  const projectOptions = useMemo(() => {
    const names = new Set(allLeads.map((l) => l.project).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allLeads]);

  const statusOptions = useMemo(() => {
    const labels = new Set(allLeads.map((l) => l.statusLabel).filter(Boolean));
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [allLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allLeads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.project.toLowerCase().includes(q);
      const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;
      const matchesProject = projectFilter === "all" || lead.project === projectFilter;
      const matchesStatus = statusFilter === "all" || lead.statusLabel === statusFilter;
      return matchesSearch && matchesSource && matchesProject && matchesStatus;
    });
  }, [allLeads, search, sourceFilter, projectFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const COL_COUNT = 10;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">All Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredLeads.length} of {allLeads.length} leads across every source
            </p>
          </div>
          <div className="relative">
            <select
              value={projectFilter}
              onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
              className="h-9 pl-3 pr-8 text-sm bg-background border border-border rounded-lg text-foreground outline-none focus:border-blue-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="all">All Projects</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Global AI Mode Toggle */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => toggleGlobalAiModeMutation.mutate(!globalAiMode)}
            disabled={!user || toggleGlobalAiModeMutation.isPending}
            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${
              globalAiMode
                ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                : "bg-muted border-border text-muted-foreground hover:bg-accent"
            }`}
            title="Toggle your global AI mode"
          >
            {globalAiMode ? (
              <>
                <Bot className="size-4" />
                AI Mode
              </>
            ) : (
              <>
                <User className="size-4" />
                Manual Mode
              </>
            )}
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                globalAiMode ? "bg-green-500" : "bg-muted-foreground/40"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${
                  globalAiMode ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground pr-1">Applies to upcoming calls only</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, phone, project..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value as "all" | LeadSource); setCurrentPage(1); }}
          className="h-9 px-3 text-sm bg-background border border-border rounded-lg text-foreground outline-none focus:border-blue-500 transition-colors cursor-pointer"
        >
          <option value="all">All Sources</option>
          <option value="form">Form</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="call">Calls</option>
          <option value="reference">Reference</option>
          <option value="walk_in">Walk-in</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="h-9 px-3 text-sm bg-background border border-border rounded-lg text-foreground outline-none focus:border-blue-500 transition-colors cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {statusOptions.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} color="bg-[#F2F2FF] dark:bg-[#F2F2FF]/5" />
        <StatCard label="Form" value={stats.form} color="bg-[#DEF6FE] dark:bg-[#DEF6FE]/5" />
        <StatCard label="WhatsApp" value={stats.whatsapp} color="bg-[#ECFDF5] dark:bg-[#ECFDF5]/5" />
        <StatCard label="Calls" value={stats.call} color="bg-[#FFF7E6] dark:bg-[#FFF7E6]/5" />
        <StatCard label="Reference" value={stats.reference} color="bg-[#F5EEFF] dark:bg-[#F5EEFF]/5" />
        <StatCard label="Walk-in" value={stats.walk_in} color="bg-[#DAFFFA] dark:bg-[#DAFFFA]/5" />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-220">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-3 py-3" />
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Project</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Budget</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">AI Mode</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} colSpan={COL_COUNT} />)
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="py-16 text-center text-sm text-muted-foreground">
                    No leads found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isExpanded = expandedRows.has(lead.id);
                  const isToggling = togglingIds.has(lead.id);
                  const isManual = lead.source === "reference" || lead.source === "walk_in";

                  return (
                    <Fragment key={lead.id}>
                      <tr
                        className="hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(lead.id)}
                      >
                        <td className="px-3 py-3.5 w-10">
                          <button className="flex items-center justify-center w-5 h-5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-foreground">{lead.name}</span>
                        </td>
                        <td className="px-4 py-3.5 text-foreground">{lead.project || "—"}</td>
                        <td className="px-4 py-3.5 text-foreground font-mono">{lead.phone || "—"}</td>
                        <td className="px-4 py-3.5 font-semibold text-foreground">{lead.budget || "—"}</td>
                        <td className="px-4 py-3.5">
                          <SourceBadge source={lead.source} />
                        </td>
                        <td className="px-4 py-3.5 text-foreground">{lead.statusLabel}</td>
                        <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">{fmtDate(lead.createdAt)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-center gap-1">
                            <AiModeToggle
                              enabled={lead.aiMode ?? true}
                              loading={isToggling}
                              onClick={(e) => handleToggleLeadAiMode(e, lead)}
                            />
                            <span className={`text-[10px] font-medium ${lead.aiMode ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                              {lead.aiMode ? "AI" : "Manual"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isManual) setEditLead(lead.raw as ManualLead);
                              else setEditFormLead(lead.raw as Lead);
                            }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && <ExpandedRow lead={lead} colSpan={COL_COUNT} />}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredLeads.length}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      </div>

      {editLead && <LeadEditModal lead={editLead} onClose={() => setEditLead(null)} />}
      {editFormLead && <FormLeadEditModal lead={editFormLead} onClose={() => setEditFormLead(null)} />}
    </div>
  );
}
