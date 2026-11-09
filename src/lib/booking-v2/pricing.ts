/**
 * Money maths for the storefront's booking flows. Pure: no DOM, no API.
 *
 * Every figure is priced from the live `BillRates` (GET /v1/pricing/rates via
 * usePricingRates): GST on the whole base or on the company's commission only,
 * and a flat platform fee per booking or per checkout, with GST on the fee.
 * The server prices each booking itself the same way; this keeps what the
 * customer sees in step with what they are charged.
 *
 * Mirrors what the flow-1 checkout does with coupons so the server sees the
 * same figures either way: a percentage coupon is taken off ONE booking's
 * pre-tax base (the code rides with that booking); a FLAT_TOTAL coupon fixes
 * the whole GST-inclusive bill.
 */

import type { PricingRates } from "@/src/api/pricing";

/** The rates a bill is priced from; the public shape the server serves. */
export type BillRates = PricingRates;

/**
 * How every bill was priced before the rates were editable (18% GST on the
 * whole base, no platform fee), and what is used until the live rates load.
 */
export const LEGACY_RATES: BillRates = {
  taxModel: "ON_BASE",
  commissionPercent: 20,
  gstPercent: 18,
  taxRateOnBase: 0.18,
  platformFeeRupees: 0,
  platformFeeMode: "PER_BOOKING",
};

/** @deprecated The rate is editable; use `rates.taxRateOnBase`. Kept for older imports. */
export const TAX_RATE = LEGACY_RATES.taxRateOnBase;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** GST on a pre-tax base under the model (the whole base, or commission × GST). */
export function taxOnBase(base: number, rates: BillRates): number {
  return round2(base * rates.taxRateOnBase);
}

/** GST on the platform fee: the company's own supply, taxed in full under either model. */
export function gstOnFee(fee: number, rates: BillRates): number {
  return round2((fee * rates.gstPercent) / 100);
}

/** The platform fee for `bookings` bookings made together: each one, or once for all. */
export function platformFeeFor(rates: BillRates, bookings: number): number {
  const fee = rates.platformFeeRupees;
  if (!(fee > 0) || bookings <= 0) return 0;
  return round2(rates.platformFeeMode === "PER_ORDER" ? fee : fee * bookings);
}

/** The bill's GST line label: "GST (18%)", or what it is on when it is not the whole price. */
export function gstLabel(rates: BillRates): string {
  return rates.taxModel === "ON_COMMISSION"
    ? `GST (${rates.gstPercent}% on platform commission)`
    : `GST (${rates.gstPercent}%)`;
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
  /** Hours per person that fall in the night window; default 0. */
  nightHours?: number;
  /** Extra rate per night hour, pre-tax; default 0. */
  nightRate?: number;
  coupon?: BillCoupon | null;
}

export interface Bill {
  /** Pre-tax amount of one booking: hours × rate plus night hours × night rate. */
  perBookingBase: number;
  /** Pre-tax amount of all bookings. */
  subtotal: number;
  /** The platform fee across the bookings (each, or once); 0 when none. */
  platformFee: number;
  /** GST on the bases under the live model, plus GST on the platform fee. */
  tax: number;
  /** Pre-tax discount applied to the first booking (percent coupons only). */
  couponBaseDiscount: number;
  /** What the customer saves, GST included — the figure shown on the bill. */
  couponSaving: number;
  /** Amount payable, GST included, after the coupon. */
  total: number;
  isFlat: boolean;
}

export function computeBill(
  { hours, rate, quantity, nightHours = 0, nightRate = 0, coupon }: BillInput,
  rates: BillRates = LEGACY_RATES,
): Bill {
  const perBookingBase = round2(hours * rate + nightHours * nightRate);
  const subtotal = round2(perBookingBase * quantity);
  const platformFee = platformFeeFor(rates, quantity);
  const tax = round2(taxOnBase(subtotal, rates) + gstOnFee(platformFee, rates));
  const gross = round2(subtotal + platformFee + tax);

  const isFlat =
    !!coupon &&
    coupon.discountType === "FLAT_TOTAL" &&
    coupon.flatTotal != null;

  let couponBaseDiscount = 0;
  let couponSaving = 0;
  if (coupon && isFlat) {
    // The coupon fixes ONE booking's pre-tax price; GST (and the fee) stay on top.
    couponBaseDiscount = Math.max(0, round2(perBookingBase - (coupon.flatTotal as number)));
    couponSaving = round2(couponBaseDiscount * (1 + rates.taxRateOnBase));
  } else if (coupon && coupon.discountPercent > 0) {
    couponBaseDiscount = round2(
      (perBookingBase * coupon.discountPercent) / 100,
    );
    couponSaving = round2(couponBaseDiscount * (1 + rates.taxRateOnBase));
  }

  const total = Math.max(0, round2(gross - couponSaving));

  return {
    perBookingBase,
    subtotal,
    platformFee,
    tax,
    couponBaseDiscount,
    couponSaving,
    total,
    isFlat,
  };
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
