/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relativePath, imports = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    }, m, m.exports,
  );
  return m.exports;
}

const shifts = load("src/lib/booking-shifts.ts");
const pricing = load("src/lib/booking-v2/pricing.ts");
const schedule = load("src/lib/booking-v2/schedule.ts", { "../booking-shifts": shifts });
const draft = load("src/lib/booking-v2/draft.ts", {
  "./pricing": pricing,
  "./cleaning": { isCleaningCategory: () => false },
  "./schedule": schedule,
});
const terms = load("src/lib/booking-v2/hourly-terms.ts", {
  "./draft": draft, "./pricing": pricing, "./schedule": schedule,
});
const { shiftTable } = load("lib/price-guide.ts", { "@/src/lib/booking-v2/hourly-terms": terms });

const defs = [
  ["5 Hour Shift (11 AM – 4 PM)", 300], ["10 Hour Shift (11 AM – 9 PM)", 600],
  ["5 Hour Shift (7 PM – 12 Midnight)", 300], ["10 Hour Shift (2 PM – 12 Midnight)", 600],
  ["1 Week Day (11 AM – 9 PM)", null], ["1 Week Night (2 PM – 12 Midnight)", null],
];
const cat = (price, prices) => ({
  services: [{ serviceId: 1, price, variants: defs.map(([name, durationMinutes], i) => ({ name, durationMinutes, price: prices[i] })) }],
  groups: [],
});

test("guide cells are what the wizard charges", () => {
  const t = shiftTable(cat(149, [799, 1499, 899, 1699, 10499, 11899]));
  assert.equal(t.hourly, 149);
  assert.equal(t.premium, 20);
  assert.deepEqual(t.rows.map((r) => [r.day.price, r.night.price]), [[745, 845], [1490, 1610], [10430, 11270]]);
  const h = shiftTable(cat(99, [599, 1099, 699, 1299, 7693, 9093]));
  assert.deepEqual(h.rows.map((r) => [r.day.price, r.night.price]), [[495, 595], [990, 1110], [6930, 7770]]);
});
