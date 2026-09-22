/**
 * Razorpay's hosted checkout, wrapped as promises. The script is injected
 * lazily so pages that never reach payment never load it.
 */

import type { CreatedRazorpayOrder, VerifyRazorpayPayload } from "@/src/api/api";

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

/** Opens the checkout for an order; resolves with the signature to verify. */
export function openRazorpay(
  order: CreatedRazorpayOrder,
  prefill: RazorpayPrefill,
  description: string,
): Promise<VerifyRazorpayPayload> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rzp = new (window as any).Razorpay({
      key: order.keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "RestoCare",
      description,
      prefill,
      theme: { color: "#F4B400" },
      handler: (resp: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) =>
        resolve({
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_signature: resp.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new Error("Payment was cancelled.")) },
    });
    rzp.open();
  });
}
