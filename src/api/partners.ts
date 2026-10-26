/**
 * Service partners: onboarding, documents, grooming, earnings, wallets, payouts, referrals.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, downloadFile, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";

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
