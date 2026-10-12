/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Use the project's TypeScript compiler without adding a test runtime.
function load(relativePath, imports = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    }, compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}

const shifts = load("src/lib/booking-shifts.ts");
const pricing = load("src/lib/booking-v2/pricing.ts");
const schedule = load("src/lib/booking-v2/schedule.ts", { "../booking-shifts": shifts });
const draft = load("src/lib/booking-v2/draft.ts", {
  "./pricing": pricing,
  "./cleaning": { isCleaningCategory: () => false },
  "./schedule": schedule,
});
const hourlyTerms = load("src/lib/booking-v2/hourly-terms.ts", {
  "./draft": draft,
  "./pricing": pricing,
  "./schedule": schedule,
});

const names = [
  "5 Hour Shift (11 AM – 4 PM)",
  "10 Hour Shift (11 AM – 9 PM)",
  "5 Hour Shift (7 PM – 12 Midnight)",
  "10 Hour Shift (2 PM – 12 Midnight)",
  "1 Week Day (11 AM – 9 PM)",
  "1 Week Night (2 PM – 12 Midnight)",
];
const chef = {
  serviceId: 7,
  name: "Chef",
  profileImage: null,
  price: 149,
  variants: [799, 1499, 899, 1699, 10499, 11899].map((price, i) => ({
    variantId: 100 + i,
    name: names[i],
    price,
  })),
};
const category = { categoryId: 3, name: "Kitchen staff" };
const address = {
  id: "a1",
  label: "Work",
  restaurantName: "R",
  address: "1 Road",
  city: "Pune",
  state: "MH",
  zipCode: "411001",
  contactName: "C",
  phone: "9999999999",
  lat: 1,
  lng: 2,
};
const pick = (i) => ({ variantId: chef.variants[i].variantId, name: names[i] });
const ready = (d, extra = {}) => ({ ...d, address, paymentMode: "COD", ...extra });
const percent = { code: "SAVE10", discountType: "PERCENT", discountPercent: 10 };
const sum = (ps) => pricing.round2(ps.reduce((s, p) => s + p.totalAmount, 0));

test("the picked variant opens the draft with its window and night rate", () => {
  const d = draft.startDraft(chef, category, pick(2));
  assert.equal(d.start, 19 * 60);
  assert.equal(d.end, 24 * 60);
  assert.equal(d.nightRate, 20);
  assert.equal(d.days, 1);
  const none = draft.startDraft(chef, category);
  assert.equal(none.start, 11 * 60);
  assert.equal(none.end, 16 * 60);
  assert.equal(none.days, 1);
});

test("chef day bills: 11-4, 7 PM-12, 2 PM-12", () => {
  const day = ready(draft.startDraft(chef, category, pick(0)));
  assert.equal(draft.fullBill(day, null).main.perBookingBase, 745);
  assert.equal(draft.fullBill(day, null).total, 879.1);
  assert.equal(draft.buildPayloads(day, 1, null)[0].totalAmount, 745);
  assert.equal(draft.draftCopy(day).billLabel(), "5 hrs × ₹149");

  const night = ready(draft.startDraft(chef, category, pick(2)));
  assert.equal(draft.fullBill(night, null).main.perBookingBase, 845);
  assert.equal(draft.fullBill(night, null).total, 997.1);
  assert.equal(draft.buildPayloads(night, 1, null)[0].totalAmount, 845);
  assert.equal(draft.draftCopy(night).billLabel(), "5 hrs × ₹149 + 5 night hrs × ₹20");

  const long = ready(draft.startDraft(chef, category, pick(3)));
  assert.equal(draft.fullBill(long, null).main.perBookingBase, 1610);
  assert.equal(draft.buildPayloads(long, 1, null)[0].variantId, 103);
});

test("chef week day: 7 consecutive bookings of 1490 across a month end", () => {
  const d = ready(draft.startDraft(chef, category, pick(4)), { date: "2026-10-30" });
  assert.equal(d.days, 7);
  assert.equal(d.start, 11 * 60);
  assert.equal(d.end, 21 * 60);
  const ps = draft.buildPayloads(d, 1, null);
  assert.equal(ps.length, 7);
  assert.deepEqual(ps.map((p) => p.bookingDate), [
    "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
  ]);
  for (const p of ps) {
    assert.equal(p.totalAmount, 1490);
    assert.equal(p.startTime, "11:00");
    assert.equal(p.endTime, "21:00");
    assert.equal(p.variantId, 101);
  }
  assert.equal(sum(ps), 10430);
  const bill = draft.fullBill(d, null);
  assert.equal(bill.main.subtotal, 10430);
  assert.equal(bill.tax, 1877.4);
  assert.equal(bill.total, 12307.4);
  assert.equal(draft.draftCopy(d).billLabel(), "7 days × 10 hrs × ₹149");
});

test("chef week night: 7 bookings of 1610", () => {
  const d = ready(draft.startDraft(chef, category, pick(5)), { date: "2026-12-28" });
  const ps = draft.buildPayloads(d, 1, null);
  assert.equal(ps.length, 7);
  assert.ok(ps.every((p) => p.totalAmount === 1610 && p.variantId === 103));
  assert.equal(ps[6].bookingDate, "2027-01-03");
  assert.equal(sum(ps), 11270);
  assert.equal(draft.draftCopy(d).billLabel(), "7 days × 10 hrs × ₹149 + 42 night hrs × ₹20");
});

test("quantity 2 on a week: 14 bookings, coupon on the first only", () => {
  const d = ready(draft.startDraft(chef, category, pick(4)), { date: "2026-10-30", quantity: 2 });
  const ps = draft.buildPayloads(d, 1, percent);
  assert.equal(ps.length, 14);
  assert.equal(ps[0].couponCode, "SAVE10");
  assert.equal(ps[0].totalAmount, 1341);
  assert.ok(ps.slice(1).every((p) => p.couponCode === undefined && p.totalAmount === 1490));
  assert.equal(ps[1].bookingDate, "2026-10-30");
  assert.equal(ps[13].bookingDate, "2026-11-05");
});

test("extras: rejected on a week, unchanged on a day", () => {
  const extra = draft.extraFromService({ ...chef, serviceId: 8, name: "Helper" }, category);
  const week = ready(draft.startDraft(chef, category, pick(4)), { extras: [extra] });
  assert.equal(draft.extraProblem(week, extra), "Add-ons aren't available for weekly bookings");
  assert.throws(() => draft.buildPayloads(week, 1, null), /weekly bookings/);

  const day = ready(draft.startDraft(chef, category, pick(0)), { extras: [extra] });
  assert.equal(draft.extraProblem(day, extra), null);
  assert.equal(draft.extraBase(day, extra), 745);
  assert.equal(draft.extraProblem({ ...day, end: day.start + 60 }, extra), "Needs at least 5 hrs");
  assert.equal(draft.buildPayloads(day, 1, null).length, 2);
});

test("a draft saved before night/days bills and books as before", () => {
  const legacy = ready(draft.startDraft(chef, category, pick(2)), { quantity: 2 });
  delete legacy.nightRate;
  delete legacy.days;
  const bill = draft.fullBill(legacy, percent);
  assert.deepEqual(bill.main, pricing.computeBill({ hours: 5, rate: 149, quantity: 2, coupon: percent }));
  const ps = draft.buildPayloads(legacy, 1, percent);
  assert.equal(ps.length, 2);
  assert.deepEqual(ps.map((p) => [p.totalAmount, p.bookingDate, p.couponCode]), [
    [670.5, legacy.date, "SAVE10"],
    [745, legacy.date, undefined],
  ]);
  assert.equal(draft.draftCopy(legacy).billLabel(), "5 hrs × ₹149");
  assert.equal(draft.draftCopy(legacy).sub, "₹149/hour, minimum 5 hrs");
});

test("draft night figures match hourly-terms", () => {
  assert.equal(draft.startDraft(chef, category).nightRate, hourlyTerms.nightPremiumPerHour(chef.variants));
  for (const i of [2, 3, 5]) {
    const d = draft.startDraft(chef, category, pick(i));
    assert.equal(draft.billedNightHours(d), hourlyTerms.nightHoursIn(d.start, d.end));
  }
});
