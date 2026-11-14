/**
 * Staff plan (permanent staff for partner restaurants): the ops side. One function per endpoint of the
 * backend's `/api/v1/admin/hr`; the console's /dashboard/hr pages use these and nothing else.
 *
 * Money is integer paise, times are ISO instants, calendar days are `YYYY-MM-DD` (see src/lib/hr-format.ts).
 * Who may call what is decided by the server (permissions `hr-plan.view` / `hr-plan.manage`); the pages
 * only hide buttons.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

const BASE = "/v1/admin/hr";

export interface HrPage<T> {
  total: number;
  page: number;
  limit: number;
  items: T[];
}

type Query = Record<string, string | number | boolean | undefined>;

export type HrRoleGroup = "kitchen" | "service" | "housekeeping";
export type HrKycStatus = "pending" | "verified" | "rejected";
export type HrContractStatus = "draft" | "active" | "ended";
export type HrShiftStatus = "scheduled" | "present" | "absent" | "leave" | "off";
export type HrShiftChip =
  | "off"
  | "on_leave"
  | "covered"
  | "absent"
  | "late"
  | "on_time"
  | "not_marked"
  | "scheduled";
export type HrReplacementStatus =
  | "requested"
  | "assigned"
  | "on_the_way"
  | "arrived"
  | "failed"
  | "cancelled";
export type HrLeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type HrTaskStatus = "open" | "in_progress" | "done";
export type HrTaskType =
  | "escalation"
  | "issue"
  | "change_request"
  | "leave_concern"
  | "unfilled_replacement";
export type HrInvoiceStatus = "issued" | "paid" | "overdue" | "void";
export type HrLeadStatus = "new" | "contacted" | "won" | "lost";

/* ------------------------------ pick-lists ------------------------------ */

export interface HrPlanOption {
  planId: string;
  name: string;
  months: number;
}
export interface HrSkillOption {
  skillSubcategoryId: number;
  name: string;
  category: string | null;
  /** An active service exists for it (a replacement booking needs one). */
  hasService: boolean;
}
export interface HrCustomerOption {
  customerId: number;
  name: string | null;
  mobile: string | null;
  restaurantName: string | null;
}
export interface HrPartnerOption {
  partnerId: number;
  name: string | null;
  mobile: string | null;
  city: string | null;
  isOnline: boolean;
  service: string | null;
}
export interface HrOpsUser {
  userId: number;
  name: string | null;
  role: string;
}

/* ---------------------------- organizations ----------------------------- */

export interface HrOrgListItem {
  orgId: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  owner: { customerId: number; name: string | null; mobile: string | null };
  outletCount: number;
  activeContracts: number;
  createdAt: string;
}

export interface HrOutlet {
  outletId: string;
  orgId: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  hasLocation: boolean;
  graceMinutes: number;
  escalateMinutes: number;
}

export interface HrOrgDetail {
  orgId: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  owner: { customerId: number; name: string | null; mobile: string | null };
  /** An active contract switches the Staff area on in the restaurant's app. */
  hrEnabled: boolean;
  outlets: HrOutlet[];
  contracts: {
    contractId: string;
    outletId: string;
    outletName: string;
    planName: string;
    status: HrContractStatus;
    startDate: string;
    endDate: string;
    monthlyFeePaise: number;
  }[];
  createdAt: string;
}

export interface HrOrgBody {
  name: string;
  legalName?: string;
  gstin?: string;
  ownerCustomerId: number;
}

export interface HrOutletBody {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  graceMinutes?: number;
  escalateMinutes?: number;
}

/* ------------------------------ contracts ------------------------------- */

export interface HrContractLine {
  lineId: string;
  roleGroup: HrRoleGroup;
  skill: { skillSubcategoryId: number; name: string };
  headcount: number;
  /** Staff deployed on this line today. */
  deployed: number;
}

export interface HrContract {
  contractId: string;
  org: { orgId: string; name: string };
  outlet: { outletId: string; name: string; hasLocation: boolean };
  plan: { planId: string; name: string; months: number };
  status: HrContractStatus;
  startDate: string;
  endDate: string;
  monthlyFeePaise: number;
  lines: HrContractLine[];
  createdAt: string;
}

export interface HrContractDetail extends HrContract {
  invoices: { invoiceId: string; period: string; status: HrInvoiceStatus; totalPaise: number }[];
}

export interface HrContractLineBody {
  roleGroup: HrRoleGroup;
  skillSubcategoryId: number;
  headcount: number;
}

export interface HrContractBody {
  orgId: string;
  outletId: string;
  planId: string;
  startDate: string;
  endDate?: string;
  monthlyFeePaise: number;
  lines: HrContractLineBody[];
}

/* -------------------------------- staff --------------------------------- */

export interface HrDeployment {
  deploymentId: string;
  outlet: { outletId: string; name: string };
  org: { orgId: string; name: string };
  contractLineId: string;
  contractId: string;
  contractStatus: HrContractStatus;
  roleGroup: HrRoleGroup;
  startDate: string;
  endDate: string | null;
  shiftStart: string;
  shiftEnd: string;
  weeklyOffDay: number;
  /** Covers today. */
  current: boolean;
}

export interface HrStaff {
  staffId: string;
  name: string;
  phone: string;
  skill: { skillSubcategoryId: number; name: string };
  partner: { partnerId: number; name: string | null; mobile: string | null } | null;
  kycStatus: HrKycStatus;
  joinedAt: string;
  deployments: HrDeployment[];
}

export interface HrStaffBody {
  name?: string;
  phone?: string;
  skillSubcategoryId: number;
  partnerId?: number;
  kycStatus?: HrKycStatus;
  joinedAt?: string;
}

export interface HrDeploymentBody {
  outletId: string;
  contractLineId: string;
  startDate: string;
  endDate?: string;
  shiftStart: string;
  shiftEnd: string;
  weeklyOffDay: number;
}

/* ----------------------- today board and replacements ------------------- */

export interface HrReplacement {
  replacementId: string;
  status: HrReplacementStatus;
  reason: string | null;
  requestedAt: string;
  assignedAt: string | null;
  eta: string | null;
  arrivedAt: string | null;
  waitingMinutes: number | null;
  bookingId: number | null;
  bookingStatus: string | null;
  bookingError: string | null;
  bookingAttempts: number;
  partner: { partnerId: number; name: string | null; mobile: string | null } | null;
  shift: {
    shiftId: string;
    date: string;
    startAt: string;
    endAt: string;
    staff: { staffId: string; name: string };
  };
  outlet: { outletId: string; name: string };
  org: { orgId: string; name: string };
  canReassign: boolean;
  canCancel: boolean;
}

export interface HrBoardShift {
  shiftId: string;
  date: string;
  startAt: string;
  endAt: string;
  status: HrShiftStatus;
  chip: HrShiftChip;
  /** Unmarked, absent with nobody asked, or a replacement still waiting for a partner. */
  needsAction: boolean;
  lateMinutes: number | null;
  markedAt: string | null;
  markedBy: "manager" | "ops" | "staff_app" | "system" | null;
  staff: {
    staffId: string;
    name: string;
    phone: string;
    skill: string;
    roleGroup: HrRoleGroup | null;
  };
  outlet: { outletId: string; name: string };
  org: { orgId: string; name: string };
  replacement: HrReplacement | null;
}

export interface HrBoard {
  date: string;
  summary: {
    total: number;
    notMarked: number;
    absent: number;
    covered: number;
    present: number;
    late: number;
    leave: number;
    off: number;
    scheduled: number;
  };
  outlets: {
    outletId: string;
    name: string;
    orgId: string;
    orgName: string;
    shifts: HrBoardShift[];
  }[];
}

export interface HrAttendanceBody {
  status: "present" | "absent" | "scheduled";
  reason?: string;
  lateMinutes?: number;
}

export interface HrAttendanceResult {
  changed: boolean;
  shift: HrBoardShift;
  /** What booking a partner did (null when nothing was asked of it). `disabled`: jobs are off. */
  bookingOutcome: string | null;
  warnings: string[];
}

/* -------------------------------- leave --------------------------------- */

export interface HrLeave {
  leaveId: string;
  staff: { staffId: string; name: string };
  outlet: { outletId: string; name: string };
  org: { orgId: string; name: string };
  fromDate: string;
  toDate: string;
  days: number;
  reason: string | null;
  status: HrLeaveStatus;
  restaurantResponse: "none" | "fine" | "busy";
  responseNote: string | null;
  respondedAt: string | null;
  decidedAt: string | null;
  decidedBy: number | null;
  createdAt: string;
}

export interface HrLeaveDecision {
  leaveId: string;
  status: "approved" | "rejected";
  changed: boolean;
  replacements: number;
  leave: HrLeave;
}

export interface HrLeaveBody {
  staffId: string;
  outletId?: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

/* -------------------------------- tasks --------------------------------- */

export interface HrTask {
  taskId: string;
  type: HrTaskType;
  note: string | null;
  status: HrTaskStatus;
  assignee: { userId: number; name: string | null } | null;
  org: { orgId: string; name: string };
  outlet: { outletId: string; name: string } | null;
  staff: { staffId: string; name: string } | null;
  shiftId: string | null;
  shiftDate: string | null;
  leaveRequestId: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface HrLead {
  leadId: string;
  kind: "staff_plan" | "deep_cleaning";
  status: HrLeadStatus;
  note: string | null;
  customer: {
    customerId: number;
    name: string | null;
    mobile: string | null;
    restaurantName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------- invoices ------------------------------- */

export interface HrInvoice {
  invoiceId: string;
  number: string | null;
  org: { orgId: string; name: string };
  outlet: { outletId: string; name: string };
  contractId: string;
  period: string;
  amountPaise: number;
  gstPaise: number;
  totalPaise: number;
  dueDate: string;
  status: HrInvoiceStatus;
  /** `issued` past its due date reads as overdue until the daily job flips it. */
  effectiveStatus: HrInvoiceStatus;
  daysBilled: number | null;
  daysInPeriod: number | null;
  pdfAvailable: boolean;
  paidAt: string | null;
  createdAt: string;
}

/* ------------------------- invites and members -------------------------- */

export interface HrMemberOutlet {
  outletId: string;
  name: string;
}

export interface HrMember {
  memberId: string;
  customerId: number;
  name: string | null;
  mobile: string | null;
  role: "owner" | "manager";
  outlets: HrMemberOutlet[];
  isPrimaryOwner: boolean;
  joinedAt: string;
}

export interface HrInvite {
  inviteId: string;
  phone: string;
  role: "owner" | "manager";
  outlets: HrMemberOutlet[];
  status: "pending" | "expired";
  expiresAt: string;
  lastSentAt: string | null;
  createdAt: string;
}

export interface HrMembers {
  org: { orgId: string; name: string };
  outlets: HrMemberOutlet[];
  members: HrMember[];
  invites: HrInvite[];
}

/* --------------------------------- api ---------------------------------- */

export const hrPlanApi = {
  // pick-lists
  plans: () => apiClient.get<{ plans: HrPlanOption[] }>(`${BASE}/lookups/plans`),
  skills: () => apiClient.get<{ skills: HrSkillOption[] }>(`${BASE}/lookups/skills`),
  customers: (q: string) =>
    apiClient.get<{ customers: HrCustomerOption[] }>(`${BASE}/lookups/customers${toQueryString({ q })}`),
  partners: (q: string) =>
    apiClient.get<{ partners: HrPartnerOption[] }>(`${BASE}/lookups/partners${toQueryString({ q })}`),
  opsUsers: () => apiClient.get<{ users: HrOpsUser[] }>(`${BASE}/lookups/ops-users`),

  // organizations and outlets
  orgs: (params: Query) => apiClient.get<HrPage<HrOrgListItem>>(`${BASE}/orgs${toQueryString(params)}`),
  org: (orgId: string) => apiClient.get<HrOrgDetail>(`${BASE}/orgs/${orgId}`),
  createOrg: (body: HrOrgBody) => apiClient.post<HrOrgDetail>(`${BASE}/orgs`, body),
  updateOrg: (orgId: string, body: Partial<Omit<HrOrgBody, "ownerCustomerId">>) =>
    apiClient.patch<HrOrgDetail>(`${BASE}/orgs/${orgId}`, body),
  createOutlet: (orgId: string, body: HrOutletBody) =>
    apiClient.post<HrOutlet>(`${BASE}/orgs/${orgId}/outlets`, body),
  updateOutlet: (outletId: string, body: Partial<HrOutletBody>) =>
    apiClient.patch<HrOutlet>(`${BASE}/outlets/${outletId}`, body),

  // contracts
  contracts: (params: Query) =>
    apiClient.get<HrPage<HrContract>>(`${BASE}/contracts${toQueryString(params)}`),
  contract: (id: string) => apiClient.get<HrContractDetail>(`${BASE}/contracts/${id}`),
  createContract: (body: HrContractBody) => apiClient.post<HrContractDetail>(`${BASE}/contracts`, body),
  updateContract: (
    id: string,
    body: Partial<Pick<HrContractBody, "planId" | "startDate" | "endDate" | "monthlyFeePaise">>,
  ) => apiClient.patch<HrContractDetail>(`${BASE}/contracts/${id}`, body),
  activateContract: (id: string) => apiClient.post<HrContractDetail>(`${BASE}/contracts/${id}/activate`, {}),
  endContract: (id: string, endDate?: string) =>
    apiClient.post<HrContractDetail>(`${BASE}/contracts/${id}/end`, endDate ? { endDate } : {}),
  addLine: (id: string, body: HrContractLineBody) =>
    apiClient.post<HrContractDetail>(`${BASE}/contracts/${id}/lines`, body),
  updateLine: (id: string, lineId: string, headcount: number) =>
    apiClient.patch<HrContractDetail>(`${BASE}/contracts/${id}/lines/${lineId}`, { headcount }),
  deleteLine: (id: string, lineId: string) =>
    apiClient.delete<HrContractDetail>(`${BASE}/contracts/${id}/lines/${lineId}`),

  // staff and deployments
  staffList: (params: Query) => apiClient.get<HrPage<HrStaff>>(`${BASE}/staff${toQueryString(params)}`),
  createStaff: (body: HrStaffBody) => apiClient.post<HrStaff>(`${BASE}/staff`, body),
  updateStaff: (
    id: string,
    body: Partial<Omit<HrStaffBody, "joinedAt">> & { unlinkPartner?: boolean },
  ) => apiClient.patch<HrStaff>(`${BASE}/staff/${id}`, body),
  deploy: (staffId: string, body: HrDeploymentBody) =>
    apiClient.post<{ deploymentId: string; staff: HrStaff }>(`${BASE}/staff/${staffId}/deployments`, body),
  updateDeployment: (
    id: string,
    body: { endDate?: string | null; shiftStart?: string; shiftEnd?: string; weeklyOffDay?: number },
  ) => apiClient.patch<HrStaff>(`${BASE}/deployments/${id}`, body),

  // today board and replacements
  board: (params: Query) => apiClient.get<HrBoard>(`${BASE}/today${toQueryString(params)}`),
  mark: (shiftId: string, body: HrAttendanceBody) =>
    apiClient.post<HrAttendanceResult>(`${BASE}/shifts/${shiftId}/attendance`, body),
  replacements: (params: Query) =>
    apiClient.get<HrPage<HrReplacement>>(`${BASE}/replacements${toQueryString(params)}`),
  cancelReplacement: (id: string, reason?: string) =>
    apiClient.post<HrReplacement>(`${BASE}/replacements/${id}/cancel`, reason ? { reason } : {}),
  reassignReplacement: (id: string, professionalId?: number) =>
    apiClient.post<HrReplacement>(
      `${BASE}/replacements/${id}/reassign`,
      professionalId ? { professionalId } : {},
    ),

  // leave
  leave: (params: Query) => apiClient.get<HrPage<HrLeave>>(`${BASE}/leave${toQueryString(params)}`),
  createLeave: (body: HrLeaveBody) => apiClient.post<HrLeave>(`${BASE}/leave`, body),
  approveLeave: (id: string) => apiClient.post<HrLeaveDecision>(`${BASE}/leave/${id}/approve`, {}),
  rejectLeave: (id: string) => apiClient.post<HrLeaveDecision>(`${BASE}/leave/${id}/reject`, {}),

  // tasks and leads
  tasks: (params: Query) => apiClient.get<HrPage<HrTask>>(`${BASE}/tasks${toQueryString(params)}`),
  assignTask: (id: string, assigneeUserId?: number) =>
    apiClient.post<HrTask>(`${BASE}/tasks/${id}/assign`, assigneeUserId ? { assigneeUserId } : {}),
  closeTask: (id: string, note?: string) =>
    apiClient.post<HrTask>(`${BASE}/tasks/${id}/close`, note ? { note } : {}),
  reopenTask: (id: string) => apiClient.post<HrTask>(`${BASE}/tasks/${id}/reopen`, {}),
  leads: (params: Query) => apiClient.get<HrPage<HrLead>>(`${BASE}/leads${toQueryString(params)}`),
  updateLead: (id: string, body: { status?: HrLeadStatus; note?: string }) =>
    apiClient.patch<{ leadId: string; status: HrLeadStatus; note: string | null }>(
      `${BASE}/leads/${id}`,
      body,
    ),

  // invoices
  invoices: (params: Query) =>
    apiClient.get<HrPage<HrInvoice>>(`${BASE}/invoices${toQueryString(params)}`),
  generateInvoices: (period: string) =>
    apiClient.post<{ period: string; created: number; existing: number }>(`${BASE}/invoices/generate`, {
      period,
    }),
  regeneratePdf: (id: string) => apiClient.post<HrInvoice>(`${BASE}/invoices/${id}/regenerate-pdf`, {}),
  markPaid: (id: string, note?: string) =>
    apiClient.post<{ invoiceId: string; changed: boolean; invoice: HrInvoice }>(
      `${BASE}/invoices/${id}/mark-paid`,
      note ? { note } : {},
    ),
  invoicePdf: (id: string) =>
    apiClient.get<{ url: string; expiresAt: string }>(`${BASE}/invoices/${id}/pdf`),

  // invites and members
  members: (orgId: string) => apiClient.get<HrMembers>(`${BASE}/orgs/${orgId}/members`),
  invite: (
    orgId: string,
    body: { phone: string; role: "owner" | "manager"; outletIds?: string[] },
  ) => apiClient.post<HrInvite>(`${BASE}/orgs/${orgId}/invites`, body),
  resendInvite: (id: string) => apiClient.post<HrInvite>(`${BASE}/invites/${id}/resend`, {}),
  revokeInvite: (id: string) =>
    apiClient.post<{ inviteId: string; revoked: boolean }>(`${BASE}/invites/${id}/revoke`, {}),
  updateMember: (
    orgId: string,
    memberId: string,
    body: { role?: "owner" | "manager"; outletIds?: string[] },
  ) => apiClient.patch<HrMembers>(`${BASE}/orgs/${orgId}/members/${memberId}`, body),
  removeMember: (orgId: string, memberId: string) =>
    apiClient.delete<{ memberId: string; removed: boolean }>(`${BASE}/orgs/${orgId}/members/${memberId}`),
};
