/**
 * Customer-side auth (OTP, Google) and saved addresses.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { collectRecords, pickBoolean, pickString } from "./_shared";

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
