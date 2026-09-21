/**
 * Typed API surface for the app. Every function here goes through `apiClient`
 * and is meant to be consumed by TanStack Query (`useQuery` / `useMutation`).
 */
import { apiClient, API_BASE_URL, downloadFile, uploadFile } from "./apiClient";

/* ============================== Auth ==================================== */

export type Role =
  "USER" | "SERVICE_PROFESSIONAL" | "ADMIN" | "SUPER_ADMIN" | "STAFF";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AdminUser {
  id: number;
  email: string | null;
  mobile: string | null;
  name: string;
  role: Role;
  // Present for multi-tenant SaaS (tenant) users — scopes them to the
  // /real-estate section. Null/absent for platform admins and staff.
  tenantId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpireTime: number;
  sessionId: string;
  user: AdminUser;
  /** CRM permissions: "*" for admins, "module.action" list for STAFF. */
  permissions?: string[];
  /** RBAC role names a STAFF member holds (e.g. ["marketing"]); [] for admins. */
  roleNames?: string[];
}

export const authApi = {
  /** POST /v1/admin/login — email + password, ADMIN / SUPER_ADMIN only. */
  login: (body: LoginRequest) =>
    apiClient.post<LoginResponse>("/v1/admin/login", body, { skipAuth: true }),

  /** POST /v1/admin/logout — destroys the current session. */
  logout: (sessionId: string) =>
    apiClient.post<{ message: string }>("/v1/admin/logout", { sessionId }),

  /** GET /v1/admin/me — the authenticated admin profile. */
  me: () => apiClient.get<AdminUser>("/v1/admin/me"),

  /** POST /v1/admin/change-password — reset the signed-in admin's password. */
  changePassword: (body: { newPassword: string }) =>
    apiClient.post<{ message: string }>("/v1/admin/change-password", body),
};

/** URL the "Continue with Google" button redirects to, to start OAuth. */
export const GOOGLE_AUTH_URL =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL ?? `${API_BASE_URL}/v1/auth/google`;

/* ============================ Dashboard ================================= */

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

/* ----------------------------- Dispatcher ------------------------------- */

export type PartnerOnboardingStatus =
  "PENDING" | "VERIFIED" | "ACTIVE" | "REJECTED";

export interface PartnerRow {
  professionalId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  category: string | null;
  service: string | null;
  city: string | null;
  experience: number | null;
  description: string | null;
  rating: number;
  totalJobs: number;
  isOnline: boolean;
  isVerified: boolean;
  isBlocked: boolean;
  onboardingStatus: PartnerOnboardingStatus;
  walletBalance: number;
  profileImage: string | null;
  /** Dispatch team the partner belongs to (null = unassigned). */
  teamId: number | null;
  /** Seconds on duty so far today (IST), including a session still open. */
  todayActiveSeconds?: number;
  /** Last proof the partner app was running (presence heartbeat). */
  lastSeenAt?: string | null;
}

export interface PartnerDocuments {
  aadharFront: string | null;
  aadharBack: string | null;
  licenseDoc: string | null;
  panCard: string | null;
  bankPassbook: string | null;
}

export interface PartnerGrooming {
  passportPhoto: string | null;
  nailsPhoto: string | null;
  fullPhoto: string | null;
}

/**
 * A partner's money and job history.
 *
 * `lifetimeEarned` is what the partner earned for work delivered (pre-tax,
 * pre-coupon list price) — deliberately NOT what the customer paid, which can
 * be lower on a coupon booking. The platform's cut is reported separately so
 * "why is my wallet lower than my earnings" answers itself.
 */
export interface PartnerEarnings {
  professionalId: number;
  earnings: {
    lifetimeEarned: number;
    commissionPaid: number;
    leadFeesPaid: number;
    netAfterPlatformCharges: number;
    averagePerJob: number;
  };
  wallet: {
    balance: number;
    totalCredited: number;
    totalDebited: number;
    transactions: {
      walletTransactionId: number;
      amount: number;
      type: "CREDIT" | "DEBIT";
      description: string | null;
      createdAt: string;
    }[];
  };
  jobs: {
    total: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    rejectedLeads: number;
    cancellationRate: number;
    firstJobAt: string | null;
    lastJobAt: string | null;
    recent: {
      bookingId: number;
      service: string;
      status: string;
      bookingDate: string;
      paymentMode: string | null;
      partnerEarning: number;
      customerPaid: number;
    }[];
  };
}

/** What a partner did with a lead. Derived server-side from the booking. */
export type LeadOutcome = "ACCEPTED" | "REJECTED" | "NO_RESPONSE";
/**
 * What became of the push for one partner. SENT = FCM accepted it for a device
 * (the phone's own settings decide whether it rings); NO_TOKEN = never logged in
 * on a device; TOKEN_DEAD = every registered device has expired — the partner
 * must log in again; FAILED = FCM turned it down for another reason.
 */
export type LeadPushStatus = "SENT" | "NO_TOKEN" | "TOKEN_DEAD" | "FAILED";

export interface BookingLeadRecipient {
  professionalId: number;
  name: string;
  mobile: string | null;
  city: string | null;
  isOnline: boolean;
  /** Which broadcast round; null for leads sent before the roster was logged. */
  attempt: number | null;
  /** Distance when the lead was sent, not now — partners move. */
  distanceKm: number | null;
  sentAt: string;
  /** What became of the push; null for rows logged before this was kept. */
  pushStatus: LeadPushStatus | null;
  /** The partner's app held a live socket when the lead went out. */
  socketLive: boolean;
  outcome: LeadOutcome;
  rejectionReason: string | null;
  respondedAt: string | null;
}

export interface BookingLeadActivity {
  bookingId: number;
  status: string;
  acceptedBy: number | null;
  acceptedAt: string | null;
  broadcastCount: number;
  lastBroadcastAt: string | null;
  counts: {
    sent: number;
    accepted: number;
    rejected: number;
    noResponse: number;
  };
  recipients: BookingLeadRecipient[];
}

export interface PartnerLeadRow {
  bookingId: number;
  serviceName: string;
  bookingDate: string;
  startTime: string | null;
  city: string | null;
  totalAmount: number;
  attempt: number;
  distanceKm: number | null;
  sentAt: string;
  pushStatus: LeadPushStatus | null;
  socketLive: boolean;
  outcome: LeadOutcome;
  rejectionReason: string | null;
  bookingStatus: string;
  /** The job went to someone else — "lost it" rather than "nobody took it". */
  takenByOther: boolean;
}

export interface PartnerLeadActivity {
  total: number;
  page: number;
  limit: number;
  counts: {
    offers: number;
    accepted: number;
    rejected: number;
    noResponse: number;
  };
  leads: PartnerLeadRow[];
}

export interface PartnerDetail extends PartnerRow {
  categoryId: number | null;
  joinedAt: string;
  verifiedAt: string | null;
  activatedAt: string | null;
  rejectionReason: string | null;
  district: string | null;
  aadharNo: string | null;
  licenseNo: string | null;
  vehicleType: string | null;
  vehicleColor: string | null;
  documents: PartnerDocuments;
  grooming: PartnerGrooming;
}

export interface PartnerStatusCounts {
  /** Blocked cuts across every onboarding stage, so it counts separately. */
  BLOCKED?: number;
  PENDING: number;
  VERIFIED: number;
  ACTIVE: number;
  REJECTED: number;
  ALL: number;
}

/** Outcome of a bulk partner import — failures are per row, never per file. */
export interface PartnerImportResult {
  message: string;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  professionalIds: number[];
  errors: { row: number; reason: string }[];
}

export interface UpdatePartnerInput {
  name?: string;
  city?: string;
  experience?: number;
  description?: string;
  categoryId?: number;
  /** District decides the partner's dispatch team, so correcting it matters. */
  district?: string;
  aadharNo?: string;
  licenseNo?: string;
  vehicleType?: string;
  vehicleColor?: string;
}

/** The KYC documents an admin can replace, keyed as the API expects them. */
export type PartnerDocumentField =
  "aadharFront" | "aadharBack" | "licenseDoc" | "panCard" | "bankPassbook";

export interface WalletRow {
  /** Null until money first moves — a wallet row is created on demand. */
  walletId: number | null;
  professionalId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  city: string | null;
  onboardingStatus: PartnerOnboardingStatus;
  isBlocked: boolean;
  balance: number;
  transactionCount: number;
}

export interface WalletListResponse {
  totalBalance: number;
  wallets: WalletRow[];
}

/** Lifecycle of a partner payout (withdrawal) request. */
export type PayoutStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface PayoutRequestRow {
  payoutRequestId: number;
  professionalId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  city: string | null;
  amount: number;
  status: PayoutStatus;
  /** Partner-supplied note (e.g. preferred method / UPI id). */
  note: string | null;
  /** Admin note on approval or reason on rejection. */
  adminNote: string | null;
  /** The partner's live wallet balance, for context while reviewing. */
  walletBalance: number;
  createdAt: string;
  processedAt: string | null;
}

export interface PayoutStatusCounts {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  ALL: number;
}

/** One online→offline session in a partner's activity log. */
export interface PartnerActivitySession {
  logId: number;
  onlineAt: string;
  offlineAt: string | null;
  /** Session length in seconds (live value for an ongoing session). */
  durationSeconds: number;
  ongoing: boolean;
}

/** Active seconds on a single day — the weekly/monthly report buckets. */
export interface PartnerActivityDay {
  date: string;
  activeSeconds: number;
}

export interface PartnerActivity {
  professionalId: number;
  name: string | null;
  mobile: string | null;
  isOnline: boolean;
  period: "week" | "month" | "custom";
  range: { from: string; to: string };
  totalActiveSeconds: number;
  sessionCount: number;
  sessions: PartnerActivitySession[];
  breakdown: PartnerActivityDay[];
}

/* ------------------------------- Workspaces ------------------------------- */
// A workspace is a self-contained mini-panel: its owner defines their own roles
// (from a workspace-only catalog) and adds members who can log in and work.

export interface WorkspaceRow {
  workspaceId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  owner: { userId: number; name: string | null; email: string | null };
  isOwner: boolean;
  memberCount: number;
  roleCount: number;
  taskCount: number;
  createdAt: string;
}

export interface WorkspaceDetail extends Omit<WorkspaceRow, "isOwner"> {
  isOwner: boolean;
  /** What the CURRENT user may do in this workspace. */
  myPermissions: string[];
}

export interface WorkspaceRoleRow {
  workspaceRoleId: number;
  name: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMemberRow {
  memberId: number;
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  role: { workspaceRoleId: number; name: string; permissions: string[] } | null;
  isActive: boolean;
  invitedBy: { memberId: number; name: string } | null;
  juniorCount: number;
  taskCount: number;
  joinedAt: string;
}

export interface WorkspaceCatalogEntry {
  module: string;
  actions: string[];
  keys: string[];
}

/** A panel login that can be handed a workspace (for the owner picker). */
export interface EligibleOwner {
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  ownedWorkspaces: number;
}

export const workspacesApi = {
  /** The permission catalog a workspace builds its roles from. */
  catalog: () =>
    apiClient.get<WorkspaceCatalogEntry[]>("/v1/workspaces/catalog"),
  /** Panel users who may be made a workspace admin. */
  eligibleOwners: (search?: string) =>
    apiClient.get<EligibleOwner[]>(
      `/v1/workspaces/eligible-owners${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  /** Workspaces I own or belong to (super admin sees all). */
  list: () => apiClient.get<WorkspaceRow[]>("/v1/workspaces"),
  get: (id: number) => apiClient.get<WorkspaceDetail>(`/v1/workspaces/${id}`),
  /** Needs workspaces.manage — hands a workspace to a panel user. */
  create: (body: { name: string; description?: string; ownerId: number }) =>
    apiClient.post<{ workspaceId: number; message: string }>(
      "/v1/workspaces",
      body,
    ),
  update: (
    id: number,
    body: { name?: string; description?: string; isActive?: boolean },
  ) => apiClient.patch<{ message: string }>(`/v1/workspaces/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/workspaces/${id}`),

  roles: (id: number) =>
    apiClient.get<WorkspaceRoleRow[]>(`/v1/workspaces/${id}/roles`),
  createRole: (
    id: number,
    body: { name: string; description?: string; permissions?: string[] },
  ) =>
    apiClient.post<{ workspaceRoleId: number; message: string }>(
      `/v1/workspaces/${id}/roles`,
      body,
    ),
  updateRole: (
    id: number,
    roleId: number,
    body: { name?: string; description?: string; permissions?: string[] },
  ) =>
    apiClient.patch<{ message: string }>(
      `/v1/workspaces/${id}/roles/${roleId}`,
      body,
    ),
  removeRole: (id: number, roleId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/workspaces/${id}/roles/${roleId}`,
    ),

  members: (id: number) =>
    apiClient.get<WorkspaceMemberRow[]>(`/v1/workspaces/${id}/members`),
  inviteMember: (
    id: number,
    body: {
      email: string;
      name: string;
      mobile?: string;
      password?: string;
      workspaceRoleId?: number;
    },
  ) =>
    apiClient.post<{ memberId: number; userId: number; message: string }>(
      `/v1/workspaces/${id}/members`,
      body,
    ),
  updateMember: (
    id: number,
    memberId: number,
    body: { workspaceRoleId?: number | null; isActive?: boolean },
  ) =>
    apiClient.patch<{ message: string }>(
      `/v1/workspaces/${id}/members/${memberId}`,
      body,
    ),
  removeMember: (id: number, memberId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/workspaces/${id}/members/${memberId}`,
    ),
};

/** Platform switch for the grooming module, with its blast radius. */
export interface GroomingSetting {
  enforced: boolean;
  enforcedAt: string | null;
  updatedBy: { userId: number; name: string | null } | null;
  updatedAt: string;
  impact: {
    totalPartners: number;
    activePartners: number;
    compliant: number;
    nonCompliant: number;
  };
}

export const groomingApi = {
  /** GET /v1/service-professional-manage/grooming/settings */
  getSetting: () =>
    apiClient.get<GroomingSetting>(
      "/v1/service-professional-manage/grooming/settings",
    ),

  /** PATCH /v1/service-professional-manage/grooming/settings — activate/deactivate. */
  setSetting: (enforced: boolean) =>
    apiClient.patch<{ message: string; enforced: boolean }>(
      "/v1/service-professional-manage/grooming/settings",
      { enforced },
    ),
};

export const dispatcherApi = {
  /** GET /v1/admin/partners — service partners (professionals), filterable by onboarding status. */
  listPartners: (
    search?: string,
    // "BLOCKED" is not an onboarding stage — the server treats it as a filter
    // across all of them.
    status?: PartnerOnboardingStatus | "ALL" | "BLOCKED",
    categoryId?: number,
  ) =>
    apiClient.get<PartnerRow[]>(
      `/v1/admin/partners${toQueryString({
        search,
        status: status && status !== "ALL" ? status : undefined,
        categoryId,
      })}`,
    ),

  /** GET /v1/admin/partners/status-counts — partner counts per onboarding bucket. */
  partnerStatusCounts: () =>
    apiClient.get<PartnerStatusCounts>(`/v1/admin/partners/status-counts`),

  /** GET /v1/admin/wallets — partner wallet balances. */
  listWallets: (search?: string, status?: string) =>
    apiClient.get<WalletListResponse>(
      `/v1/admin/wallets${toQueryString({ search, status })}`,
    ),

  /** GET /v1/admin/partners/:id — a single partner's full profile. */
  getPartner: (professionalId: number) =>
    apiClient.get<PartnerDetail>(`/v1/admin/partners/${professionalId}`),

  /** POST /v1/admin/partners — register a partner exactly like first-time app
   *  signup (multipart: photo required, KYC docs optional). */
  createPartner: (fd: FormData) =>
    uploadFile<{ message: string; professionalId: number | null }>(
      "/v1/admin/partners",
      fd,
    ),

  /** GET /v1/admin/partners/import-template — the CSV an admin fills in. */
  partnerImportTemplate: () =>
    downloadFile("/v1/admin/partners/import-template"),

  /** POST /v1/admin/partners/import — bulk-register partners from a filled
   *  sheet. Rows are independent, so the result lists every failure by row. */
  importPartners: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<PartnerImportResult>("/v1/admin/partners/import", fd);
  },

  /** GET /v1/admin/partners/:id/activity — active hours, login session logs and
   *  a daily breakdown for the weekly/monthly report. */
  getPartnerActivity: (professionalId: number, period?: "week" | "month") =>
    apiClient.get<PartnerActivity>(
      `/v1/admin/partners/${professionalId}/activity${toQueryString({ period })}`,
    ),

  /** PATCH /v1/admin/partners/:id — edit a partner's basic profile. */
  updatePartner: (professionalId: number, body: UpdatePartnerInput) =>
    apiClient.patch<{ message: string }>(
      `/v1/admin/partners/${professionalId}`,
      body,
    ),

  /**
   * PATCH /v1/admin/partners/:id/documents — replace one KYC document.
   *
   * One field at a time: the API only touches what it receives, so replacing a
   * blurred Aadhaar never disturbs the licence next to it.
   */
  updatePartnerDocument: (
    professionalId: number,
    field: PartnerDocumentField,
    file: File,
  ) => {
    const fd = new FormData();
    fd.append(field, file);
    return uploadFile<{ message: string }>(
      `/v1/admin/partners/${professionalId}/documents`,
      fd,
      "PATCH",
    );
  },

  /** PATCH /v1/admin/partners/:id/block — block or unblock a partner. */
  setPartnerBlocked: (professionalId: number, isBlocked: boolean) =>
    apiClient.patch<{ message: string; isBlocked: boolean }>(
      `/v1/admin/partners/${professionalId}/block`,
      { isBlocked },
    ),

  /** PATCH /v1/admin/partners/:id/onboarding — verify / activate / reject a partner. */
  setPartnerOnboarding: (
    professionalId: number,
    status: PartnerOnboardingStatus,
    reason?: string,
  ) =>
    apiClient.patch<{
      message: string;
      onboardingStatus: PartnerOnboardingStatus;
    }>(`/v1/admin/partners/${professionalId}/onboarding`, { status, reason }),

  /** GET /v1/admin/partners/:id/earnings — lifetime money + job history. */
  getPartnerEarnings: (professionalId: number) =>
    apiClient.get<PartnerEarnings>(
      `/v1/admin/partners/${professionalId}/earnings`,
    ),
  /** Every lead this partner was offered, and what they did with each. */
  getPartnerLeadActivity: (
    professionalId: number,
    params: { page?: number; limit?: number } = {},
  ) =>
    apiClient.get<PartnerLeadActivity>(
      `/v1/admin/partners/${professionalId}/lead-activity${toQueryString(params)}`,
    ),
  /** Who this booking's lead reached, and what each of them did with it. */
  getBookingLeadActivity: (bookingId: number) =>
    apiClient.get<BookingLeadActivity>(
      `/v1/admin/bookings/${bookingId}/lead-activity`,
    ),

  /** DELETE /v1/admin/partners/:id — remove a partner. */
  deletePartner: (professionalId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/partners/${professionalId}`,
    ),

  /** POST /v1/admin/wallets/:id/credit — add balance to a partner's wallet. */
  creditWallet: (
    professionalId: number,
    amount: number,
    description?: string,
  ) =>
    apiClient.post<unknown>(`/v1/admin/wallets/${professionalId}/credit`, {
      amount,
      description,
    }),

  /** POST /v1/admin/wallets/:id/debit — deduct balance from a partner's wallet. */
  debitWallet: (professionalId: number, amount: number, description?: string) =>
    apiClient.post<unknown>(`/v1/admin/wallets/${professionalId}/debit`, {
      amount,
      description,
    }),

  /** GET /v1/admin/payouts — partner payout requests, filterable by status. */
  listPayouts: (search?: string, status?: PayoutStatus | "ALL") =>
    apiClient.get<PayoutRequestRow[]>(
      `/v1/admin/payouts${toQueryString({
        search,
        status: status && status !== "ALL" ? status : undefined,
      })}`,
    ),

  /** GET /v1/admin/payouts/status-counts — payout counts per status bucket. */
  payoutStatusCounts: () =>
    apiClient.get<PayoutStatusCounts>(`/v1/admin/payouts/status-counts`),

  /** PATCH /v1/admin/payouts/:id/approve — approve a payout (debits the wallet). */
  approvePayout: (payoutRequestId: number, note?: string) =>
    apiClient.patch<{ payoutRequestId: number; status: PayoutStatus }>(
      `/v1/admin/payouts/${payoutRequestId}/approve`,
      { note },
    ),

  /** PATCH /v1/admin/payouts/:id/reject — reject a payout (with a reason). */
  rejectPayout: (payoutRequestId: number, reason?: string) =>
    apiClient.patch<{ payoutRequestId: number; status: PayoutStatus }>(
      `/v1/admin/payouts/${payoutRequestId}/reject`,
      { reason },
    ),
};

/* ------------------------- Partner referrals ---------------------------- */

export interface ReferralSettings {
  settingId: number;
  /** Master switch — when false, no referral rewards are paid. */
  enabled: boolean;
  /** ₹ credited to the referrer on the referee's first completed booking. */
  rewardAmount: number;
  updatedAt: string;
}

export interface ReferralRow {
  /** The referred (new) partner. */
  professionalId: number;
  name: string;
  mobile: string | null;
  onboardingStatus: PartnerOnboardingStatus;
  joinedAt: string;
  completedBookings: number;
  /** The partner who referred them. */
  referrer: {
    professionalId: number;
    name: string;
    referralCode: string | null;
  } | null;
  /** PENDING until the referee completes their first booking. */
  status: "PENDING" | "REWARDED";
  rewardedAt: string | null;
}

export const referralApi = {
  /** GET /v1/admin/referrals/settings — the referral program config. */
  settings: () =>
    apiClient.get<ReferralSettings>("/v1/admin/referrals/settings"),

  /** PATCH /v1/admin/referrals/settings — enable/disable + reward amount. */
  updateSettings: (body: { enabled?: boolean; rewardAmount?: number }) =>
    apiClient.patch<ReferralSettings>("/v1/admin/referrals/settings", body),

  /** GET /v1/admin/referrals — referred partners + reward status. */
  list: (search?: string) =>
    apiClient.get<ReferralRow[]>(
      `/v1/admin/referrals${toQueryString({ search })}`,
    ),
};

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

/* ------------------------------ Customers ------------------------------- */

export interface CustomerRow {
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  restaurantName: string | null;
  profileImage: string | null;
  /** Admin block flag — a blocked customer cannot log in. */
  isBlocked: boolean;
  bookingsCount: number;
  addressCount: number;
  joinedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  /** 10-digit mobile number (used for the customer's OTP login). */
  mobile: string;
  email?: string;
  restaurantName?: string;
  gstNumber?: string;
}

export interface CustomerAddress {
  id: number;
  label: string | null;
  address: string;
  city: string;
  state: string | null;
  zipCode: string;
  country: string | null;
  isDefault: boolean;
}

export interface CustomerBooking {
  id: string;
  service: string;
  variant: string | null;
  amount: number;
  status: "Completed" | "Pending" | "Cancelled";
  paymentMode: string;
  date: string;
}

export interface CustomerDetail {
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  dob: string | null;
  gstNumber: string | null;
  restaurantName: string | null;
  profileImage: string | null;
  /** Admin block flag — a blocked customer cannot log in. */
  isBlocked: boolean;
  joinedAt: string;
  stats: {
    totalBookings: number;
    completed: number;
    cancelled: number;
    totalSpent: number;
  };
  addresses: CustomerAddress[];
  bookings: CustomerBooking[];
}

/** A coupon every customer may redeem once, priced as a fixed total. */
/**
 * PUBLIC = every customer sees it; PRIVATE = only the customers on its list;
 * UNLISTED = shown to nobody, but anyone who types the code can use it.
 */
export type CouponVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

/** A customer on a private coupon's list. */
export interface CouponAudienceMember {
  userId: number;
  name: string;
  mobile: string | null;
}

export interface CampaignCoupon {
  couponId: number;
  code: string;
  description: string;
  /** Nobody wrote the description — it is generated from the terms and follows them. */
  descriptionIsAuto: boolean;
  discountType: "PERCENT" | "FLAT_TOTAL";
  /** For PERCENT: percentage off; null for a fixed-total coupon. */
  discountPercent: number | null;
  /** What the customer pays in total, GST included. */
  flatTotal: number | null;
  /** For PERCENT: the most it takes off, in ₹ (GST included); null = no cap. */
  maxDiscount: number | null;
  /** The booking must come to at least this much (GST included); null = any. */
  minOrderAmount: number | null;
  visibility: CouponVisibility;
  /** Service categories it is good for; empty = every category. */
  categoryIds: number[];
  categories: { categoryId: number; name: string }[];
  audienceCount: number;
  audience: CouponAudienceMember[];
  validTill: string;
  isActive: boolean;
  maxRedemptions: number | null;
  /** How many times one customer may use it; 1 = once each. */
  usesPerCustomer: number;
  /** The offer's picture, if one was uploaded. */
  imageUrl: string | null;
  imagePublicId: string | null;
  /** Offered only to customers who have never booked. */
  firstOrderOnly: boolean;
  /** Only redeemable when the customer pays online, never on COD. */
  prepaidOnly: boolean;
  redemptions: number;
  status: "ACTIVE" | "DISABLED" | "EXPIRED" | "EXHAUSTED";
  createdAt: string;
}

/** Everything an admin can set on a campaign coupon. */
export interface CampaignCouponRules {
  discountType?: "PERCENT" | "FLAT_TOTAL";
  discountPercent?: number;
  flatTotal?: number;
  maxDiscount?: number | null;
  minOrderAmount?: number | null;
  visibility?: CouponVisibility;
  categoryIds?: number[];
  /** For PRIVATE: replaces the whole list. */
  userIds?: number[];
  description?: string;
  maxRedemptions?: number;
  usesPerCustomer?: number;
  /** From uploadCampaignImage; null removes the picture. */
  imageUrl?: string | null;
  imagePublicId?: string | null;
  firstOrderOnly?: boolean;
  prepaidOnly?: boolean;
}

export interface AdminCoupon {
  couponId: number;
  code: string;
  description: string;
  discountPercent: number;
  source: "SIGNUP" | "ADMIN";
  isApplied: boolean;
  isUsed: boolean;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  status: "ACTIVE" | "USED" | "EXPIRED";
}

export const customersApi = {
  /** GET /v1/admin/customers — all customers (USER accounts). */
  list: (search?: string) =>
    apiClient.get<CustomerRow[]>(
      `/v1/admin/customers${toQueryString({ search })}`,
    ),

  /** GET /v1/admin/customers/:id — a single customer's full profile. */
  get: (userId: number) =>
    apiClient.get<CustomerDetail>(`/v1/admin/customers/${userId}`),

  /** GET /v1/admin/customers/:id/coupons — every coupon the customer holds. */
  coupons: (userId: number) =>
    apiClient.get<AdminCoupon[]>(`/v1/admin/customers/${userId}/coupons`),

  /** GET /v1/admin/coupons/campaigns — coupons any customer may redeem once. */
  campaigns: () =>
    apiClient.get<CampaignCoupon[]>("/v1/admin/coupons/campaigns"),

  /** POST /v1/admin/coupons/campaigns — create one (20% off up to ₹300, pay ₹1, a private code…). */
  createCampaign: (
    body: CampaignCouponRules & { code: string; validTill: string },
  ) => apiClient.post<CampaignCoupon>("/v1/admin/coupons/campaigns", body),

  /** PATCH /v1/admin/coupons/campaigns/:id — change terms, audience, categories, validity or status. */
  updateCampaign: (
    couponId: number,
    body: CampaignCouponRules & { isActive?: boolean; validTill?: string },
  ) =>
    apiClient.patch<CampaignCoupon>(
      `/v1/admin/coupons/campaigns/${couponId}`,
      body,
    ),

  /** POST /v1/admin/coupons/campaigns/image — upload a coupon picture; save its URL on the coupon. */
  uploadCampaignImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<{ url: string; publicId: string }>(
      "/v1/admin/coupons/campaigns/image",
      fd,
    );
  },

  /** DELETE /v1/admin/coupons/campaigns/:id/audience/:userId — take one customer off a private list. */
  removeCampaignAudience: (couponId: number, userId: number) =>
    apiClient.delete<CampaignCoupon>(
      `/v1/admin/coupons/campaigns/${couponId}/audience/${userId}`,
    ),

  /** POST /v1/admin/customers/:id/coupons — grant N one-time 50%-off coupons. */
  grantCoupons: (userId: number, count: number) =>
    apiClient.post<{ issued: number; coupons: AdminCoupon[] }>(
      `/v1/admin/customers/${userId}/coupons`,
      { count },
    ),

  /** POST /v1/admin/customers — create a customer (USER account). */
  create: (body: CreateCustomerInput) =>
    apiClient.post<CustomerRow>("/v1/admin/customers", body),

  /** PATCH /v1/admin/customers/:id/block — block or unblock a customer. */
  setBlocked: (userId: number, isBlocked: boolean) =>
    apiClient.patch<{ message: string; isBlocked: boolean }>(
      `/v1/admin/customers/${userId}/block`,
      { isBlocked },
    ),

  /** DELETE /v1/admin/customers/:id — permanently delete a customer + their data. */
  remove: (userId: number) =>
    apiClient.delete<{ message: string }>(`/v1/admin/customers/${userId}`),
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

/* ============================== Vendors ================================= */

export type VendorStatus = "ACTIVE" | "AWAITING_APPROVAL" | "BLOCKED";

export interface Vendor {
  vendorId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  icon: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: number | null;
  isOpen: boolean;
  status: VendorStatus;
  offersServices: boolean;
  canAddCategory: boolean;
  commissionPercentage: number;
  createdAt: string;
  updatedAt: string;
  servicesCount: number;
}

export interface VendorListResponse {
  vendors: Vendor[];
  stats: {
    totalVendors: number;
    openVendors: number;
    totalServices: number;
    activeVendors: number;
  };
  tabs: { active: number; awaitingApproval: number; blocked: number };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VendorInput {
  name: string;
  email?: string;
  mobile?: string;
  icon?: string;
  description?: string;
  address?: string;
  city?: string;
  isOpen?: boolean;
  status?: VendorStatus;
  offersServices?: boolean;
  canAddCategory?: boolean;
  commissionPercentage?: number;
}

export interface VendorListParams {
  status?: VendorStatus;
  search?: string;
}

function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}

export interface VendorWithCategory extends Vendor {
  category?: { categoryId: number; name: string } | null;
}

export const vendorApi = {
  list: (params: VendorListParams = {}) =>
    apiClient.get<VendorListResponse>(
      `/v1/vendor${toQueryString({ status: params.status, search: params.search })}`,
    ),
  get: (id: number) => apiClient.get<VendorWithCategory>(`/v1/vendor/${id}`),
  create: (body: VendorInput) => apiClient.post<Vendor>("/v1/vendor", body),
  update: (id: number, body: Partial<VendorInput>) =>
    apiClient.patch<Vendor>(`/v1/vendor/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/vendor/${id}`),
};

/* ============================= Categories =============================== */

export interface Category {
  categoryId: number;
  name: string;
}

export interface CategoryInput {
  name: string;
  description?: string;
  /** Parent category id; omit/0 for a top-level category. */
  parentId?: number | null;
  /** Square icon image — required on create, optional on update. */
  image?: File | null;
  /** Wide banner image shown on the category page — optional. */
  banner?: File | null;
  /** Banner video shown on the category page — optional. */
  video?: File | null;
}

function categoryFormData(body: CategoryInput): FormData {
  const fd = new FormData();
  fd.append("name", body.name);
  if (body.description) fd.append("description", body.description);
  if (body.parentId != null) fd.append("parentId", String(body.parentId));
  if (body.image) fd.append("catagoryImage", body.image);
  if (body.banner) fd.append("bannerImage", body.banner);
  if (body.video) fd.append("bannerVideo", body.video);
  return fd;
}

export const categoryApi = {
  // GET /v1/catagories (public) — returns the full category tree.
  list: () => apiClient.get<Category[]>("/v1/catagories"),

  /** POST /v1/catagories/create-categories — multipart, image required. */
  create: (body: CategoryInput) =>
    uploadFile<CategoryTreeNode>(
      "/v1/catagories/create-categories",
      categoryFormData(body),
    ),

  /** PATCH /v1/catagories/:id — multipart, image optional. */
  update: (id: number, body: CategoryInput) =>
    uploadFile<CategoryTreeNode>(
      `/v1/catagories/${id}`,
      categoryFormData(body),
      "PATCH",
    ),

  /** DELETE /v1/catagories/service-categories/:id */
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/catagories/service-categories/${id}`,
    ),

  /** PATCH /v1/catagories/reorder — persist admin drag-and-drop order so the
   *  web storefront and customer app show categories in the same sequence. */
  reorder: (ids: number[]) =>
    apiClient.patch<{ message: string; count: number }>(
      "/v1/catagories/reorder",
      { ids },
    ),

  /** PATCH /v1/catagories/:id/publish — publish or unpublish a category.
   *  Unpublished categories still appear on the storefront but as "Coming soon". */
  setPublished: (id: number, isPublished: boolean) =>
    apiClient.patch<CategoryTreeNode>(`/v1/catagories/${id}/publish`, {
      isPublished,
    }),
};

/* ====================== Services (catalog) & variants =================== */

export interface ServiceVariant {
  variantId: number;
  serviceId: number;
  name: string;
  price: number;
  durationMinutes: number | null;
  profileImage: string | null;
}

export interface CatalogService {
  serviceId: number;
  name: string;
  description: string | null;
  basePrice: number | null;
  categoryId: number;
  vendorId: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  isFeatured: boolean;
  profileImage: string | null;
  createdAt: string;
  category?: { categoryId: number; name: string } | null;
  vendor?: { vendorId: number; name: string } | null;
  variantsCount?: number;
  variants?: ServiceVariant[];
}

export interface ServiceListResponse {
  services: CatalogService[];
  stats: {
    totalServices: number;
    publishedServices: number;
    featuredServices: number;
    newServices: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ServiceVariantInput {
  name: string;
  price: number;
  durationMinutes?: number;
}

export interface ServiceInput {
  name: string;
  categoryId: number;
  vendorId?: number;
  description?: string;
  basePrice?: number;
  durationMinutes?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  profileImage?: string;
  variants?: ServiceVariantInput[];
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
  message: string;
}

export interface ServiceListParams {
  vendorId?: number;
  categoryId?: number;
  search?: string;
  /** The backend defaults to 50 per page — pass a higher limit to show a whole
   *  catalog (a category can hold 100+ services). */
  limit?: number;
  page?: number;
}

export const serviceApi = {
  list: (params: ServiceListParams = {}) =>
    apiClient.get<ServiceListResponse>(
      `/v1/service${toQueryString({
        vendorId: params.vendorId,
        categoryId: params.categoryId,
        search: params.search,
        limit: params.limit,
        page: params.page,
      })}`,
    ),
  get: (id: number) => apiClient.get<CatalogService>(`/v1/service/${id}`),
  create: (body: ServiceInput) =>
    apiClient.post<CatalogService>("/v1/service", body),
  update: (id: number, body: Partial<ServiceInput>) =>
    apiClient.patch<CatalogService>(`/v1/service/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/service/${id}`),

  /** POST /v1/service/:id/image — multipart image upload to Cloudinary. */
  uploadImage: (id: number, image: File) => {
    const fd = new FormData();
    fd.append("serviceImage", image);
    return uploadFile<CatalogService>(`/v1/service/${id}/image`, fd);
  },

  listVariants: (serviceId: number) =>
    apiClient.get<{ variants: ServiceVariant[] }>(
      `/v1/service/${serviceId}/variants`,
    ),
  addVariant: (serviceId: number, body: ServiceVariantInput) =>
    apiClient.post<ServiceVariant>(`/v1/service/${serviceId}/variants`, body),
  removeVariant: (variantId: number) =>
    apiClient.delete<{ message: string }>(`/v1/service/variants/${variantId}`),

  import: (file: File, opts?: { vendorId?: number; categoryId?: number }) => {
    const fd = new FormData();
    fd.append("file", file);
    const qs = toQueryString({
      vendorId: opts?.vendorId,
      categoryId: opts?.categoryId,
    });
    return uploadFile<ImportResult>(`/v1/service/import${qs}`, fd);
  },
  downloadTemplate: () => downloadFile("/v1/service/import/template"),
};

/* ================== Category tree (public landing) ===================== */
/*
 * The public `/v1/catagories` endpoint returns the full storefront hierarchy:
 * category → groups (sub-categories) → services → variants. The landing page
 * is driven entirely from this, so no separate storefront/vendor API is needed.
 */

export interface CategoryTreeVariant {
  variantId: number;
  name: string;
  price: number;
  profileImage: string | null;
}

export interface CategoryTreeService {
  serviceId: number;
  name: string;
  description: string | null;
  price: number | null;
  durationMinutes: number | null;
  profileImage: string | null;
  /** When true, the service appears in the landing "Popular services" row. */
  isFeatured?: boolean;
  variants: CategoryTreeVariant[];
}

export interface CategoryTreeGroup {
  groupId: number;
  name: string;
  profileImage: string | null;
  services: CategoryTreeService[];
}

export interface CategoryTreeNode {
  categoryId: number;
  name: string;
  description: string | null;
  profileImage: string;
  /** Wide banner image shown on the category page (optional). */
  bannerImage?: string | null;
  /** Banner video shown on the category page (optional, takes priority over the image). */
  bannerVideo?: string | null;
  /** When false, the category shows as "Coming soon" on the storefront/customer app. */
  isPublished?: boolean;
  /**
   * Whether anyone can actually be dispatched for this category AT the
   * customer's location. Separate from isPublished: a category can be live
   * everywhere and still have nobody to serve this particular address. Absent
   * when the tree was fetched without coordinates, which means "don't know" —
   * treat it as available.
   */
  available?: boolean;
  comingSoon?: boolean;
  comingSoonMessage?: string | null;
  /** Services attached directly to this category (no sub-category). */
  services: CategoryTreeService[];
  groups: CategoryTreeGroup[];
}

export const categoryTreeApi = {
  /** GET /v1/catagories — full category → service → variant tree (public). */
  /**
   * The category tree. With coordinates the server also says which categories
   * can be served there — unserved ones come back flagged and with NO services
   * attached, so nothing is loaded for a category nobody could be sent to.
   */
  tree: (coords?: { lat: number; lng: number } | null) =>
    apiClient.get<CategoryTreeNode[]>(
      `/v1/catagories${coords ? toQueryString({ lat: coords.lat, lng: coords.lng }) : ""}`,
      { skipAuth: true },
    ),
};

/* ============================== Banners ================================= */

/** Where a banner is shown: the web storefront or the mobile app. */
export type BannerPlatform = "WEB" | "MOBILE" | "QC";

export interface Banner {
  bannerId: number;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  imagePublicId: string | null;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Defaults to WEB for banners created before the platform field existed. */
  platform?: BannerPlatform;
  createdAt: string;
  updatedAt: string;
}

export interface BannerInput {
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  platform?: BannerPlatform;
  /** Image file — required on create, optional on update. */
  image?: File | null;
}

/** Recommended banner image dimensions / size, per platform. */
export interface BannerSpec {
  width: number;
  height: number;
  minWidth: number;
  maxBytes: number;
  aspect: string;
  label: string;
}

export const BANNER_SPECS: Record<BannerPlatform, BannerSpec> = {
  // Web storefront hero — wide landscape.
  WEB: {
    width: 1920,
    height: 640,
    minWidth: 1200,
    maxBytes: 5 * 1024 * 1024,
    aspect: "3:1",
    label: "1920 × 640 px (3:1), max 5 MB",
  },
  // Mobile app banner — matches the app's full-width 2:1 hero.
  MOBILE: {
    width: 1080,
    height: 540,
    minWidth: 720,
    maxBytes: 5 * 1024 * 1024,
    aspect: "2:1",
    label: "1080 × 540 px (2:1), max 5 MB",
  },
  // Quick-commerce app hero carousel — same 2:1 full-width slides.
  QC: {
    width: 1080,
    height: 540,
    minWidth: 720,
    maxBytes: 5 * 1024 * 1024,
    aspect: "2:1",
    label: "1080 × 540 px (2:1), max 5 MB",
  },
};

/** Back-compat default spec (web). */
export const BANNER_SPEC = BANNER_SPECS.WEB;

function bannerFormData(body: BannerInput): FormData {
  const fd = new FormData();
  if (body.title !== undefined) fd.append("title", body.title);
  if (body.subtitle !== undefined) fd.append("subtitle", body.subtitle);
  if (body.linkUrl !== undefined) fd.append("linkUrl", body.linkUrl);
  if (body.isActive !== undefined) fd.append("isActive", String(body.isActive));
  if (body.sortOrder !== undefined)
    fd.append("sortOrder", String(body.sortOrder));
  if (body.platform !== undefined) fd.append("platform", body.platform);
  if (body.image) fd.append("bannerImage", body.image);
  return fd;
}

export const bannerApi = {
  /** GET /v1/banner — all banners (admin). */
  list: () => apiClient.get<Banner[]>("/v1/banner"),

  /** GET /v1/banner/active — active banners for a platform (public). */
  listActive: (platform?: BannerPlatform) =>
    apiClient.get<Banner[]>(
      `/v1/banner/active${platform ? toQueryString({ platform }) : ""}`,
      { skipAuth: true },
    ),

  /** POST /v1/banner — multipart, image required. */
  create: (body: BannerInput) =>
    uploadFile<Banner>("/v1/banner", bannerFormData(body)),

  /** PATCH /v1/banner/:id — multipart, image optional. */
  update: (id: number, body: BannerInput) =>
    uploadFile<Banner>(`/v1/banner/${id}`, bannerFormData(body), "PATCH"),

  /** DELETE /v1/banner/:id */
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/banner/${id}`),
};

/* =============================== Cart ==================================== */
/*
 * Guest-friendly cart. The backend uses an OptionalJwtAuthGuard, so for the
 * public storefront we identify the cart purely by a client-generated
 * `sessionId` (no customer login required). All calls skip auth so the
 * admin token is never attached to a shopper's cart.
 */

export interface CartItemData {
  id: number;
  serviceId: number;
  variantId: number | null;
  quantity: number;
  name: string;
  image: string | null;
  price: number;
  total: number;
  variantName: string | null;
}

export interface CartPriceSummary {
  itemTotal?: number;
  platformFee?: number;
  tax?: number;
  discount?: number;
  grandTotal?: number;
}

export interface CartResponse {
  id: number | null;
  items: CartItemData[];
  priceSummary: CartPriceSummary;
}

export interface AddToCartBody {
  serviceId: number;
  quantity?: number;
  variantId?: number;
  sessionId: string;
}

export interface UpdateCartBody {
  serviceId: number;
  variantId?: number | null;
  quantity: number;
  action: "increment" | "decrement";
}

export const cartApi = {
  /** GET /v1/manage-cart/get-cart?sessionId — full cart with price summary.
   *  NOT skipAuth: when a token is present the backend (OptionalJwtAuthGuard)
   *  prioritises the user's cart over the guest sessionId — essential after
   *  login/merge, when the guest cart no longer exists. */
  get: (sessionId: string) =>
    apiClient.get<CartResponse>(
      `/v1/manage-cart/get-cart${toQueryString({ sessionId })}`,
    ),

  /** POST /v1/manage-cart/merge — fold the guest cart (sessionId) into the
   *  logged-in user's cart. Requires the Bearer token (JwtAuthGuard). */
  merge: (sessionId: string) =>
    apiClient.post<{ message: string; cartId?: number }>(
      "/v1/manage-cart/merge",
      { sessionId },
    ),

  /** POST /v1/manage-cart/add — add a service (optionally a variant).
   *  NOT skipAuth: a logged-in user must add to their own cart (resolved via the
   *  token), while guests add to the sessionId cart. Keeps add + get consistent. */
  add: (body: AddToCartBody) =>
    apiClient.post<unknown>("/v1/manage-cart/add", body),

  /** PATCH /v1/manage-cart/update?cartId — change an item's quantity. */
  updateQuantity: (cartId: number, body: UpdateCartBody) =>
    apiClient.patch<unknown>(
      `/v1/manage-cart/update${toQueryString({ cartId })}`,
      body,
      { skipAuth: true },
    ),

  /** DELETE /v1/manage-cart/delete/:cartItemId — remove one line item. */
  deleteItem: (cartItemId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/manage-cart/delete/${cartItemId}`,
      { skipAuth: true },
    ),
};

/* =========================== Customer auth ============================== */
/*
 * The storefront customer signs in with a mobile number + OTP (the same flow as
 * the React Native app). This is distinct from the admin email/password login.
 * Responses are loosely shaped, so we normalize tokens + user out of them.
 */

export interface CustomerUser {
  id: string;
  name?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface CustomerAuthResult {
  success?: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  sessionId?: string;
  user?: CustomerUser;
  raw?: unknown;
}

export interface VerifyOtpRequest {
  otp_input: string;
  mobile: string;
  fcmToken: string;
  deviceId: string;
  platform: string;
}

/** Strip a country code / non-digits down to a bare 10-digit Indian number. */
export function normalizeMobileNumber(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.startsWith("91") && digitsOnly.length === 12) {
    return digitsOnly.slice(2);
  }
  return digitsOnly;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  const visited = new Set<Record<string, unknown>>();
  const queue: unknown[] = [value];
  const records: Record<string, unknown>[] = [];
  while (queue.length > 0) {
    const current = asRecord(queue.shift());
    if (!current || visited.has(current)) continue;
    visited.add(current);
    records.push(current);
    for (const key of [
      "data",
      "payload",
      "result",
      "tokens",
      "auth",
      "user",
      "profile",
      "booking",
    ]) {
      if (current[key] && typeof current[key] === "object")
        queue.push(current[key]);
    }
  }
  return records;
}

function pickString(
  records: Record<string, unknown>[],
  keys: string[],
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const v = record[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

function pickNumber(
  records: Record<string, unknown>[],
  keys: string[],
): number | undefined {
  for (const record of records) {
    for (const key of keys) {
      const v = record[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
        return Number(v);
    }
  }
  return undefined;
}

function pickBoolean(
  records: Record<string, unknown>[],
  keys: string[],
): boolean | undefined {
  for (const record of records) {
    for (const key of keys) {
      if (typeof record[key] === "boolean") return record[key] as boolean;
    }
  }
  return undefined;
}

function normalizeCustomerUser(
  records: Record<string, unknown>[],
): CustomerUser | undefined {
  for (const record of records) {
    const hasShape =
      ("id" in record ||
        "userId" in record ||
        "mobile" in record ||
        "phone" in record ||
        "email" in record) &&
      !("accessToken" in record) &&
      !("refreshToken" in record);
    if (!hasShape) continue;
    const idCandidate = record.id ?? record.userId ?? record._id;
    const id =
      typeof idCandidate === "string"
        ? idCandidate
        : typeof idCandidate === "number"
          ? String(idCandidate)
          : undefined;
    const mobile = pickString([record], ["mobile", "phone"]);
    const email = pickString([record], ["email"]);
    const name = pickString([record], ["name"]);
    if (!id && !mobile && !email) continue;
    return {
      ...record,
      id: id ?? mobile ?? email ?? "user",
      mobile,
      phone: mobile,
      email,
      name,
    };
  }
  return undefined;
}

function normalizeAuthResult(value: unknown): CustomerAuthResult {
  const records = collectRecords(value);
  return {
    success: pickBoolean(records, ["success", "ok"]),
    message: pickString(records, ["message", "msg"]),
    accessToken: pickString(records, ["accessToken", "access_token", "token"]),
    refreshToken: pickString(records, ["refreshToken", "refresh_token"]),
    sessionId: pickString(records, ["sessionId", "session_id"]),
    user: normalizeCustomerUser(records),
    raw: value,
  };
}

export const customerAuthApi = {
  /** POST /v1/auth/otp-generate-user — send an OTP to the mobile number. */
  generateOtp: (mobile: string) =>
    apiClient
      .post<unknown>(
        "/v1/auth/otp-generate-user",
        { mobile },
        { skipAuth: true },
      )
      .then(normalizeAuthResult),

  /** POST /v1/auth/resend-otp — re-send the OTP. */
  resendOtp: (mobile: string) =>
    apiClient
      .post<unknown>("/v1/auth/resend-otp", { mobile }, { skipAuth: true })
      .then(normalizeAuthResult),

  /** POST /v1/auth/otp-verify-user — verify the OTP, returns tokens + user. */
  verifyOtp: (body: VerifyOtpRequest) =>
    apiClient
      .post<unknown>("/v1/auth/otp-verify-user", body, { skipAuth: true })
      .then(normalizeAuthResult),

  /** POST /v1/auth/deleteAccountById — permanently delete the signed-in account. */
  deleteAccount: () => apiClient.post<unknown>("/v1/auth/deleteAccountById"),

  /**
   * POST /v1/auth/delete-account — self-service account deletion gated by OTP.
   * The caller first sends an OTP via `generateOtp`, then submits the mobile +
   * OTP here to permanently erase the account. No login/token required — this
   * powers the public /delete-account page linked from the Play Store listing.
   */
  deleteAccountWithOtp: (mobile: string, otpInput: string) =>
    apiClient
      .post<unknown>(
        "/v1/auth/delete-account",
        { mobile, otp_input: otpInput },
        { skipAuth: true },
      )
      .then(normalizeAuthResult),
};

/* ============================ User addresses ============================ */

export interface UserAddress {
  id?: number | string;
  addressId?: number | string;
  label: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface AddAddressPayload {
  label: string;
  address: string;
  city: string;
  zipCode?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export const userApi = {
  /** GET /v1/auth/user/:id/addresses — the user's saved addresses. */
  getAddresses: (userId: string | number) =>
    apiClient.get<unknown>(`/v1/auth/user/${userId}/addresses`),

  /** POST /v1/auth/user/:id/addresses — save a new address. */
  addAddress: (userId: string | number, payload: AddAddressPayload) =>
    apiClient.post<unknown>(`/v1/auth/user/${userId}/addresses`, payload),

  /** PATCH /v1/auth/user/:id/profile — update the customer's business profile
   *  (owner name, restaurant name, GST) captured at checkout. */
  updateProfile: (
    userId: string | number,
    payload: { name?: string; restaurantName?: string; gstNumber?: string },
  ) => apiClient.patch<unknown>(`/v1/auth/user/${userId}/profile`, payload),
};

/* =============================== Booking ================================ */

export interface AvailableSlot {
  id: string;
  label: string;
  startTime: string;
  endTime?: string;
  professionalId: number | null;
  professionalName?: string;
}

/** A customer's own coupon, as /v1/coupons returns it. */
export interface CustomerCoupon {
  couponId: number;
  code: string;
  description: string | null;
  discountPercent: number;
  isApplied: boolean;
  isUsed: boolean;
  expiresAt: string;
  /** Refused on cash on delivery — the customer must pay online to use it. */
  prepaidOnly?: boolean;
  /** FLAT_TOTAL fixes the whole bill; a percentage cannot express that. */
  discountType?: "PERCENT" | "FLAT_TOTAL";
  /** For FLAT_TOTAL: the total the customer pays, GST included. */
  flatTotal?: number | null;
}

/** Customer coupons — the same endpoints the mobile app uses. */
export const couponsApi = {
  list: () => apiClient.get<CustomerCoupon[]>("/v1/coupons"),
  apply: (couponCode: string) =>
    apiClient.post<CustomerCoupon>("/v1/coupons/apply", { couponCode }),
  remove: (couponId: number) =>
    apiClient.delete<{ message: string }>(`/v1/coupons/remove/${couponId}`),
};

export interface CreateBookingPayload {
  userId?: number;
  professionalId: number | null;
  serviceId: number;
  variantId: number | null;
  bookingDate: string;
  startTime: string;
  /** "HH:mm". Sent by the hourly flow; the admin create call has the same field. */
  endTime?: string;
  totalAmount: number;
  serviceLat: number;
  serviceLng: number;
  serviceCity: string;
  serviceAddress: string;
  paymentMode: string;
  /** Redeemed server-side on the booking it rides with (single use). */
  couponCode?: string;
}

export interface BookingSummary {
  bookingId: number;
  status: string;
  message?: string;
  raw?: unknown;
}

function normalizeBookingResponse(value: unknown): BookingSummary {
  const records = collectRecords(value);
  return {
    bookingId: pickNumber(records, ["bookingId", "id"]) ?? 0,
    status:
      pickString(records, ["status", "bookingStatus", "action"]) ?? "Pending",
    message: pickString(records, ["message", "msg"]),
    raw: value,
  };
}

/** The professional assigned to a booking (who accepted it). */
export interface BookingProfessional {
  professionalId?: number;
  rating?: number | null;
  user?: {
    name?: string | null;
    email?: string | null;
    mobile?: string | null;
  } | null;
}

/** A booking row as returned by GET /v1/booking/get (loosely shaped). */
export interface BookingRecord {
  bookingId?: number;
  id?: number;
  serviceId?: number;
  variantId?: number | null;
  serviceName?: string;
  variantName?: string | null;
  service?: {
    serviceId?: number;
    name?: string;
    profileImage?: string | null;
  } | null;
  variant?: { variantId?: number; name?: string } | null;
  professionalId?: number | null;
  professional?: BookingProfessional | null;
  bookingDate?: string;
  startTime?: string;
  totalAmount?: number;
  paymentMode?: string;
  status?: string;
  otpVerified?: boolean;
  /** Start code the customer reads out to the professional; sent while accepted. */
  otp?: string | number;
  createdAt?: string;
}

export interface UserBookingsResponse {
  bookings: BookingRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const bookingApi = {
  /** GET /v1/booking/get/slots — professional availability for a service+date. */
  getAvailableSlots: (params: {
    serviceId: number;
    variantId: number;
    date: string;
  }) =>
    apiClient.get<unknown>(
      `/v1/booking/get/slots${toQueryString({
        serviceId: params.serviceId,
        variantId: params.variantId,
        date: params.date,
      })}`,
    ),

  /** POST /v1/booking/book — create a booking for one cart item. */
  create: (payload: CreateBookingPayload) =>
    apiClient
      .post<unknown>("/v1/booking/book", payload)
      .then(normalizeBookingResponse),

  /** GET /v1/booking/get?userId — the signed-in customer's bookings. */
  listByUser: (userId: string | number, page = 1, limit = 50) =>
    apiClient.get<UserBookingsResponse>(
      `/v1/booking/get${toQueryString({ userId, page, limit })}`,
    ),

  /** POST /v1/booking/cancel — cancel a booking by id. */
  /** `reason` is required by the UI and stored on the booking for the admin panel. */
  cancel: (bookingId: number, reason?: string) =>
    apiClient
      .post<unknown>("/v1/booking/cancel", { bookingId, reason })
      .then(normalizeBookingResponse),
};

/* =============================== Payments =============================== */

export interface CreatedRazorpayOrder {
  id: string;
  amount: number; // in paise
  currency: string;
  receipt?: string;
  status?: string;
  keyId: string;
}

export interface VerifyRazorpayPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface VerifyRazorpayResult {
  success: boolean;
  message?: string;
  isValid?: boolean;
}

export const paymentsApi = {
  /** POST /v1/payments/create-order — amount in INR (backend converts to paise). */
  createOrder: (amount: number, currency = "INR") =>
    apiClient.post<CreatedRazorpayOrder>("/v1/payments/create-order", {
      amount,
      currency,
    }),

  /** POST /v1/payments/verify — verify the Razorpay signature server-side. */
  verify: (payload: VerifyRazorpayPayload) =>
    apiClient.post<VerifyRazorpayResult>("/v1/payments/verify", payload),
};

/* ==================== Dispatcher: dispatch domain ======================= */
/* Teams, geofences (polygon zones), warehouses, auto-allocation settings
   and delivery pricing rules — all under /v1/admin/dispatch. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Lightweight partner row shared by team + geofence pickers. */
export interface DispatchPartnerRow {
  professionalId: number;
  name: string;
  mobile: string | null;
  city: string | null;
  isOnline: boolean;
  profileImage: string | null;
  teamId: number | null;
}

export interface DispatchTeamRow {
  teamId: number;
  name: string;
  description: string | null;
  memberCount: number;
  geofenceCount: number;
  createdAt: string;
}

export interface DispatchTeamDetail {
  teamId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: DispatchPartnerRow[];
  geofences: {
    geofenceId: number;
    name: string;
    color: string;
    isActive: boolean;
  }[];
}

export interface GeofenceRow {
  geofenceId: number;
  name: string;
  description: string | null;
  color: string;
  polygon: LatLng[];
  isActive: boolean;
  team: { teamId: number; name: string } | null;
  partnerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceDetail {
  geofenceId: number;
  name: string;
  description: string | null;
  color: string;
  polygon: LatLng[];
  isActive: boolean;
  teamId: number | null;
  team: { teamId: number; name: string } | null;
  partners: DispatchPartnerRow[];
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceInput {
  name: string;
  description?: string;
  color?: string;
  polygon: LatLng[];
  /**
   * The team that covers this zone — a zone is scoped to a team, never to
   * individual service partners. null clears it; omit to leave it unchanged.
   */
  teamId?: number | null;
  isActive?: boolean;
}

export interface WarehouseRow {
  warehouseId: number;
  name: string;
  address: string;
  city: string | null;
  latitude: number;
  longitude: number;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInput {
  name: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  contactName?: string;
  contactPhone?: string;
  isActive?: boolean;
}

/** How auto-allocation pushes leads to eligible partners. */
export type AllocationMethod = "BROADCAST" | "NEAREST" | "ROUND_ROBIN";

export interface AllocationSettings {
  settingId: number;
  /** Master switch — when false, new bookings are not broadcast at all. */
  enabled: boolean;
  method: AllocationMethod;
  radiusKm: number;
  /** Partner cap per lead for NEAREST / ROUND_ROBIN; 0 = no cap. */
  maxAgents: number;
  /** Restrict leads to partners of the geofence covering the booking point. */
  restrictToGeofence: boolean;
  /** Apply the radius inside a zone too; off = a zone's team is trusted at any distance. */
  radiusInsideZone: boolean;
  /** Alarm partners whose profile has no GPS; off = the radius is strict. */
  includeUnlocatedPartners: boolean;
  /** Extra times an unaccepted lead is re-offered; 0 = broadcast once and stop. */
  leadRetryCount: number;
  /** Minutes to wait after a broadcast before re-offering. */
  leadRetryAfterMinutes: number;
  /** Metres a partner must be within to enter the OTP and start the job. */
  startRadiusMeters: number;
  /** Minutes the app may be silent before duty hours pause (duty status is untouched). */
  presenceStaleMinutes: number;
  /** The most one duty session can be worth, in hours. */
  dutySessionMaxHours: number;
  /** How many MORE times a lead rings each partner who has not answered; 0 = ring once. */
  leadRingRepeatCount: number;
  /** Seconds between repeat rings. */
  leadRingRepeatSeconds: number;
  updatedAt: string;
}

export interface PricingRuleRow {
  ruleId: number;
  name: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmFare: number;
  perMinuteFare: number;
  waitingFarePerMin: number;
  minFare: number | null;
  teamId: number | null;
  geofenceId: number | null;
  team: { teamId: number; name: string } | null;
  geofence: { geofenceId: number; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRuleInput {
  name: string;
  baseFare: number;
  baseDistanceKm?: number;
  perKmFare?: number;
  perMinuteFare?: number;
  waitingFarePerMin?: number;
  minFare?: number;
  teamId?: number | null;
  geofenceId?: number | null;
  isActive?: boolean;
}

export interface LivePartnerPoint {
  professionalId: number;
  name: string;
  mobile: string | null;
  city: string | null;
  lat: number;
  lng: number;
  teamId: number | null;
  geofenceId: number | null;
  zoneName: string | null;
  zoneColor: string | null;
}

export interface LivePartnerZone {
  geofenceId: number;
  name: string;
  color: string;
  polygon: LatLng[];
  /** The dispatch team assigned to this zone, if any. */
  team: { teamId: number; name: string } | null;
  activeCount: number;
}

export interface LivePartnersResponse {
  totalActive: number;
  unzonedCount: number;
  zones: LivePartnerZone[];
  partners: LivePartnerPoint[];
}

export const dispatchApi = {
  /** GET /v1/admin/dispatch/live-partners — active partners placed on their zone. */
  livePartners: () =>
    apiClient.get<LivePartnersResponse>(`/v1/admin/dispatch/live-partners`),

  /** GET /v1/admin/dispatch/teams — teams with member/geofence counts. */
  listTeams: (search?: string) =>
    apiClient.get<DispatchTeamRow[]>(
      `/v1/admin/dispatch/teams${toQueryString({ search })}`,
    ),

  /** GET /v1/admin/dispatch/teams/:id — a team with members and geofences. */
  getTeam: (teamId: number) =>
    apiClient.get<DispatchTeamDetail>(`/v1/admin/dispatch/teams/${teamId}`),

  /** POST /v1/admin/dispatch/teams — create a team. */
  createTeam: (body: { name: string; description?: string }) =>
    apiClient.post<DispatchTeamRow>(`/v1/admin/dispatch/teams`, body),

  /** PATCH /v1/admin/dispatch/teams/:id — rename / redescribe a team. */
  updateTeam: (teamId: number, body: { name?: string; description?: string }) =>
    apiClient.patch<DispatchTeamRow>(
      `/v1/admin/dispatch/teams/${teamId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/teams/:id — members/zones are unassigned, not deleted. */
  deleteTeam: (teamId: number) =>
    apiClient.delete<{ message: string }>(`/v1/admin/dispatch/teams/${teamId}`),

  /** PUT /v1/admin/dispatch/teams/:id/members — replace the full member list. */
  setTeamMembers: (teamId: number, professionalIds: number[]) =>
    apiClient.put<DispatchTeamDetail>(
      `/v1/admin/dispatch/teams/${teamId}/members`,
      {
        professionalIds,
      },
    ),

  /** GET /v1/admin/dispatch/geofences — zones with team + partner counts. */
  listGeofences: (search?: string) =>
    apiClient.get<GeofenceRow[]>(
      `/v1/admin/dispatch/geofences${toQueryString({ search })}`,
    ),

  /** GET /v1/admin/dispatch/geofences/:id — polygon, team and partners. */
  getGeofence: (geofenceId: number) =>
    apiClient.get<GeofenceDetail>(`/v1/admin/dispatch/geofences/${geofenceId}`),

  /** POST /v1/admin/dispatch/geofences — create a zone. */
  createGeofence: (body: GeofenceInput) =>
    apiClient.post<GeofenceDetail>(`/v1/admin/dispatch/geofences`, body),

  /** PATCH /v1/admin/dispatch/geofences/:id */
  updateGeofence: (geofenceId: number, body: Partial<GeofenceInput>) =>
    apiClient.patch<GeofenceDetail>(
      `/v1/admin/dispatch/geofences/${geofenceId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/geofences/:id */
  deleteGeofence: (geofenceId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/geofences/${geofenceId}`,
    ),

  /** GET /v1/admin/dispatch/warehouses */
  listWarehouses: (search?: string) =>
    apiClient.get<WarehouseRow[]>(
      `/v1/admin/dispatch/warehouses${toQueryString({ search })}`,
    ),

  /** POST /v1/admin/dispatch/warehouses */
  createWarehouse: (body: WarehouseInput) =>
    apiClient.post<WarehouseRow>(`/v1/admin/dispatch/warehouses`, body),

  /** PATCH /v1/admin/dispatch/warehouses/:id */
  updateWarehouse: (warehouseId: number, body: Partial<WarehouseInput>) =>
    apiClient.patch<WarehouseRow>(
      `/v1/admin/dispatch/warehouses/${warehouseId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/warehouses/:id */
  deleteWarehouse: (warehouseId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/warehouses/${warehouseId}`,
    ),

  /** GET /v1/admin/dispatch/allocation — the auto-allocation settings singleton. */
  getAllocationSettings: () =>
    apiClient.get<AllocationSettings>(`/v1/admin/dispatch/allocation`),

  /** PUT /v1/admin/dispatch/allocation — update the auto-allocation settings. */
  updateAllocationSettings: (
    body: Partial<Omit<AllocationSettings, "settingId" | "updatedAt">>,
  ) => apiClient.put<AllocationSettings>(`/v1/admin/dispatch/allocation`, body),

  /** GET /v1/admin/dispatch/pricing-rules */
  listPricingRules: () =>
    apiClient.get<PricingRuleRow[]>(`/v1/admin/dispatch/pricing-rules`),

  /** POST /v1/admin/dispatch/pricing-rules */
  createPricingRule: (body: PricingRuleInput) =>
    apiClient.post<PricingRuleRow>(`/v1/admin/dispatch/pricing-rules`, body),

  /** PATCH /v1/admin/dispatch/pricing-rules/:id */
  updatePricingRule: (ruleId: number, body: Partial<PricingRuleInput>) =>
    apiClient.patch<PricingRuleRow>(
      `/v1/admin/dispatch/pricing-rules/${ruleId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/pricing-rules/:id */
  deletePricingRule: (ruleId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/pricing-rules/${ruleId}`,
    ),
};

/* ============================ Query keys ================================ */

/* =============================== Tasks ================================= */

export type TaskStatus =
  "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskAssignee {
  employeeId: number;
  name: string;
  email?: string;
  designation: string | null;
  department?: { name: string } | null;
}

export interface TaskRow {
  taskId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeId: number;
  assignee: TaskAssignee;
  assignedBy: { userId: number; name: string | null } | null;
}

export interface TaskCommentRow {
  commentId: number;
  body: string;
  createdAt: string;
  author: { userId: number; name: string | null } | null;
}

export interface TaskActivityRow {
  activityId: number;
  type: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  note: string | null;
  createdAt: string;
  actor: { userId: number; name: string | null } | null;
}

export interface TaskAttachmentRow {
  attachmentId: number;
  url: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  uploadedBy: { userId: number; name: string | null } | null;
}

export interface TaskSubtaskRow {
  subtaskId: number;
  title: string;
  isDone: boolean;
}

export interface TaskDetail extends TaskRow {
  comments: TaskCommentRow[];
  activities: TaskActivityRow[];
  attachments: TaskAttachmentRow[];
  subtasks: TaskSubtaskRow[];
}

export interface TaskListResponse {
  tasks: TaskRow[];
  counts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AssignableEmployee {
  /** Null for a panel login that has no employee record yet. */
  employeeId: number | null;
  /** Set only when employeeId is null — assign by login instead. */
  userId: number | null;
  name: string;
  email: string;
  designation: string | null;
  department: { name: string } | null;
}

export interface TaskReport {
  group: "day" | "week" | "month";
  range: { from: string; to: string };
  summary: {
    total: number;
    byStatus: Record<string, number>;
    completed: number;
    pending: number;
    overdue: number;
  };
  leaderboard: {
    employeeId: number;
    name: string;
    designation: string | null;
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  }[];
  buckets: { period: string; assigned: number; completed: number }[];
}

export interface TaskListParams {
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type TaskRepeat = "DAILY" | "WEEKLY" | "MONTHLY";

export interface CreateTaskInput {
  title: string;
  description?: string;
  /** Employee to assign to. Use assigneeUserId for a login with no employee record. */
  assigneeId?: number;
  assigneeUserId?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  /** When the work should begin. */
  startDate?: string;
  dueDate?: string;
  isRepeating?: boolean;
  repeatEvery?: TaskRepeat;
  repeatUntil?: string;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export const taskApi = {
  /** GET /v1/tasks — management list (permission: tasks.view). */
  list: (params: TaskListParams = {}) =>
    apiClient.get<TaskListResponse>(
      `/v1/tasks${toQueryString({
        assigneeId: params.assigneeId,
        status: params.status,
        priority: params.priority,
        search: params.search,
        from: params.from,
        to: params.to,
        page: params.page,
        limit: params.limit,
      })}`,
    ),
  employees: (search?: string) =>
    apiClient.get<AssignableEmployee[]>(
      `/v1/tasks/employees${toQueryString({ search })}`,
    ),
  get: (taskId: number) => apiClient.get<TaskDetail>(`/v1/tasks/${taskId}`),
  create: (body: CreateTaskInput) => apiClient.post<TaskRow>("/v1/tasks", body),
  update: (taskId: number, body: UpdateTaskInput) =>
    apiClient.patch<TaskRow>(`/v1/tasks/${taskId}`, body),
  remove: (taskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/${taskId}`),
  addComment: (taskId: number, body: string) =>
    apiClient.post<TaskCommentRow>(`/v1/tasks/${taskId}/comments`, { body }),
  report: (
    params: {
      group?: "day" | "week" | "month";
      from?: string;
      to?: string;
      assigneeId?: number;
    } = {},
  ) =>
    apiClient.get<TaskReport>(
      `/v1/tasks/report${toQueryString({ ...params })}`,
    ),

  // Attachments (management side — permission: tasks.update).
  addAttachment: (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<TaskAttachmentRow>(`/v1/tasks/${taskId}/attachments`, fd);
  },
  removeAttachment: (attachmentId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/tasks/attachments/${attachmentId}`,
    ),

  // Subtasks (management side).
  addSubtask: (taskId: number, title: string) =>
    apiClient.post<TaskSubtaskRow>(`/v1/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (
    subtaskId: number,
    body: { title?: string; isDone?: boolean },
  ) => apiClient.patch<TaskSubtaskRow>(`/v1/tasks/subtasks/${subtaskId}`, body),
  removeSubtask: (subtaskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/subtasks/${subtaskId}`),

  /** Employee self-service (JWT-only). */
  myTasks: (status?: TaskStatus) =>
    apiClient.get<{
      employee: { employeeId: number; name: string };
      tasks: TaskRow[];
      counts: Record<string, number>;
    }>(`/v1/tasks/me${toQueryString({ status })}`),
  createMyTask: (body: Omit<CreateTaskInput, "assigneeId">) =>
    apiClient.post<TaskRow>("/v1/tasks/me", body),
  getMyTask: (taskId: number) =>
    apiClient.get<TaskDetail>(`/v1/tasks/me/${taskId}`),
  updateMyTask: (taskId: number, body: UpdateTaskInput) =>
    apiClient.patch<TaskRow>(`/v1/tasks/me/${taskId}`, body),
  updateMyStatus: (taskId: number, status: TaskStatus, note?: string) =>
    apiClient.patch<TaskRow>(`/v1/tasks/me/${taskId}/status`, { status, note }),
  addMyComment: (taskId: number, body: string) =>
    apiClient.post<TaskCommentRow>(`/v1/tasks/me/${taskId}/comments`, { body }),
  addMyAttachment: (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<TaskAttachmentRow>(
      `/v1/tasks/me/${taskId}/attachments`,
      fd,
    );
  },
  removeMyAttachment: (attachmentId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/tasks/me/attachments/${attachmentId}`,
    ),
  addMySubtask: (taskId: number, title: string) =>
    apiClient.post<TaskSubtaskRow>(`/v1/tasks/me/${taskId}/subtasks`, {
      title,
    }),
  updateMySubtask: (
    subtaskId: number,
    body: { title?: string; isDone?: boolean },
  ) =>
    apiClient.patch<TaskSubtaskRow>(`/v1/tasks/me/subtasks/${subtaskId}`, body),
  removeMySubtask: (subtaskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/me/subtasks/${subtaskId}`),
};

export const queryKeys = {
  me: ["auth", "me"] as const,
  tasks: (params: TaskListParams) => ["tasks", params] as const,
  task: (id: number) => ["task", id] as const,
  taskEmployees: (search: string) => ["task-employees", search] as const,
  taskReport: (params: Record<string, unknown>) =>
    ["task-report", params] as const,
  myTasks: (status: string) => ["my-tasks", status] as const,
  dashboardOverview: ["dashboard", "overview"] as const,
  analytics: (range: string, from?: string, to?: string) =>
    ["dashboard", "analytics", range, from ?? "", to ?? ""] as const,
  adminBookings: (params: AdminBookingListParams) =>
    ["admin-bookings", params] as const,
  partners: (search: string, status: string, categoryId?: number) =>
    ["dispatcher", "partners", status, search, categoryId ?? "all"] as const,
  partnerStatusCounts: ["dispatcher", "partners", "status-counts"] as const,
  partnerEarnings: (professionalId: number) =>
    ["dispatcher", "partner", professionalId, "earnings"] as const,
  partner: (id: number) => ["dispatcher", "partner", id] as const,
  partnerWallets: (search: string, status?: string) =>
    ["dispatcher", "wallets", search, status ?? "ALL"] as const,
  payouts: (search: string, status: string) =>
    ["dispatcher", "payouts", status, search] as const,
  payoutStatusCounts: ["dispatcher", "payouts", "status-counts"] as const,
  referralSettings: ["dispatcher", "referrals", "settings"] as const,
  referrals: (search: string) => ["dispatcher", "referrals", search] as const,
  dispatchTeams: (search: string) => ["dispatcher", "teams", search] as const,
  dispatchTeam: (id: number) => ["dispatcher", "team", id] as const,
  livePartners: ["dispatcher", "live-partners"] as const,
  geofences: (search: string) => ["dispatcher", "geofences", search] as const,
  geofence: (id: number) => ["dispatcher", "geofence", id] as const,
  warehouses: (search: string) => ["dispatcher", "warehouses", search] as const,
  allocationSettings: ["dispatcher", "allocation"] as const,
  pricingRules: ["dispatcher", "pricing-rules"] as const,
  customers: (search: string) => ["customers", search] as const,
  customer: (id: number) => ["customer", id] as const,
  customerCoupons: (id: number) => ["customer", id, "coupons"] as const,
  vendors: (params: VendorListParams) => ["vendors", params] as const,
  vendor: (id: number) => ["vendor", id] as const,
  categories: ["categories"] as const,
  services: (params: ServiceListParams) => ["services", params] as const,
  categoryTree: ["categoryTree"] as const,
  /** Location-scoped tree: a Delhi answer must never be reused in Mumbai. */
  categoryTreeAt: (coords?: { lat: number; lng: number } | null) =>
    [
      "categoryTree",
      coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : "all",
    ] as const,
  banners: ["banners"] as const,
  bannersActive: ["banners", "active"] as const,
  cart: (sessionId: string) => ["cart", sessionId] as const,
  userAddresses: (userId: string | number) => ["addresses", userId] as const,
  userBookings: (userId: string | number) =>
    ["bookings", "user", userId] as const,
  contactSubmissions: (search: string) => ["contacts", search] as const,
  configure: ["configure"] as const,
  auraOverview: ["aura", "overview"] as const,
  auraUsers: (params: Record<string, unknown>) =>
    ["aura", "users", params] as const,
  auraUser: (userId: number) => ["aura", "user", userId] as const,
  auraCatalog: (params: Record<string, unknown>) =>
    ["aura", "catalog", params] as const,
  auraScoreRules: ["aura", "score-rules"] as const,
  auraSettings: ["aura", "settings"] as const,
};

/* ========================= Contact Enquiries ============================ */

export type ContactStatus = "UNREAD" | "READ" | "RESOLVED";

export interface ContactSubmission {
  enquiryId: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
  user?: {
    userId: number;
    name: string | null;
    email: string | null;
    mobile: string | null;
    restaurantName: string | null;
  } | null;
}

export interface ContactSubmitRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export const contactApi = {
  /** POST /v1/contact — public endpoint, no auth required. */
  submit: (body: ContactSubmitRequest) =>
    apiClient.post<{ message: string }>("/v1/contact", body, {
      skipAuth: true,
    }),

  /** GET /v1/admin/contact — admin only, lists all submissions. */
  list: (search?: string) =>
    apiClient.get<ContactSubmission[]>(
      `/v1/admin/contact${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),

  /** PATCH /v1/admin/contact/:id — update status (READ / RESOLVED). */
  updateStatus: (id: number, status: ContactStatus) =>
    apiClient.patch<{ message: string; data: ContactSubmission }>(
      `/v1/admin/contact/${id}`,
      { status },
    ),
};

/* ============================== CRM / HR ================================ */
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
  | "SELECTED_CUSTOMERS";
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

/* ============================ WhatsApp inbox ============================ */

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

/* ------------------------------- RBAC ---------------------------------- */

export interface RbacRoleRow {
  roleId: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** Shipped with the product rather than created here — hidden by default. */
  isSeeded?: boolean;
  userCount?: number;
  permissions: string[];
  createdAt: string;
}

export interface PermissionCatalogEntry {
  module: string;
  actions: string[];
  keys: string[];
}

export interface StaffRow {
  userId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  createdAt: string;
  roles: { roleId: number; name: string }[];
  employee: {
    employeeId: number;
    employeeCode: string;
    designation: string | null;
  } | null;
}

export type NotificationCategory =
  "POLICY" | "ATTENDANCE" | "SHIFT" | "LEAVE" | "GENERAL";

export interface NotificationRow {
  notificationId: number;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The bell. Every route is scoped to the signed-in user's own feed. */
export const notificationsApi = {
  list: (limit = 30) =>
    apiClient.get<{ notifications: NotificationRow[]; unreadCount: number }>(
      `/v1/notifications?limit=${limit}`,
    ),
  unreadCount: () =>
    apiClient.get<{ unreadCount: number }>("/v1/notifications/unread-count"),
  markRead: (id: number) =>
    apiClient.patch<NotificationRow>(`/v1/notifications/${id}/read`, {}),
  markAllRead: () =>
    apiClient.patch<{ message: string; count: number }>(
      "/v1/notifications/read-all",
      {},
    ),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/notifications/${id}`),
};

export const rbacApi = {
  permissionCatalog: () =>
    apiClient.get<PermissionCatalogEntry[]>("/v1/rbac/permissions"),
  myPermissions: () => apiClient.get<string[]>("/v1/rbac/me/permissions"),
  roles: () => apiClient.get<RbacRoleRow[]>("/v1/rbac/roles"),
  createRole: (body: {
    name: string;
    description?: string;
    permissions?: string[];
  }) => apiClient.post<RbacRoleRow>("/v1/rbac/roles", body),
  updateRole: (
    id: number,
    body: { name?: string; description?: string; permissions?: string[] },
  ) => apiClient.patch<RbacRoleRow>(`/v1/rbac/roles/${id}`, body),
  deleteRole: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/rbac/roles/${id}`),
  staff: () => apiClient.get<StaffRow[]>("/v1/rbac/staff"),
  createStaff: (body: {
    name: string;
    email: string;
    mobile?: string;
    password: string;
    roleIds?: number[];
  }) =>
    apiClient.post<{ userId: number; message: string }>("/v1/rbac/staff", body),
  updateStaff: (
    userId: number,
    body: {
      name?: string;
      mobile?: string;
      password?: string;
      roleIds?: number[];
    },
  ) => apiClient.patch<{ message: string }>(`/v1/rbac/staff/${userId}`, body),
  deleteStaff: (userId: number) =>
    apiClient.delete<{ message: string }>(`/v1/rbac/staff/${userId}`),
};

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

/* ============================ Resume builder ============================ */
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

/* ============================== PDF AI ================================= */
// Gemini-vision analysis for the PDF editor tool: OCR + typography of a
// cropped page region, so edits can match font, color, slant and aging.

export interface PdfRegionAnalysis {
  text: string;
  fontCategory: "sans" | "serif" | "mono";
  fontName: string;
  bold: boolean;
  italic: boolean;
  slantDegrees: number;
  colorHex: string;
  backgroundHex: string;
  aged: boolean;
  blur: "none" | "slight" | "strong";
}

export const pdfAiApi = {
  /** POST /v1/pdf-ai/analyze — image is a PNG/JPEG data URL of the cropped region. */
  analyze: (image: string) =>
    apiClient.post<PdfRegionAnalysis>("/v1/pdf-ai/analyze", { image }),
};

/* ============================== AI Tutor ================================ */
// The animated speaking teacher behind the admin panel's AI Tutor tab.
// `ask` returns a spoken-style plain-text answer; `speak` returns Gemini TTS
// audio as base64 PCM (mimeType carries the sample rate, e.g. rate=24000).

export interface TutorTurn {
  role: "user" | "tutor";
  text: string;
}

export type TutorSpeechLang = "hi-IN" | "en-IN";

// Whiteboard scene primitives — mirrors the backend sanitizer's whitelist.
// Coordinates: x 0-100 (left→right), y 0-75 (top→bottom); drawing is
// cumulative across steps.
export type TutorVisualColor = "ink" | "gold" | "sky" | "rose" | "mint";
export type TutorVisualItem =
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      color: TutorVisualColor;
    }
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: TutorVisualColor;
      dashed: boolean;
    }
  | {
      type: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: TutorVisualColor;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      r: number;
      color: TutorVisualColor;
      fill: boolean;
    }
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: TutorVisualColor;
      fill: boolean;
    }
  | {
      type: "polygon";
      points: [number, number][];
      color: TutorVisualColor;
      fill: boolean;
    }
  | { type: "polyline"; points: [number, number][]; color: TutorVisualColor }
  | { type: "point"; x: number; y: number; label: string }
  | {
      type: "number-line";
      y: number;
      from: number;
      to: number;
      highlights: number[];
    }
  | {
      type: "fraction-circle";
      x: number;
      y: number;
      r: number;
      num: number;
      den: number;
    }
  | {
      type: "angle";
      x: number;
      y: number;
      start: number;
      end: number;
      r: number;
      label: string;
    };
export interface TutorVisualStep {
  caption: string;
  items: TutorVisualItem[];
}
export type TutorVisual =
  | { applicable: false }
  | { applicable: true; title: string; steps: TutorVisualStep[] };

/** Expert badge keys — must mirror the backend's TUTOR_PERSONAS whitelist. */
export type TutorPersona =
  | "doctor"
  | "electrician"
  | "technician"
  | "developer"
  | "scientist"
  | "astrologer"
  | "student"
  | "chef"
  | "lawyer"
  | "fitness";

/** One live tutor turn: answer text + natively spoken base64 PCM audio. */
export interface TutorConverseResult {
  answer: string;
  audio: string;
  mimeType: string;
  languageCode: string;
}

export const aiTutorApi = {
  /** POST /v1/ai-tutor/converse — one Gemini Live turn (text + voice together). */
  converse: (body: {
    question: string;
    history?: TutorTurn[];
    persona?: TutorPersona;
    languageCode?: TutorSpeechLang;
  }) => apiClient.post<TutorConverseResult>("/v1/ai-tutor/converse", body),
  /** Step-by-step whiteboard scene for the question, or applicable:false. */
  visualize: (body: { question: string; answer?: string }) =>
    apiClient.post<TutorVisual>("/v1/ai-tutor/visualize", body),
};

/* =============================== Aura =================================== */
/**
 * Aura — the AI life tracker (React Native app). These endpoints back the
 * panel's Aura tab: fleet observability plus the two knobs that drive the
 * productivity score (the package→category catalog and the per-category
 * weights). Read routes need `aura.view`, writes need `aura.manage`.
 */

export type AuraCategory =
  | "PRODUCTIVITY"
  | "LEARNING"
  | "COMMUNICATION"
  | "SOCIAL"
  | "ENTERTAINMENT"
  | "GAMING"
  | "HEALTH"
  | "FINANCE"
  | "UTILITY"
  | "OTHER";

export const AURA_CATEGORIES: AuraCategory[] = [
  "PRODUCTIVITY",
  "LEARNING",
  "COMMUNICATION",
  "HEALTH",
  "FINANCE",
  "UTILITY",
  "SOCIAL",
  "ENTERTAINMENT",
  "GAMING",
  "OTHER",
];

export interface AuraOverview {
  totals: {
    users: number;
    activeUsers: number;
    suspended: number;
    devices: number;
    activeReminders: number;
    remindersFired24h: number;
    openTasks: number;
    chatTurns7d: number;
    unclassifiedApps: number;
  };
  averages: {
    productivityScore: number;
    screenMinutes: number;
    trackedDays: number;
  };
  dau: { day: string; users: number; averageScore: number }[];
  topApps: { appLabel: string; category: AuraCategory; minutes: number }[];
}

export interface AuraUserRow {
  userId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  profileImage: string | null;
  displayName: string | null;
  timezone: string;
  isActive: boolean;
  suspendedReason: string | null;
  onboardedAt: string | null;
  averageScore7d: number;
  screenMinutes7d: number;
  activeReminders: number;
  devices: number;
  lastSeenAt: string | null;
}

export interface AuraUsersPage {
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: AuraUserRow[];
}

export interface AuraUserDetail {
  profile: {
    timezone: string;
    wakeTime: string;
    sleepTime: string;
    workStart: string;
    workEnd: string;
    isActive: boolean;
    suspendedReason: string | null;
    onboardedAt: string | null;
    aiTone: string;
    morningBriefEnabled: boolean;
    dailyReportEnabled: boolean;
    weeklyReportEnabled: boolean;
  };
  user: {
    userId: number;
    name: string | null;
    email: string | null;
    mobile: string | null;
    profileImage: string | null;
  };
  counts: {
    reminders: number;
    tasks: number;
    habits: number;
    notes: number;
    memories: number;
    chatTurns: number;
  };
  devices: {
    deviceId: string;
    platform: string;
    model: string | null;
    osVersion: string | null;
    appVersion: string | null;
    batteryPercent: number | null;
    storageUsedMb: number | null;
    storageTotalMb: number | null;
    ramUsedMb: number | null;
    ramTotalMb: number | null;
    networkType: string | null;
    pushEnabled: boolean;
    lastSeenAt: string;
  }[];
  stats: {
    day: string;
    productivityScore: number;
    screenMinutes: number;
    productiveMinutes: number;
    distractingMinutes: number;
  }[];
  topApps: { appLabel: string; category: AuraCategory; minutes: number }[];
  reports: {
    id: string;
    kind: "DAILY" | "WEEKLY";
    periodStart: string;
    score: number;
    summary: string;
  }[];
}

export interface AuraCatalogEntry {
  id: string;
  packageName: string;
  appLabel: string;
  category: AuraCategory;
  pointsPerHour: number | null;
  isDistracting: boolean;
  /** Launchers and System UI: excluded from screen time rather than counted. */
  isSystem: boolean;
  updatedAt: string;
  totalMinutes: number;
  userCount: number;
}

export interface AuraScoreRule {
  id: string;
  category: AuraCategory;
  pointsPerHour: number;
  maxPoints: number;
  updatedAt: string;
}

export interface AuraSettings {
  settingId: number;
  aiEnabled: boolean;
  chatModel: string;
  morningBriefHour: number;
  dailyReportHour: number;
  weeklyReportWeekday: number;
  maxRemindersPerUser: number;
  defaultTimezone: string;
  /** Advance warnings before every reminder, in minutes (furthest-out first). */
  leadAlertMinutes: number[];
  registrationOpen: boolean;
  updatedAt: string;
  updatedBy?: {
    userId: number;
    name: string | null;
    email: string | null;
  } | null;
}

export interface AuraUsersParams {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export const auraApi = {
  /** GET /v1/aura/admin/overview — fleet totals, 14-day actives, top apps. */
  overview: () => apiClient.get<AuraOverview>("/v1/aura/admin/overview"),

  /** GET /v1/aura/admin/users — paginated user list with 7-day metrics. */
  users: (params: AuraUsersParams = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.active !== undefined) query.set("active", String(params.active));
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString();
    return apiClient.get<AuraUsersPage>(
      `/v1/aura/admin/users${suffix ? `?${suffix}` : ""}`,
    );
  },

  /** GET /v1/aura/admin/users/:userId — 30-day trend, devices, top apps. */
  user: (userId: number) =>
    apiClient.get<AuraUserDetail>(`/v1/aura/admin/users/${userId}`),

  /** PATCH /v1/aura/admin/users/:userId/status — suspend or restore access. */
  setUserStatus: (
    userId: number,
    body: { isActive: boolean; reason?: string },
  ) =>
    apiClient.patch<{ isActive: boolean }>(
      `/v1/aura/admin/users/${userId}/status`,
      body,
    ),

  /** GET /v1/aura/admin/catalog — package → category map, ranked by usage. */
  catalog: (
    params: {
      search?: string;
      category?: AuraCategory;
      unclassified?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.unclassified) query.set("unclassified", "true");
    const suffix = query.toString();
    return apiClient.get<AuraCatalogEntry[]>(
      `/v1/aura/admin/catalog${suffix ? `?${suffix}` : ""}`,
    );
  },

  /** PUT /v1/aura/admin/catalog — classify an app (re-tags existing usage). */
  saveCatalog: (body: {
    packageName: string;
    appLabel?: string;
    category: AuraCategory;
    pointsPerHour?: number | null;
    isDistracting?: boolean;
    isSystem?: boolean;
  }) => apiClient.put<AuraCatalogEntry>("/v1/aura/admin/catalog", body),

  /** DELETE /v1/aura/admin/catalog/:packageName */
  deleteCatalog: (packageName: string) =>
    apiClient.delete<{ deleted: boolean }>(
      `/v1/aura/admin/catalog/${encodeURIComponent(packageName)}`,
    ),

  /** GET /v1/aura/admin/score-rules — per-category scoring weights. */
  scoreRules: () =>
    apiClient.get<AuraScoreRule[]>("/v1/aura/admin/score-rules"),

  /** PUT /v1/aura/admin/score-rules — retune one category. */
  saveScoreRule: (body: {
    category: AuraCategory;
    pointsPerHour: number;
    maxPoints: number;
  }) => apiClient.put<AuraScoreRule>("/v1/aura/admin/score-rules", body),

  /** GET /v1/aura/admin/settings */
  settings: () => apiClient.get<AuraSettings>("/v1/aura/admin/settings"),

  /** PATCH /v1/aura/admin/settings */
  saveSettings: (
    body: Partial<Omit<AuraSettings, "settingId" | "updatedAt" | "updatedBy">>,
  ) => apiClient.patch<AuraSettings>("/v1/aura/admin/settings", body),

  /** POST /v1/aura/admin/broadcast — announcement push to active users. */
  broadcast: (body: { title: string; body: string; userIds?: number[] }) =>
    apiClient.post<{ targeted: number; sent: number }>(
      "/v1/aura/admin/broadcast",
      body,
    ),
};

/* ═══════════════════ Quick Commerce (store 2) ═══════════════════ */

export interface QcCategory {
  qcCategoryId: number;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface QcProduct {
  qcProductId: number;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  qcCategoryId: number;
  category?: { name: string } | null;
  createdAt?: string;
}

export interface QcVendorRow {
  qcVendorId: number;
  userId: number;
  storeName: string;
  ownerName: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  /** Store pin — the delivery app's pickup marker. */
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
  user?: { email: string | null };
  _count?: { products: number };
}

export type QcOrderStatus =
  "PLACED" | "ACCEPTED" | "PICKED_UP" | "DELIVERED" | "CANCELLED";

export interface QcAdminOrder {
  qcOrderId: number;
  status: QcOrderStatus;
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  paymentMode: string;
  address: string;
  city: string | null;
  createdAt: string;
  deliveredAt: string | null;
  customer?: { name: string | null; mobile: string | null };
  partner?: { professionalId: number; user: { name: string | null } } | null;
  items: {
    name: string;
    quantity: number;
    amount: number;
    qcVendorId: number;
  }[];
}

export interface QcVendorOrder {
  qcOrderId: number;
  status: QcOrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  address: string;
  city: string | null;
  customer: { name: string | null; mobile: string | null };
  amount: number;
  items: { name: string; price: number; quantity: number; amount: number }[];
}

export interface QcVendorRevenue {
  today: number;
  week: number;
  month: number;
  allTime: number;
  unitsSold: number;
  products: {
    qcProductId: number;
    name: string;
    units: number;
    revenue: number;
  }[];
}

export const qcApi = {
  categories: () =>
    apiClient.get<QcCategory[]>("/v1/qc/categories", { skipAuth: true }),

  /* admin */
  vendors: () => apiClient.get<QcVendorRow[]>("/v1/qc/admin/vendors"),
  createVendor: (body: {
    storeName: string;
    email: string;
    password: string;
    ownerName?: string;
    mobile?: string;
    address?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }) =>
    apiClient.post<{ message: string; vendor: QcVendorRow }>(
      "/v1/qc/admin/vendors",
      body,
    ),
  updateVendor: (
    id: number,
    body: Partial<{
      storeName: string;
      ownerName: string;
      mobile: string;
      address: string;
      city: string;
      lat: number;
      lng: number;
      isActive: boolean;
      password: string;
    }>,
  ) => apiClient.patch<QcVendorRow>(`/v1/qc/admin/vendors/${id}`, body),
  adminOrders: (status?: string) =>
    apiClient.get<QcAdminOrder[]>(
      `/v1/qc/admin/orders${toQueryString({ status })}`,
    ),
  adminStats: () =>
    apiClient.get<{
      orders: number;
      revenue: number;
      vendors: number;
      products: number;
      pendingOrders: number;
    }>("/v1/qc/admin/stats"),

  /* vendor portal (scoped server-side to the caller's store) */
  vendorMe: () =>
    apiClient.get<QcVendorRow & { productCount: number; inStock: number }>(
      "/v1/qc/vendor/me",
    ),
  vendorProducts: () => apiClient.get<QcProduct[]>("/v1/qc/vendor/products"),
  vendorCreateProduct: (body: {
    name: string;
    qcCategoryId: number;
    price: number;
    mrp?: number;
    stock?: number;
    description?: string;
    isActive?: boolean;
  }) => apiClient.post<QcProduct>("/v1/qc/vendor/products", body),
  vendorUpdateProduct: (
    id: number,
    body: Partial<{
      name: string;
      qcCategoryId: number;
      price: number;
      mrp: number;
      stock: number;
      description: string;
      isActive: boolean;
    }>,
  ) => apiClient.patch<QcProduct>(`/v1/qc/vendor/products/${id}`, body),
  vendorDeleteProduct: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/qc/vendor/products/${id}`),
  vendorUploadImage: (id: number, image: File) => {
    const fd = new FormData();
    fd.append("image", image);
    return uploadFile<QcProduct>(`/v1/qc/vendor/products/${id}/image`, fd);
  },
  vendorOrders: () => apiClient.get<QcVendorOrder[]>("/v1/qc/vendor/orders"),

  /* delivery partners (wallet, masked bank details, task stats) */
  deliveryPartners: () =>
    apiClient.get<QcDeliveryPartnerRow[]>("/v1/qc/admin/delivery-partners"),

  /* settings (refund policy shown in the customer app) */
  settings: () =>
    apiClient.get<{
      refundPolicy: string | null;
      supportPhone: string | null;
      supportEmail: string | null;
    }>("/v1/qc/settings", { skipAuth: true }),
  updateSettings: (body: {
    refundPolicy?: string;
    supportPhone?: string;
    supportEmail?: string;
  }) => apiClient.patch<{ message: string }>("/v1/qc/admin/settings", body),
  vendorRevenue: () => apiClient.get<QcVendorRevenue>("/v1/qc/vendor/revenue"),
};
