import apiClient from "@/app/api/apiClient";
import { unwrapList } from "@/app/api/unwrapList";
import type { Lead, LeadStatus, LeadType, Priority, CallStatus, CallAttempt, Meeting, LeadNote } from "../types";

// ─── API shapes (matching existing codebase) ──────────────────────────────────

interface FormSchemaItem {
  Id: string;
  Label: string;
  Type: string;
  Required: boolean;
  "Form ID": string;
  Order: number;
}

interface FormConfig {
  id: string;
  title: string;
  schema: FormSchemaItem[];
}

interface ApiCallRecord {
  id: string;
  status?: string | null;
  summary?: string | null;
  leadClass?: string | null;
  score?: number | null;
  nextDate?: string | null;
  transcription?: string | null;
  createdAt: string;
}

interface ApiSubmission {
  id?: string;
  createdAt?: string;
  submittedAt?: string;
  responses: Record<string, unknown>;
  callSummary?: string | null;
  callMade?: boolean;
  calls?: ApiCallRecord[];
  // Set by the backend only when the submission arrived via a WhatsApp
  // conversation rather than a plain web form fill.
  waMessageId?: string | null;
  projectId?: string | null;
  aiMode?: boolean;
}

interface ApiProject {
  id: string;
  projectName?: string;
  project_name?: string;
}

// ─── Field extraction helpers ─────────────────────────────────────────────────

function pickByLabel(responses: Record<string, unknown>, keywords: string[]): string {
  for (const [key, val] of Object.entries(responses)) {
    if (keywords.some((k) => key.toLowerCase().trim().includes(k))) {
      const str = Array.isArray(val) ? val.join(", ") : String(val ?? "").trim();
      if (str) return str;
    }
  }
  return "";
}

function extractName(responses: Record<string, unknown>): string {
  return (
    pickByLabel(responses, ["name", "full name", "customer", "contact"]) ||
    // fallback: first non-empty string value
    Object.values(responses)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0) ||
    "Unknown"
  );
}

function extractProject(responses: Record<string, unknown>): string {
  return pickByLabel(responses, ["project"]);
}

function extractPhone(responses: Record<string, unknown>): string {
  return pickByLabel(responses, ["phone", "mobile", "contact number", "number", "whatsapp"]);
}

function extractBudget(responses: Record<string, unknown>): string {
  return pickByLabel(responses, ["budget", "price", "investment", "amount"]) || "—";
}

// ─── Status / priority mapping ────────────────────────────────────────────────

function mapCallStatus(raw?: string | null): CallStatus {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("not interested") || s.includes("not_interested")) return "not_interested";
  if (s.includes("interested") || s.includes("connected")) return "interested";
  if (s.includes("busy")) return "busy";
  if (s.includes("no answer") || s.includes("no_answer") || s.includes("noanswer")) return "no_answer";
  if (s.includes("voicemail")) return "voicemail";
  return "callback";
}

function derivePriority(calls: ApiCallRecord[]): Priority {
  if (calls.length === 0) return "low";
  const last = calls[calls.length - 1];
  switch (last.leadClass?.toLowerCase()) {
    case "hot": return "high";
    case "warm": return "medium";
    case "cold":
    case "low_priority": return "low";
  }
  const s = (last.status ?? "").toLowerCase();
  if (s.includes("interested") && !s.includes("not")) return "high";
  if (s.includes("callback") || s.includes("follow")) return "medium";
  return "low";
}

function deriveStatus(sub: ApiSubmission): LeadStatus {
  const calls = sub.calls ?? [];
  if (calls.length === 0) return sub.callMade ? "follow_up" : "new";
  const s = (calls[calls.length - 1].status ?? "").toLowerCase();
  if (s.includes("not interested") || s.includes("inactive")) return "lost";
  if (s.includes("booked") || s.includes("deal closed") || s.includes("closed")) return "closed";
  if (s.includes("site visit") || s.includes("meeting")) return "meeting_scheduled";
  if (s.includes("interested") || s.includes("connected")) return "interested";
  if (s.includes("follow") || s.includes("callback") || s.includes("busy") || s.includes("no answer")) return "follow_up";
  return "follow_up";
}

function deriveMeeting(calls: ApiCallRecord[]): Meeting | undefined {
  const withDate = calls.find((c) => c.nextDate);
  if (!withDate?.nextDate) return undefined;
  try {
    const d = new Date(withDate.nextDate);
    return {
      id: withDate.id,
      date: d.toISOString().split("T")[0],
      time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      status: "scheduled",
    };
  } catch {
    return undefined;
  }
}

function mapToLead(
  sub: ApiSubmission,
  form: FormConfig,
  fallbackIdx: number,
  type: LeadType,
  projectNames: Map<string, string>,
): Lead {
  const calls = sub.calls ?? [];

  const mappedCalls: CallAttempt[] = calls.map((c, i) => ({
    id: c.id,
    attemptNumber: i + 1,
    status: mapCallStatus(c.status),
    notes: c.summary ?? undefined,
    createdAt: c.createdAt,
    rawStatus: c.status ?? null,
    leadClass: c.leadClass ?? null,
    score: c.score ?? null,
    nextDate: c.nextDate ?? null,
    transcription: c.transcription ?? null,
  }));

  const notes: LeadNote[] = sub.callSummary
    ? [{ id: "summary", content: sub.callSummary, createdAt: sub.createdAt ?? sub.submittedAt ?? "" }]
    : [];

  // The lead picks their project directly in the form (a "Projects" field),
  // so that beats the submission's projectId — which only gets backfilled
  // later by a backend cron job and is often still null.
  const projectName =
    extractProject(sub.responses) || (sub.projectId && projectNames.get(sub.projectId)) || form.title;

  return {
    id: sub.id ?? `${form.id}-${fallbackIdx}`,
    name: extractName(sub.responses),
    project: projectName,
    phone: extractPhone(sub.responses),
    budget: extractBudget(sub.responses),
    priority: derivePriority(calls),
    status: deriveStatus(sub),
    calls: mappedCalls,
    meeting: deriveMeeting(calls),
    notes,
    createdAt: sub.createdAt ?? sub.submittedAt ?? new Date().toISOString(),
    type,
    aiMode: sub.aiMode ?? true,
  };
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchProjectNames(): Promise<Map<string, string>> {
  try {
    const res = await apiClient.get<unknown>("/api/projects");
    const list = unwrapList<ApiProject>(res.data);
    const names = new Map<string, string>();
    for (const p of list) {
      const name = p.projectName ?? p.project_name;
      if (p.id && name) names.set(p.id, name);
    }
    return names;
  } catch {
    return new Map();
  }
}

async function fetchSubmissionLeads(classify: (sub: ApiSubmission) => LeadType): Promise<Lead[]> {
  const [formsRes, projectNames] = await Promise.all([
    apiClient.get<FormConfig[]>("/api/meta-forms"),
    fetchProjectNames(),
  ]);
  const forms = formsRes.data;

  const results = await Promise.allSettled(
    forms.map((form) =>
      apiClient
        .get<ApiSubmission[]>(`/api/meta-forms/${form.id}/submissions`)
        .then((res) => ({ form, submissions: res.data })),
    ),
  );

  const leads: Lead[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { form, submissions } = result.value;
      submissions.forEach((sub, idx) => leads.push(mapToLead(sub, form, idx, classify(sub), projectNames)));
    }
  }
  return leads;
}

export async function fetchAllFormLeads(): Promise<Lead[]> {
  return fetchSubmissionLeads(() => "form");
}

// Same submissions as fetchAllFormLeads, but tags each one "whatsapp" instead
// of "form" when it carries a waMessageId — used by the unified All Leads page
// to split a single real data source into two.
export async function fetchAllFormAndWhatsappLeads(): Promise<Lead[]> {
  return fetchSubmissionLeads((sub) => (sub.waMessageId ? "whatsapp" : "form"));
}

// Toggles AI mode for a single form/WhatsApp submission (lead-level, independent
// of the whole form's AI toggle on the Manage Forms page).
export async function updateSubmissionAiMode(id: string, aiMode: boolean): Promise<void> {
  await apiClient.patch(`/api/meta-forms/submissions/${id}`, { aiMode });
}
