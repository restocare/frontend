import apiClient from "./apiClient";

export interface ManualLeadPayload {
  customerName: string;
  phoneNumber: string;
  projectId: string;
  budget?: string;
  referenceType?: string;
  referralName?: string;
  agentName?: string;
  status?: string;
  siteVisitDate?: string;
  initialSummary?: string;
  aiMode?: boolean;
}

// Excel bulk-import rows only ever carry the project's display name (there's
// no picker), unlike ManualLeadPayload which requires a resolved projectId.
export interface ManualLeadBulkRow {
  customerName: string;
  phoneNumber: string;
  projectName: string;
  budget?: string;
  referenceType?: string;
  referralName?: string;
  agentName?: string;
  status?: string;
  initialSummary?: string;
}

export interface UpdateManualLeadPayload {
  customerName?: string;
  phoneNumber?: string;
  projectId?: string;
  budget?: string;
  referenceType?: string;
  referralName?: string;
  agentName?: string;
  status?: string;
  siteVisitDate?: string;
  newSummaryEntry?: string;
  aiMode?: boolean;
}

// The backend (leads.service.ts `CreateLeadDto`/`UpdateLeadDto`) expects a
// differently-shaped body than the one above — e.g. `customerPhone` instead
// of `phoneNumber`, `type` instead of `referenceType`. Translate here, at the
// single API boundary, so callers can keep using the friendlier field names.
function toCreateDto(payload: ManualLeadPayload) {
  return {
    customerName: payload.customerName,
    customerPhone: payload.phoneNumber,
    projectId: payload.projectId,
    customerBudget: payload.budget,
    type: payload.referenceType,
    referralName: payload.referralName,
    agentName: payload.agentName,
    status: payload.status,
    statusDate: payload.siteVisitDate,
    initialSummary: payload.initialSummary,
    aiMode: payload.aiMode,
  };
}

function toUpdateDto(payload: UpdateManualLeadPayload) {
  return {
    customerName: payload.customerName,
    customerPhone: payload.phoneNumber,
    projectId: payload.projectId,
    customerBudget: payload.budget,
    type: payload.referenceType,
    referralName: payload.referralName,
    agentName: payload.agentName,
    status: payload.status,
    statusDate: payload.siteVisitDate,
    newSummaryEntry: payload.newSummaryEntry,
    aiMode: payload.aiMode,
  };
}

export interface SummaryEntry {
  text: string;
  createdAt: string;
}

export interface ManualLead {
  id: string;
  customerName: string;
  phoneNumber: string;
  projectId: string;
  projectName: string;
  budget: string | null;
  referenceType: string | null;
  referralName: string | null;
  agentName: string | null;
  status: string;
  siteVisitDate: string | null;
  summaries: SummaryEntry[];
  aiMode: boolean;
  createdAt: string;
  updatedAt: string;
}

// The backend (leads.service.ts `mapToResponse`) returns a differently-shaped
// object than what the rest of the frontend expects — e.g. `customerPhone`
// instead of `phoneNumber`, and `summary` instead of `summaries`. Normalize
// it here, at the single API boundary, so every consumer can rely on the
// `ManualLead` shape below.
/** Lead as leads.service `mapToResponse` returns it (see normalizeManualLead). */
interface RawManualLead {
  id: string;
  customerName?: string;
  phoneNumber?: string;
  customerPhone?: string;
  projectId?: string;
  projectName?: string;
  budget?: string | null;
  customerBudget?: string | null;
  referenceType?: string | null;
  type?: string | null;
  referralName?: string | null;
  agentName?: string | null;
  status: string;
  siteVisitDate?: string | null;
  nextDate?: string | null;
  summaries?: SummaryEntry[];
  summary?: SummaryEntry[];
  aiMode: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeManualLead(raw: RawManualLead): ManualLead {
  return {
    id: raw.id,
    customerName: raw.customerName ?? "",
    phoneNumber: raw.phoneNumber ?? raw.customerPhone ?? "",
    projectId: raw.projectId ?? "",
    projectName: raw.projectName ?? "",
    budget: raw.budget ?? raw.customerBudget ?? null,
    referenceType: raw.referenceType ?? (raw.type === "referal" ? "referral" : raw.type) ?? null,
    referralName: raw.referralName ?? null,
    agentName: raw.agentName ?? null,
    status: raw.status,
    siteVisitDate: raw.siteVisitDate ?? raw.nextDate ?? null,
    summaries: Array.isArray(raw.summaries) ? raw.summaries : Array.isArray(raw.summary) ? raw.summary : [],
    aiMode: raw.aiMode,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const LEAD_STATUS_OPTIONS = [
  { value: "interested", label: "Interested", color: "blue" },
  { value: "followup", label: "Follow Up", color: "yellow" },
  { value: "site_visit", label: "Site Visit", color: "purple" },
  { value: "not_interested", label: "Not Interested", color: "red" },
  { value: "deal_closed", label: "Deal Closed", color: "green" },
  { value: "lost", label: "Lost", color: "gray" },
  { value: "not_initiated", label: "Not Initiated", color: "orange" },
] as const;

export const manualLeadsApi = {
  create: async (payload: ManualLeadPayload) => {
    const response = await apiClient.post("/api/leads", toCreateDto(payload));
    return normalizeManualLead(response.data);
  },

  getAll: async (): Promise<ManualLead[]> => {
    const response = await apiClient.get("/api/leads");
    return (response.data as RawManualLead[]).map(normalizeManualLead);
  },

  getOne: async (id: string): Promise<ManualLead> => {
    const response = await apiClient.get(`/api/leads/${id}`);
    return normalizeManualLead(response.data);
  },

  update: async (id: string, payload: UpdateManualLeadPayload): Promise<ManualLead> => {
    const response = await apiClient.patch(`/api/leads/${id}`, toUpdateDto(payload));
    return normalizeManualLead(response.data);
  },

  remove: async (id: string) => {
    const response = await apiClient.delete(`/api/leads/${id}`);
    return response.data;
  },

  // NOTE: there is no `/api/leads/bulk` route on the backend yet (see
  // leads.controller.ts) — this call 404s until that endpoint is added.
  // Excel rows only carry a project *name*, so resolving it to a projectId
  // is backend work, not something this client can paper over.
  bulkCreate: async (rows: ManualLeadBulkRow[], onUploadProgress?: (percent: number) => void) => {
    const response = await apiClient.post(
      "/api/leads/bulk",
      { rows },
      {
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            onUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        },
      }
    );
    return response.data;
  },
};
