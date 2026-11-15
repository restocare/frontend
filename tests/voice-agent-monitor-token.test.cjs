/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The backend monitor socket (/calls/monitor-stream) refuses a handshake with no
// JWT. A browser WebSocket cannot send an Authorization header, so the testing
// page must put the token in the query string (BAC-0119).
const PAGE = path.join(
  __dirname,
  "..",
  "app/real-estate/voice-agent/testing/page.tsx",
);

test("voice-agent testing page sends the JWT on the monitor socket", () => {
  const src = fs.readFileSync(PAGE, "utf8");
  assert.match(src, /\$\{BACKEND_WS\}\?phone=/);
  assert.match(src, /`&token=\$\{encodeURIComponent\(token\)\}`/);
});

test("voice-agent testing page does not open the socket without a token", () => {
  const src = fs.readFileSync(PAGE, "utf8");
  const guard = src.indexOf("if (!token)");
  const open = src.indexOf("new WebSocket(");
  assert.ok(guard !== -1 && open !== -1, "token guard and WebSocket both present");
  assert.ok(guard < open, "token guard comes before the socket is opened");
});
