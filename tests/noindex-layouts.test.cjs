/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cases = [
  ["app/cart/layout.tsx", "Cart"],
  ["app/checkout/layout.tsx", "Checkout"],
  ["app/account/layout.tsx", "My account"],
];

for (const [file, title] of cases) {
  test(`${file} is a noindex server layout titled "${title}"`, () => {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(!/^\s*["']use client["']/m.test(src), "must be a server component");
    assert.match(src, /export const metadata: Metadata/);
    assert.ok(src.includes(`title: "${title}",`), `title ${title}`);
    assert.match(src, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    assert.match(src, /return children;/);
  });
}
