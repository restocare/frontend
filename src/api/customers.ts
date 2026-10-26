/**
 * Customer records as seen from the admin panel.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";

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

/**
 * One duration tier on a coupon. The tier that applies to a booking is the
 * highest `minHours` it reaches, so with 5h/10% and 10h/20% a 7-hour job takes
 * 10% and a 12-hour job 20%. A booking shorter than every tier gets nothing.
 */
export interface CampaignCouponHourTier {
  tierId: number;
  /** Bookings of at least this many hours qualify; 1.5 = ninety minutes. */
  minHours: number;
  /** The same threshold as the server stores it. */
  minMinutes: number;
  discountPercent: number;
  /** The most this tier takes off, in ₹ (GST included); null = no cap. */
  maxDiscount: number | null;
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
  /**
   * Duration tiers, shortest first: a booking of at least `minHours` takes
   * `discountPercent` off. Empty means the coupon's own rate applies to any
   * length of booking.
   */
  hourTiers: CampaignCouponHourTier[];
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
  /**
   * Replaces the whole tier ladder; [] clears it and returns the coupon to a
   * single rate for every booking length. Omitted leaves the tiers untouched.
   */
  hourTiers?: { minHours: number; discountPercent: number; maxDiscount: number | null }[];
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
