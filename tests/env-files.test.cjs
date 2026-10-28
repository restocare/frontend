/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
// Guards every env file that IS committed (see the exceptions in .gitignore):
// - .env.production ships to Vercel builds, so it may hold only public
//   NEXT_PUBLIC_* values (they end up in the client bundle anyway).
// - every other committed env file (.env.example, or any added later) is a
//   template, so each server-only key must stay empty.
// The list comes from git, not the folder, so a developer's untracked
// .env.local (which holds real secrets) is never checked.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");

const trackedEnvFiles = execSync("git ls-files -- .env*", { cwd: ROOT, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

/** [key, value] pairs; comments, blank lines and lines without "=" are skipped. */
function readEnv(file) {
  return fs
    .readFileSync(path.join(ROOT, file), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    });
}

test("the committed env files are found", () => {
  assert.ok(trackedEnvFiles.includes(".env.production"), ".env.production");
  assert.ok(trackedEnvFiles.includes(".env.example"), ".env.example");
});

for (const file of trackedEnvFiles) {
  if (file === ".env.production") {
    test(".env.production holds only public NEXT_PUBLIC_* keys", () => {
      for (const [key] of readEnv(file)) {
        assert.match(key, /^NEXT_PUBLIC_/, `${key} is not public; set it on Vercel instead`);
      }
    });
  } else {
    test(`${file} leaves every server-only key empty`, () => {
      for (const [key, value] of readEnv(file)) {
        if (key.startsWith("NEXT_PUBLIC_")) continue;
        assert.equal(value, "", `${key} has a value in ${file}; move it to .env.local`);
      }
    });
  }
}
