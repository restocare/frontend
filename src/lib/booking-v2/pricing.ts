/**
 * Money maths for the hourly booking flow. Pure: no DOM, no API.
 *
 * Mirrors what the flow-1 checkout does with coupons so the server sees the
 * same figures either way: a percentage coupon is taken off ONE booking's
 * pre-tax base (the code rides with that booking); a FLAT_TOTAL coupon fixes
 * the whole GST-inclusive bill.
 */

export const TAX_RATE = 0.18;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BillCoupon {
  discountType?: "PERCENT" | "FLAT_TOTAL";
  discountPercent: number;
  flatTotal?: number | null;
}

export interface BillInput {
  /** Booked hours per person, e.g. 5.5. */
  hours: number;
  /** Rate per hour, pre-tax. */
  rate: number;
  /** People booked (each becomes its own booking). */
  quantity: number;
  coupon?: BillCoupon | null;
}

export interface Bill {
  /** Pre-tax amount of one booking: hours × rate. */
  perBookingBase: number;
  /** Pre-tax amount of all bookings. */
  subtotal: number;
  tax: number;
  /** Pre-tax discount applied to the first booking (percent coupons only). */
  couponBaseDiscount: number;
  /** What the customer saves, GST included — the figure shown on the bill. */
  couponSaving: number;
  /** Amount payable, GST included, after the coupon. */
  total: number;
  isFlat: boolean;
}

export function computeBill({ hours, rate, quantity, coupon }: BillInput): Bill {
  const perBookingBase = round2(hours * rate);
  const subtotal = round2(perBookingBase * quantity);
  const tax = round2(subtotal * TAX_RATE);
  const gross = round2(subtotal + tax);

  const isFlat =
    !!coupon && coupon.discountType === "FLAT_TOTAL" && coupon.flatTotal != null;

  let couponBaseDiscount = 0;
  let couponSaving = 0;
  if (coupon && isFlat) {
    couponSaving = Math.max(0, round2(gross - (coupon.flatTotal as number)));
  } else if (coupon && coupon.discountPercent > 0) {
    couponBaseDiscount = round2((perBookingBase * coupon.discountPercent) / 100);
    couponSaving = round2(couponBaseDiscount * (1 + TAX_RATE));
  }

  const total = Math.max(0, round2(gross - couponSaving));

  return { perBookingBase, subtotal, tax, couponBaseDiscount, couponSaving, total, isFlat };
}

/** "₹745" or "₹134.10"; paise only when the amount has them. */
export function formatInr(n: number): string {
  const v = Number(n) || 0;
  const hasPaise = Math.round(v * 100) % 100 !== 0;
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}
