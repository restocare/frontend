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
  /** FLAT_TOTAL fixes the whole bill; a percentage cannot express that. */
  discountType?: "PERCENT" | "FLAT_TOTAL";
  /** For FLAT_TOTAL: the total the customer pays, GST included. */
  flatTotal?: number | null;
}

/** Customer coupons — the same endpoints the mobile app uses. */
export const couponsApi = {
  list: async (): Promise<CustomerCoupon[]> => {
    const response = await apiClient.get<unknown>("/v1/coupons");
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
