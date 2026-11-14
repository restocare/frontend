/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Use the project's TypeScript compiler without adding a test runtime.
function load(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    () => {
      throw new Error("hr-format.ts must not import anything");
    },
    compiledModule,
    compiledModule.exports,
  );
  return compiledModule.exports;
}

const f = load("src/lib/hr-format.ts");

test("money is integer paise shown with Indian grouping", () => {
  assert.equal(f.formatPaise(12345600), "₹1,23,456");
  assert.equal(f.formatPaise(18500000), "₹1,85,000");
  assert.equal(f.formatPaise(100), "₹1");
  assert.equal(f.formatPaise(0), "₹0");
  assert.equal(f.formatPaise(99900), "₹999");
  assert.equal(f.formatPaise(100000), "₹1,000");
  assert.equal(f.formatPaise(1000000000), "₹1,00,00,000");
  assert.equal(f.formatPaise(12345650), "₹1,23,456.50");
  assert.equal(f.formatPaise(5), "₹0.05");
  assert.equal(f.formatPaise(-250000), "-₹2,500");
  assert.equal(f.formatPaise(null), "—");
  assert.equal(f.formatPaise(undefined), "—");
});

test("rupees typed by ops become whole paise, and junk is refused", () => {
  assert.equal(f.rupeesToPaise("1,85,000"), 18500000);
  assert.equal(f.rupeesToPaise("₹ 1850.5"), 185050);
  assert.equal(f.rupeesToPaise("1850.55"), 185055);
  assert.equal(f.rupeesToPaise("0"), 0);
  assert.equal(f.rupeesToPaise("1850.555"), null);
  assert.equal(f.rupeesToPaise("abc"), null);
  assert.equal(f.rupeesToPaise(""), null);
  assert.equal(f.rupeesToPaise("-5"), null);
  // The round trip never loses a paisa.
  assert.equal(f.rupeesToPaise("1234.56"), 123456);
  assert.equal(f.formatPaise(f.rupeesToPaise("1234.56")), "₹1,234.56");
});

test("times are India time whatever the browser's zone", () => {
  assert.equal(f.istTime("2026-11-12T05:30:00Z"), "11:00 AM");
  assert.equal(f.istTime("2026-11-12T06:00:00Z"), "11:30 AM");
  assert.equal(f.istTime("2026-11-12T18:30:00Z"), "12:00 AM"); // midnight IST
  assert.equal(f.istTime("2026-11-12T06:30:00Z"), "12:00 PM");
  assert.equal(f.istTime("2026-11-12T15:30:00Z"), "9:00 PM");
  assert.equal(f.istTime(null), "—");
});

test("days and the IST calendar day of an instant", () => {
  assert.equal(f.formatDay("2026-11-12"), "Thu, 12 Nov");
  assert.equal(f.formatDay("2026-12-01"), "Tue, 1 Dec");
  assert.equal(f.formatDayYear("2026-11-12"), "12 Nov 2026");
  assert.equal(f.formatDay(null), "—");
  assert.equal(f.istDateTime("2026-11-12T05:30:00Z"), "Thu, 12 Nov, 11:00 AM");
  // 20:00 UTC on the 12th is already the 13th in India.
  assert.equal(f.istDayOf("2026-11-12T20:00:00Z"), "2026-11-13");
  assert.equal(f.istDayOf("2026-11-12T05:00:00Z"), "2026-11-12");
  assert.equal(f.formatPeriod("2026-11"), "Nov 2026");
});

test("labels, mobile numbers and pasted map coordinates", () => {
  assert.equal(f.pretty("in_progress"), "In progress");
  assert.equal(f.pretty("on_the_way"), "On the way");
  assert.equal(f.tenDigitMobile("+91 98111 00001"), "9811100001");
  assert.equal(f.tenDigitMobile("09811100001"), "9811100001");
  assert.equal(f.tenDigitMobile("12345"), null);
  assert.deepEqual(f.parseLatLng("28.6469, 77.1167"), { lat: 28.6469, lng: 77.1167 });
  assert.deepEqual(f.parseLatLng(" -33.86  151.2 "), { lat: -33.86, lng: 151.2 });
  assert.equal(f.parseLatLng("91, 77"), null);
  assert.equal(f.parseLatLng("28.6469"), null);
  assert.equal(f.parseLatLng("Rajouri Garden"), null);
});
