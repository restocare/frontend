/**
 * Admin dashboard: overview stats, bookings list, MIS reports, store configuration.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

export interface StatCardData {
  key: string;
  label: string;
  value: string;
  /** percentage change vs previous period; positive = up */
  delta: number;
  spark: number[];
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  orders: number;
}

export interface TrafficSlice {
  label: string;
  value: number;
}

export interface RecentOrder {
  id: string;
  customer: string;
  service: string;
  amount: number;
  status: "Completed" | "Pending" | "Cancelled";
  date: string;
}

export interface DashboardOverview {
  stats: StatCardData[];
  revenue: RevenuePoint[];
  traffic: TrafficSlice[];
  recentOrders: RecentOrder[];
}

/** The full set of booking lifecycle states the backend can return. */
export type AdminBookingStatus =
  | "PENDING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "ON_THE_WAY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface AdminBooking {
  id: string;
  bookingId: number;
  customer: string;
  mobile: string | null;
  /** Business profile the customer entered at checkout — the restaurant this
   *  booking is for; `customer` is the owner's name. */
  restaurantName: string | null;
  gstNumber: string | null;
  service: string;
  /** What the customer pays, GST included. */
  amount: number;
  /** GST split — null on bookings taken before tax was stored server-side. */
  baseAmount: number | null;
  taxAmount: number | null;
  status: AdminBookingStatus;
  paymentMode: string;
  /** Partner tapped "Payment received" in the app — customer's money confirmed
   *  in hand, stamped when they tapped. */
  paymentCollected: boolean;
  paymentCollectedAt: string | null;
  /** Extra services the partner added on site before starting (more work
   *  found). The amount fields already include them. */
  addons: {
    addonId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    amount: number;
  }[];
  /** Assigned service partner, or null when nobody has accepted the lead yet. */
  professionalId: number | null;
  professionalName: string | null;
  /** How the partner was chosen: AUTO = accepted the broadcast lead, MANUAL =
   *  admin allocated directly. Null while unassigned. */
  assignmentSource: "AUTO" | "MANUAL" | null;
  /** The booked slot window ("HH:mm") + the shift the customer picked. */
  startTime: string | null;
  endTime: string | null;
  /** Total booked time in minutes — 300 for a 5-hour shift, 660 for 08:00–19:00. */
  totalMinutes: number | null;
  /** Variant name, e.g. "5 Hour Shift (11 AM – 4 PM)". */
  shift: string | null;
  /** Day-part bucket derived from startTime: Morning/Afternoon/Evening/Night. */
  slotPeriod: string | null;
  /** Where the booking is for. */
  city: string | null;
  address: string | null;
  /** True when the booking fell outside every active service zone — recorded as
   *  demand (customer saw "Coming soon in your area"), not dispatched to a partner. */
  outOfServiceArea: boolean;
  /** When the customer placed the booking (ISO). */
  createdAt: string;
  /** Set only on cancelled bookings: when and why the customer cancelled. */
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** How many distinct partners the lead reached (retries don't double-count). */
  leadPartnerCount: number;
  /** Total offers including retries — how many alarms actually rang. */
  leadOfferCount: number;
  /** How many broadcast rounds this lead has had. */
  broadcastCount: number;
  lastBroadcastAt: string | null;
  /** Partners who declined this lead — explains why a booking is still unassigned. */
  rejectionCount: number;
  rejections: {
    rejectionId: number;
    professionalId: number | null;
    professionalName: string;
    reason: string | null;
    rejectedAt: string;
  }[];
  date: string;
}

export interface AdminBookingListParams {
  status?: AdminBookingStatus;
  search?: string;
  /** true = only out-of-zone demand bookings; false = only in-zone; omit = all. */
  outOfServiceArea?: boolean;
  /** Filter by booking date (inclusive), "YYYY-MM-DD". */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminBookingListResponse {
  bookings: AdminBooking[];
  /** Count per status plus an `all` total, for the filter tabs. */
  counts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* Bank & Payout MIS report — the money-side view of every partner. */
export interface BankPayoutMisParams {
  from?: string;
  to?: string;
  city?: string;
  teamId?: number;
  categoryId?: number;
  verification?: string;
  payoutStatus?: string;
  search?: string;
}

export interface BankPayoutMisRow {
  professionalId: number;
  partnerId: string;
  name: string | null;
  mobile: string | null;
  category: string | null;
  zone: string | null;
  accountHolder: string | null;
  bankName: string | null;
  /** Always masked server-side: "XXXX XXXX 1234". */
  accountMasked: string | null;
  ifsc: string | null;
  upiId: string | null;
  bankVerification: "Verified" | "Pending" | "Not Provided";
  grossEarnings: number;
  commission: number;
  otherDeductions: number;
  netPayable: number;
  walletBalance: number;
  payoutRequestId: string | null;
  payoutStatus: "Paid" | "Pending" | "Failed" | null;
  payoutDate: string | null;
  transactionId: string | null;
}

export interface BankPayoutMisResponse {
  range: { from: string; to: string };
  kpis: {
    totalEarnings: number;
    earningsDeltaPct: number | null;
    totalCommission: number;
    commissionDeltaPct: number | null;
    netPayable: number;
    paidAmount: number;
    paidDeltaPct: number | null;
    pendingPayouts: number;
    pendingCount: number;
    failedPayouts: number;
    failedDeltaPct: number | null;
  };
  partners: BankPayoutMisRow[];
  charts: {
    payoutStatus: { paid: number; pending: number; failed: number };
    byCategory: {
      basis: "paid" | "netPayable";
      bars: { category: string; amount: number }[];
    };
    dailyPaid: { date: string; amount: number }[];
  };
  filters: {
    cities: string[];
    teams: { teamId: number; name: string }[];
    categories: { categoryId: number; name: string }[];
  };
}

export interface QcDeliveryPartnerRow {
  professionalId: number;
  name: string | null;
  mobile: string | null;
  city: string | null;
  isBlocked: boolean;
  joinedAt: string;
  deliveredTasks: number;
  earnings: number;
  activeTasks: number;
  walletBalance: number;
  accountHolder: string | null;
  bankName: string | null;
  accountMasked: string | null;
  ifsc: string | null;
  upiId: string | null;
  bankProvided: boolean;
}

/* Partner MIS report — the dispatcher's management-information view. */
export interface PartnerMisParams {
  from?: string;
  to?: string;
  city?: string;
  teamId?: number;
  categoryId?: number;
  status?: string;
  search?: string;
}

export interface PartnerMisRow {
  professionalId: number;
  partnerId: string;
  name: string | null;
  mobile: string | null;
  category: string | null;
  service: string | null;
  registeredAt: string;
  verificationStatus: "Verified" | "Pending" | "Rejected";
  trainingStatus: "Completed" | "In Progress" | "Not Started";
  zone: string | null;
  availability: "Available" | "Busy" | "Unavailable";
  assigned: number;
  accepted: number;
  completed: number;
  cancelled: number;
  acceptanceRate: number;
  completionRate: number;
  rating: number;
  earnings: number;
}

export interface PartnerMisResponse {
  range: { from: string; to: string };
  kpis: {
    totalPartners: number;
    activePartners: number;
    activePct: number;
    verifiedPartners: number;
    verifiedPct: number;
    availableToday: number;
    availablePct: number;
    completionRate: number;
    completionDelta: number;
    totalEarnings: number;
    earningsDeltaPct: number | null;
  };
  partners: PartnerMisRow[];
  charts: {
    verification: { verified: number; pending: number; rejected: number };
    availability: { available: number; busy: number; unavailable: number };
    ordersByCategory: { category: string; count: number }[];
  };
  filters: {
    cities: string[];
    teams: { teamId: number; name: string }[];
    categories: { categoryId: number; name: string }[];
  };
}

/** One partner in the pipeline: Onboarding → 15-day Training → Deployment. */
export interface PartnerProgressRow {
  professionalId: number;
  name: string | null;
  mobile: string | null;
  city: string | null;
  category: string | null;
  stage: 1 | 2 | 3;
  stageName: "ONBOARDING" | "TRAINING" | "DEPLOYMENT" | "DEPLOYED";
  live: boolean;
  onboardingStatus: "PENDING" | "VERIFIED" | "ACTIVE" | "REJECTED";
  rejectionReason: string | null;
  registeredAt: string;
  verifiedAt: string | null;
  trainingStartedAt: string | null;
  trainingCompletedAt: string | null;
  trainingNote: string | null;
  trainingDay: number;
  trainingDays: number;
  groomingApproved: number;
  groomingTotal: number;
  groomingEnforced: boolean;
  deployedAt: string | null;
}

export interface PartnerProgressList {
  partners: PartnerProgressRow[];
  total: number;
  page: number;
  limit: number;
  counts: {
    all: number;
    onboarding: number;
    training: number;
    deployment: number;
    live: number;
  };
}

/** A service the manual-booking form can be filled against, with its shifts. */
export interface BookableService {
  serviceId: number;
  name: string;
  /** Lets the form narrow the service list to one category. */
  categoryId: number | null;
  category: string | null;
  basePrice: number | null;
  variants: { variantId: number; name: string; price: number | null }[];
}

/**
 * A booking created from the admin panel.
 *
 * The customer is either an existing `userId` or a `customerMobile` we match on
 * (creating the account when it's new) — an admin taking a phone order usually
 * has a number, not an id.
 */
export interface CreateBookingInput {
  userId?: number;
  customerMobile?: string;
  customerName?: string;
  restaurantName?: string;
  gstNumber?: string;
  serviceId: number;
  variantId?: number;
  /** YYYY-MM-DD */
  bookingDate: string;
  /** HH:mm */
  startTime: string;
  endTime?: string;
  /** Pre-GST — the backend adds tax and stores the inclusive total. */
  baseAmount: number;
  paymentMode?: "COD" | "RAZORPAY";
  serviceCity: string;
  serviceAddress: string;
  serviceLat?: number;
  serviceLng?: number;
  /** Assign this partner immediately instead of broadcasting the lead. */
  professionalId?: number;
}

export interface CreateBookingResult {
  message: string;
  bookingId: number;
  status: AdminBookingStatus;
  /** True when the lead actually reached at least one partner. */
  dispatched: boolean;
  partnersAlerted: number | null;
  /** Plain-language outcome — shown to the admin verbatim. */
  note: string;
}

/* --------------------- Configure (platform credentials) ----------------- */

export interface ConfigureField {
  /** Stable key — same as the backend env var name. */
  key: string;
  label: string;
  placeholder: string;
  /** Rendered masked with a show/hide toggle. */
  isSecret: boolean;
  value: string;
  /** Where the current value comes from. */
  source: "database" | "env" | "unset";
  /** A fixed set of choices → rendered as a dropdown. */
  options: { value: string; label: string }[] | null;
  hint: string | null;
  /** Shown only while another field in the same card holds this value. */
  showWhen: { key: string; value: string } | null;
}

export type OtpProvider = "FABMEDIA" | "MSG91" | "WHATSAPP";

export interface OtpDeliveryStatus {
  provider: OtpProvider;
  whatsappTemplate: { name: string; language: string };
  /** Meta's state for the OTP template: APPROVED / PENDING / REJECTED / MISSING; null if WhatsApp is unreachable. */
  whatsappTemplateStatus: string | null;
  /** What each service still needs before it can be switched on. */
  missing: Record<OtpProvider, string[]>;
}

export interface ConfigureGroup {
  key: string;
  title: string;
  description: string;
  fields: ConfigureField[];
}

export interface ConfigureSection {
  title: string;
  groups: ConfigureGroup[];
}

export const configureApi = {
  /** GET /v1/configure — all credential cards + current values (super admin). */
  get: () => apiClient.get<{ sections: ConfigureSection[] }>("/v1/configure"),

  /** PUT /v1/configure — upsert the given key/value overrides (super admin). */
  update: (values: { key: string; value: string }[]) =>
    apiClient.put<{ updated: number }>("/v1/configure", { values }),

  /** GET /v1/configure/otp/status — which OTP service is on and what each needs. */
  otpStatus: () => apiClient.get<OtpDeliveryStatus>("/v1/configure/otp/status"),
  /** POST /v1/configure/otp/test — send a real test OTP through a service. */
  otpTest: (mobile: string, provider?: OtpProvider) =>
    apiClient.post<{
      provider: OtpProvider;
      detail: string;
      mobile: string;
      otp: string;
    }>("/v1/configure/otp/test", { mobile, provider }),
  /** POST /v1/configure/otp/whatsapp-template — create/confirm the WhatsApp OTP template. */
  createWhatsappOtpTemplate: () =>
    apiClient.post<{ name: string; language: string; status: string }>(
      "/v1/configure/otp/whatsapp-template",
      {},
    ),
};

/* ----------------------------- Analytics -------------------------------- */

/** Time-range presets accepted by GET /v1/admin/analytics. */
export type AnalyticsRange = "7d" | "30d" | "90d" | "12m" | "custom";

export interface AnalyticsKpi {
  value: number;
  /** % change vs the previous period of equal length (percentage POINTS for rates). */
  delta: number;
}

export interface AnalyticsSeriesPoint {
  label: string;
  date: string;
  revenue: number;
  bookings: number;
  completed: number;
  cancelled: number;
}

export interface AnalyticsStatusSlice {
  status: AdminBookingStatus;
  count: number;
}

export interface AnalyticsPaymentMode {
  mode: string;
  bookings: number;
  amount: number;
}

export interface AnalyticsTopService {
  serviceId: number;
  name: string;
  bookings: number;
  revenue: number;
}

export interface AnalyticsTopCategory {
  categoryId: number;
  name: string;
  bookings: number;
  revenue: number;
}

export interface AnalyticsTopPartner {
  professionalId: number;
  name: string;
  jobs: number;
  revenue: number;
  rating: number | null;
}

export interface AnalyticsTopCity {
  city: string;
  bookings: number;
  revenue: number;
}

export interface AnalyticsZone {
  /** geofenceId, or 0 for the synthetic "Unzoned" bucket. */
  geofenceId: number;
  name: string;
  color: string;
  bookings: number;
  revenue: number;
}

export interface AnalyticsRatings {
  average: number;
  count: number;
  distribution: { stars: number; count: number }[];
}

export interface AnalyticsResponse {
  range: AnalyticsRange;
  start: string;
  end: string;
  bucket: "day" | "week" | "month";
  kpis: {
    revenue: AnalyticsKpi;
    bookings: AnalyticsKpi;
    avgOrderValue: AnalyticsKpi;
    completionRate: AnalyticsKpi;
    cancellationRate: AnalyticsKpi;
    newCustomers: AnalyticsKpi;
    newPartners: AnalyticsKpi;
    payoutsPaid: AnalyticsKpi;
  };
  series: AnalyticsSeriesPoint[];
  statusBreakdown: AnalyticsStatusSlice[];
  paymentModes: AnalyticsPaymentMode[];
  topServices: AnalyticsTopService[];
  topCategories: AnalyticsTopCategory[];
  topPartners: AnalyticsTopPartner[];
  topCities: AnalyticsTopCity[];
  /** Bookings + revenue per geo-fence zone (point-in-polygon on service location). */
  zones: AnalyticsZone[];
  ratings: AnalyticsRatings;
}

export const dashboardApi = {
  /** GET /v1/admin/dashboard/overview — real metrics aggregated by the backend. */
  getOverview: () =>
    apiClient.get<DashboardOverview>("/v1/admin/dashboard/overview"),

  /** GET /v1/admin/analytics — KPIs, series and breakdowns for a time range. */
  getAnalytics: (range: AnalyticsRange, from?: string, to?: string) =>
    apiClient.get<AnalyticsResponse>(
      // from/to override the preset server-side; both are IST dates, inclusive.
      `/v1/admin/analytics${toQueryString(range === "custom" ? { from, to } : { range })}`,
    ),

  /** GET /v1/admin/bookings — full, paginated booking history (admin). */
  listBookings: (params: AdminBookingListParams = {}) =>
    apiClient.get<AdminBookingListResponse>(
      `/v1/admin/bookings${toQueryString({
        status: params.status,
        search: params.search,
        outOfServiceArea: params.outOfServiceArea,
        from: params.from,
        to: params.to,
        page: params.page,
        limit: params.limit,
      })}`,
    ),

  /** GET /v1/admin/bookings/services — the services (and their shifts) a manual
   *  booking can be created against. */
  bookableServices: () =>
    apiClient.get<BookableService[]>("/v1/admin/bookings/services"),

  /** POST /v1/admin/bookings — create a booking on a customer's behalf (phone
   *  orders, walk-ins). `baseAmount` is pre-GST; tax and the total are added by
   *  the backend so a manual booking is priced like an app one. */
  createBooking: (body: CreateBookingInput) =>
    apiClient.post<CreateBookingResult>("/v1/admin/bookings", body),

  /* ── Partner MIS report ────────────────────────────────────────────────── */

  /** GET /v1/admin/partner-mis — KPIs, per-partner stats, chart breakdowns. */
  partnerMis: (params: PartnerMisParams = {}) =>
    apiClient.get<PartnerMisResponse>(
      `/v1/admin/partner-mis${toQueryString({
        from: params.from,
        to: params.to,
        city: params.city,
        teamId: params.teamId,
        categoryId: params.categoryId,
        status: params.status,
        search: params.search,
      })}`,
    ),

  /** GET /v1/admin/bank-payout-mis — money-side MIS (bank details masked). */
  bankPayoutMis: (params: BankPayoutMisParams = {}) =>
    apiClient.get<BankPayoutMisResponse>(
      `/v1/admin/bank-payout-mis${toQueryString({
        from: params.from,
        to: params.to,
        city: params.city,
        teamId: params.teamId,
        categoryId: params.categoryId,
        verification: params.verification,
        payoutStatus: params.payoutStatus,
        search: params.search,
      })}`,
    ),

  /* ── Partner pipeline (Onboarding → Training → Deployment) ─────────────── */

  /** GET /v1/admin/partner-progress — pipeline list with training + grooming state. */
  partnerProgress: (
    params: {
      search?: string;
      stage?: string;
      page?: number;
      limit?: number;
    } = {},
  ) =>
    apiClient.get<PartnerProgressList>(
      `/v1/admin/partner-progress${toQueryString({
        search: params.search,
        stage: params.stage,
        page: params.page,
        limit: params.limit,
      })}`,
    ),
  /** Start the partner's 15-day training clock. */
  startTraining: (professionalId: number) =>
    apiClient.patch<{ message: string }>(
      `/v1/admin/partner-progress/${professionalId}/training/start`,
      {},
    ),
  /** Trainer signs off the completed 15-day training. */
  completeTraining: (professionalId: number, note?: string) =>
    apiClient.patch<{ message: string }>(
      `/v1/admin/partner-progress/${professionalId}/training/complete`,
      { note },
    ),
  /** Final activation — partner goes live. */
  deployPartner: (professionalId: number) =>
    apiClient.patch<{ message: string }>(
      `/v1/admin/partner-progress/${professionalId}/deploy`,
      {},
    ),

  /** PATCH /v1/admin/bookings/:id/allocate — manually assign a partner to a
   *  booking nobody accepted. Sets the booking ACCEPTED with a fresh start-OTP. */
  allocateBooking: (bookingId: number, professionalId: number) =>
    apiClient.patch<{
      message: string;
      bookingId: number;
      professionalId: number;
      status: AdminBookingStatus;
    }>(`/v1/admin/bookings/${bookingId}/allocate`, { professionalId }),

  /** PATCH /v1/admin/bookings/:id/reopen — back to PENDING with no partner, ready to allocate again. */
  reopenBooking: (bookingId: number) =>
    apiClient.patch<{
      message: string;
      bookingId: number;
      status: AdminBookingStatus;
      releasedProfessionalId: number | null;
    }>(`/v1/admin/bookings/${bookingId}/reopen`, {}),
};
