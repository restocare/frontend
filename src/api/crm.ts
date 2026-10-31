/**
 * CRM: restaurants, sales, marketing leads, tickets, WhatsApp inbox, campaigns, finance, ops, reports.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, downloadFile, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";

// Backed by the RBAC-gated /v1/crm, /v1/hr and /v1/rbac endpoints. Admins
// bypass every permission check; STAFF users only see what their roles grant
// (the login response carries `permissions`, "*" = everything).

export interface CrmSummary {
  customers: number;
  partners: number;
  bookingsToday: number;
  pendingLeaves: number;
  employees: number;
  // Business overview (spec dashboard)
  activeRestaurants: number;
  newLeads: number;
  activeWorkforce: number;
  openOrders: number;
  monthlyRevenue: number;
  pendingPayments: number;
  pendingPaymentsCount: number;
  customerSatisfaction: number | null;
  ratingsCount: number;
  workforceUtilizationPct: number | null;
  openTickets: number;
  dueFollowUps: number;
}

export interface CrmCustomerRow {
  userId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  /** Admin block flag — a blocked customer cannot log in. */
  isBlocked: boolean;
  createdAt: string;
  bookingCount: number;
}

export interface CrmPartnerRow {
  professionalId: number;
  name: string | null;
  mobile: string | null;
  email: string | null;
  service: string | null;
  city: string | null;
  rating: number;
  totalJobs: number;
  isOnline: boolean;
  isBlocked: boolean;
  onboardingStatus: "PENDING" | "VERIFIED" | "ACTIVE" | "REJECTED";
  bookingCount: number;
  createdAt: string;
}

export interface CrmPage {
  total: number;
  page: number;
  limit: number;
}

export type CrmCustomerList = CrmPage & { customers: CrmCustomerRow[] };

export type CrmPartnerList = CrmPage & { partners: CrmPartnerRow[] };

export interface CrmBookingRow {
  bookingId: number;
  status: string;
  totalAmount: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  serviceCity: string;
  serviceAddress: string;
  paymentMode: string;
  createdAt: string;
  user: { userId: number; name: string | null; mobile: string | null } | null;
  service: { name: string } | null;
  variant: { name: string } | null;
  professional: {
    professionalId: number;
    user: { name: string | null } | null;
  } | null;
}

export type CrmBookingList = CrmPage & { bookings: CrmBookingRow[] };

export const crmApi = {
  summary: () => apiClient.get<CrmSummary>("/v1/crm/summary"),
  customers: (params: { search?: string; page?: number; limit?: number }) =>
    apiClient.get<CrmCustomerList>(`/v1/crm/customers${toQueryString(params)}`),
  updateCustomer: (id: number, body: { name?: string; mobile?: string }) =>
    apiClient.patch(`/v1/crm/customers/${id}`, body),
  partners: (params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<CrmPartnerList>(`/v1/crm/partners${toQueryString(params)}`),
  updatePartner: (
    id: number,
    body: { isBlocked?: boolean; onboardingStatus?: string },
  ) => apiClient.patch(`/v1/crm/partners/${id}`, body),
  bookings: (params: {
    search?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<CrmBookingList>(`/v1/crm/bookings${toQueryString(params)}`),
  /** Cancel/complete a booking from the panel. `reason` is recorded on cancel
   *  so the bookings table can show WHY it was cancelled. */
  /** PATCH /v1/admin/bookings/:id — edit date, slot, address or amount. */
  updateBooking: (
    id: number,
    body: {
      bookingDate?: string;
      startTime?: string;
      endTime?: string;
      serviceAddress?: string;
      serviceCity?: string;
      baseAmount?: number;
    },
  ) => apiClient.patch<{ message: string }>(`/v1/admin/bookings/${id}`, body),

  /** DELETE /v1/admin/bookings/:id — completed bookings included. */
  deleteBooking: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/admin/bookings/${id}`),

  /** POST /v1/admin/bookings/bulk-delete — completed bookings included. */
  bulkDeleteBookings: (bookingIds: number[]) =>
    apiClient.post<{
      message: string;
      deleted: number[];
      skipped: { bookingId: number; reason: string }[];
    }>("/v1/admin/bookings/bulk-delete", { bookingIds }),

  updateBookingStatus: (
    id: number,
    status: "CANCELLED" | "COMPLETED",
    reason?: string,
  ) => apiClient.patch(`/v1/crm/bookings/${id}/status`, { status, reason }),
};

/* ----------------------- CRM: Restaurant clients ----------------------- */

export type RestaurantStatus = "PROSPECT" | "ACTIVE" | "INACTIVE" | "CHURNED";

export interface RestaurantRow {
  restaurantId: number;
  name: string;
  ownerName: string | null;
  contactNumber: string | null;
  email: string | null;
  gstNumber: string | null;
  address: string | null;
  city: string | null;
  restaurantType: string | null;
  outlets: number;
  status: RestaurantStatus;
  agreementStart: string | null;
  agreementEnd: string | null;
  servicePackage: string | null;
  pricingPlan: string | null;
  agreementCopyUrl: string | null;
  gstCertificateUrl: string | null;
  fssaiLicenseUrl: string | null;
  fssaiNumber: string | null;
  notes: string | null;
  linkedUserId: number | null;
  linkedUser?: {
    userId: number;
    name: string | null;
    email: string | null;
  } | null;
  _count?: { tickets: number };
  createdAt: string;
  /* Field-sales visit capture — filled during onboarding. */
  painPoints: string[];
  requiredStaffRoles: string[];
  staffRequired: number | null;
  requiredDate: string | null;
  decisionStatus: string | null;
  salesExecutive: string | null;
  salesFeedback: string | null;
  appInstalled: boolean;
  visitDate: string | null;
  restaurantPhotoUrl: string | null;
  meetingPhotoUrl: string | null;
}

export type RestaurantList = CrmPage & { restaurants: RestaurantRow[] };

/** The field-sales questionnaire — mirrors the options the API documents. */
export const RESTAURANT_PAIN_POINTS = [
  "Staff Absenteeism",
  "Hiring Time",
  "Emergency Staff Requests",
  "Staff Turnover",
  "Salary Issues",
  "Skilled Manpower Shortage",
  "Seasonal Hiring Issues",
] as const;

export const RESTAURANT_STAFF_ROLES = [
  "Executive Chef",
  "Sous Chef",
  "Commis / CDP",
  "Kitchen Helper",
  "Waiter",
  "Captain",
  "Utility Boy",
  "Housekeeping",
] as const;

export const RESTAURANT_DECISIONS = [
  "Interested",
  "Not Interested",
  "Follow-up Required",
  "Call Later",
  "Need Owner Approval",
] as const;

export interface RestaurantDetail extends RestaurantRow {
  orderStats: { totalBookings: number; revenue: number } | null;
  convertedFromLead?: {
    leadId: number;
    restaurantName: string;
    wonAt: string | null;
  } | null;
  tickets: {
    ticketId: number;
    subject: string;
    category: string;
    status: string;
    priority: string;
    createdAt: string;
  }[];
}

export type RestaurantBody = Partial<
  Omit<RestaurantRow, "restaurantId" | "createdAt">
> & {
  name?: string;
};

/**
 * A restaurant as the customer identified it while booking. These are the only
 * restaurant details actually captured (stored on the customer's User row at
 * first checkout) — the CRM Restaurant table is a separate, manually-entered
 * entity.
 */
export interface CustomerRestaurantRow {
  userId: number;
  restaurantName: string | null;
  ownerName: string | null;
  gstNumber: string | null;
  mobile: string | null;
  email: string | null;
  bookingsCount: number;
  /** The same login also works for us as a service partner (a user can be both). */
  isAlsoPartner: boolean;
  joinedAt: string;
}

export type CustomerRestaurantList = CrmPage & {
  restaurants: CustomerRestaurantRow[];
};

export const crmRestaurantsApi = {
  /** GET /v1/crm/restaurants/from-customers — restaurant name / owner / GST as
   *  entered by the customer at their first booking. */
  fromCustomers: (params: { search?: string; page?: number; limit?: number }) =>
    apiClient.get<CustomerRestaurantList>(
      `/v1/crm/restaurants/from-customers${toQueryString(params)}`,
    ),
  list: (params: {
    search?: string;
    status?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<RestaurantList>(
      `/v1/crm/restaurants${toQueryString(params)}`,
    ),
  get: (id: number) =>
    apiClient.get<RestaurantDetail>(`/v1/crm/restaurants/${id}`),
  bookings: (id: number, params: { page?: number; limit?: number }) =>
    apiClient.get<CrmBookingList>(
      `/v1/crm/restaurants/${id}/bookings${toQueryString(params)}`,
    ),
  create: (body: RestaurantBody & { name: string }) =>
    apiClient.post<RestaurantRow>("/v1/crm/restaurants", body),
  /** POST /v1/crm/restaurants/photo — store a visit photo, get its URL back. */
  uploadPhoto: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<{ url: string; publicId: string }>(
      "/v1/crm/restaurants/photo",
      fd,
    );
  },
  update: (id: number, body: RestaurantBody) =>
    apiClient.patch<RestaurantRow>(`/v1/crm/restaurants/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/crm/restaurants/${id}`),
};

/* ------------------------ CRM: Sales lead pipeline ---------------------- */

export type SalesLeadStage =
  | "NEW"
  | "CONTACTED"
  | "DEMO_SCHEDULED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type SalesLeadSource =
  | "WEBSITE"
  | "INSTAGRAM"
  | "LINKEDIN"
  | "REFERRAL"
  | "COLD_CALLING"
  | "GOOGLE_ADS"
  | "META"
  | "OTHER";

export interface SalesFollowUpRow {
  followUpId: number;
  leadId: number;
  dueAt: string;
  note: string | null;
  status: "PENDING" | "DONE";
  completedAt: string | null;
  createdAt: string;
}

export interface SalesLeadRow {
  leadId: number;
  restaurantName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  source: SalesLeadSource;
  stage: SalesLeadStage;
  leadValue: number;
  expectedCloseAt: string | null;
  notes: string | null;
  lostReason: string | null;
  wonAt: string | null;
  assignedToId: number | null;
  assignedTo?: {
    userId: number;
    name: string | null;
    email: string | null;
  } | null;
  convertedRestaurantId: number | null;
  convertedRestaurant?: { restaurantId: number; name: string } | null;
  nextFollowUp?: SalesFollowUpRow | null;
  followUps?: SalesFollowUpRow[];
  _count?: { followUps: number };
  createdAt: string;
}

export type SalesLeadList = CrmPage & { leads: SalesLeadRow[] };

export interface SalesPipeline {
  byStage: { stage: SalesLeadStage; count: number; value: number }[];
  overdueFollowUps: number;
  upcomingFollowUps: number;
}

export type SalesLeadBody = {
  restaurantName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  stage?: string;
  leadValue?: number;
  expectedCloseAt?: string;
  assignedToId?: number;
  notes?: string;
  lostReason?: string;
};

export const crmSalesApi = {
  pipeline: () => apiClient.get<SalesPipeline>("/v1/crm/sales-leads/pipeline"),
  list: (params: {
    search?: string;
    stage?: string;
    source?: string;
    assignedToId?: number;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<SalesLeadList>(`/v1/crm/sales-leads${toQueryString(params)}`),
  get: (id: number) => apiClient.get<SalesLeadRow>(`/v1/crm/sales-leads/${id}`),
  create: (body: SalesLeadBody & { restaurantName: string }) =>
    apiClient.post<SalesLeadRow>("/v1/crm/sales-leads", body),
  update: (id: number, body: SalesLeadBody) =>
    apiClient.patch<SalesLeadRow>(`/v1/crm/sales-leads/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/crm/sales-leads/${id}`),
  convert: (id: number) =>
    apiClient.post<RestaurantRow>(`/v1/crm/sales-leads/${id}/convert`, {}),
  addFollowUp: (leadId: number, body: { dueAt: string; note?: string }) =>
    apiClient.post<SalesFollowUpRow>(
      `/v1/crm/sales-leads/${leadId}/follow-ups`,
      body,
    ),
  updateFollowUp: (
    followUpId: number,
    body: { dueAt?: string; note?: string; status?: string },
  ) =>
    apiClient.patch<SalesFollowUpRow>(
      `/v1/crm/sales-leads/follow-ups/${followUpId}`,
      body,
    ),
  removeFollowUp: (followUpId: number) =>
    apiClient.delete<{ deleted: boolean }>(
      `/v1/crm/sales-leads/follow-ups/${followUpId}`,
    ),
};

/* ----------------------- Marketing leads (call centre) ------------------ */
// The ad-sourced lead sheet behind /dashboard/leads. Gated by the
// "marketing-leads" permission module — unrelated to crmSalesApi above
// (restaurant pipeline) and to the real-estate leads section.

export type LeadMasterType =
  | "platforms"
  | "staff-categories"
  | "callers"
  | "call-statuses";

export interface LeadMasterRow {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  /** call-statuses only: badge colour (#RRGGBB). */
  color?: string | null;
  /** staff-categories only. */
  parentId?: number | null;
  /** Leads referencing this entry — delete is refused while non-zero. */
  usage: number;
  /** staff-categories only: sub-types nested under a main category. */
  children?: LeadMasterRow[];
}

export interface LeadRequirementRef {
  categoryId: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  /** "Chef > Tandoor" or "Waiter" — ready for chips and exports. */
  label: string;
}

export interface MarketingLeadRow {
  leadId: number;
  platformId: number;
  platform: { platformId: number; name: string };
  fullName: string;
  phoneNumber: string;
  restaurantName: string | null;
  location: string | null;
  callerId: number | null;
  caller: { callerId: number; name: string } | null;
  callStatusId: number | null;
  callStatus: { statusId: number; name: string; color: string | null } | null;
  callRemarks: string | null;
  requirements: LeadRequirementRef[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketingLeadList {
  total: number;
  page: number;
  limit: number;
  leads: MarketingLeadRow[];
}

export type MarketingLeadListParams = {
  q?: string;
  platformId?: number;
  staffCategoryId?: number;
  callerId?: number;
  callStatusId?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type MarketingLeadBody = {
  platformId?: number;
  fullName?: string;
  phoneNumber?: string;
  restaurantName?: string;
  location?: string;
  callerId?: number | null;
  callStatusId?: number | null;
  callRemarks?: string;
  staffCategoryIds?: number[];
};

export interface LeadImportPreview {
  total: number;
  valid: number;
  invalid: { row: number; reason: string }[];
  duplicates: {
    row: number;
    phoneNumber: string;
    existingLeadId?: number;
    repeatedInFile: boolean;
  }[];
  newMasters: {
    platforms: string[];
    callers: string[];
    callStatuses: string[];
    staffCategories: string[];
  };
}

export interface LeadImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: { row: number; reason: string }[];
  newMasters: string[];
}

export const marketingLeadsApi = {
  list: (params: MarketingLeadListParams) =>
    apiClient.get<MarketingLeadList>(`/v1/admin/leads${toQueryString(params)}`),
  get: (id: number) => apiClient.get<MarketingLeadRow>(`/v1/admin/leads/${id}`),
  /** 409 with { existingLeadId } on a duplicate phone unless force. */
  create: (body: MarketingLeadBody, force = false) =>
    apiClient.post<MarketingLeadRow>(
      `/v1/admin/leads${force ? "?force=true" : ""}`,
      body,
    ),
  update: (id: number, body: MarketingLeadBody, force = false) =>
    apiClient.put<MarketingLeadRow>(
      `/v1/admin/leads/${id}${force ? "?force=true" : ""}`,
      body,
    ),
  /** Inline table edit: caller / status / remarks. */
  updateCall: (
    id: number,
    body: { callerId?: number | null; callStatusId?: number | null; callRemarks?: string },
  ) => apiClient.patch<MarketingLeadRow>(`/v1/admin/leads/${id}/call`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/admin/leads/${id}`),
  bulkDelete: (ids: number[]) =>
    apiClient.post<{ deleted: number }>("/v1/admin/leads/bulk-delete", { ids }),
  bulkUpdate: (body: { ids: number[]; callerId?: number; callStatusId?: number }) =>
    apiClient.patch<{ updated: number }>("/v1/admin/leads/bulk-update", body),
  /** Filtered export; pass ids for the checkbox selection only. */
  exportCsv: (params: MarketingLeadListParams & { ids?: number[] }) =>
    downloadFile(
      `/v1/admin/leads/export.csv${toQueryString({
        ...params,
        ids: params.ids?.length ? params.ids.join(",") : undefined,
      })}`,
    ),
  importTemplate: () => downloadFile("/v1/admin/leads/import-template.csv"),
  importPreview: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<LeadImportPreview>("/v1/admin/leads/import/preview", fd);
  },
  importConfirm: (file: File, duplicateMode: "skip" | "update" | "create") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("duplicateMode", duplicateMode);
    return uploadFile<LeadImportResult>("/v1/admin/leads/import/confirm", fd);
  },
  masters: {
    list: (type: LeadMasterType) =>
      apiClient.get<LeadMasterRow[]>(`/v1/admin/lead-masters/${type}`),
    create: (
      type: LeadMasterType,
      body: { name: string; parentId?: number; color?: string },
    ) => apiClient.post<LeadMasterRow>(`/v1/admin/lead-masters/${type}`, body),
    update: (
      type: LeadMasterType,
      id: number,
      body: { name: string; parentId?: number; color?: string },
    ) => apiClient.put<LeadMasterRow>(`/v1/admin/lead-masters/${type}/${id}`, body),
    toggle: (type: LeadMasterType, id: number) =>
      apiClient.patch<LeadMasterRow>(`/v1/admin/lead-masters/${type}/${id}/toggle`, {}),
    remove: (type: LeadMasterType, id: number) =>
      apiClient.delete<{ deleted: boolean }>(`/v1/admin/lead-masters/${type}/${id}`),
    reorder: (type: LeadMasterType, ids: number[]) =>
      apiClient.patch<{ reordered: number }>(`/v1/admin/lead-masters/${type}/reorder`, {
        ids,
      }),
  },
};

export const marketingLeadKeys = {
  leads: (p: object) => ["marketing-leads", "list", p] as const,
  lead: (id: number) => ["marketing-leads", "detail", id] as const,
  masters: (type: LeadMasterType) => ["marketing-leads", "masters", type] as const,
};

/* -------------------------- CRM: Support desk --------------------------- */

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketCategory =
  | "WORKFORCE_ISSUE"
  | "BILLING_ISSUE"
  | "SERVICE_COMPLAINT"
  | "TECHNICAL_ISSUE"
  | "OTHER";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TicketMessageRow {
  messageId: number;
  ticketId: number;
  body: string;
  createdAt: string;
  author: { userId: number; name: string | null; role: string } | null;
}

export interface TicketRow {
  ticketId: number;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  restaurantId: number | null;
  restaurant?: {
    restaurantId: number;
    name: string;
    contactNumber?: string | null;
  } | null;
  /** Booking customer the ticket is about — their restaurantName is the
   *  restaurant shown in the panel (the CRM Restaurant table is separate). */
  customerId?: number | null;
  customer?: {
    userId: number;
    name: string | null;
    restaurantName: string | null;
    mobile: string | null;
    gstNumber?: string | null;
  } | null;
  raisedByName: string | null;
  raisedByContact: string | null;
  assignedToId: number | null;
  assignedTo?: {
    userId: number;
    name: string | null;
    email?: string | null;
  } | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  messages?: TicketMessageRow[];
  _count?: { messages: number };
}

export type TicketList = CrmPage & { tickets: TicketRow[] };

export interface TicketSummary {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byCategory: { category: TicketCategory; count: number }[];
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export type TicketBody = {
  subject?: string;
  description?: string;
  category?: string;
  status?: string;
  priority?: string;
  restaurantId?: number;
  customerId?: number;
  raisedByName?: string;
  raisedByContact?: string;
  assignedToId?: number;
};

export const crmTicketsApi = {
  summary: () => apiClient.get<TicketSummary>("/v1/crm/tickets/summary"),
  list: (params: {
    search?: string;
    status?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get<TicketList>(`/v1/crm/tickets${toQueryString(params)}`),
  get: (id: number) => apiClient.get<TicketRow>(`/v1/crm/tickets/${id}`),
  create: (body: TicketBody & { subject: string; description: string }) =>
    apiClient.post<TicketRow>("/v1/crm/tickets", body),
  update: (id: number, body: TicketBody) =>
    apiClient.patch<TicketRow>(`/v1/crm/tickets/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/crm/tickets/${id}`),
  addMessage: (id: number, body: string) =>
    apiClient.post<TicketMessageRow>(`/v1/crm/tickets/${id}/messages`, {
      body,
    }),
};

/* ------------------------ CRM: Marketing campaigns ---------------------- */

export type CampaignChannel = "EMAIL" | "WHATSAPP" | "SMS";

export type CampaignSegment =
  | "ALL_CLIENTS"
  | "ACTIVE_CLIENTS"
  | "INACTIVE_CLIENTS"
  | "HIGH_REVENUE_CLIENTS"
  | "POTENTIAL_CLIENTS"
  /** Not a rule — the exact customers an admin ticked. */
  | "SELECTED_CUSTOMERS"
  /** Imported ad/call-centre leads, not customer accounts. */
  | "MARKETING_LEADS"
  /** Not a rule — the exact leads an admin ticked on the Leads page. */
  | "SELECTED_LEADS";

export type CampaignStatus = "DRAFT" | "SENDING" | "SENT" | "FAILED";

export interface CampaignRow {
  campaignId: number;
  name: string;
  channel: CampaignChannel;
  segment: CampaignSegment;
  subject: string | null;
  message: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  templateParams: string[] | null;
  dailyCap: number | null;
  createdBy?: { userId: number; name: string | null } | null;
  createdAt: string;
}

export type CampaignList = CrmPage & { campaigns: CampaignRow[] };

/** Live counts for a running blast, polled while a campaign is SENDING. */
export interface CampaignProgress {
  campaignId: number;
  status: CampaignStatus;
  template: string | null;
  counts: {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    skipped: number;
  };
  sampleFailures: { mobile: string; error: string | null }[];
}

export interface SegmentPreview {
  segment: string;
  channel: string | null;
  count: number;
  sample: {
    name: string | null;
    email: string | null;
    mobile: string | null;
  }[];
}

export type CampaignRecipientStatus =
  "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "SKIPPED";

/** One row of a campaign's send ledger. */
export interface CampaignRecipientRow {
  recipientId: number;
  userId: number | null;
  name: string | null;
  mobile: string;
  status: CampaignRecipientStatus;
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface CampaignRecipientList {
  total: number;
  page: number;
  limit: number;
  recipients: CampaignRecipientRow[];
}

/** One button under a template — Meta's three kinds. */
export interface TemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "COPY_CODE";
  /** Label, max 25 chars. COPY_CODE has none — WhatsApp draws "Copy offer code". */
  text: string;
  url?: string;
  phoneNumber?: string;
  /** COPY_CODE only: a sample code for Meta's review, e.g. RESTO200. */
  example?: string;
}

/** An approved template on the WABA, as Meta reports it. */
export interface TemplateButtonInfo {
  type: string;
  text: string;
  url: string | null;
  example: string | null;
}

export interface WhatsappTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  variableCount: number;
  example: string[];
  /** null for a plain text header, else "IMAGE" | "VIDEO" | "DOCUMENT". */
  headerFormat: string | null;
  /** The picture/file Meta approved the template with — the sensible default. */
  headerMediaExample: string | null;
  buttons: TemplateButtonInfo[];
}

/** One thread with a phone number that has written to, or been written by, the business number. */
export interface WhatsappConversation {
  conversationId: number;
  waId: string;
  /** "+91 98765 43210" */
  phone: string;
  /** The customer's account name, else their WhatsApp profile name. */
  name: string | null;
  whatsappName: string | null;
  restaurantName: string | null;
  /** Matched customer account, when the number is on file. */
  userId: number | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastPreview: string | null;
  unreadCount: number;
  /** A typed reply is allowed only within 24h of the customer's last message. */
  replyWindowOpen: boolean;
  replyWindowEndsAt: string | null;
}

export interface WhatsappInboxMessage {
  messageId: number;
  direction: "INBOUND" | "OUTBOUND";
  /** text, image, video, audio, document, sticker, location, template, ... */
  type: string;
  body: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  /** Outbound: SENT → DELIVERED → READ, or FAILED. */
  status: string | null;
  error: string | null;
  sentByUserId: number | null;
  sentAt: string;
}

export const whatsappInboxApi = {
  conversations: (search?: string) =>
    apiClient.get<WhatsappConversation[]>(
      `/v1/crm/whatsapp/conversations${toQueryString({ search })}`,
    ),
  conversation: (id: number) =>
    apiClient.get<WhatsappConversation>(`/v1/crm/whatsapp/conversations/${id}`),
  messages: (id: number, before?: number) =>
    apiClient.get<{ messages: WhatsappInboxMessage[]; hasMore: boolean }>(
      `/v1/crm/whatsapp/conversations/${id}/messages${toQueryString({ before, limit: 80 })}`,
    ),
  markRead: (id: number) =>
    apiClient.post<{ ok: boolean }>(
      `/v1/crm/whatsapp/conversations/${id}/read`,
      {},
    ),
  reply: (id: number, text: string) =>
    apiClient.post<{ ok: boolean }>(
      `/v1/crm/whatsapp/conversations/${id}/messages`,
      { text },
    ),
  /** A photo the customer sent, as a data URL. */
  media: (messageId: number) =>
    apiClient.get<{ mime: string; dataUrl: string }>(
      `/v1/crm/whatsapp/messages/${messageId}/media`,
    ),
};

export const crmCampaignsApi = {
  list: (params: {
    status?: string;
    channel?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<CampaignList>(`/v1/crm/campaigns${toQueryString(params)}`),
  get: (id: number) => apiClient.get<CampaignRow>(`/v1/crm/campaigns/${id}`),
  previewSegment: (segment: string, channel?: string) =>
    apiClient.get<SegmentPreview>(
      `/v1/crm/campaigns/segments/preview${toQueryString({ segment, channel })}`,
    ),
  create: (body: {
    name: string;
    channel: string;
    segment: string;
    subject?: string;
    message: string;
    templateName?: string;
    templateLanguage?: string;
    templateParams?: string[];
    dailyCap?: number;
    recipientUserIds?: number[];
    /** SELECTED_LEADS only — MarketingLead ids ticked on the Leads page. */
    recipientLeadIds?: number[];
    headerMediaUrl?: string;
    couponCode?: string;
  }) => apiClient.post<CampaignRow>("/v1/crm/campaigns", body),
  update: (
    id: number,
    body: {
      name?: string;
      channel?: string;
      segment?: string;
      subject?: string;
      message?: string;
      templateName?: string;
      templateLanguage?: string;
      templateParams?: string[];
      dailyCap?: number;
    },
  ) => apiClient.patch<CampaignRow>(`/v1/crm/campaigns/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ deleted: boolean }>(`/v1/crm/campaigns/${id}`),
  send: (id: number) =>
    apiClient.post<CampaignRow>(`/v1/crm/campaigns/${id}/send`, {}),
  /**
   * Start a WhatsApp template blast. Returns as soon as the run starts —
   * hundreds of paced sends outlive any request timeout — so the caller polls
   * progress() rather than waiting on this.
   */
  sendTemplate: (id: number) =>
    apiClient.post<{ started: boolean; pending: number }>(
      `/v1/crm/campaigns/${id}/send-template`,
      {},
    ),
  /** One message to one number, to see the template render before the blast. */
  test: (id: number, mobile: string, name?: string) =>
    apiClient.post<{ to: string; messageId: string | null }>(
      `/v1/crm/campaigns/${id}/test`,
      {
        mobile,
        name,
      },
    ),
  progress: (id: number) =>
    apiClient.get<CampaignProgress>(`/v1/crm/campaigns/${id}/progress`),
  /** Every template on the WABA, whatever its review status. */
  templates: () =>
    apiClient.get<WhatsappTemplate[]>("/v1/crm/campaigns/templates"),
  /** Submit a new template to Meta; it returns PENDING until reviewed. */
  createTemplate: (body: {
    name: string;
    category: string;
    language: string;
    body: string;
    bodyExamples?: string[];
    header?: string;
    headerExample?: string;
    /** TEXT (default) uses `header`; IMAGE uses `headerHandle` from uploadTemplateHeaderImage. */
    headerFormat?: "TEXT" | "IMAGE";
    headerHandle?: string;
    headerImageUrl?: string;
    footer?: string;
    buttons?: TemplateButton[];
  }) =>
    apiClient.post<{ id: string; status: string; category: string }>(
      "/v1/crm/campaigns/templates",
      body,
    ),
  /** The picture for an IMAGE header: Meta's handle (for the template) plus a lasting URL (for sending). */
  uploadTemplateHeaderImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<{ handle: string; url: string }>(
      "/v1/crm/campaigns/templates/header-image",
      fd,
    );
  },
  deleteTemplate: (name: string) =>
    apiClient.delete<{ success: boolean }>(
      `/v1/crm/campaigns/templates/${encodeURIComponent(name)}`,
    ),
  /** One template message to one customer, outside any campaign. */
  sendOne: (body: {
    userId?: number;
    mobile?: string;
    templateName: string;
    templateLanguage: string;
    templateParams?: string[];
    headerMediaUrl?: string;
    couponCode?: string;
  }) =>
    apiClient.post<{
      to: string;
      name: string | null;
      messageId: string | null;
    }>("/v1/crm/campaigns/send-one", body),
  recipients: (
    id: number,
    params: { status?: string; page?: number; limit?: number },
  ) =>
    apiClient.get<CampaignRecipientList>(
      `/v1/crm/campaigns/${id}/recipients${toQueryString(params)}`,
    ),
};

/* --------------------------- CRM: Finance ------------------------------- */

export interface InvoiceRow {
  invoiceId: number;
  bookingId: number;
  invoiceNumber: string;
  serviceAmount: number;
  platformFee: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  commissionAmount: number;
  professionalEarning: number;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  booking?: {
    bookingId: number;
    serviceCity?: string;
    bookingDate?: string;
    user: {
      userId: number;
      name: string | null;
      restaurantName: string | null;
    } | null;
    service: { name: string } | null;
  } | null;
}

export type InvoiceList = CrmPage & { invoices: InvoiceRow[] };

export interface FinanceSummary {
  paid: { count: number; amount: number };
  pending: { count: number; amount: number };
  failed: { count: number; amount: number };
  refunded: { count: number; amount: number };
  overdue: { count: number; amount: number };
  overdueAfterDays: number;
  monthlyCollections: { month: string; amount: number; count: number }[];
}

export interface RevenueReport {
  by: "restaurant" | "city" | "month";
  rows: {
    userId?: number;
    name?: string;
    mobile?: string | null;
    city?: string;
    month?: string;
    bookings?: number;
    count?: number;
    revenue?: number;
    amount?: number;
  }[];
}

export const crmFinanceApi = {
  summary: () => apiClient.get<FinanceSummary>("/v1/crm/finance/summary"),
  invoices: (params: {
    search?: string;
    status?: string;
    overdue?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<InvoiceList>(
      `/v1/crm/finance/invoices${toQueryString(params)}`,
    ),
  invoice: (id: number) =>
    apiClient.get<InvoiceRow>(`/v1/crm/finance/invoices/${id}`),
  updateInvoice: (
    id: number,
    body: {
      paymentStatus: string;
      paymentMethod?: string;
      transactionId?: string;
    },
  ) => apiClient.patch<InvoiceRow>(`/v1/crm/finance/invoices/${id}`, body),
  revenue: (by: "restaurant" | "city" | "month") =>
    apiClient.get<RevenueReport>(`/v1/crm/finance/revenue?by=${by}`),
};

/* -------------------------- CRM: Operations board ----------------------- */

export interface OpsBoard {
  date: string;
  bookings: {
    byStatus: Record<string, number>;
    items: CrmBookingRow[];
  };
  alerts: {
    staleAssignmentMinutes: number;
    staleAssignments: {
      bookingId: number;
      assignedAt: string | null;
      startTime: string;
      user: { name: string | null } | null;
      service: { name: string } | null;
      professional: {
        user: { name: string | null; mobile: string | null } | null;
      } | null;
    }[];
    emergencyReplacements: {
      bookingId: number;
      startTime: string;
      user: { name: string | null } | null;
      service: { name: string } | null;
      professional: { user: { name: string | null } | null } | null;
    }[];
  };
  workforce: {
    partnersOnline: number;
    partnersActive: number;
    employeesActive: number;
    checkedIn: number;
    checkedOut: number;
    lateAfter: string;
    lateCheckIns: {
      employeeId: number;
      name: string;
      designation: string | null;
      checkInAt: string;
    }[];
    notCheckedIn: {
      employeeId: number;
      name: string;
      designation: string | null;
    }[];
  };
}

export const crmOpsApi = {
  board: () => apiClient.get<OpsBoard>("/v1/crm/ops/board"),
};

/* --------------------------- CRM: Reports ------------------------------- */

export interface SalesReport {
  monthly: {
    month: string;
    revenue: number;
    bookings: number;
    newLeads: number;
  }[];
  funnel: { stage: SalesLeadStage; count: number }[];
  totalLeads: number;
  won: number;
  lost: number;
  conversionRate: number | null;
  sources: { source: string; total: number; won: number; value: number }[];
}

export interface WorkforceReport {
  activePartners: number;
  onlinePartners: number;
  utilizationPct: number | null;
  busyPartnersThisMonth: number;
  topPerformers: {
    professionalId: number;
    name: string | null;
    service: string | null;
    city: string | null;
    rating: number;
    totalJobs: number;
    trainingStatus: string;
  }[];
  employeesActive: number;
  attendanceToday: number;
}

export interface RestaurantsReport {
  activeRestaurants: number;
  repeatCustomers: number;
  totalCustomersWithBookings: number;
  repeatRatePct: number | null;
  topByRevenue: {
    userId: number;
    name: string;
    bookings: number;
    revenue: number;
  }[];
  serviceFrequency: { serviceId: number; name: string; bookings: number }[];
}

export const crmReportsApi = {
  sales: (months?: number) =>
    apiClient.get<SalesReport>(
      `/v1/crm/reports/sales${months ? `?months=${months}` : ""}`,
    ),
  workforce: () => apiClient.get<WorkforceReport>("/v1/crm/reports/workforce"),
  restaurants: () =>
    apiClient.get<RestaurantsReport>("/v1/crm/reports/restaurants"),
};

export const crmQueryKeys = {
  summary: ["crm", "summary"] as const,
  crmCustomers: (p: object) => ["crm", "customers", p] as const,
  crmPartners: (p: object) => ["crm", "partners", p] as const,
  crmBookings: (p: object) => ["crm", "bookings", p] as const,
  restaurants: (p: object) => ["crm", "restaurants", p] as const,
  restaurant: (id: number) => ["crm", "restaurant", id] as const,
  restaurantBookings: (id: number, p: object) =>
    ["crm", "restaurant", id, "bookings", p] as const,
  salesPipeline: ["crm", "sales-pipeline"] as const,
  salesLeads: (p: object) => ["crm", "sales-leads", p] as const,
  salesLead: (id: number) => ["crm", "sales-lead", id] as const,
  ticketSummary: ["crm", "tickets", "summary"] as const,
  tickets: (p: object) => ["crm", "tickets", p] as const,
  ticket: (id: number) => ["crm", "ticket", id] as const,
  campaigns: (p: object) => ["crm", "campaigns", p] as const,
  campaign: (id: number) => ["crm", "campaign", id] as const,
  segmentPreview: (segment: string, channel?: string) =>
    ["crm", "segment-preview", segment, channel] as const,
  campaignProgress: (id: number) =>
    ["crm", "campaigns", "progress", id] as const,
  campaignRecipients: (id: number, p: object) =>
    ["crm", "campaigns", "recipients", id, p] as const,
  whatsappTemplates: ["crm", "campaigns", "templates"] as const,
  financeSummary: ["crm", "finance", "summary"] as const,
  invoices: (p: object) => ["crm", "invoices", p] as const,
  invoice: (id: number) => ["crm", "invoice", id] as const,
  revenue: (by: string) => ["crm", "revenue", by] as const,
  opsBoard: ["crm", "ops", "board"] as const,
  reportSales: (months?: number) =>
    ["crm", "reports", "sales", months] as const,
  reportWorkforce: ["crm", "reports", "workforce"] as const,
  reportRestaurants: ["crm", "reports", "restaurants"] as const,
  rbacRoles: ["rbac", "roles"] as const,
  rbacCatalog: ["rbac", "catalog"] as const,
  rbacStaff: ["rbac", "staff"] as const,
  departments: ["hr", "departments"] as const,
  offices: ["hr", "offices"] as const,
  employees: (p: object) => ["hr", "employees", p] as const,
  employee: (id: number) => ["hr", "employee", id] as const,
  myAttendance: (month: string) => ["hr", "attendance", "me", month] as const,
  attendance: (p: object) => ["hr", "attendance", p] as const,
  leaveTypes: ["hr", "leave-types"] as const,
  leaveBalances: (employeeId: number, year?: number) =>
    ["hr", "leave-balances", employeeId, year] as const,
  myLeaves: ["hr", "leaves", "me"] as const,
  leaves: (p: object) => ["hr", "leaves", p] as const,
  linkableUsers: ["hr", "linkable-users"] as const,
  shifts: (includeInactive?: boolean) =>
    ["hr", "shifts", includeInactive ?? false] as const,
  shiftRoster: (shiftId: number) => ["hr", "shift-roster", shiftId] as const,
  shiftRequests: (status?: string) =>
    ["hr", "shift-requests", status ?? "ALL"] as const,
  myShift: ["ess", "shift"] as const,
  attendancePolicy: ["hr", "attendance-policy"] as const,
  policies: (p: object) => ["hr", "policies", p] as const,
  myPolicies: ["ess", "policies"] as const,
  notifications: ["notifications"] as const,
  appraisals: (p: object) => ["hr", "appraisals", p] as const,
  myAppraisals: ["hr", "appraisals", "me"] as const,
  myPortal: ["ess", "portal"] as const,
  myPayslips: ["ess", "payslips"] as const,
  myPayslip: (id: number) => ["ess", "payslip", id] as const,
  myIncrements: ["ess", "increments"] as const,
  celebrations: ["ess", "celebrations"] as const,
  holidays: (year?: number) => ["ess", "holidays", year] as const,
  openPositions: ["ess", "positions", "open"] as const,
  payroll: (p: object) => ["hr", "payroll", p] as const,
  positions: (status?: string) => ["hr", "positions", status] as const,
  offerLetters: (p: object) => ["hr", "offer-letters", p] as const,
  offerLetter: (id: number) => ["hr", "offer-letter", id] as const,
  myOfferLetters: ["ess", "offer-letters"] as const,
  myOfferLetter: (id: number) => ["ess", "offer-letter", id] as const,
};
