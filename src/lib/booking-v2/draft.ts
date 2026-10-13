/**
 * The in-progress booking of the wizard, kept in sessionStorage so the
 * three wizard steps (and a login round-trip) share one object. Pure apart
 * from the storage calls.
 *
 * Two kinds of booking share it: hourly (chef, helpers: rate × hours) and
 * fixed (a Deep Cleaning package: one price, only a start time is picked).
 */

import type {
  CategoryTreeService,
  CreateBookingPayload,
  CustomerCoupon,
} from "@/src/api/api";
import { TAX_RATE, computeBill, formatInr, round2, type Bill } from "./pricing";
import { isCleaningCategory } from "./cleaning";
import {
  defaultWindow,
  getDays,
  minShiftMinutes,
  fmtDuration,
  fmtTime,
  pickShiftVariant,
  shiftMinutes,
  shiftWindow,
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

export type DraftPricing = "hourly" | "fixed";

export interface BookingDraft {
  /** Missing on drafts saved before fixed pricing existed: treat as hourly. */
  pricing?: DraftPricing;
  serviceId: number;
  serviceName: string;
  serviceImage: string | null;
  categoryId: number;
  categoryName: string;
  /** Hourly: rate per hour. Fixed: the package price. Pre-tax either way. */
  rate: number;
  /** Hourly: shortest booking. Fixed: the time blocked for the job. In minutes. */
  minMinutes: number;
  variants: DraftVariant[];
  /** ISO yyyy-mm-dd */
  date: string;
  /** Minutes since midnight. */
  start: number;
  end: number;
  quantity: number;
  /** Night premium per night hour, pre-tax. Missing on older drafts: 0. */
  nightRate?: number;
  /** Consecutive days booked from `date`, same window each day: 7 for a week. Missing: 1. */
  days?: number;
  address: DraftAddress | null;
  paymentMode: "COD" | "RAZORPAY" | null;
  couponCode: string | null;
  /**
   * More services booked for the same date and time, one booking each.
   * Always the same kind as the main service (hourly with hourly, a cleaning
   * package with cleaning packages), so one time window fits them all.
   */
  extras?: DraftExtra[];
}

/** A service added on top of the main one, sharing its date and time. */
export interface DraftExtra {
  serviceId: number;
  serviceName: string;
  /** The catalogue's one-liner, e.g. "150 to 300 sq ft". */
  subtitle?: string | null;
  serviceImage: string | null;
  categoryName: string;
  rate: number;
  /** Night premium per night hour. Missing on older drafts: 0. */
  nightRate?: number;
  minMinutes: number;
  variants: DraftVariant[];
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

/**
 * Time a fixed-price job blocks after its start. The catalogue has no job
 * duration yet, so this matches the cleaning flow's 4-hour arrival windows.
 */
export const FIXED_JOB_MINUTES = 4 * 60;
/** Default start for a fixed-price job: 10:00. */
const FIXED_DEFAULT_START = 10 * 60;

export function isFixedDraft(draft: Pick<BookingDraft, "pricing">): boolean {
  return draft.pricing === "fixed";
}

/** Hours billed: a fixed package is billed once, whatever the clock says. */
export function billedHours(draft: Pick<BookingDraft, "pricing" | "start" | "end">): number {
  return isFixedDraft(draft) ? 1 : draftHours(draft);
}

/*
 * Night premium. Mirrors nightHoursIn / nightPremiumPerHour in hourly-terms.ts,
 * which imports this module, so they can't be imported here.
 */
const NIGHT_START = 18 * 60;
const MIDNIGHT = 24 * 60;

/** Per-hour night surcharge: the 5-hour night shift against the 5-hour day shift; 0 if either is missing. */
function nightRateOf(variants: { name: string; price: number }[]): number {
  let night: number | null = null;
  let day: number | null = null;
  for (const v of variants) {
    if (shiftMinutes(v.name) !== 5 * 60) continue;
    const w = shiftWindow(v.name);
    if (!w) continue;
    if (w.start >= NIGHT_START) night ??= v.price;
    else if (w.end <= NIGHT_START) day ??= v.price;
  }
  return night == null || day == null ? 0 : round2((night - day) / 5);
}

/**
 * Night hours billed per day. Like the catalogue's night shifts, the premium
 * applies only to a window that runs to midnight; a fixed package has none.
 */
export function billedNightHours(draft: Pick<BookingDraft, "pricing" | "start" | "end">): number {
  if (isFixedDraft(draft) || draft.end < MIDNIGHT) return 0;
  return (MIDNIGHT - Math.max(draft.start, NIGHT_START)) / 60;
}

export function draftDays(draft: Pick<BookingDraft, "days">): number {
  return draft.days && draft.days > 1 ? draft.days : 1;
}

export function isWeekDraft(draft: Pick<BookingDraft, "days">): boolean {
  return draftDays(draft) > 1;
}

/** The copy the three steps share, so hourly and fixed read right everywhere. */
export function draftCopy(draft: BookingDraft) {
  const fixed = isFixedDraft(draft);
  const minutes = draft.end - draft.start;
  const days = draftDays(draft);
  const night = billedNightHours(draft) * (draft.nightRate ? 1 : 0);
  const nightLabel = (hrs: number) =>
    night > 0 ? ` + ${hrs} night ${hrs === 1 ? "hr" : "hrs"} × ${formatInr(draft.nightRate ?? 0)}` : "";
  return {
    title: fixed ? `Book ${draft.serviceName}` : `Book a ${draft.serviceName}`,
    sub: fixed
      ? `${formatInr(draft.rate)} package, taxes extra`
      : days > 1
        ? `${days} days × ${fmtDuration(minutes)} × ${formatInr(draft.rate)}${nightLabel(night * days)}`
        : night > 0
          ? `${fmtDuration(minutes)} × ${formatInr(draft.rate)}${nightLabel(night)}`
          : `${formatInr(draft.rate)}/hour, minimum ${draft.minMinutes / 60} hrs`,
    time: fixed ? `Starts ${fmtTime(draft.start)}` : `${fmtTime(draft.start)} to ${fmtTime(draft.end)}`,
    /** Bill line before tax, e.g. "5 hrs × ₹149" or "Washroom Essential". */
    billLabel: (extra = "") =>
      fixed
        ? `${draft.serviceName}${draft.quantity > 1 ? ` × ${draft.quantity}` : ""}`
        : `${days > 1 ? `${days} days × ` : ""}${fmtDuration(minutes)} × ${formatInr(draft.rate)}${nightLabel(night * days)}${extra}`,
  };
}

/**
 * A fresh draft. `pick` is the variant chosen in the picker: its window opens
 * the draft, and a week variant books 7 days of that daily window.
 */
export function startDraft(
  service: CategoryTreeService,
  category: { categoryId: number; name: string },
  pick?: { variantId: number; name: string },
): BookingDraft {
  if (isCleaningCategory(category.name)) {
    const sizes = service.variants.map((v) => v.price).filter((p) => p > 0);
    const days = getDays(2);
    return {
      pricing: "fixed",
      serviceId: service.serviceId,
      serviceName: service.name,
      serviceImage: service.profileImage,
      categoryId: category.categoryId,
      categoryName: category.name,
      rate: service.price != null && service.price > 0 ? service.price : sizes.length ? Math.min(...sizes) : 0,
      minMinutes: FIXED_JOB_MINUTES,
      variants: [],
      date: days[1]?.value ?? days[0]?.value ?? "",
      start: FIXED_DEFAULT_START,
      end: FIXED_DEFAULT_START + FIXED_JOB_MINUTES,
      quantity: 1,
      address: null,
      paymentMode: null,
      couponCode: null,
    };
  }

  const minMinutes = minShiftMinutes(service.variants);
  const window =
    (pick && shiftWindow(pick.name)) || defaultWindow(service.variants, minMinutes);
  const week = !!pick && /\bweek\b/i.test(pick.name);
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
    nightRate: nightRateOf(service.variants),
    days: week ? 7 : 1,
    address: null,
    paymentMode: null,
    couponCode: null,
  };
}

export function draftHours(draft: Pick<BookingDraft, "start" | "end">): number {
  return (draft.end - draft.start) / 60;
}

/* ------------------------------- extras -------------------------------- */

/** An extra built from a catalogue service, priced the way its own booking would be. */
export function extraFromService(
  service: CategoryTreeService,
  category: { categoryId: number; name: string },
): DraftExtra {
  const d = startDraft(service, category);
  return {
    serviceId: d.serviceId,
    serviceName: d.serviceName,
    subtitle: service.subtitle ?? null,
    serviceImage: d.serviceImage,
    categoryName: d.categoryName,
    rate: d.rate,
    nightRate: d.nightRate,
    minMinutes: d.minMinutes,
    variants: d.variants,
  };
}

/** Pre-tax price of one extra for this draft's time window. */
export function extraBase(draft: BookingDraft, extra: DraftExtra): number {
  return round2(extra.rate * billedHours(draft) + billedNightHours(draft) * (extra.nightRate ?? 0));
}

/** Why an extra can't join this window, or null when it fits. */
export function extraProblem(draft: BookingDraft, extra: DraftExtra): string | null {
  if (isWeekDraft(draft)) return "Add-ons aren't available for weekly bookings";
  if (isFixedDraft(draft)) return null;
  const needs = extra.minMinutes;
  return draft.end - draft.start < needs ? `Needs at least ${needs / 60} hrs` : null;
}

export interface FullBill {
  /** The main service (all its people), coupon included. */
  main: Bill;
  extrasBase: number;
  extrasTax: number;
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * The whole booking: the main service as before (the coupon stays on it)
 * plus every extra at its own price for the same window.
 */
export function fullBill(draft: BookingDraft, coupon: CustomerCoupon | null): FullBill {
  const main = mainBill(draft, coupon);
  const extrasBase = round2((draft.extras ?? []).reduce((sum, x) => sum + extraBase(draft, x), 0));
  const extrasTax = round2(extrasBase * TAX_RATE);
  return {
    main,
    extrasBase,
    extrasTax,
    subtotal: round2(main.subtotal + extrasBase),
    tax: round2(main.tax + extrasTax),
    total: round2(main.total + extrasBase + extrasTax),
  };
}

/** The main service: per-day base × days × people, coupon on one booking. */
function mainBill(draft: BookingDraft, coupon: CustomerCoupon | null): Bill {
  return computeBill({
    hours: billedHours(draft),
    rate: draft.rate,
    quantity: draft.quantity * draftDays(draft),
    nightHours: billedNightHours(draft),
    nightRate: draft.nightRate ?? 0,
    coupon,
  });
}

/** `iso` (yyyy-mm-dd) moved by `n` days, across month and year ends. */
export function addDaysISO(iso: string, n: number): string {
  if (!n) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * One booking per person per day. The percentage coupon's share comes off the first
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
  const bill = mainBill(draft, coupon);
  const variantId = pickShiftVariant(draft.variants, draft.start, draft.end);
  const blocked = (draft.extras ?? []).map((x) => extraProblem(draft, x)).find(Boolean);
  if (blocked) throw new Error(`${blocked} for one of the added services. Change the hours or remove it.`);

  const extras: CreateBookingPayload[] = (draft.extras ?? []).map((x) => ({
    userId,
    professionalId: null,
    serviceId: x.serviceId,
    variantId: pickShiftVariant(x.variants, draft.start, draft.end),
    bookingDate: draft.date,
    startTime: toHHmm(draft.start),
    endTime: toHHmm(draft.end),
    totalAmount: extraBase(draft, x),
    serviceLat: address.lat ?? 0,
    serviceLng: address.lng ?? 0,
    serviceCity: address.city,
    serviceAddress: address.address,
    paymentMode: draft.paymentMode ?? "COD",
  }));

  const quantity = draft.quantity;
  const mains = Array.from({ length: quantity * draftDays(draft) }, (_, i) => {
    const carriesCoupon = i === 0 && !!coupon;
    return {
      userId,
      professionalId: null,
      serviceId: draft.serviceId,
      variantId,
      bookingDate: addDaysISO(draft.date, Math.floor(i / quantity)),
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
  return [...mains, ...extras];
}
