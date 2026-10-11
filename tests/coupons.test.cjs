/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Use the project's TypeScript compiler without adding a test runtime.
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

const parsers = load("src/lib/coupons.ts");
const coupon = { couponId: 42, code: "SAVE20", discountPercent: 20, isApplied: true, isUsed: false, expiresAt: "2099-01-01" };
class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
function api(client) {
  return load("src/api/api.ts", {
    "./apiClient": { apiClient: client, ApiError, API_BASE_URL: "https://example.invalid/api" },
    "@/src/lib/coupons": parsers,
  }).couponsApi;
}

test("reads wrapped lists and apply responses with numeric strings", () => {
  const list = parsers.parseCustomerCoupons({ data: { coupons: [{ ...coupon, couponId: "42", discountPercent: "20" }] } });
  assert.equal(list[0].couponId, 42);
  assert.equal(list[0].discountPercent, 20);
  assert.equal(parsers.parseCustomerCoupon({ data: { coupon } }).code, "SAVE20");
  assert.deepEqual(parsers.parseCustomerCoupons({ data: [] }), []);
  assert.equal(parsers.parseCustomerCoupons({ message: "Unavailable" }), null);
});

test("never accepts incomplete, invalid, or failed apply responses", () => {
  for (const value of [{ code: "SAVE20" }, { ...coupon, discountPercent: undefined }, { ...coupon, discountPercent: -20 }, { ...coupon, discountPercent: 200 }, { success: false, data: coupon }]) {
    assert.equal(parsers.parseCustomerCoupon(value), null);
  }
  const flat = parsers.parseCustomerCoupon({ ...coupon, discountType: "FLAT_TOTAL", flatTotal: "199", discountPercent: null });
  assert.equal(flat.flatTotal, 199);
});

test("apply normalizes the code and resolves a wrapped coupon", async () => {
  const service = api({ post: async (url, body) => {
    assert.equal(url, "/v1/coupons/apply");
    assert.deepEqual(body, { couponCode: "SAVE20" });
    return { data: { coupon } };
  } });
  assert.equal((await service.apply(" save20 ")).discountPercent, 20);
});

test("confirmation-only apply reads back the selected coupon", async () => {
  const service = api({ post: async () => ({ message: "Coupon applied" }), get: async () => ({ coupons: [coupon] }) });
  assert.equal((await service.apply("SAVE20")).couponId, 42);
});

test("missing discount details cannot silently produce an applied coupon", async () => {
  const service = api({ post: async () => ({ message: "Coupon applied" }), get: async () => [] });
  await assert.rejects(service.apply("SAVE20"), /Could not confirm/);
});

test("invalid codes preserve the backend error instead of claiming success", async () => {
  const service = api({ post: async () => { throw new Error("Coupon not found"); } });
  await assert.rejects(service.apply("MISSING"), /Coupon not found/);
});

test("category-restricted codes explain the API's ambiguous not-found error", async () => {
  const service = api({ post: async () => { throw new ApiError("Coupon not found", 404); } });
  await assert.rejects(service.apply("TUSHAR55"), /not eligible.*service category/);
});
