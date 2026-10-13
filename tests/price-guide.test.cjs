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
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    }, compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}

// Fixture pricing: a shift costs its catalogue variant price (math is tested elsewhere).
const hourlyTerms = {
  variantCharge: (s, name) => s.variants.find((v) => v.name === name)?.price ?? null,
  nightPremiumPerHour: () => 0,
};
const { shiftTable, shiftLead, cleaningTable } = load("lib/price-guide.ts", {
  "@/src/lib/booking-v2/hourly-terms": hourlyTerms,
});

const variant = (name, price, durationMinutes) => ({ name, price, durationMinutes });
const chefCategory = {
  categoryId: 1,
  services: [{
    serviceId: 1, name: "Chef", price: 1, isActive: true,
    variants: [
      variant("5 Hour Shift (11 AM – 4 PM)", 5, 300),
      variant("5 Hour Midnight Shift (4 PM – 9 PM)", 7, 300),
      variant("10 Hour Shift (11 AM – 9 PM)", 10, 600),
    ],
  }],
  groups: [],
};
const item = (serviceId, name, price) => ({ serviceId, name, price, isActive: true, variants: [] });
const cleaningCategory = {
  categoryId: 2,
  services: [
    item(261, "Kitchen Cleaning (Floor & Walls)", 300),
    item(243, "Burner Cleaning", 40),
    item(999, "Unconfirmed Item", 50),
  ],
  groups: [],
};

test("the 5-hour shift row feeds the lead, hourly second", () => {
  const table = shiftTable(chefCategory);
  const lead = shiftLead(table);
  assert.equal(lead.shift.label, "5 hours");
  assert.deepEqual(lead.shift.day, { price: 5, from: false });
  assert.deepEqual(lead.shift.night, { price: 7, from: false });
  assert.equal(lead.hourly, table.hourly);
});

test("lead falls back to the hourly line when the 5-hour cells are null", () => {
  const table = shiftTable({
    ...chefCategory,
    services: [{ ...chefCategory.services[0], variants: [chefCategory.services[0].variants[2]] }],
  });
  const lead = shiftLead(table);
  assert.equal(lead.shift, null);
  assert.equal(lead.hourly, 1);
});

test("Kitchen Cleaning (id 261) is 'per job', never 'per piece'", () => {
  const { rows, totalItems } = cleaningTable(cleaningCategory);
  const kitchen = rows.find((r) => r.serviceId === 261);
  assert.ok(kitchen);
  assert.equal(kitchen.unit, "per job");
  assert.notEqual(kitchen.unit, "per piece");
  assert.equal(rows.length, 2);
  assert.equal(totalItems, 3);
});
