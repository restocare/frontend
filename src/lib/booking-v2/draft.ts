/**
 * The in-progress booking of the hourly flow, kept in sessionStorage so the
 * three wizard steps (and a login round-trip) share one object. Pure apart
 * from the storage calls.
 */

import type {
  CategoryTreeService,
  CreateBookingPayload,
  CustomerCoupon,
} from "@/src/api/api";
import { computeBill, round2 } from "./pricing";
import {
  defaultWindow,
  getDays,
  minShiftMinutes,
  pickShiftVariant,
  shiftMinutes,
  toHHmm,
} from "./schedule";

export const DRAFT_KEY = "rc.bookingV2";

export interface DraftVariant {
  variantId: number;
  name: string;
  price: number;
}

export interface DraftAddress {
  /** Saved-address id from the API, or a local id for a just-typed one. */
  id: string;
  label: string;
  restaurantName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contactName: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

export interface BookingDraft {
  serviceId: number;
  serviceName: string;
  serviceImage: string | null;
  categoryId: number;
  categoryName: string;
  /** Rate per hour, pre-tax. */
  rate: number;
  /** Shortest booking, in minutes. */
  minMinutes: number;
  variants: DraftVariant[];
  /** ISO yyyy-mm-dd */
  date: string;
  /** Minutes since midnight. */
  start: number;
  end: number;
  quantity: number;
  address: DraftAddress | null;
  paymentMode: "COD" | "RAZORPAY" | null;
  couponCode: string | null;
}

export function loadDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: BookingDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** The service's rate per hour: its base price, else a shift price ÷ hours. */
export function hourlyRate(service: {
  price: number | null;
  variants: { name: string; price: number }[];
}): number {
  if (service.price != null && service.price > 0) return service.price;
  for (const v of service.variants) {
    const m = shiftMinutes(v.name);
    if (m && v.price > 0) return round2(v.price / (m / 60));
  }
  return 0;
}

export function startDraft(
  service: CategoryTreeService,
  category: { categoryId: number; name: string },
): BookingDraft {
  const minMinutes = minShiftMinutes(service.variants);
  const window = defaultWindow(service.variants, minMinutes);
  const days = getDays(2);
  return {
    serviceId: service.serviceId,
    serviceName: service.name,
    serviceImage: service.profileImage,
    categoryId: category.categoryId,
    categoryName: category.name,
    rate: hourlyRate(service),
    minMinutes,
    variants: service.variants.map((v) => ({
      variantId: v.variantId,
      name: v.name,
      price: v.price,
    })),
    date: days[1]?.value ?? days[0]?.value ?? "",
    start: window.start,
    end: window.end,
    quantity: 1,
    address: null,
    paymentMode: null,
    couponCode: null,
  };
}

export function draftHours(draft: Pick<BookingDraft, "start" | "end">): number {
  return (draft.end - draft.start) / 60;
}

/**
 * One booking per person. The percentage coupon's share comes off the first
 * booking and the code rides with it, exactly as the flow-1 checkout does; a
 * flat-total coupon is priced by the server, so every line keeps its base.
 */
export function buildPayloads(
  draft: BookingDraft,
  userId: number,
  coupon: CustomerCoupon | null,
): CreateBookingPayload[] {
  const address = draft.address;
  if (!address) throw new Error("Pick an address before booking.");
  const bill = computeBill({
    hours: draftHours(draft),
    rate: draft.rate,
    quantity: draft.quantity,
    coupon,
  });
  const variantId = pickShiftVariant(draft.variants, draft.start, draft.end);

  return Array.from({ length: draft.quantity }, (_, i) => {
    const carriesCoupon = i === 0 && !!coupon;
    return {
      userId,
      professionalId: null,
      serviceId: draft.serviceId,
      variantId,
      bookingDate: draft.date,
      startTime: toHHmm(draft.start),
      endTime: toHHmm(draft.end),
      totalAmount:
        carriesCoupon && !bill.isFlat
          ? round2(bill.perBookingBase - bill.couponBaseDiscount)
          : bill.perBookingBase,
      serviceLat: address.lat ?? 0,
      serviceLng: address.lng ?? 0,
      serviceCity: address.city,
      serviceAddress: address.address,
      paymentMode: draft.paymentMode ?? "COD",
      ...(carriesCoupon ? { couponCode: coupon!.code } : {}),
    };
  });
}
