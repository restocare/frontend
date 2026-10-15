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

const { siteJsonLd } = load("lib/site-identity.ts");
const raw = siteJsonLd();
const data = JSON.parse(raw);
const [org, site] = data["@graph"];

test("graph has exactly Organization and WebSite with stable ids", () => {
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@graph"].length, 2);
  assert.equal(org["@type"], "Organization");
  assert.equal(org["@id"], "https://www.restocare.in/#organization");
  assert.equal(site["@type"], "WebSite");
  assert.equal(site["@id"], "https://www.restocare.in/#website");
  assert.equal(site.url, "https://www.restocare.in");
  assert.equal(site.name, "RestoCare");
});

test("WebSite.publisher references the organization", () => {
  assert.deepEqual(site.publisher, { "@id": org["@id"] });
});

test("organization fields match the spec", () => {
  assert.equal(org.name, "RestoCare");
  assert.equal(org.legalName, "Restroedge Private Limited");
  assert.equal(org.url, "https://www.restocare.in");
  assert.equal(org.logo, "https://www.restocare.in/icon.png");
  assert.equal(org.email, "support@restocare.in");
  assert.deepEqual(org.areaServed, { "@type": "AdministrativeArea", name: "Delhi NCR" });
  assert.deepEqual(org.contactPoint, {
    "@type": "ContactPoint",
    telephone: "+91-9953532995",
    contactType: "customer service",
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  });
  assert.deepEqual(org.sameAs, [
    "https://www.instagram.com/restocare_/",
    "https://www.facebook.com/profile.php?id=61584401909814",
    "https://www.linkedin.com/company/resto-care1111/",
    "https://www.youtube.com/@restocare.1",
    "https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148",
    "https://play.google.com/store/apps/details?id=com.restocare.customer",
  ]);
});

test("no rating, review or search markup; < is escaped", () => {
  assert.doesNotMatch(raw, /aggregateRating|review|SearchAction|potentialAction/i);
  assert.ok(!raw.includes("<"));
});
