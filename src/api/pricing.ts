import { apiClient } from "./apiClient";
import type { PlatformFeeMode, TaxModel } from "./dispatch";

/**
 * The rates the storefront needs to show a bill before booking, as the server
 * will charge it: GET /v1/pricing/rates (public, cached a minute behind the
 * admin's Payment Settings). The server still prices every booking itself;
 * this only keeps what the customer sees in step with what they pay.
 */
export interface PricingRates {
  taxModel: TaxModel;
  /** The company's commission, in percent (what ON_COMMISSION taxes). */
  commissionPercent: number;
  gstPercent: number;
  /** The GST as a rate ON THE BASE under the model: 0.18, or commission × GST. */
  taxRateOnBase: number;
  /** Flat ₹ per booking (PER_BOOKING) or per checkout (PER_ORDER); 0 = none. GST applies to it. */
  platformFeeRupees: number;
  platformFeeMode: PlatformFeeMode;
  /**
   * Night conveyance: flat ₹ per booking whose window ends at or after
   * nightChargeAfterTime ("HH:mm") or past midnight; 0 = none. GST applies to
   * it. Optional so a server that predates it still prices the rest.
   */
  nightChargeRupees?: number;
  nightChargeAfterTime?: string;
}

/**
 * How every bill was priced before the rates were editable, and what the
 * storefront falls back to while the rates are loading or unreachable.
 */
export const LEGACY_PRICING_RATES: PricingRates = {
  taxModel: "ON_BASE",
  commissionPercent: 20,
  gstPercent: 18,
  taxRateOnBase: 0.18,
  platformFeeRupees: 0,
  platformFeeMode: "PER_BOOKING",
  nightChargeRupees: 0,
  nightChargeAfterTime: "22:00",
};

/** The public endpoint wraps its payload: { status, message, statusCode, data }. */
interface PricingRatesResponse {
  data?: PricingRates;
}

/** True when every field the bill needs is present, so a bad payload never prices a bill. */
export function isPricingRates(value: unknown): value is PricingRates {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    (r.taxModel === "ON_BASE" || r.taxModel === "ON_COMMISSION") &&
    typeof r.commissionPercent === "number" &&
    typeof r.gstPercent === "number" &&
    typeof r.taxRateOnBase === "number" &&
    typeof r.platformFeeRupees === "number" &&
    (r.platformFeeMode === "PER_BOOKING" || r.platformFeeMode === "PER_ORDER")
  );
}

export const pricingApi = {
  /** GET /v1/pricing/rates — public. Resolves to the rates themselves, never the envelope. */
  rates: async (): Promise<PricingRates> => {
    const res = await apiClient.get<PricingRatesResponse>("/v1/pricing/rates", {
      skipAuth: true,
    });
    if (!isPricingRates(res?.data)) {
      console.warn(
        "GET /v1/pricing/rates: unexpected payload, pricing with the legacy rates",
        res,
      );
      throw new Error("Pricing rates: unexpected response");
    }
    return res.data;
  },
};
