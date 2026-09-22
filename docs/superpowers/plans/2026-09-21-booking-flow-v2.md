# Booking flow v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a switchable second booking flow for staffing categories: prototype-styled category page, three-step wizard priced per hour, bookings created through the existing API.

**Architecture:** A `localStorage` flag read through `useSyncExternalStore` selects flow 1 (today's pages) or flow 2 at two branch points. Flow 2 is a set of client components under `src/components/booking-v2` fed by pure modules under `src/lib/booking-v2` (pricing, schedule, draft). The wizard is one route with a `step` query param and a session-storage draft.

**Tech Stack:** Next 16 app router, React 19, Tailwind 4 (`@theme inline` tokens), TanStack Query 5, `next/font/google` Roboto Slab, existing `src/api/api.ts` clients.

**Spec:** `docs/superpowers/specs/2026-09-21-booking-flow-v2-design.md`

## Global Constraints

- Files in this repo are CRLF; keep them CRLF.
- No test runner exists. Pure modules are verified with `node --experimental-strip-types` scratch scripts; UI is verified with `npx eslint`, `npx tsc --noEmit` and headless Edge screenshots against the running dev server on port 3000.
- Do not modify `app/checkout/page.tsx`, `app/cart/page.tsx`, `src/lib/cart.tsx` or `src/components/cart/cart-layer.tsx`.
- Do not commit; the owner commits.
- Copy rules from the spec: no cancellation-policy sentence, no guarantee text, sentence case, no all-caps labels.

---

### Task 1: The flow switch

**Files:**
- Create: `src/lib/booking-flow.ts`
- Create: `src/components/booking-flow-sync.tsx`
- Modify: `src/components/providers.tsx` (mount `<BookingFlowSync />` next to `<CartLayer />`)

**Interfaces:**
- Produces: `type BookingFlow = 1 | 2`; `readBookingFlow(): BookingFlow`; `writeBookingFlow(flow: BookingFlow): void`; `useBookingFlow(): BookingFlow`; `applyBookingFlowFromUrl(search: string): BookingFlow | null`.

- [ ] **Step 1: Write `src/lib/booking-flow.ts`**

```ts
"use client";
import { useSyncExternalStore } from "react";

export type BookingFlow = 1 | 2;
export const BOOKING_FLOW_KEY = "rc.bookingFlow";
const EVENT = "rc:booking-flow";

function parse(value: string | null | undefined): BookingFlow | null {
  return value === "1" ? 1 : value === "2" ? 2 : null;
}
const DEFAULT_FLOW: BookingFlow = parse(process.env.NEXT_PUBLIC_BOOKING_FLOW) ?? 1;

export function readBookingFlow(): BookingFlow {
  if (typeof window === "undefined") return DEFAULT_FLOW;
  try { return parse(window.localStorage.getItem(BOOKING_FLOW_KEY)) ?? DEFAULT_FLOW; }
  catch { return DEFAULT_FLOW; }
}
export function writeBookingFlow(flow: BookingFlow): void {
  try { window.localStorage.setItem(BOOKING_FLOW_KEY, String(flow)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}
export function applyBookingFlowFromUrl(search: string): BookingFlow | null {
  const wanted = parse(new URLSearchParams(search).get("flow"));
  if (wanted) writeBookingFlow(wanted);
  return wanted;
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVENT, cb); };
}
export function useBookingFlow(): BookingFlow {
  return useSyncExternalStore(subscribe, readBookingFlow, () => DEFAULT_FLOW);
}
```

- [ ] **Step 2: Write `src/components/booking-flow-sync.tsx`** — a client component whose only effect calls `applyBookingFlowFromUrl(window.location.search)` on mount and on `popstate`; renders null.
- [ ] **Step 3: Mount it in `providers.tsx`** after `<CartLayer />`.
- [ ] **Step 4: Verify** — `npx eslint src/lib/booking-flow.ts src/components/booking-flow-sync.tsx src/components/providers.tsx`.

### Task 2: Pure pricing module

**Files:**
- Create: `src/lib/booking-v2/pricing.ts`
- Test: scratch script run with `node --experimental-strip-types`

**Interfaces:**
- Produces: `TAX_RATE = 0.18`; `round2(n)`; `interface BillInput { hours: number; rate: number; quantity: number; coupon?: { discountType?: "PERCENT" | "FLAT_TOTAL"; discountPercent: number; flatTotal?: number | null } | null }`; `interface Bill { perBookingBase: number; subtotal: number; tax: number; couponBaseDiscount: number; couponSaving: number; total: number; isFlat: boolean }`; `computeBill(input: BillInput): Bill`.

- [ ] **Step 1: Write the scratch test** (`scratchpad/pricing.test.ts`): 5 h × 149 × 1 → subtotal 745, tax 134.1, total 879.1; with a 10 percent coupon → couponBaseDiscount 74.5, couponSaving 87.91, total 791.19; flat total 1 → saving 878.1, total 1; quantity 2 → subtotal 1490.
- [ ] **Step 2: Run it, expect failure (module missing).**
- [ ] **Step 3: Implement** per the spec's pricing rules.
- [ ] **Step 4: Run it, expect all assertions to pass.**

### Task 3: Pure schedule module

**Files:**
- Create: `src/lib/booking-v2/schedule.ts` (imports `parseVariantShift`, `parseTimeToken`, `istNow`, `getNextDays` from `../booking-shifts`)

**Interfaces:**
- Produces: `STEP_MINUTES = 60`, `DAY_START = 360`, `DAY_END = 1440`, `DAYS_AHEAD = 7`, `SAME_DAY_LEAD = 30`; `fmtTime(minutes): string` ("11:00 AM", 1440 → "12:00 AM"); `fmtDuration(minutes): string` ("5 hrs", "5 hrs 30 min"); `toHHmm(minutes): string` (1440 → "23:59"); `earliestStart(dateISO, now: {dateISO, minutes}): number`; `latestStart(minMinutes): number`; `timeOptions(from, to): number[]`; `minShiftMinutes(variants: {name: string}[]): number` (default 300); `defaultWindow(variants, minMinutes): {start, end}`; `pickShiftVariant(variants: {variantId: number; name: string}[], start, end): number | null`; `isValidRange(start, end, minMinutes, dateISO, now): "ok" | "too-short" | "passed"`.

- [ ] **Step 1: Scratch test**: `fmtTime(660) === "11:00 AM"`, `fmtTime(1440) === "12:00 AM"`, `toHHmm(1440) === "23:59"`, `earliestStart("2026-09-22", {dateISO: "2026-09-22", minutes: 9*60+5}) === 570` (9:35 rounded up to 10:00 = 600? no: 545+30 = 575 → ceil to 600); write the expected values explicitly and fix the implementation until they hold; `minShiftMinutes([{name: "5 Hour Shift (11 AM – 4 PM)"}, {name: "1 Week Day Shift"}]) === 300`; `defaultWindow(same, 300)` → `{start: 660, end: 960}`; `pickShiftVariant` returns 26 for start 660, end 960 given the live Chinese Chef variants.
- [ ] **Step 2: Run, expect failure. Step 3: Implement. Step 4: Run, expect pass.**

### Task 4: Draft store and payload builder

**Files:**
- Create: `src/lib/booking-v2/draft.ts`
- Modify: `src/api/api.ts` — add `endTime?: string;` to `CreateBookingPayload` after `startTime`.

**Interfaces:**
- Produces: `interface DraftAddress { id: string; label: string; restaurantName: string; address: string; city: string; state: string; zipCode: string; contactName: string; phone: string; lat: number | null; lng: number | null }`; `interface BookingDraft { serviceId; serviceName; serviceImage; categoryId; categoryName; rate; minMinutes; variants: {variantId; name; price}[]; date: string; start: number; end: number; quantity: number; address: DraftAddress | null; paymentMode: "COD" | "RAZORPAY" | null }`; `loadDraft(): BookingDraft | null`; `saveDraft(d)`; `clearDraft()`; `startDraft(service: CategoryTreeService, category: {categoryId; name}): BookingDraft`; `buildPayloads(draft, userId, coupon | null): CreateBookingPayload[]`.

- [ ] Implement with `sessionStorage` key `rc.bookingV2`; `startDraft` derives `rate`, `minMinutes`, default `date` (tomorrow via `getNextDays(2)[1]`), window from `defaultWindow`. `buildPayloads` follows the spec's payload rules, using `computeBill` for the first-booking discount.
- [ ] Verify with a scratch script that two people, 5 h × 149 and a 10 percent coupon produce `[{totalAmount: 670.5, couponCode}, {totalAmount: 745}]`.

### Task 5: Shared shell, theme tokens, geocode and Razorpay helpers

**Files:**
- Modify: `app/globals.css` — add inside the existing `@theme inline` block: `--color-rc-yellow: #F4B400; --color-rc-yellow-deep: #B57F00; --color-rc-yellow-tint: #FFF3CC; --color-rc-ink: #1C1A17; --color-rc-ink-2: #4A4642; --color-rc-muted: #7A7570; --color-rc-ground: #F5F6FA; --color-rc-line: #E7E8EE; --color-rc-green: #1E8E3E; --color-rc-red: #C0392B;`
- Create: `src/lib/reverse-geocode.ts` — `reverseGeocode(lat, lng): Promise<{address, city, state, country, zipCode}>`, a copy of the checkout chain.
- Create: `src/lib/razorpay.ts` — `loadRazorpayScript(): Promise<boolean>`; `openRazorpay(order: CreatedRazorpayOrder, prefill: {name?, email?, contact?}, description: string): Promise<VerifyRazorpayPayload>`.
- Create: `src/components/booking-v2/shell.tsx` — `robotoSlab` font; `Shell({children})` wrapper (`data-theme="light"`, ground background, max-width 430 centred on ≥520px like the prototype frame); `TopBar({title, onBack})`; `Steps({current: 0|1|2})`; `ServiceStrip({image, name, sub, onChange})`; `BottomBar({total, note, action})`; `ChoiceCard({selected, onSelect, title, tag?, lines?, meta?, disabled?})`; `Thumb({src, fallback, size})`.

- [ ] Write each file; run eslint on them.

### Task 6: Flow-2 category page

**Files:**
- Create: `src/components/booking-v2/category-page-v2.tsx`
- Modify: `app/category/[id]/page.tsx` — in `CategoryPage`, `const flow = useBookingFlow();` and render `<CategoryPageV2 />` when `flow === 2`, else the existing content. `CategoryPageV2` itself falls back to the existing content for non-staffing categories by returning `null` from a `shouldUseV2(category)` check and letting the caller render flow 1 (implement as: `CategoryPage` renders `<CategoryRouter />` which loads the tree, then picks).

- [ ] Build the hero, heading, search toggle and cards per the spec, using the shell's `Thumb`. "Book now" → `saveDraft(startDraft(service, category))`, `router.push(`/booking/${service.serviceId}`)`.
- [ ] Verify: eslint, tsc, screenshot `http://localhost:3000/category/5?flow=2` at 430 px.

### Task 7: Wizard route and Step 1

**Files:**
- Create: `src/components/booking-v2/wizard.tsx`, `src/components/booking-v2/step-time.tsx`
- Modify: `app/booking/[serviceId]/page.tsx` — `BookingSchedulePage` renders `<BookingWizard />` when `useBookingFlow() === 2`.

- [ ] `wizard.tsx`: read `serviceId` and `step`; load draft; if missing or for another service, fetch the tree (`categoryTreeApi.tree(null)`) and `startDraft`; show a spinner meanwhile; render the step; provide `goTo(step)` via `router.push`.
- [ ] `step-time.tsx` per spec: date strip, two selects, hint, summary card, bottom bar; `Next` saves and `goTo("address")`.
- [ ] Verify: screenshot `http://localhost:3000/booking/19?flow=2`.

### Task 8: Step 2, Address

**Files:**
- Create: `src/components/booking-v2/step-address.tsx`

- [ ] Login gate, saved list via `userApi.getAddresses`, new-address form with type chips, current-location fill via `reverseGeocode`, save via `userApi.addAddress` + `userApi.updateProfile`, select → `draft.address`, Next → `goTo("review")`.
- [ ] Verify: eslint, tsc; manual walk-through in the browser (needs an OTP login).

### Task 9: Step 3, Review, confirm and success

**Files:**
- Create: `src/components/booking-v2/step-review.tsx`

- [ ] Cards, quantity stepper (1..5), coupon (list, apply, remove), bill from `computeBill`, payment cards, confirm (Razorpay path then bookings, or bookings), success view at `step=done` with IDs, `clearDraft()`.
- [ ] Verify: eslint, tsc; a COD test booking on the owner's account, then delete it from the admin panel.

### Task 10: Final verification

- [ ] `npx eslint app src`, `npx tsc --noEmit`, screenshots of all steps at 430 px on flow 2, and one screenshot of `/category/5` on flow 1 to prove it is unchanged.
