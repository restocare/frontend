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
// draft.ts and hourly-terms.ts import each other; resolve lazily.
let hourlyTerms;
const draft = load("src/lib/booking-v2/draft.ts", {
  "./pricing": pricing,
  "./cleaning": { isCleaningCategory: () => false },
  "./hourly-terms": new Proxy({}, { get: (_, key) => hourlyTerms[key] }),
  "./schedule": schedule,
});
hourlyTerms = load("src/lib/booking-v2/hourly-terms.ts", {
  "./draft": draft,
  "./pricing": pricing,
  "./schedule": schedule,
});
const { nightHoursIn, nightPremiumPerHour, variantCharge } = hourlyTerms;

const names = [
  "5 Hour Shift (11 AM – 4 PM)",
  "10 Hour Shift (11 AM – 9 PM)",
  "5 Hour Shift (7 PM – 12 Midnight)",
  "10 Hour Shift (2 PM – 12 Midnight)",
  "1 Week Day (11 AM – 9 PM)",
  "1 Week Night (2 PM – 12 Midnight)",
];
const make = (price, prices) => ({
  price,
  variants: prices.map((p, i) => ({ name: names[i], price: p })),
});
const chef = make(149, [799, 1499, 899, 1699, 10499, 11899]);
const helpers = make(99, [599, 1099, 699, 1299, 7693, 9093]);

test("night premium is read from the catalogue", () => {
  assert.equal(nightPremiumPerHour(chef.variants), 20);
  assert.equal(nightPremiumPerHour(helpers.variants), 20);
});

test("variant charges for chef and helpers", () => {
  assert.deepEqual(names.map((n) => variantCharge(chef, n)), [745, 1490, 845, 1610, 10430, 11270]);
  assert.deepEqual(names.map((n) => variantCharge(helpers, n)), [495, 990, 595, 1110, 6930, 7770]);
});

test("no night pair means no premium; no window means null", () => {
  const svc = { price: 100, variants: [{ name: "5 Hour Shift (11 AM – 4 PM)", price: 500 }] };
  assert.equal(nightPremiumPerHour(svc.variants), 0);
  assert.equal(variantCharge(svc, "5 Hour Shift (7 PM – 12 Midnight)"), 500);
  assert.equal(variantCharge(svc, "Weekly"), null);
});

test("nightHoursIn counts hours from 18:00 to midnight", () => {
  assert.equal(nightHoursIn(11 * 60, 16 * 60), 0);
  assert.equal(nightHoursIn(19 * 60, 24 * 60), 5);
  assert.equal(nightHoursIn(14 * 60, 24 * 60), 6);
  assert.equal(nightHoursIn(17 * 60, 22 * 60), 4);
});

test("computeBill adds night hours and is unchanged without them", () => {
  const plain = pricing.computeBill({ hours: 5, rate: 149, quantity: 1 });
  assert.deepEqual(pricing.computeBill({ hours: 5, rate: 149, quantity: 1, nightHours: 0 }), plain);
  assert.equal(plain.perBookingBase, 745);
  const night = pricing.computeBill({ hours: 5, rate: 149, quantity: 1, nightHours: 5, nightRate: 20 });
  assert.equal(night.perBookingBase, 845);
  assert.equal(night.total, 997.1);
});
