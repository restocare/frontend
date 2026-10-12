/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Customer-facing files whose prices must come from the catalogue/pricing helpers.
// Deliberately NOT scanned: src/components/landing/phone-screens.tsx — it draws
// static phone mockups, so literal sample prices there are allowed.
const FILES = [
  "src/components/landing/hero.tsx",
  "src/components/landing/service-grid.tsx",
  "src/components/landing/restaurant-repair.tsx",
  "app/category/[slug]/category-page-client.tsx",
  "src/components/cart/cart-layer.tsx",
  "lib/category-content.ts",
  "lib/category-json-ld.ts",
  "lib/price-guide.ts",
  "app/guides/restaurant-staffing-prices/page.tsx",
];

const RUPEE_LITERAL = /₹\s?\d/;

// Blank out // and /* */ comments (keeping line numbers) using the real parser,
// so "http://" inside strings is not mistaken for a comment.
function stripComments(text, filename) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.ES2020, true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ranges = new Map();
  const add = (list) => list?.forEach((r) => ranges.set(r.pos, r.end));
  const visit = (node) => {
    add(ts.getLeadingCommentRanges(text, node.pos));
    add(ts.getTrailingCommentRanges(text, node.end));
    node.forEachChild(visit);
  };
  visit(source);
  add(ts.getLeadingCommentRanges(text, source.endOfFileToken.pos));
  let out = text;
  for (const [pos, end] of ranges) {
    out = out.slice(0, pos) + out.slice(pos, end).replace(/[^\n]/g, " ") + out.slice(end);
  }
  return out;
}

for (const file of FILES) {
  test(`${file} has no hardcoded rupee price`, () => {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    const hits = stripComments(text, file).split("\n").flatMap((line, i) =>
      RUPEE_LITERAL.test(line) ? [`${file}:${i + 1}: ${text.split("\n")[i].trim()}`] : []);
    assert.deepEqual(hits, [], `Hardcoded ₹<digit> price found:\n${hits.join("\n")}`);
  });
}

test("comment stripping ignores rupee amounts in comments only", () => {
  const sample = "// ₹99 here\n/* ₹5\n₹6 */\nconst a = '₹149'; // ₹7\n";
  const lines = stripComments(sample, "x.ts").split("\n");
  assert.deepEqual(lines.map((l) => RUPEE_LITERAL.test(l)), [false, false, false, true, false]);
});
