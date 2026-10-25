/**
 * Browser-side Meta Pixel tracking with server-side Conversions API (CAPI)
 * mirroring. Every event gets one `eventID` that is sent both to the pixel
 * (`fbq`) and to /api/meta/capi so Meta deduplicates the pair.
 *
 * Safe to import anywhere: every function is a no-op during SSR, when the
 * pixel id is missing, or when the pixel script is blocked.
 */
import { META_PIXEL_ID, SUPPORT_PHONE_DIGITS, type MetaEventName } from "./meta-shared";

export type MetaEventParams = Record<
  string,
  string | number | boolean | string[] | number[] | undefined
>;

/** Raw (unhashed) customer details. Hashed on the server before reaching Meta. */
export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface MetaCapiPayload {
  event_name: MetaEventName;
  event_id: string;
  event_time: number;
  event_source_url: string;
  fbp?: string;
  fbc?: string;
  custom_data?: MetaEventParams;
  user_data?: MetaUserData;
}

const CAPI_ENDPOINT = "/api/meta/capi";

export function isMetaEnabled(): boolean {
  return typeof window !== "undefined" && META_PIXEL_ID.length > 0;
}

export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Very old browsers: still unique enough for deduplication.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return undefined;
}

/**
 * `_fbc` is normally set by the pixel from a `fbclid` landing param. When the
 * cookie is missing but the param is present (first page view, ad blockers),
 * build it the way the pixel would: `fb.1.<ms timestamp>.<fbclid>`.
 */
export function readFbc(): string | undefined {
  const cookie = readCookie("_fbc");
  if (cookie) return cookie;
  if (typeof window === "undefined") return undefined;
  try {
    const fbclid = new URL(window.location.href).searchParams.get("fbclid");
    if (!fbclid) return undefined;
    const value = `fb.1.${Date.now()}.${fbclid}`;
    // Persist so later events (and the pixel) agree on the same click id.
    document.cookie = `_fbc=${encodeURIComponent(value)}; path=/; max-age=${
      90 * 24 * 60 * 60
    }; SameSite=Lax`;
    return value;
  } catch {
    return undefined;
  }
}

function sendToCapi(payload: MetaCapiPayload, beforeNavigation: boolean): void {
  const body = JSON.stringify(payload);
  try {
    if (
      beforeNavigation &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const ok = navigator.sendBeacon(
        CAPI_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (ok) return;
    }
    void fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // Never let analytics break the page.
  }
}

export interface TrackOptions {
  /** The click is about to leave the page (tel:, wa.me, outbound): use sendBeacon. */
  beforeNavigation?: boolean;
  /** Reuse an id (e.g. when one click should fire two events sharing a source). */
  eventId?: string;
}

/**
 * Fire a standard event to the browser pixel and to the Conversions API with
 * a shared event id. Returns the id, or null when tracking is off.
 */
export function trackEvent(
  name: MetaEventName,
  params?: MetaEventParams,
  userData?: MetaUserData,
  options: TrackOptions = {},
): string | null {
  if (!isMetaEnabled()) return null;
  const eventId = options.eventId ?? newEventId();
  const customData = params ? stripEmpty(params) : undefined;

  try {
    if (typeof window.fbq === "function") {
      window.fbq("track", name, customData ?? {}, { eventID: eventId });
    }
  } catch {
    // Pixel blocked or threw: the server event below still goes out.
  }

  const payload: MetaCapiPayload = {
    event_name: name,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
    fbp: readCookie("_fbp"),
    fbc: readFbc(),
    custom_data: customData,
    user_data: userData ? stripEmpty(userData) : undefined,
  };
  sendToCapi(payload, options.beforeNavigation === true);
  return eventId;
}

/** PageView goes to the pixel and CAPI like every other event. */
export function trackPageView(): void {
  trackEvent("PageView");
}

/**
 * Purchase once per order: the order id is remembered in sessionStorage so a
 * re-render, back navigation or a refresh of the confirmation screen never
 * reports the same order twice.
 */
export function trackPurchaseOnce(
  orderId: string,
  params: MetaEventParams & { value: number; currency: string },
  userData?: MetaUserData,
): void {
  if (!isMetaEnabled() || !orderId) return;
  const key = `rc.meta.purchase.${orderId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked: fire anyway rather than lose the conversion.
  }
  trackEvent("Purchase", { ...params, order_id: orderId }, userData);
}

/** Pathname-based label used as `content_category` for contact clicks. */
export function currentPageLabel(): string {
  if (typeof window === "undefined") return "unknown";
  const path = window.location.pathname;
  if (path === "/") return "home";
  return path.replace(/^\/+|\/+$/g, "").split("/").join("_") || "home";
}

export type ContactChannel = "whatsapp" | "phone_call";

/** Which support channel an anchor's href opens, or null if it is not one. */
export function contactChannelFromHref(
  href: string | null | undefined,
): ContactChannel | null {
  if (!href) return null;
  const value = href.trim().toLowerCase();
  if (value.startsWith("tel:")) {
    const digits = value.replace(/\D/g, "");
    // Only the support line counts: customers also call partners from /account.
    return digits.endsWith(SUPPORT_PHONE_DIGITS.slice(-10)) ? "phone_call" : null;
  }
  const isWhatsApp =
    value.startsWith("https://wa.me/") ||
    value.startsWith("https://api.whatsapp.com/") ||
    value.startsWith("https://web.whatsapp.com/") ||
    value.startsWith("whatsapp:");
  if (isWhatsApp && value.includes(SUPPORT_PHONE_DIGITS)) return "whatsapp";
  return null;
}

/**
 * Fire the events for a support click: Contact for every channel, plus Lead
 * for WhatsApp (a WhatsApp conversation is how most bookings start).
 */
export function trackContactClick(channel: ContactChannel, params: MetaEventParams = {}): void {
  const base: MetaEventParams = {
    content_name: channel,
    content_category: currentPageLabel(),
    ...params,
  };
  trackEvent("Contact", base, undefined, { beforeNavigation: true });
  if (channel === "whatsapp") {
    trackEvent("Lead", base, undefined, { beforeNavigation: true });
  }
}

function stripEmpty<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out as T;
}
