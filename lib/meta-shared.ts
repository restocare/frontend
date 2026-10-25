/**
 * Meta Pixel / Conversions API settings shared by the browser helper
 * (lib/meta.ts) and the server route (app/api/meta/capi/route.ts).
 * Keep this file free of browser- and server-only imports.
 */

export const META_GRAPH_API_VERSION = "v21.0";

/** Standard events the site fires. The CAPI route rejects anything else. */
export const META_ALLOWED_EVENTS = [
  "PageView",
  "ViewContent",
  "Lead",
  "Contact",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "Schedule",
  "CompleteRegistration",
] as const;

export type MetaEventName = (typeof META_ALLOWED_EVENTS)[number];

export function isMetaEventName(name: unknown): name is MetaEventName {
  return typeof name === "string" && (META_ALLOWED_EVENTS as readonly string[]).includes(name);
}

/** The support line every WhatsApp / tel link on the site points at. */
export const SUPPORT_PHONE_DIGITS = "919953532995";

/** NEXT_PUBLIC_* values are inlined at build time, so read them statically. */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
