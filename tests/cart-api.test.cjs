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

function cartApi(client) {
  return load("src/api/cart.ts", {
    "./apiClient": { apiClient: client },
    "./_shared": load("src/api/_shared.ts"),
  }).cartApi;
}

test("updateQuantity sends the guest sessionId in the PATCH body", async () => {
  let call;
  const api = cartApi({ patch: async (url, body) => { call = { url, body }; return {}; } });
  const body = { serviceId: 7, variantId: undefined, quantity: 2, action: "increment", sessionId: "guest-abc" };
  await api.updateQuantity(11, body);
  assert.equal(call.url, "/v1/manage-cart/update?cartId=11");
  assert.equal(call.body.sessionId, "guest-abc");
  assert.equal(call.body.quantity, 2);
});

test("deleteItem sends the guest sessionId as a query parameter", async () => {
  let url;
  const api = cartApi({ delete: async (u) => { url = u; return { message: "ok" }; } });
  await api.deleteItem(5, "guest-abc");
  assert.equal(url, "/v1/manage-cart/delete/5?sessionId=guest-abc");
});

test("deleteItem encodes the sessionId and omits it when empty", async () => {
  const urls = [];
  const api = cartApi({ delete: async (u) => { urls.push(u); return {}; } });
  await api.deleteItem(5, "a b&c");
  await api.deleteItem(6, "");
  assert.equal(urls[0], "/v1/manage-cart/delete/5?sessionId=a+b%26c");
  assert.equal(urls[1], "/v1/manage-cart/delete/6");
});

test("the cart provider passes its sessionId to update and delete", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src/lib/cart.tsx"), "utf8");
  assert.match(src, /cartApi\.deleteItem\(cartItemId, sessionId\)/);
  const update = src.slice(src.indexOf("cartApi.updateQuantity("));
  assert.match(update.slice(0, update.indexOf("onSuccess")), /\bsessionId,/);
});
