/**
 * The Deep Cleaning cart on flow 2: several packages, one date, one arrival
 * window, one address, one payment. Each line becomes its own booking.
 *
 * Kept in localStorage per category so a refresh, a login round-trip or a
 * second tab keeps it. Everything read back from storage is validated:
 * a hand-edited or outdated value is repaired or dropped, never trusted, so
 * a bad entry can't break the page.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CreateBookingPayload } from "@/src/api/api";
import { TAX_RATE, round2 } from "./pricing";
import type { DraftAddress } from "./draft";
import type { Clock } from "./schedule";

export const MAX_LINE_QTY = 10;
const KEY_PREFIX = "rc.cleaningCart.v1:";
const CHANGE_EVENT = "rc:cleaning-cart";

export interface CartLine {
  /** serviceId:variantId — one line per service option. */
  key: string;
  serviceId: number;
  variantId: number | null;
  name: string;
  variantName: string | null;
  subtitle: string | null;
  image: string | null;
  /** Pre-tax price of one. */
  unitPrice: number;
  originalPrice: number | null;
  isStartingPrice: boolean;
  quantity: number;
}

export type PaymentMode = "COD" | "RAZORPAY";

export interface CleaningCart {
  categoryId: number;
  categoryName: string;
  lines: CartLine[];
  /** yyyy-mm-dd */
  date: string | null;
  windowId: ArrivalWindowId | null;
  address: DraftAddress | null;
  paymentMode: PaymentMode | null;
}

export function lineKey(serviceId: number, variantId: number | null): string {
  return `${serviceId}:${variantId ?? 0}`;
}

export function emptyCart(categoryId: number, categoryName: string): CleaningCart {
  return { categoryId, categoryName, lines: [], date: null, windowId: null, address: null, paymentMode: null };
}

/* ------------------------------ validation ------------------------------ */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function cleanLine(v: unknown): CartLine | null {
  if (!isObj(v)) return null;
  const serviceId = num(v.serviceId);
  const unitPrice = num(v.unitPrice);
  const name = str(v.name);
  if (serviceId == null || unitPrice == null || unitPrice < 0 || !name) return null;
  const variantId = num(v.variantId);
  const qty = Math.round(num(v.quantity) ?? 1);
  return {
    key: lineKey(serviceId, variantId),
    serviceId,
    variantId,
    name,
    variantName: str(v.variantName),
    subtitle: str(v.subtitle),
    image: str(v.image),
    unitPrice,
    originalPrice: num(v.originalPrice),
    isStartingPrice: v.isStartingPrice === true,
    quantity: Math.min(MAX_LINE_QTY, Math.max(1, qty)),
  };
}

function cleanAddress(v: unknown): DraftAddress | null {
  if (!isObj(v) || !str(v.id) || !str(v.address)) return null;
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    id: text(v.id),
    label: text(v.label),
    restaurantName: text(v.restaurantName),
    address: text(v.address),
    city: text(v.city),
    state: text(v.state),
    zipCode: text(v.zipCode),
    contactName: text(v.contactName),
    phone: text(v.phone),
    lat: num(v.lat),
    lng: num(v.lng),
  };
}

/** Parse what storage holds into a usable cart, or null. Never throws. */
export function parseCart(raw: string | null, categoryId: number): CleaningCart | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || v.categoryId !== categoryId) return null;
  const seen = new Set<string>();
  const lines = (Array.isArray(v.lines) ? v.lines : [])
    .map(cleanLine)
    .filter((l): l is CartLine => l !== null && !seen.has(l.key) && !!seen.add(l.key));
  const windowId = ARRIVAL_WINDOWS.some((w) => w.id === v.windowId) ? (v.windowId as ArrivalWindowId) : null;
  return {
    categoryId,
    categoryName: str(v.categoryName) ?? "",
    lines,
    date: typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : null,
    windowId,
    address: cleanAddress(v.address),
    paymentMode: v.paymentMode === "COD" || v.paymentMode === "RAZORPAY" ? v.paymentMode : null,
  };
}

/* -------------------------------- storage ------------------------------- */

function readRaw(categoryId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_PREFIX + categoryId);
  } catch {
    return null;
  }
}

/** Save; returns false when storage refuses (private mode, quota). */
export function saveCart(cart: CleaningCart): boolean {
  if (typeof window === "undefined") return false;
  let ok = true;
  try {
    if (cart.lines.length === 0 && !cart.address) {
      window.localStorage.removeItem(KEY_PREFIX + cart.categoryId);
    } else {
      window.localStorage.setItem(KEY_PREFIX + cart.categoryId, JSON.stringify(cart));
    }
  } catch {
    ok = false;
  }
  // Fallback memory copy so the cart still works for this page visit.
  memory.set(cart.categoryId, JSON.stringify(cart));
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return ok;
}

// Used when localStorage is unavailable: the cart lasts until the tab closes.
const memory = new Map<number, string>();

const noopSubscribe = () => () => {};

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The cart for one category, live across tabs. `null` on the server and
 * during hydration, so the first client render matches the server's.
 */
export function useCleaningCart(categoryId: number, categoryName: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(categoryId) ?? memory.get(categoryId) ?? null,
    () => null,
  );
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const cart = useMemo(
    () => parseCart(raw, categoryId) ?? emptyCart(categoryId, categoryName),
    [raw, categoryId, categoryName],
  );

  const write = useCallback(
    (next: CleaningCart) => saveCart({ ...next, categoryName: next.categoryName || categoryName }),
    [categoryName],
  );

  const add = useCallback(
    (line: Omit<CartLine, "key" | "quantity">, quantity = 1) => {
      const key = lineKey(line.serviceId, line.variantId);
      const existing = cart.lines.find((l) => l.key === key);
      const lines = existing
        ? cart.lines.map((l) =>
            l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QTY, l.quantity + quantity) } : l,
          )
        : [...cart.lines, { ...line, key, quantity: Math.min(MAX_LINE_QTY, Math.max(1, quantity)) }];
      return write({ ...cart, lines });
    },
    [cart, write],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      const lines =
        quantity <= 0
          ? cart.lines.filter((l) => l.key !== key)
          : cart.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_LINE_QTY, quantity) } : l));
      return write({ ...cart, lines });
    },
    [cart, write],
  );

  const update = useCallback((patch: Partial<CleaningCart>) => write({ ...cart, ...patch }), [cart, write]);

  const quantityOf = useCallback(
    (serviceId: number, variantId: number | null = null) =>
      cart.lines.find((l) => l.key === lineKey(serviceId, variantId))?.quantity ?? 0,
    [cart],
  );

  /** Every option of one service in the cart, added up. */
  const serviceCount = useCallback(
    (serviceId: number) =>
      cart.lines.filter((l) => l.serviceId === serviceId).reduce((n, l) => n + l.quantity, 0),
    [cart],
  );

  return {
    /** False on the server and during hydration, before storage is read. */
    hydrated,
    cart,
    itemCount: cart.lines.reduce((n, l) => n + l.quantity, 0),
    add,
    setQuantity,
    update,
    quantityOf,
    serviceCount,
    clear: () => write(emptyCart(categoryId, categoryName)),
  };
}

/* ------------------------------ arrival time ---------------------------- */

export type ArrivalWindowId = "morning" | "afternoon" | "evening";

export interface ArrivalWindow {
  id: ArrivalWindowId;
  label: string;
  /** Minutes since midnight, IST. */
  start: number;
  end: number;
}

export const ARRIVAL_WINDOWS: ArrivalWindow[] = [
  { id: "morning", label: "Morning", start: 8 * 60, end: 12 * 60 },
  { id: "afternoon", label: "Afternoon", start: 12 * 60, end: 16 * 60 },
  { id: "evening", label: "Evening", start: 16 * 60, end: 20 * 60 },
];

/** Notice the crew needs before a same-day window opens. */
export const SAME_DAY_NOTICE = 60;

export function windowById(id: ArrivalWindowId | null): ArrivalWindow | null {
  return ARRIVAL_WINDOWS.find((w) => w.id === id) ?? null;
}

/** A window on `dateISO` can still be booked at `clock`. */
export function windowOpen(dateISO: string, w: ArrivalWindow, clock: Clock): boolean {
  if (dateISO > clock.dateISO) return true;
  if (dateISO < clock.dateISO) return false;
  return w.start >= clock.minutes + SAME_DAY_NOTICE;
}

/* --------------------------------- money -------------------------------- */

export interface CartCoupon {
  code: string;
  discountType?: "PERCENT" | "FLAT_TOTAL";
  discountPercent: number;
  flatTotal?: number | null;
}

export interface CartBill {
  /** Pre-tax amount of each line (unit × quantity). */
  lineBases: number[];
  subtotal: number;
  tax: number;
  /** The line the coupon rides on (it is redeemed on one booking). */
  couponLine: number;
  /** Pre-tax discount on that line (percentage coupons). */
  couponBaseDiscount: number;
  /** What the customer saves, GST included. */
  couponSaving: number;
  total: number;
  isFlat: boolean;
}

/**
 * The line a coupon rides on. The server prices a coupon booking from its
 * variant's single price, so a line with a variant AND a quantity above one
 * would be mispriced; prefer a line without that combination.
 */
export function couponLineIndex(lines: Pick<CartLine, "variantId" | "quantity">[]): number {
  const i = lines.findIndex((l) => l.variantId == null || l.quantity === 1);
  return i === -1 ? 0 : i;
}

/** Same rules as the hourly flow and the server: see pricing.ts. */
export function computeCartBill(
  lines: Pick<CartLine, "unitPrice" | "quantity" | "variantId">[],
  coupon: CartCoupon | null,
): CartBill {
  const lineBases = lines.map((l) => round2(l.unitPrice * l.quantity));
  const subtotal = round2(lineBases.reduce((a, b) => a + b, 0));
  const tax = round2(subtotal * TAX_RATE);
  const gross = round2(subtotal + tax);
  const couponLine = couponLineIndex(lines);
  const base = lineBases[couponLine] ?? 0;

  const isFlat = !!coupon && coupon.discountType === "FLAT_TOTAL" && coupon.flatTotal != null;
  let couponBaseDiscount = 0;
  let couponSaving = 0;
  if (coupon && lines.length) {
    if (isFlat) {
      couponSaving = Math.max(0, round2(base * (1 + TAX_RATE) - (coupon.flatTotal as number)));
    } else if (coupon.discountPercent > 0) {
      couponBaseDiscount = round2((base * coupon.discountPercent) / 100);
      couponSaving = round2(couponBaseDiscount * (1 + TAX_RATE));
    }
  }
  const total = Math.max(0, round2(gross - couponSaving));
  return { lineBases, subtotal, tax, couponLine, couponBaseDiscount, couponSaving, total, isFlat };
}

/** "HH:mm" for the API. */
function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * One booking per cart line, all on the same date, window and address. The
 * coupon rides on one booking, as in every other flow.
 */
export function buildCartPayloads(
  cart: CleaningCart,
  userId: number,
  coupon: CartCoupon | null,
): CreateBookingPayload[] {
  const address = cart.address;
  const window = windowById(cart.windowId);
  if (!cart.lines.length) throw new Error("Your cart is empty.");
  if (!cart.date || !window) throw new Error("Pick a date and an arrival time first.");
  if (!address) throw new Error("Pick an address before booking.");
  const bill = computeCartBill(cart.lines, coupon);

  return cart.lines.map((line, i) => {
    const carriesCoupon = i === bill.couponLine && !!coupon;
    const base = bill.lineBases[i];
    return {
      userId,
      professionalId: null,
      serviceId: line.serviceId,
      variantId: line.variantId,
      bookingDate: cart.date as string,
      startTime: hhmm(window.start),
      endTime: hhmm(window.end),
      totalAmount: carriesCoupon && !bill.isFlat ? round2(base - bill.couponBaseDiscount) : base,
      serviceLat: address.lat ?? 0,
      serviceLng: address.lng ?? 0,
      serviceCity: address.city,
      serviceAddress: address.address,
      paymentMode: cart.paymentMode ?? "COD",
      ...(carriesCoupon ? { couponCode: coupon!.code } : {}),
    };
  });
}

/* ----------------------------- catalog sync ----------------------------- */

export interface CatalogLookup {
  service: { serviceId: number; name: string; price: number | null; isActive?: boolean; profileImage: string | null };
  variant?: { variantId: number; name: string; price: number } | null;
}

/**
 * Bring stored lines in line with the live catalog: drop what was removed or
 * unpublished, refresh changed prices. Returns what changed, for a notice.
 */
export function reconcileLines(
  lines: CartLine[],
  find: (serviceId: number, variantId: number | null) => CatalogLookup | null,
): { lines: CartLine[]; removed: string[]; repriced: string[] } {
  const removed: string[] = [];
  const repriced: string[] = [];
  const next: CartLine[] = [];
  for (const line of lines) {
    const hit = find(line.serviceId, line.variantId);
    const label = line.variantName ? `${line.name} (${line.variantName})` : line.name;
    const price = line.variantId != null ? hit?.variant?.price : hit?.service.price;
    if (!hit || hit.service.isActive === false || price == null || (line.variantId != null && !hit.variant)) {
      removed.push(label);
      continue;
    }
    if (price !== line.unitPrice) repriced.push(label);
    next.push({ ...line, unitPrice: price });
  }
  return { lines: next, removed, repriced };
}
