"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LEGACY_PRICING_RATES,
  pricingApi,
  queryKeys,
  type PricingRates,
} from "@/src/api/api";

/**
 * The live rates for pricing a bill (GST model and rate, platform fee), from
 * GET /v1/pricing/rates. Never blocks a screen: until they arrive, or if the
 * call fails, the bill is priced the way it always was (18% on the whole base,
 * no fee), and the server corrects the figure when the booking is created.
 */
export function usePricingRates(): PricingRates {
  const { data } = useQuery({
    queryKey: queryKeys.pricingRates,
    queryFn: () => pricingApi.rates(),
    staleTime: 60_000,
    retry: 1,
  });
  return data ?? LEGACY_PRICING_RATES;
}
