/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
// Guards the two env files that ARE committed (see .gitignore):
// - .env.production ships to Vercel builds, so it may hold only public
//   NEXT_PUBLIC_* values (they end up in the client bundle anyway).
// - .env.example is a template, so every server-only key must stay empty.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readEnv(file) {
  const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  return src
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    });
}

test(".env.production holds only public NEXT_PUBLIC_* keys", () => {
  for (const [key] of readEnv(".env.production")) {
    assert.match(key, /^NEXT_PUBLIC_/, `${key} is not public; set it on Vercel instead`);
  }
});

test(".env.example leaves every server-only key empty", () => {
  for (const [key, value] of readEnv(".env.example")) {
    if (key.startsWith("NEXT_PUBLIC_")) continue;
    assert.equal(value, "", `${key} has a value in .env.example; move it to .env.local`);
  }
});
