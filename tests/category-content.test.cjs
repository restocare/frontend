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
    (name) => {
      throw new Error(`Unexpected import: ${name}`);
    }, compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}

const { categoryContent } = load("lib/category-content.ts");

test("electrician has the approved H1, an intro and no FAQs", () => {
  const content = categoryContent("electrician");
  assert.equal(content.h1, "Electrician for Restaurants in Delhi NCR");
  assert.deepEqual(content.faqs, []);
  assert.ok(content.intro.length > 0);
});

test("electrician override description matches the intro and fits meta length", () => {
  const layout = fs.readFileSync(path.join(__dirname, "..", "app/category/[slug]/layout.tsx"), "utf8");
  assert.match(layout, /electrician: \{\s*title: "Electrician for Restaurants in Delhi NCR"/);
  const { intro } = categoryContent("electrician");
  assert.ok(intro.length < 160);
  assert.ok(layout.includes(intro));
});

test("existing categories are unchanged", () => {
  assert.equal(categoryContent("chef").h1, "Hire a Chef for Your Restaurant in Delhi NCR");
  assert.equal(categoryContent("chef").faqs.length, 6);
  assert.equal(
    categoryContent("helpers-and-waiters").h1,
    "Hire Kitchen Helpers and Waiters for Your Restaurant",
  );
  assert.equal(categoryContent("helpers-and-waiters").faqs.length, 5);
  assert.equal(
    categoryContent("deep-cleaning").h1,
    "Restaurant & Commercial Kitchen Deep Cleaning in Delhi NCR",
  );
  assert.equal(categoryContent("deep-cleaning").faqs.length, 1);
});

test("plumber has no content entry", () => {
  assert.equal(categoryContent("plumber"), undefined);
});
