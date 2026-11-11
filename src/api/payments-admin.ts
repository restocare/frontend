import { apiClient } from "./apiClient";

/**
 * Dispatcher → Payments: what Razorpay's webhook told the server, and the
 * captured payments nobody booked (ORPHANED), which support refunds or books.
 */
export type PaymentEventOutcome =
  | "RECORDED"
  | "BOOKING_PAID"
  | "WALLET_CREDITED"
  | "ORPHANED"
  | "FAILED"
  | "NO_ACTION"
  | "ERROR"
  | "REFUNDED"
  | "BOOKED_BY_SUPPORT";

export interface PaymentEventRow {
  paymentEventId: number;
  event: string;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  /** Rupees. */
  amount: number | null;
  purpose: "BOOKING_CHECKOUT" | "BOOKING_PAY" | "WALLET_RECHARGE" | null;
  userId: number | null;
  professionalId: number | null;
  bookingIds: number[];
  outcome: PaymentEventOutcome;
  error: string | null;
  receivedAt: string;
  resolvedAt: string | null;
}

export interface PaymentEventsView {
  events: PaymentEventRow[];
  /** Captured payments with no booking that support has not closed yet. */
  orphaned: number;
}

export const paymentsAdminApi = {
  /** GET /v1/admin/payments/events — latest 100, optionally one outcome. */
  events: (outcome?: string) =>
    apiClient.get<PaymentEventsView>(
      `/v1/admin/payments/events${outcome ? `?outcome=${encodeURIComponent(outcome)}` : ""}`,
    ),

  /** POST /v1/admin/payments/events/:id/refund — refund in Razorpay and close the event. */
  refund: (paymentEventId: number) =>
    apiClient.post<unknown>(`/v1/admin/payments/events/${paymentEventId}/refund`, {}),

  /** POST /v1/admin/payments/events/:id/resolve — closed by hand. */
  resolve: (paymentEventId: number, outcome: "REFUNDED" | "BOOKED_BY_SUPPORT") =>
    apiClient.post<unknown>(`/v1/admin/payments/events/${paymentEventId}/resolve`, { outcome }),
};
