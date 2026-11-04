/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => { throw new Error(`Unexpected import: ${name}`); },
    compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}

const { classifyLedgerEntry, rupeesOrOwes } = load("src/lib/wallet-ledger.ts");

// The exact descriptions the backend writes (backend PR 118, booking.service.ts).
test("classifies every description the backend writes", () => {
  const cases = [
    ["Earning for booking #12 (base service price)", "earning"],
    ["Commission (20%) for booking #12", "commission"],
    ["Lead fee for booking #12", "lead-fee"],
    ["Lead fee refund for cancelled booking #12", "lead-fee-refund"],
    ["GST collected on booking #12 (remitted to government)", "gst"],
    ["Coupon reimbursement for booking #12 (customer discount covered by the platform)", "coupon"],
  ];
  for (const [description, kind] of cases) {
    assert.equal(classifyLedgerEntry(description).kind, kind, description);
  }
});

test("unknown, empty and missing descriptions are 'other'", () => {
  for (const d of ["Wallet recharge via Razorpay", "", null, undefined]) {
    assert.equal(classifyLedgerEntry(d).kind, "other");
  }
});

test("a lead fee refund is not mistaken for a lead fee", () => {
  assert.equal(classifyLedgerEntry("Lead fee refund for cancelled booking #3").kind, "lead-fee-refund");
});

test("GST row explains it is held for the government", () => {
  assert.match(classifyLedgerEntry("GST collected on booking #1").hint, /government/);
});

test("a negative amount reads as owed, not as a minus sign", () => {
  assert.equal(rupeesOrOwes(-1234.5), "Owes ₹1,234.5");
  assert.equal(rupeesOrOwes(-410, 0), "Owes ₹410");
  assert.equal(rupeesOrOwes(1234.5), "₹1,234.5");
  assert.equal(rupeesOrOwes(0), "₹0");
});
