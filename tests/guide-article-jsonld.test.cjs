/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(
  path.join(root, "app/guides/restaurant-staffing-prices/page.tsx"),
  "utf8",
);
const meta = fs.readFileSync(path.join(root, "lib/guide-meta.ts"), "utf8");
const identity = fs.readFileSync(path.join(root, "lib/site-identity.ts"), "utf8");
const article = page.slice(page.indexOf('"@type": "Article"'), page.indexOf("function Cell"));

test("guide dates live only in lib/guide-meta.ts", () => {
  assert.match(meta, /GUIDE_PUBLISHED = "2026-10-05"/);
  assert.match(meta, /GUIDE_UPDATED = "2026-10-14"/);
  assert.doesNotMatch(page, /2026-10-\d\d/);
});

test("Article has dates from the shared constants", () => {
  assert.match(article, /datePublished: GUIDE_PUBLISHED/);
  assert.match(article, /dateModified: GUIDE_UPDATED/);
});

test("author and publisher are bare @id references to the organization", () => {
  assert.match(article, /author: ORGANIZATION_REF/);
  assert.match(article, /publisher: ORGANIZATION_REF/);
  assert.match(identity, /ORGANIZATION_ID = `\$\{SITE_URL\}\/#organization`/);
  assert.match(identity, /ORGANIZATION_REF = \{ "@id": ORGANIZATION_ID \}/);
  assert.match(identity, /SITE_URL = "https:\/\/www\.restocare\.in"/);
});

test("Article image is the root OG image URL", () => {
  assert.match(article, /image: `\$\{SITE\}\/opengraph-image`/);
  assert.match(page, /const SITE = SITE_URL;/);
  assert.ok(fs.existsSync(path.join(root, "app/opengraph-image.tsx")));
});

test("visible Updated line uses GUIDE_UPDATED", () => {
  assert.match(
    page,
    /Updated <time dateTime=\{GUIDE_UPDATED\}>\{formatGuideDate\(GUIDE_UPDATED\)\}<\/time>/,
  );
  assert.match(page, /text-sm text-rc-muted/);
});
