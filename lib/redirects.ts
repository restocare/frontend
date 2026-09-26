/**
 * Single source of truth for every legacy-URL redirect and 410, consumed by
 * both next.config.ts (redirects()) and proxy.ts (410s). Every entry here
 * must resolve in one hop — never point `destination` at another row's
 * `source`. See docs/seo/404-resolution.md for the full outcome table this
 * was built from.
 */
import type { NextConfig } from "next";
import { CATEGORY_SLUGS } from "./category-slugs";

type RedirectsFn = NonNullable<NextConfig["redirects"]>;
export type RedirectRule = Awaited<ReturnType<RedirectsFn>>[number];

/** /category/<numeric id> -> /category/<slug>, one row per known category. */
const CATEGORY_ID_REDIRECTS: RedirectRule[] = CATEGORY_SLUGS.map(({ id, slug }) => ({
  source: `/category/${id}`,
  destination: `/category/${slug}`,
  permanent: true,
}));

/**
 * GSC 404 cleanup (docs/seo/404-resolution.md, outcomes B/C/D). Old
 * /services?category= query links and misspelled/legacy category slugs, all
 * from the decommissioned pre-Next platform.
 */
const LEGACY_URL_REDIRECTS: RedirectRule[] = [
  // Misspelling/variant of a real category slug (outcome C).
  { source: "/category/helpersnwaiters", destination: "/category/helpers-and-waiters", permanent: true },
  { source: "/category/cheff", destination: "/category/chef", permanent: true },
  { source: "/category/plumbing", destination: "/category/plumber", permanent: true },

  // Old /services?category= query links (outcome B) — matched before the
  // bare /services 410 in proxy.ts, since next.config redirects() run first.
  {
    source: "/services",
    destination: "/category/helpers-and-waiters",
    permanent: true,
    has: [{ type: "query", key: "category", value: "helper_waiter" }],
  },
  {
    source: "/services",
    destination: "/category/technician",
    permanent: true,
    has: [{ type: "query", key: "category", value: "expert_technician" }],
  },
  {
    source: "/services",
    destination: "/category/deep-cleaning",
    permanent: true,
    has: [{ type: "query", key: "category", value: "deep_cleaning" }],
  },

  // Old technician product-detail pages -> the category that replaces them.
  { source: "/technician/product/:id", destination: "/category/technician", permanent: true },

  // Legal pages, now live under different paths (outcome B).
  { source: "/privacy", destination: "/privacy-policy", permanent: true },
  { source: "/terms", destination: "/terms-and-conditions", permanent: true },
  { source: "/refund", destination: "/refund-cancellation-policy", permanent: true },
  { source: "/refund-policy", destination: "/refund-cancellation-policy", permanent: true },

  // Signup / login / partner (outcome B).
  { source: "/user/register", destination: "/account/login", permanent: true },
  { source: "/register", destination: "/account/login", permanent: true },
  { source: "/user/login", destination: "/account/login", permanent: true },
  { source: "/partner", destination: "/contact", permanent: true },
  { source: "/page/freelancer-registration", destination: "/contact", permanent: true },
];

export const REDIRECT_RULES: RedirectRule[] = [
  ...CATEGORY_ID_REDIRECTS,
  ...LEGACY_URL_REDIRECTS,
];

/**
 * Paths that must return 410 Gone (junk/internal paths, unmapped legacy
 * category slugs, or dead /categories/<id> URLs with no live equivalent).
 * Matched exactly by proxy.ts on pathname (query strings ignored) — no
 * wildcards, so each row stays auditable against docs/seo/404-resolution.md.
 */
export const GONE_PATHS: string[] = [
  // Bare /services (no matching ?category=) — falls through the redirects
  // above with no match, so it lands here.
  "/services",

  // Ambiguous old category slugs — no confirmed live equivalent.
  "/category/washing",
  "/category/hire",

  // Old MongoDB-backed /categories/<id> URLs from the decommissioned
  // pre-Next platform. Not present in this repo's Postgres/Prisma history
  // or any seed/export file — unmappable.
  "/categories/69d5c41afed655ae07d6c2cb",
  "/categories/69f4578a1d6c0724bd2602d1",
  "/categories/69d5c41efed655ae07d6c2f1",
  "/categories/69d5c428fed655ae07d6c3ff",
  "/categories/69d5c42afed655ae07d6c409",
  "/categories/69d5c41dfed655ae07d6c2d7",
  "/categories/69d5c41ffed655ae07d6c2fb",
  "/categories/69d5c427fed655ae07d6c3f7",

  // Junk / leftover paths from the old template.
  "/homeTemplateOne",
  "/$",

  // Old cart / payment / OTP endpoints from the decommissioned platform.
  "/payment/userede/page",
  "/payment/braintree/page",
  "/payment/ozow",
  "/payment/easypaisa",
  "/payment/razorpay/pay",
  "/product/updateCartQuantity",
  "/product/deletecartproduct",
  "/cartProducts",
  "/cartDelete",
  "/updateCartSlot",
  "/viewcart",
  "/make-payment",
  "/user/verifyPhoneLoginOtp",
];
