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
let terms;
const draft = load("src/lib/booking-v2/draft.ts", {
  "./pricing": pricing,
  "./cleaning": { isCleaningCategory: () => false },
  "./hourly-terms": new Proxy({}, { get: (_, key) => terms[key] }),
  "./schedule": schedule,
});
terms = load("src/lib/booking-v2/hourly-terms.ts", {
  "./draft": draft,
  "./pricing": pricing,
  "./schedule": schedule,
});
const { hourlyTerms, categoryHourlyHeadline } = terms;

const shiftNames = [
  "5 Hours (11 AM – 4 PM)",
  "10 Hours (11 AM – 9 PM)",
  "5 Hours (6 PM – 11 PM)",
  "10 Hours (6 PM – 4 AM)",
  "Weekly (5 Hours)",
  "Monthly (5 Hours)",
];
const make = (price, prices) => ({
  price,
  variants: prices.map((p, i) => ({ name: shiftNames[i], price: p })),
});
const chef = make(149, [799, 1499, 899, 1699, 10499, 11899]);
const helpers = make(99, [599, 1099, 699, 1299, 7693, 9093]);

test("hourly terms use the base price and the 5 hour minimum", () => {
  assert.deepEqual(hourlyTerms(chef), { rate: 149, minHours: 5, minPrice: 745 });
  assert.deepEqual(hourlyTerms(helpers), { rate: 99, minHours: 5, minPrice: 495 });
});

test("falls back to shift price / hours without a base price", () => {
  const svc = { price: null, variants: [{ name: "5 Hours (11 AM – 4 PM)", price: 799 }] };
  assert.equal(hourlyTerms(svc).rate, draft.hourlyRate(svc));
  assert.equal(hourlyTerms(svc).rate, 159.8);
  assert.equal(hourlyTerms(svc).minPrice, 799);
});

test("category headline is null without a positive rate", () => {
  assert.equal(categoryHourlyHeadline([]), null);
  assert.equal(categoryHourlyHeadline([{ price: null, variants: [] }, { price: 0, variants: [] }]), null);
});

test("category headline picks the lowest rate and cheapest minimum", () => {
  assert.deepEqual(categoryHourlyHeadline([chef, helpers]), { rate: 99, minHours: 5, minPrice: 495 });
});
