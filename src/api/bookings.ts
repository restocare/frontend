/**
 * Customer bookings, coupons and payments.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, ApiError } from "./apiClient";
import { parseCustomerCoupon, parseCustomerCoupons } from "@/src/lib/coupons";
import { collectRecords, pickNumber, pickString, toQueryString } from "./_shared";

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
  /** FLAT_TOTAL fixes one booking's pre-tax price; a percentage cannot express that. */
  discountType?: "PERCENT" | "FLAT_TOTAL";
  /** For FLAT_TOTAL: the service's fixed pre-tax price; GST and the platform fee are added on top. */
  flatTotal?: number | null;
  /** A duration ladder: "20% from 10 hrs, 30% from 12 hrs". Absent on a flat-rate coupon. */
  hourTiers?: { minHours: number; discountPercent: number }[];
  /** The most the coupon takes off; with it, discountPercent is the rate for THIS cart. */
  maxDiscount?: number | null;
  /** The booked hours reach none of the tiers: the coupon needs at least this many. */
  needsMinHours?: number | null;
}

/** What the customer is booking, so a tiered coupon lists at the rate those hours earn. */
export interface CouponContext {
  minutes?: number | null;
  categoryIds?: number[];
}

/** Customer coupons — the same endpoints the mobile app uses. */
export const couponsApi = {
  list: async (context: CouponContext = {}): Promise<CustomerCoupon[]> => {
    const query = new URLSearchParams();
    if (context.minutes) query.set("minutes", String(context.minutes));
    if (context.categoryIds?.length) query.set("categoryIds", context.categoryIds.join(","));
    const qs = query.toString();
    const response = await apiClient.get<unknown>(`/v1/coupons${qs ? `?${qs}` : ""}`);
    const coupons = parseCustomerCoupons(response);
    if (!coupons) throw new Error("Could not load your coupons. Please try again.");
    return coupons;
  },
  apply: async (couponCode: string): Promise<CustomerCoupon> => {
    const code = couponCode.trim().toUpperCase();
    let response: unknown;
    try {
      response = await apiClient.post<unknown>("/v1/coupons/apply", { couponCode: code });
    } catch (error) {
      // The API also returns "not found" for existing campaigns that fail
      // audience, category, minimum-spend, expiry or redemption checks.
      if (error instanceof ApiError && error.status === 404 && /coupon not found/i.test(error.message)) {
        throw new Error("This code was not found or is not eligible for your account or cart. Check the code, eligible service category and expiry.");
      }
      throw error;
    }
    const coupon = parseCustomerCoupon(response);
    if (coupon && coupon.code.toUpperCase() === code && !coupon.isUsed) return coupon;
    // Some API versions return only a confirmation message; read the selected
    // coupon rather than manufacturing a coupon without discount details.
    const selected = (await couponsApi.list()).find((c) => c.isApplied && !c.isUsed && c.code.toUpperCase() === code);
    if (selected) return selected;
    throw new Error("Could not confirm the coupon discount. Please try again.");
  },
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
  /**
   * One key per checkout, the same on every booking it creates, so a
   * "once per checkout" platform fee lands on the first of them only.
   */
  checkoutKey?: string;
  /**
   * Pay-first online booking: the Razorpay order the whole checkout was paid
   * with, on every booking of that checkout (see paidWith). The server
   * verifies them and creates the booking already paid.
   */
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

/** The payload fields that carry a verified Razorpay payment onto a booking. */
export type PaidWith = Required<
  Pick<CreateBookingPayload, "razorpayOrderId" | "razorpayPaymentId" | "razorpaySignature">
>;

export function paidWith(s: VerifyRazorpayPayload): PaidWith {
  return {
    razorpayOrderId: s.razorpay_order_id,
    razorpayPaymentId: s.razorpay_payment_id,
    razorpaySignature: s.razorpay_signature,
  };
}

/** What to tell a customer whose payment went through but whose booking did not. */
export function paidButNotBooked(paymentId: string, what: string): string {
  return `Your payment went through (payment ID ${paymentId}), but ${what} could not be booked. Our team will book it for you or refund you; you can also call support with this payment ID.`;
}

/** A fresh checkout key: "ck_" + 16 hex chars. */
export function newCheckoutKey(): string {
  const hex =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return `ck_${hex.slice(0, 16)}`;
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
  /** Area labels returned with the professional profile (not a live GPS address). */
  city?: string | null;
  district?: string | null;
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
  serviceCity?: string | null;
  serviceAddress?: string | null;
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

  /**
   * POST /v1/booking/payment/order — a Razorpay order for the customer's OWN
   * bookings, priced by the server from the bookings themselves (no amount
   * is sent), so what is charged always matches what is owed.
   */
  createBookingOrder: (userId: number, bookingIds: number[]) =>
    apiClient.post<CreatedRazorpayOrder & { payableAmount: number; bookingIds: number[] }>(
      "/v1/booking/payment/order",
      { userId, bookingIds },
    ),

  /** POST /v1/booking/payment/confirm — checks signature AND captured amount, then marks them paid. */
  confirmBookingPayment: (
    payload: VerifyRazorpayPayload & { userId: number; bookingIds: number[] },
  ) =>
    apiClient.post<{ success: boolean; message?: string; bookingIds?: number[]; amountPaid?: number }>(
      "/v1/booking/payment/confirm",
      payload,
    ),
};
