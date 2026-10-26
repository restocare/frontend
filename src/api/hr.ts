/**
 * HR: employees, attendance, leave, shifts, payroll, holidays, positions, offer letters, resumes.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";
import type { CrmPage } from "./crm";

/* -------------------------------- HR ----------------------------------- */

export interface DepartmentRow {
  departmentId: number;
  name: string;
  description: string | null;
  _count?: { employees: number };
}

export interface OfficeRow {
  officeId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  _count?: { employees: number };
}

export interface EmployeeRow {
  employeeId: number;
  userId: number | null;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  designation: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "RESIGNED";
  joinDate: string;
  salary: number | null;
  address: string | null;
  emergencyContact: string | null;
  department: { departmentId: number; name: string } | null;
  office: { officeId: number; name: string; radiusMeters: number } | null;
  manager: { employeeId: number; name: string } | null;
  user: { userId: number; email: string | null } | null;
  shiftId?: number | null;
  shift?: {
    shiftId: number;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
}

export interface LinkableUser {
  userId: number;
  name: string;
  email: string;
  /** Prefills the employee form's phone when HR picks this login. */
  mobile?: string | null;
  role: string;
}

export interface AttendanceRow {
  attendanceId: number;
  employeeId: number;
  date: string;
  workMode: "OFFICE" | "REMOTE" | "FIELD";
  note: string | null;
  checkInAt: string;
  checkInDistanceM: number | null;
  checkOutAt: string | null;
  checkOutDistanceM: number | null;
  workedMinutes: number | null;
  status: "PRESENT" | "LATE" | "HALF_DAY";
  employee?: {
    employeeId: number;
    name: string;
    employeeCode: string;
    designation: string | null;
    department: { name: string } | null;
  };
  office?: { name: string; radiusMeters?: number };
}

export interface MyAttendance {
  employee: { employeeId: number; name: string; office: OfficeRow | null };
  month: string;
  today: AttendanceRow | null;
  records: AttendanceRow[];
}

export interface LeaveTypeRow {
  leaveTypeId: number;
  name: string;
  annualAllowance: number;
  isPaid: boolean;
  carryForward: boolean;
}

export interface LeaveBalanceRow {
  balanceId: number;
  employeeId: number;
  leaveTypeId: number;
  year: number;
  allocated: number;
  used: number;
  leaveType: LeaveTypeRow;
}

export interface LeaveRequestRow {
  leaveRequestId: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  createdAt: string;
  leaveType: LeaveTypeRow;
  employee?: {
    employeeId: number;
    name: string;
    employeeCode: string;
    department: { name: string } | null;
  };
  approver?: { employeeId: number; name: string } | null;
}

export interface MyLeaves {
  employee: { employeeId: number; name: string };
  balances: LeaveBalanceRow[];
  requests: LeaveRequestRow[];
}

export interface AppraisalRow {
  appraisalId: number;
  employeeId: number;
  cycle: string;
  periodStart: string;
  periodEnd: string;
  overallRating: number | null;
  goals: string | null;
  strengths: string | null;
  improvements: string | null;
  comments: string | null;
  recommendation: "PROMOTE" | "INCREMENT" | "HOLD" | "PIP" | null;
  incrementPct: number | null;
  status: "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED";
  createdAt: string;
  employee?: {
    employeeId: number;
    name: string;
    employeeCode: string;
    designation: string | null;
    department: { name: string } | null;
  };
  reviewer?: { employeeId: number; name: string } | null;
}

export const hrApi = {
  departments: () => apiClient.get<DepartmentRow[]>("/v1/hr/departments"),
  createDepartment: (body: { name: string; description?: string }) =>
    apiClient.post<DepartmentRow>("/v1/hr/departments", body),
  updateDepartment: (
    id: number,
    body: { name?: string; description?: string },
  ) => apiClient.patch<DepartmentRow>(`/v1/hr/departments/${id}`, body),
  deleteDepartment: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/departments/${id}`),

  offices: () => apiClient.get<OfficeRow[]>("/v1/hr/offices"),
  createOffice: (
    body: Partial<OfficeRow> & { name: string; address: string },
  ) => apiClient.post<OfficeRow>("/v1/hr/offices", body),
  updateOffice: (id: number, body: Partial<OfficeRow>) =>
    apiClient.patch<OfficeRow>(`/v1/hr/offices/${id}`, body),
  deleteOffice: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/offices/${id}`),

  employees: (params: {
    search?: string;
    departmentId?: number;
    status?: string;
  }) =>
    apiClient.get<EmployeeRow[]>(`/v1/hr/employees${toQueryString(params)}`),
  employee: (id: number) =>
    apiClient.get<
      EmployeeRow & {
        leaveBalances: LeaveBalanceRow[];
        appraisals: AppraisalRow[];
      }
    >(`/v1/hr/employees/${id}`),
  createEmployee: (body: Record<string, unknown>) =>
    apiClient.post<EmployeeRow>("/v1/hr/employees", body),
  updateEmployee: (id: number, body: Record<string, unknown>) =>
    apiClient.patch<EmployeeRow>(`/v1/hr/employees/${id}`, body),
  deleteEmployee: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/employees/${id}`),

  linkableUsers: () => apiClient.get<LinkableUser[]>("/v1/hr/linkable-users"),
  linkEmployeeUser: (
    id: number,
    body: { userId?: number; password?: string },
  ) => apiClient.post<EmployeeRow>(`/v1/hr/employees/${id}/link-user`, body),
  unlinkEmployeeUser: (id: number) =>
    apiClient.post<EmployeeRow>(`/v1/hr/employees/${id}/unlink-user`, {}),

  checkIn: (body: { lat: number; lng: number; mode?: string; note?: string }) =>
    apiClient.post<AttendanceRow>("/v1/hr/attendance/check-in", body),
  checkOut: (body: { lat: number; lng: number }) =>
    apiClient.post<AttendanceRow>("/v1/hr/attendance/check-out", body),
  myAttendance: (month?: string) =>
    apiClient.get<MyAttendance>(
      `/v1/hr/attendance/me${month ? `?month=${month}` : ""}`,
    ),
  attendance: (params: {
    date?: string;
    from?: string;
    to?: string;
    employeeId?: number;
  }) =>
    apiClient.get<AttendanceRow[]>(`/v1/hr/attendance${toQueryString(params)}`),

  leaveTypes: () => apiClient.get<LeaveTypeRow[]>("/v1/hr/leave-types"),
  createLeaveType: (body: {
    name: string;
    annualAllowance: number;
    isPaid?: boolean;
    carryForward?: boolean;
  }) => apiClient.post<LeaveTypeRow>("/v1/hr/leave-types", body),
  updateLeaveType: (id: number, body: Partial<LeaveTypeRow>) =>
    apiClient.patch<LeaveTypeRow>(`/v1/hr/leave-types/${id}`, body),
  deleteLeaveType: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/leave-types/${id}`),

  leaveBalances: (employeeId: number, year?: number) =>
    apiClient.get<LeaveBalanceRow[]>(
      `/v1/hr/leave-balances/${employeeId}${year ? `?year=${year}` : ""}`,
    ),
  adjustBalance: (balanceId: number, allocated: number) =>
    apiClient.patch<LeaveBalanceRow>(`/v1/hr/leave-balances/${balanceId}`, {
      allocated,
    }),

  myLeaves: () => apiClient.get<MyLeaves>("/v1/hr/leaves/me"),
  applyLeave: (body: {
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    reason?: string;
  }) => apiClient.post<LeaveRequestRow>("/v1/hr/leaves/apply", body),
  cancelLeave: (id: number) =>
    apiClient.post<LeaveRequestRow>(`/v1/hr/leaves/${id}/cancel`, {}),
  leaves: (params: { status?: string; employeeId?: number }) =>
    apiClient.get<LeaveRequestRow[]>(`/v1/hr/leaves${toQueryString(params)}`),
  approveLeave: (id: number) =>
    apiClient.post<LeaveRequestRow>(`/v1/hr/leaves/${id}/approve`, {}),
  rejectLeave: (id: number, reason?: string) =>
    apiClient.post<LeaveRequestRow>(`/v1/hr/leaves/${id}/reject`, { reason }),

  appraisals: (params: {
    cycle?: string;
    employeeId?: number;
    status?: string;
  }) =>
    apiClient.get<AppraisalRow[]>(`/v1/hr/appraisals${toQueryString(params)}`),
  myAppraisals: () => apiClient.get<AppraisalRow[]>("/v1/hr/appraisals/me"),
  createAppraisal: (body: Record<string, unknown>) =>
    apiClient.post<AppraisalRow>("/v1/hr/appraisals", body),
  updateAppraisal: (id: number, body: Record<string, unknown>) =>
    apiClient.patch<AppraisalRow>(`/v1/hr/appraisals/${id}`, body),
  submitAppraisal: (id: number) =>
    apiClient.post<AppraisalRow>(`/v1/hr/appraisals/${id}/submit`, {}),
  acknowledgeAppraisal: (id: number) =>
    apiClient.post<AppraisalRow>(`/v1/hr/appraisals/${id}/acknowledge`, {}),
  deleteAppraisal: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/appraisals/${id}`),

  /* ── Shifts: the organisation's working windows + the reschedule queue ── */
  shifts: (includeInactive?: boolean) =>
    apiClient.get<ShiftRow[]>(
      `/v1/hr/shifts${includeInactive ? "?includeInactive=true" : ""}`,
    ),
  shiftRoster: (shiftId: number) =>
    apiClient.get<{ shift: ShiftRow; employees: ShiftRosterEmployee[] }>(
      `/v1/hr/shifts/${shiftId}/roster`,
    ),
  createShift: (body: ShiftInput) =>
    apiClient.post<ShiftRow>("/v1/hr/shifts", body),
  updateShift: (id: number, body: Partial<ShiftInput>) =>
    apiClient.patch<ShiftRow>(`/v1/hr/shifts/${id}`, body),
  deleteShift: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/shifts/${id}`),
  assignShift: (id: number, employeeIds: number[]) =>
    apiClient.post<{ message: string; assigned: number }>(
      `/v1/hr/shifts/${id}/assign`,
      {
        employeeIds,
      },
    ),
  unassignShift: (employeeId: number) =>
    apiClient.post<{ message: string }>(
      `/v1/hr/shifts/employees/${employeeId}/unassign`,
      {},
    ),
  shiftRequests: (status?: string) =>
    apiClient.get<{ requests: ShiftRequestRow[]; pendingCount: number }>(
      `/v1/hr/shifts/requests${status ? `?status=${status}` : ""}`,
    ),
  approveShiftRequest: (id: number) =>
    apiClient.post<ShiftRequestRow>(`/v1/hr/shifts/requests/${id}/approve`, {}),
  rejectShiftRequest: (id: number, reason?: string) =>
    apiClient.post<ShiftRequestRow>(`/v1/hr/shifts/requests/${id}/reject`, {
      reason,
    }),

  /* ── HR policy: the attendance rulebook + written documents ── */
  attendancePolicy: () =>
    apiClient.get<AttendancePolicy>("/v1/hr/policies/attendance"),
  updateAttendancePolicy: (body: Partial<AttendancePolicyInput>) =>
    apiClient.patch<AttendancePolicy>("/v1/hr/policies/attendance", body),
  policies: (params: { published?: boolean; category?: string } = {}) =>
    apiClient.get<HrPolicyRow[]>(
      `/v1/hr/policies${toQueryString({
        published: params.published ? "true" : undefined,
        category: params.category,
      })}`,
    ),
  createPolicy: (body: HrPolicyInput) =>
    apiClient.post<HrPolicyRow>("/v1/hr/policies", body),
  updatePolicy: (id: number, body: Partial<HrPolicyInput>) =>
    apiClient.patch<HrPolicyRow>(`/v1/hr/policies/${id}`, body),
  deletePolicy: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/policies/${id}`),
  myPolicies: () =>
    apiClient.get<{
      policies: HrPolicyRow[];
      attendancePolicy: AttendancePolicy;
    }>("/v1/hr/me/policies"),

  /* ── My shift (employee self-service) ── */
  myShift: () => apiClient.get<MyShift>("/v1/hr/me/shift"),
  requestShiftChange: (body: {
    requestedShiftId: number;
    effectiveFrom: string;
    effectiveTo?: string;
    reason?: string;
  }) => apiClient.post<ShiftRequestRow>("/v1/hr/me/shift/request", body),
  cancelShiftRequest: (id: number) =>
    apiClient.post<ShiftRequestRow>(`/v1/hr/me/shift/request/${id}/cancel`, {}),
};

export interface ShiftRow {
  shiftId: number;
  name: string;
  /** "HH:mm" wall clock. endTime <= startTime means it runs past midnight. */
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  workDays: number[];
  description: string | null;
  isActive: boolean;
  /** Paid hours the window covers, break already deducted. */
  hours: number;
  overnight: boolean;
  employeeCount?: number;
}

export interface ShiftInput {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  workDays?: number[];
  description?: string;
  isActive?: boolean;
}

export interface ShiftRosterEmployee {
  employeeId: number;
  employeeCode: string;
  name: string;
  designation: string | null;
  department: { name: string } | null;
}

export type ShiftRequestStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ShiftRequestRow {
  shiftRequestId: number;
  employeeId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  status: ShiftRequestStatus;
  decidedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  employee?: {
    employeeId: number;
    employeeCode: string;
    name: string;
    designation: string | null;
    department: { name: string } | null;
  };
  requestedShift: ShiftRow;
  currentShift: ShiftRow | null;
  approver?: { employeeId: number; name: string } | null;
}

/** The attendance rulebook applied automatically on every check-in. */
export interface AttendancePolicy {
  attendancePolicyId: number;
  /** Free minutes after shift start before a day counts as late. */
  graceMinutes: number;
  /** Arriving later than this is a half day on the spot. */
  halfDayAfterMinutes: number;
  /** …and this many late marks in a month also costs a half day. */
  lateMarksForHalfDay: number;
  absentAfterMinutes: number;
  minHoursFullDay: number;
  minHoursHalfDay: number;
  autoApply: boolean;
  notifyEmployee: boolean;
  updatedAt: string;
}

export type AttendancePolicyInput = Omit<
  AttendancePolicy,
  "attendancePolicyId" | "updatedAt"
>;

export interface HrPolicyRow {
  hrPolicyId: number;
  title: string;
  category: string;
  body: string;
  effectiveFrom: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HrPolicyInput {
  title: string;
  category?: string;
  body: string;
  effectiveFrom?: string;
  isPublished?: boolean;
}

export interface MyShift {
  employeeId: number;
  currentShift: ShiftRow | null;
  shifts: ShiftRow[];
  requests: ShiftRequestRow[];
}

/* --------------------- Employee self-service (ESS) ---------------------- */

export interface PayslipRow {
  payslipId: number;
  employeeId: number;
  month: string;
  basic: number;
  hra: number;
  allowances: number;
  bonus: number;
  pf: number;
  tax: number;
  deductions: number;
  lopDays: number;
  paidDays: number;
  grossPay: number;
  netPay: number;
  status: "DRAFT" | "PUBLISHED";
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  employee?: {
    employeeId: number;
    employeeCode: string;
    name: string;
    designation: string | null;
    joinDate?: string;
    department: { name: string } | null;
    office?: { name: string; address: string } | null;
  };
}

export type PayrollList = CrmPage & { payslips: PayslipRow[] };

export interface HolidayRow {
  holidayId: number;
  name: string;
  date: string;
  isOptional: boolean;
}

export interface JobPostingRow {
  jobId: number;
  title: string;
  departmentId: number | null;
  department: { departmentId: number; name: string } | null;
  location: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  description: string | null;
  status: "OPEN" | "CLOSED";
  postedAt: string;
  closedAt: string | null;
}

export interface CelebrationEntry {
  employeeId: number;
  name: string;
  designation: string | null;
  department: string | null;
  date: string;
  years?: number;
}

export interface Celebrations {
  birthdays: CelebrationEntry[];
  anniversaries: CelebrationEntry[];
  newJoiners: CelebrationEntry[];
}

export interface MyPortal {
  employee: EmployeeRow & {
    manager: {
      employeeId: number;
      name: string;
      designation: string | null;
    } | null;
    /** The raw shift row — no derived `hours`/`overnight` on this endpoint. */
    shift: Omit<ShiftRow, "hours" | "overnight" | "employeeCount"> | null;
  };
  leave: {
    totalAllocated: number;
    totalUsed: number;
    balances: LeaveBalanceRow[];
  };
  attendanceThisMonth: {
    month: string;
    presentDays: number;
    checkedInToday: boolean;
    workedMinutes: number;
  };
  latestAppraisal: AppraisalRow | null;
  latestPayslipMonth: string | null;
  nextHolidays: HolidayRow[];
}

export interface MyIncrements {
  appraisals: Pick<
    AppraisalRow,
    | "appraisalId"
    | "cycle"
    | "periodStart"
    | "periodEnd"
    | "overallRating"
    | "recommendation"
    | "incrementPct"
    | "status"
  >[];
  salaryTrend: { month: string; grossPay: number; netPay: number }[];
}

export const essApi = {
  portal: () => apiClient.get<MyPortal>("/v1/hr/me/portal"),
  myPayslips: () => apiClient.get<PayslipRow[]>("/v1/hr/me/payslips"),
  myPayslip: (id: number) =>
    apiClient.get<PayslipRow>(`/v1/hr/me/payslips/${id}`),
  myIncrements: () => apiClient.get<MyIncrements>("/v1/hr/me/increments"),
  celebrations: () => apiClient.get<Celebrations>("/v1/hr/celebrations"),
  holidays: (year?: number) =>
    apiClient.get<HolidayRow[]>(
      `/v1/hr/holidays${year ? `?year=${year}` : ""}`,
    ),
  openPositions: () => apiClient.get<JobPostingRow[]>("/v1/hr/positions/open"),
  myOfferLetters: () =>
    apiClient.get<OfferLetterRow[]>("/v1/hr/me/offer-letters"),
  myOfferLetter: (id: number) =>
    apiClient.get<OfferLetterRow>(`/v1/hr/me/offer-letters/${id}`),
  acceptOffer: (id: number) =>
    apiClient.post<OfferLetterRow>(`/v1/hr/me/offer-letters/${id}/accept`, {}),
  declineOffer: (id: number, reason?: string) =>
    apiClient.post<OfferLetterRow>(`/v1/hr/me/offer-letters/${id}/decline`, {
      reason,
    }),
};

export const payrollApi = {
  generate: (month: string) =>
    apiClient.post<{ month: string; created: number; skipped: number }>(
      "/v1/hr/payroll/generate",
      { month },
    ),
  list: (params: {
    month?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get<PayrollList>(`/v1/hr/payroll${toQueryString(params)}`),
  update: (id: number, body: Record<string, unknown>) =>
    apiClient.patch<PayslipRow>(`/v1/hr/payroll/${id}`, body),
  publish: (id: number) =>
    apiClient.post<PayslipRow>(`/v1/hr/payroll/${id}/publish`, {}),
  publishMonth: (month: string) =>
    apiClient.post<{ month: string; published: number }>(
      "/v1/hr/payroll/publish-month",
      { month },
    ),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/hr/payroll/${id}`),
};

export const holidayApi = {
  create: (body: { name: string; date: string; isOptional?: boolean }) =>
    apiClient.post<HolidayRow>("/v1/hr/holidays", body),
  update: (
    id: number,
    body: { name?: string; date?: string; isOptional?: boolean },
  ) => apiClient.patch<HolidayRow>(`/v1/hr/holidays/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/hr/holidays/${id}`),
};

export const positionsApi = {
  list: (status?: string) =>
    apiClient.get<JobPostingRow[]>(
      `/v1/hr/positions${status ? `?status=${status}` : ""}`,
    ),
  create: (body: Record<string, unknown>) =>
    apiClient.post<JobPostingRow>("/v1/hr/positions", body),
  update: (id: number, body: Record<string, unknown>) =>
    apiClient.patch<JobPostingRow>(`/v1/hr/positions/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/hr/positions/${id}`),
};

/* --------------------------- Offer letters ----------------------------- */
// HR fills a fixed-format template (only the variable fields — name/CTC/joining
// date …); issuing unlocks the employee's read-only "My Offer Letters" view,
// where they can accept/decline and download a PDF. `computed` is a
// server-derived salary breakup + amount-in-words shared by every render.

export type OfferLetterStatus =
  "DRAFT" | "ISSUED" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export interface OfferLetterComputed {
  monthlyCtc: number;
  annualInWords: string;
  breakup: { basic: number; hra: number; specialAllowance: number };
}

export interface OfferLetterRow {
  offerLetterId: number;
  referenceNo: string | null;
  employeeId: number | null;
  templateKey: "standard" | "detailed";
  status: OfferLetterStatus;
  candidateName: string;
  candidateEmail: string | null;
  designation: string;
  departmentName: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  annualCtc: number;
  joiningDate: string;
  workLocation: string | null;
  probationMonths: number;
  reportingTo: string | null;
  offerDate: string;
  responseByDate: string | null;
  companyName: string;
  companyAddress: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  customNote: string | null;
  issuedAt: string | null;
  respondedAt: string | null;
  issuedById: number | null;
  createdAt: string;
  updatedAt: string;
  computed: OfferLetterComputed;
  employee?: {
    employeeId: number;
    employeeCode: string;
    name: string;
    email?: string;
    userId: number | null;
  } | null;
}

export const offerLetterApi = {
  list: (params: { status?: string; employeeId?: number; search?: string }) =>
    apiClient.get<OfferLetterRow[]>(
      `/v1/hr/offer-letters${toQueryString(params)}`,
    ),
  get: (id: number) =>
    apiClient.get<OfferLetterRow>(`/v1/hr/offer-letters/${id}`),
  create: (body: Record<string, unknown>) =>
    apiClient.post<OfferLetterRow>("/v1/hr/offer-letters", body),
  update: (id: number, body: Record<string, unknown>) =>
    apiClient.patch<OfferLetterRow>(`/v1/hr/offer-letters/${id}`, body),
  issue: (id: number) =>
    apiClient.post<OfferLetterRow>(`/v1/hr/offer-letters/${id}/issue`, {}),
  withdraw: (id: number) =>
    apiClient.post<OfferLetterRow>(`/v1/hr/offer-letters/${id}/withdraw`, {}),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/hr/offer-letters/${id}`),
};

// Tools → Resume Builder. Resumes are scoped server-side to the session user;
// `data` is the full editor document (see src/lib/resume.ts for the shape).

export interface ResumeSummaryRow {
  resumeId: number;
  title: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDetail extends ResumeSummaryRow {
  userId: number;
  data: unknown;
}

export type ResumeAiMode =
  "improve" | "shorten" | "expand" | "grammar" | "keywords";

export interface AtsReport {
  score: number;
  wordCount: number;
  checks: {
    id: string;
    label: string;
    passed: boolean;
    tip: string;
    weight: number;
  }[];
  aiSuggestions: string[];
  missingKeywords: string[];
  aiAvailable: boolean;
  targetRole: string | null;
}

export const resumeApi = {
  list: () => apiClient.get<ResumeSummaryRow[]>("/v1/resume"),
  get: (id: number) => apiClient.get<ResumeDetail>(`/v1/resume/${id}`),
  create: (body: { title?: string; template?: string; data?: unknown }) =>
    apiClient.post<ResumeDetail>("/v1/resume", body),
  update: (
    id: number,
    body: { title?: string; template?: string; data?: unknown },
  ) => apiClient.patch<ResumeDetail>(`/v1/resume/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/resume/${id}`),
  duplicate: (id: number) =>
    apiClient.post<ResumeDetail>(`/v1/resume/${id}/duplicate`),
  enhance: (body: { text: string; mode?: ResumeAiMode; context?: string }) =>
    apiClient.post<{ text: string; mode: ResumeAiMode }>(
      "/v1/resume/ai/enhance",
      body,
    ),
  /** POST /v1/resume/ai/import — AI-structure an uploaded resume's plain text. */
  import: (body: { text: string }) =>
    apiClient.post<unknown>("/v1/resume/ai/import", body),
  ats: (id: number, targetRole?: string) =>
    apiClient.post<AtsReport>(`/v1/resume/${id}/ats`, {
      targetRole: targetRole || undefined,
    }),
};

export const resumeQueryKeys = {
  resumes: ["resumes"] as const,
  resume: (id: number) => ["resume", id] as const,
};
