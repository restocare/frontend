/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src/lib/landing-services.ts");
const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("require", "module", "exports", output)(
  (name) => {
    throw new Error(`Unexpected import: ${name}`);
  }, compiledModule, compiledModule.exports,
);
const { flattenServices } = compiledModule.exports;

const svc = (name, isFeatured) => ({ name, isFeatured, variants: [] });
const cat = (categoryId, extra) => ({
  categoryId,
  name: `Cat ${categoryId}`,
  services: [svc(`direct-${categoryId}`, true), svc(`plain-${categoryId}`, false)],
  groups: [{ name: "G", services: [svc(`grouped-${categoryId}`, true)] }],
  ...extra,
});
const tree = [
  cat(1),
  cat(2, { comingSoon: true }),
  cat(3, { isPublished: false }),
  cat(4, { isPublished: true, comingSoon: false }),
];
const names = (list) => list.map((s) => s.name);

test("coming-soon and unpublished categories never appear", () => {
  for (const id of [null, 2, 3]) {
    const out = names(flattenServices(tree, id));
    assert.ok(!out.some((n) => /-(2|3)$/.test(n)), `categoryId ${id}`);
  }
  assert.deepEqual(flattenServices(tree, 2), []);
});

test("published, non-coming-soon categories still appear", () => {
  assert.deepEqual(names(flattenServices(tree, null)), [
    "direct-1", "grouped-1", "direct-4", "grouped-4",
  ]);
});

test("home row is featured-only; a selected category shows all its services", () => {
  assert.ok(flattenServices(tree, null).every((s) => s.isFeatured));
  assert.deepEqual(names(flattenServices(tree, 1)), ["direct-1", "plain-1", "grouped-1"]);
});
