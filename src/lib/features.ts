/**
 * Storefront feature switches.
 *
 * SHOW_PRODUCTS — the Products (cleaning chemicals & supplies) section.
 * While false, every link to /products is hidden (header, footer, About,
 * 404 page, sitemap) and search engines are asked not to index it. The
 * /products pages themselves stay in the codebase and still open by direct
 * URL. Set to true to bring the links back.
 */
export const SHOW_PRODUCTS = false;

/** Booking illustrations. Public flags are read at build time; rebuild after changing. */
export const SHOW_BOOKING_ANIMATIONS =
  process.env.NEXT_PUBLIC_SHOW_BOOKING_ANIMATIONS === "true";
