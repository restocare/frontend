import type { CustomerCoupon } from "@/src/api/api";

/** Accept the coupon itself or the envelope returned by an API gateway. */
export function parseCustomerCoupon(value: unknown, depth = 0): CustomerCoupon | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return null;
  const row = value as Record<string, unknown>;
  if (row.success === false) return null;
  const code = String(row.code ?? row.couponCode ?? "").trim();
  const couponId = Number(row.couponId ?? row.id);
  if (!code || !Number.isInteger(couponId) || couponId <= 0) {
    for (const key of ["coupon", "data", "result"]) {
      const coupon = parseCustomerCoupon(row[key], depth + 1);
      if (coupon) return coupon;
    }
    return null;
  }
  const percent = Number(row.discountPercent ?? row.discount ?? row.percent);
  const flatTotal = row.flatTotal == null ? null : Number(row.flatTotal);
  const isFlat = row.discountType === "FLAT_TOTAL";
  // Never report success with an incomplete response and a zero/NaN saving.
  if (isFlat ? flatTotal == null || !Number.isFinite(flatTotal) || flatTotal < 0 : !Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  return {
    ...row,
    couponId,
    code,
    description: typeof row.description === "string" ? row.description : null,
    discountPercent: Number.isFinite(percent) ? percent : 0,
    isApplied: row.isApplied === true,
    isUsed: row.isUsed === true || String(row.status).toUpperCase() === "USED" || !!row.usedAt,
    expiresAt: String(row.expiresAt ?? row.validTill ?? row.expiryDate ?? ""),
    prepaidOnly: row.prepaidOnly === true,
    discountType: isFlat ? "FLAT_TOTAL" : "PERCENT",
    flatTotal: isFlat ? flatTotal : null,
  };
}

export function parseCustomerCoupons(value: unknown, depth = 0): CustomerCoupon[] | null {
  if (Array.isArray(value)) return value.map((row) => parseCustomerCoupon(row)).filter((coupon): coupon is CustomerCoupon => !!coupon);
  if (!value || typeof value !== "object" || depth > 4) return null;
  const row = value as Record<string, unknown>;
  if (row.success === false) return null;
  for (const key of ["data", "coupons", "items", "results", "result", "rows"]) {
    const coupons = parseCustomerCoupons(row[key], depth + 1);
    if (coupons) return coupons;
  }
  return null;
}
