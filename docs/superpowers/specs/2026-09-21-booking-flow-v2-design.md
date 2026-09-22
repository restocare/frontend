# Booking flow v2 (Chef, Helpers & Waiter) — design

Date: 2026-09-21. Status: approved by the product owner via the prototype
screens in `D:\RC\Redesign\Chaf_Helper_waiter` and the chat brief of the
same day. Revised the same day: the prototype was a phone mockup that
supplied the flow and the copy; the build is a desktop web design inside
the site's normal header and footer, responsive down to phones.

## Goal

Add a second, switchable customer booking flow for the staffing categories
(Chef, Helpers & Waiter): a category page whose "Book now" opens a
three-step wizard (date and hours, address, review), priced per hour, that
creates real bookings through the existing API. The current flow stays
intact and is selected by a switch.

## The switch

- Key `rc.bookingFlow` in `localStorage`, value `"1"` or `"2"`.
- Default: `NEXT_PUBLIC_BOOKING_FLOW` (env, `"1"` or `"2"`), else `1`.
  `.env.local` (gitignored) sets `2` for local development; production
  stays on `1` until the variable is set on the host.
- Any page opened with `?flow=1` or `?flow=2` writes the key, then the
  value is used everywhere until changed.
- Read through `useBookingFlow()` (`useSyncExternalStore`; server
  snapshot is the env default so hydration never mismatches).
- Only two places branch: the category page (`/category/[id]`) and the
  booking page (`/booking/[serviceId]`). Everything else is shared.
- Flow 2 applies only to categories where `categoryUsesSlots(name)` is
  true (name contains chef, helper or waiter). Other categories render
  exactly as today on both values.

## Flow 2 category page

Replaces the current category page for staffing categories. It sits inside
the site header and footer.

- Banner: the same full-width banner as every category page (category
  `bannerImage || profileImage`, dark gradient, breadcrumb), the category
  name, the line "Quality-checked professionals, booked by the hour for
  the date and time you need", and chips "Verified professionals",
  "Custom hours", "{n} services available". The site header's search box
  filters the list; `?q=` pre-fills it.
- Heading "Choose a chef" when the category name is a single word,
  otherwise "Choose a service"; sub-line "Pick who you need. You set the
  date and hours on the next step."
- A grid of cards, three across on desktop, two on tablets, one on phones:
  image on top, name, description clamped to three lines, chips "Custom
  hours" and "Minimum {min} hrs", price block `₹{rate}` with `/hour` unit,
  "Taxes extra" with a "View details" toggle that un-clamps the
  description, and a "Book now" button.
- `rate` = `service.price` when > 0, else the cheapest variant price
  divided by its parsed hours. `min` = shortest parsed duration among the
  variants, else 5.
- "Book now" starts a draft (see below) and navigates to
  `/booking/{serviceId}`. No variant picker on flow 2.
- Coming-soon and not-found states keep today's copy.

## The wizard (`/booking/[serviceId]` on flow 2)

Single client page. The step is the `step` query param: `time`
(default), `address`, `review`. Navigation between steps uses
`router.push`, so the browser back button steps back.

Layout on every step, inside the site header and footer: a breadcrumb
(Home / {category} / earlier steps as links / current step), the title
"Book a {service}", and a numbered three-step stepper (done = ink with a
check, current = yellow, upcoming = grey). Below, two columns on desktop:
the step's content on the left, and on the right a sticky summary card
with the service thumb, name, "₹{rate}/hour, minimum {min} hrs", a
"Change" link back to the category page, the date, time and duration
chosen so far, the bill rows, the total, and the step's primary button.

On phones (below the `md` breakpoint) the header block changes: the three
steps become a full-width strip directly under the site header, each
number centred in its own column with the label underneath and a line
joining the numbers (dark up to the current step, light after it); the
breadcrumb collapses to a single back link to the previous crumb (the
category page on step 1, the previous step afterwards); the title follows.
The columns stack and the primary button moves into a fixed bottom bar
with the total.

Draft: `sessionStorage` key `rc.bookingV2`, one object. If the page opens
without a draft, or with a draft for another service (deep link
`/book/{id}` from WhatsApp), the wizard fetches the category tree, finds
the service, and starts a draft from it.

### Step 1, Date & time

- Date picker: 7 days from today (IST) as chips with weekday, day number
  and month on the first chip and on the 1st of a month. Seven per row on
  `sm` and up; on phones a single row that scrolls sideways (scrollbar
  hidden, bleeding to the card edge so a partly visible chip hints at the
  scroll), and a day chosen earlier is scrolled into view on load. A day
  is disabled when no valid start remains on it.
- Start and end time as two tiles side by side at every width: each a
  bordered rounded tile with a clock badge in a yellow-tint circle (from
  `sm` up), the caption "Start time" or "End time", the chosen time in
  bold (18px from `sm` up) and a chevron. The native `<select>` in
  one-hour steps sits invisibly over the whole tile, so a tap anywhere
  opens the picker and the focus ring lands on the tile. A round grey
  connector with a right chevron sits between the tiles from `sm` up.
  Day window 6:00 AM to 12:00 AM (midnight).
  Same-day starts must be at least 30 minutes from now, rounded up to the
  next hour. End must be at least `min` hours after start and at most 12
  hours after it (`MAX_MINUTES`); the end list only offers that range and
  a stored end outside it is clamped. `min` is the shortest variant
  floored at 5 hours (`MIN_MINUTES`). A stored time that is not on the
  hour snaps to the nearest hour. The hint reads "Minimum {min} hours,
  maximum 12 hours. Extend by the hour."
- Defaults: tomorrow, and the first variant's window (for example 11 AM
  to 4 PM) when the variant name carries one, else 11:00 to 11:00 + min.
- The tiles span the card's full width, like the date row above them.
- Under the tiles, only one quiet sentence: "{Tue 22 Sep}, {start} to
  {end}. {n} hrs at ₹{rate} an hour." with the hours in bold. Or an
  error: "Minimum booking is {min} hours. Pick a later end time.",
  "Maximum booking is 12 hours. Pick an earlier end time." or "That start
  time has passed. Pick a later time." Nothing else: the owner asked for
  a clean card, so no length chips, no day timeline and no grey strip.
- The summary card shows date, time and duration, rows `{hrs} hrs ×
  ₹{rate}`, `Taxes (18%)`, `Total`, and "Next: address", disabled while
  invalid.

### Step 2, Address

- Requires a signed-in customer. If not signed in after hydration,
  `router.replace("/account/login?redirect=/booking/{id}?step=address")`.
  The draft survives in session storage.
- Heading "Where should the chef come?" (or "Where should the staff
  come?" for other staffing categories); note "Pick a saved address or add
  a new one. The contact person gets the arrival call."
- Saved addresses from `GET /v1/auth/user/{id}/addresses`, shown as one
  bordered list of full-width radio rows with dividers (never a grid):
  label tag and restaurant name from the profile, the address line with
  city and pincode, then contact name and mobile from the profile. The
  selected row gets a yellow left accent and tint.
- "+ Add a new address" reveals a form card: type chips (Restaurant,
  Cloud kitchen, Other), a location box, and a two-column field
  grid: Restaurant name, Contact name, Flat / building / street, Area or
  locality, City, Pincode, State, GST number (optional).
- The location box holds a search input ("Search area, landmark or
  restaurant") and a "Use current location" button, so a customer can
  book for a restaurant they are not standing in. Search uses the same
  Google Places autocomplete as the dispatcher's geofence editor
  (`fetchPlaceSuggestions`, India only, 300 ms debounce, from three
  characters); picking a suggestion resolves its coordinates. Current
  location uses the browser Geolocation API. Both then run the
  reverse-geocode chain the checkout uses (Google, then OpenStreetMap,
  then BigDataCloud) to fill area, city, state, pincode and the pin.
- Save: `POST /v1/auth/user/{id}/addresses` with label, address
  (`"{flat}, {area}"`), city, state, zipCode, latitude, longitude,
  isDefault true; then `PATCH /v1/auth/user/{id}/profile` with name,
  restaurantName and gstNumber. Then the list refetches and the new
  address is selected.
- Validation: flat, area, city, 6-digit pincode and contact name are
  required; coordinates are required (without them the backend records
  the booking as demand and never dispatches it), so a saved address
  without coordinates is shown disabled with the note to add it again
  with the current location.
- The summary card adds an "Address" line once one is chosen; "Next:
  review" is disabled until an address with coordinates is selected.

### Step 3, Review

- Service card: thumb, name, date, time and duration, Edit link to step
  1. Below it a quantity row "Chefs" ("People" for other categories) with
  the note "Same hours for each chef. Each one is a separate booking." and
  a stepper from 1 to 5.
- Address card with Change link to step 2.
- Coupon card: input plus Apply, using `GET /v1/coupons`,
  `POST /v1/coupons/apply`, `DELETE /v1/coupons/remove/{id}`. The
  customer's unused coupons are listed under the input. Applied state
  shows "{code} applied" with Remove.
- Payment method radio cards: "Pay online" with note "UPI, cards and
  netbanking" (Razorpay) and "COD" with note "Cash or UPI to the chef
  after the service" (COD). A coupon flagged `prepaidOnly` blocks "COD"
  with the same message checkout uses.
- The summary card shows the chosen payment method, the bill rows `{hrs}
  hrs × ₹{rate}` (plus `× {n} chefs` when n > 1), `Coupon {code}` when
  applied, `Taxes (18%)`, and "Amount payable"; "Confirm booking" is
  disabled until address and payment are set.
- Confirm: for Razorpay, create the order for the amount payable, open
  Razorpay, verify, then create the bookings; for COD create the bookings
  directly. One `POST /v1/booking/book` per person booked. Each payload
  carries `userId`, `professionalId: null`, `serviceId`, `variantId`,
  `bookingDate`, `startTime`, `endTime`, `totalAmount` (pre-tax hours ×
  rate; the coupon's percentage share is subtracted on the first booking
  only, and the code rides on that booking, mirroring checkout),
  `serviceLat`, `serviceLng`, `serviceCity`, `serviceAddress`,
  `paymentMode`. `endTime` of midnight is sent as `23:59`. `variantId`
  is the variant whose parsed duration equals the chosen hours and whose
  start matches, else one with the same duration, else null.
- Success: a centred card with a green check, "Booking confirmed", the
  booking IDs, a one-sentence summary, and the buttons "View my orders"
  and "Book another chef" (category page). The draft is cleared.

## Pricing rules

- `rate` per hour as defined above. `subtotal = hours × rate × quantity`.
- Percent coupon: discount = `hours × rate × percent / 100` on one
  booking; the customer-facing saving is that × 1.18, as checkout shows.
- Flat-total coupon: saving = subtotal + tax − flatTotal, floor 0.
- `tax = subtotal × 0.18`, `total = subtotal + tax − saving`, all rounded
  to two decimals.

## Visual tokens

The site's own typeface and grey scale (white cards, `gray-100` borders,
`gray-900` text, `gray-500` secondary text, rounded-2xl cards with a
soft shadow), so flow 2 reads as part of the storefront. The prototype's
accent colours are registered once as Tailwind theme colours prefixed
`rc-` and used for primary actions, the current step and links: yellow
`#F4B400`, deep yellow `#B57F00`, yellow tint `#FFF3CC`, green
`#1E8E3E`, red `#C0392B`.

## Out of scope

- The cancellation-policy sentence and the replacement guarantee in the
  prototype are not shown; they are business promises nobody has
  confirmed.
- The cart, mini-cart and flow-1 checkout are untouched.
- Deep Cleaning and every other category keep the current pages.
- No backend changes. If the booking endpoint rejects `endTime`, the field
  is dropped and the end time is lost on the booking record.

## Files

Created: `src/lib/booking-flow.ts`, `src/components/booking-flow-sync.tsx`,
`src/lib/booking-v2/pricing.ts`, `src/lib/booking-v2/schedule.ts`,
`src/lib/booking-v2/draft.ts`, `src/lib/reverse-geocode.ts`,
`src/lib/razorpay.ts`, `src/components/booking-v2/shell.tsx`,
`src/components/booking-v2/category-page-v2.tsx`,
`src/components/booking-v2/wizard.tsx`,
`src/components/booking-v2/step-time.tsx`,
`src/components/booking-v2/step-address.tsx`,
`src/components/booking-v2/step-review.tsx`.

Modified: `app/globals.css` (theme colours), `src/components/providers.tsx`
(mount the flow sync), `app/category/[id]/page.tsx` (branch),
`app/booking/[serviceId]/page.tsx` (branch), `src/api/api.ts`
(`endTime?` on `CreateBookingPayload`).
