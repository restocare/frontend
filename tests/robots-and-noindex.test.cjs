/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

test("robots.ts disallows old and new private sections", () => {
  const src = read("app/robots.ts");
  const block = src.match(/disallow:\s*\[([\s\S]*?)\]/);
  assert.ok(block, "disallow array not found");
  const entries = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const expected of [
    "/account/login",
    "/delete-account",
    "/payment/*",
    "/api/*",
    "/real-estate",
    "/cart",
    "/checkout",
    "/account/",
  ]) {
    assert.ok(entries.includes(expected), `missing disallow ${expected}`);
  }
});

test("real-estate layout is noindex, nofollow and keeps its title", () => {
  const src = read("app/real-estate/layout.tsx");
  assert.match(src, /export const metadata: Metadata/);
  assert.match(src, /title:\s*"Real Estate — AI Sales Agent"/);
  assert.match(src, /robots:\s*\{[^}]*index:\s*false/);
  assert.match(src, /robots:\s*\{[^}]*follow:\s*false/);
});
