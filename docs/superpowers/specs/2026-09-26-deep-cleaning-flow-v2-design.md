# Deep Cleaning on booking flow v2 — design

Date: 2026-09-26. Status: approved in chat by the product owner ("design a
second flow of deep cleaning design"), building on the prototype in
`D:\RC\Redesign\Deep_Cleaning\deep-cleaning.html` (a phone mockup of the
category page only) and the live catalogue.

## Goal

Give the Deep Cleaning category its own flow-2 design: a category page in
the prototype's spirit (sub-category tiles, rows grouped with a pricing
basis, one "Book" per row) and a short booking wizard, all driven by the
live API. The existing pages stay on switch value 1.

## The switch

Deep Cleaning has its own switch, independent of the chef flow's:
`NEXT_PUBLIC_DEEP_CLEANING_FLOW`, read once at build time in
`src/lib/deep-cleaning-flow.ts` (`useDeepCleaningFlow()`; unset means 1).
`.env.production` pins `1`, so the live site keeps the current Deep
Cleaning page until the new design is complete; `.env.local` sets `2`
for development. The category page opens the flow-2 component when either
switch is 2; that component shows the new cleaning page only for
categories where `isCleaningCategory(name)` is true (name contains
"clean") and this switch is 2, and falls back to the production page
otherwise. Every other category still renders flow 1 regardless.

## The catalogue

The live Deep Cleaning category (id 9) has 22 equipment-level services
with a fixed `price` and no variants, and no sub-categories. The owner's
direction (2026-09-26): list the prototype's size-based packages as a
**static design** for now. They live in
`src/lib/booking-v2/cleaning-packages.ts` (four sub-categories, 20
packages, prices pre-tax, `from` for starting prices, the two group notes)
and are swapped for API data once the backend catalogue has them. Only
the banner (image, name) comes from the API category.

## Category page (`/category/9` on flow 2)

Inside the site header and footer, desktop first, responsive to phones.

- **Banner:** the same full-width banner as the chef page (banner image or
  video, dark gradient, breadcrumb), the category name, the line
  "Commercial kitchen and restaurant cleaning, priced per item", chips
  "{n} services", "Fixed prices", "Taxes extra". The header's search box
  filters the rows; `?q=` pre-fills it.
- **Sub-category tiles:** the prototype's four, in this order and as a
  grid (two across on phones, four on desktop): Washroom "3 sizes",
  Kitchen "7 sizes", Sitting & Service Area "4 sizes", Full Restaurant
  "6 types", each with the prototype's icon. Tapping a tile shows only that
  sub-category, turns the list heading into its title with its basis line,
  and writes `?sub={key}`; tapping it again or "Show all" clears.
- **How booking works:** one white strip under the tiles with the
  wizard's three steps, numbered in yellow: "Pick a package", "Choose date
  and slot", "Crew arrives", each with a one-line note.
- **Cards** under each sub-category heading ("Washroom Deep Cleaning")
  and basis line ("Priced by fixture count"), in a grid: one across on
  phones, two on tablets, three on desktop, four on wide screens. Each
  card: icon tile, package name, the size or scope line, then above a
  hairline the price in large type with "from" above it where it is a
  starting price and "before tax" beneath, and a yellow "Book" button.
  The Sitting and Full Restaurant groups end with their note from the
  prototype. "Book" is inert in the static design.
- Coming-soon, not-found and error states keep the chef page's copy.

## Wizard (`/booking/{serviceId}` on flow 2, cleaning categories)

The chef wizard's shell, address and review steps, with step 1 replaced:

1. **Date & arrival window:** the 7-day picker, then three arrival windows
   as radio cards, Morning 8 AM to 12 PM, Afternoon 12 PM to 4 PM, Evening
   4 PM to 8 PM (same-day windows that have started are disabled), then a
   quantity stepper "Items" 1 to 10 (e.g. three burners). Summary card:
   date, window, items, `{n} × ₹{price}`, Taxes (18%), Total.
2. **Address:** the existing step, heading "Where should the crew come?".
3. **Review:** the existing step with the item, quantity, window, address,
   coupon and payment. One booking per item quantity is NOT created:
   quantity rides in the bill and `totalAmount` (price × quantity,
   pre-tax), one `POST /v1/booking/book` per booking, `startTime` and
   `endTime` set to the window's bounds. `variantId` is null.

Pricing: `subtotal = price × quantity`, GST 18%, coupons as the chef flow.

## Out of scope

The prototype's add-ons, night/emergency surcharge, photo quote requests
and the 48-hour re-clean guarantee: the API has no inputs for them and the
guarantee is an unconfirmed promise. The prototype's packages wait for the
backend catalogue.

## Files

Created: `src/lib/booking-v2/cleaning.ts`,
`src/components/booking-v2/cleaning-page.tsx`,
`src/components/booking-v2/step-window.tsx`.
Modified: `src/components/booking-v2/category-page-v2.tsx` (route cleaning
categories to the new page), `src/components/booking-v2/wizard.tsx`
(cleaning categories use the window step), `src/lib/booking-v2/draft.ts`
(a `kind: "hourly" | "cleaning"` on the draft).
