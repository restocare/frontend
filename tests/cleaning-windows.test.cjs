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

const shifts = load("src/lib/booking-shifts.ts");
const pricing = load("src/lib/booking-v2/pricing.ts");
const schedule = load("src/lib/booking-v2/schedule.ts", { "../booking-shifts": shifts });
// The cart module imports React hooks; the window rules under test do not use them.
const cart = load("src/lib/booking-v2/cleaning-cart.ts", {
  react: {},
  "./pricing": pricing,
  "./schedule": schedule,
});

// BUG-009: the server refuses a booking that starts less than 90 minutes from now
// (MIN_LEAD_MINUTES). A same-day arrival window used to open at 60 minutes' notice, so
// a window 60 to 89 minutes ahead was offered and then refused.
const TODAY = "2026-10-03";
const at = (minutes) => cart.ARRIVAL_WINDOWS.map((w) => cart.windowOpen(TODAY, w, { dateISO: TODAY, minutes }));

test("closes same-day windows that start too soon for the server", () => {
  // At 11:00 the afternoon window (12:00) is only 60 minutes away.
  assert.deepEqual(at(11 * 60), [false, false, true]);
  assert.deepEqual(at(11 * 60 + 30), [false, false, true]);
});

test("follows the hourly flow: the afternoon window is open until 10:29 and closed from 10:30", () => {
  assert.deepEqual(at(10 * 60 + 29), [false, true, true]); // 12:00 is 91 minutes away
  assert.deepEqual(at(10 * 60 + 30), [false, false, true]);
});

test("later days are open and earlier days are closed", () => {
  const clock = { dateISO: TODAY, minutes: 11 * 60 };
  assert.ok(cart.ARRIVAL_WINDOWS.every((w) => cart.windowOpen("2026-10-04", w, clock)));
  assert.equal(cart.windowOpen("2026-10-02", cart.ARRIVAL_WINDOWS[2], clock), false);
});

test("never offers a window the server would refuse, at any minute of the day", () => {
  for (let minutes = 0; minutes < 24 * 60; minutes++) {
    cart.ARRIVAL_WINDOWS.forEach((w, i) => {
      if (at(minutes)[i]) {
        assert.ok(w.start - minutes >= schedule.SERVER_NOTICE_MINUTES, `${w.id} offered at minute ${minutes}`);
      }
    });
  }
});
