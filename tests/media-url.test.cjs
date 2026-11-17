/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test runner loads the TypeScript compiler. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Use the project's TypeScript compiler without adding a test runtime.
function load(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", "process", output)(
    (name) => {
      throw new Error(`Unexpected import: ${name}`);
    },
    compiledModule,
    compiledModule.exports,
    process,
  );
  return compiledModule.exports;
}

const { mediaSized, isPrivateMediaPath, privateMediaApiPath, PRIVATE_MEDIA_PREFIX } = load(
  "src/lib/media-url.ts",
);

const CLOUD = "https://res.cloudinary.com/demo/image/upload/v17/services/a.png";
const MEDIA = "https://api.restocare.in/media";

test("a Cloudinary image is resized through its URL", () => {
  assert.equal(
    mediaSized(CLOUD, 400),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v17/services/a.png",
  );
  assert.equal(
    mediaSized(CLOUD, 96),
    "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_96/v17/services/a.png",
  );
});

test("a Cloudinary URL that already has a transformation is left alone", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/w_200,h_200/v17/a.png";
  assert.equal(mediaSized(url, 400), url);
});

test("an image on the media server becomes its matching WebP copy", () => {
  const name = "0123456789abcdef0123456789abcdef";
  assert.equal(mediaSized(`${MEDIA}/services/${name}.jpg`, 400), `${MEDIA}/services/${name}.w400.webp`);
  assert.equal(mediaSized(`${MEDIA}/services/${name}.jpeg`, 800), `${MEDIA}/services/${name}.w800.webp`);
  assert.equal(mediaSized(`${MEDIA}/banners/${name}.png`, 96), `${MEDIA}/banners/${name}.w96.webp`);
  assert.equal(mediaSized(`${MEDIA}/banners/${name}.webp`, 400), `${MEDIA}/banners/${name}.w400.webp`);
});

test("a GIF on the media server has no copies and is returned as is", () => {
  const url = `${MEDIA}/chat-media/0123456789abcdef0123456789abcdef.gif`;
  assert.equal(mediaSized(url, 400), url);
});

test("a copy is never turned into a copy of a copy", () => {
  const url = `${MEDIA}/services/0123456789abcdef0123456789abcdef.w400.webp`;
  assert.equal(mediaSized(url, 800), url);
});

test("other hosts, videos and empty values are returned unchanged", () => {
  for (const url of [
    "https://images.unsplash.com/photo-1?w=800",
    `${MEDIA}/service-categories/0123456789abcdef0123456789abcdef.mp4`,
    "https://evil.example/media/a.png",
    "data:image/png;base64,AAAA",
    "",
  ]) {
    assert.equal(mediaSized(url, 400), url);
  }
});

test("a private path is recognised and mapped to an API path", () => {
  assert.equal(PRIVATE_MEDIA_PREFIX, "/api/v1/media/private/");
  assert.equal(isPrivateMediaPath("/api/v1/media/private/kyc/a.jpg"), true);
  assert.equal(isPrivateMediaPath("https://res.cloudinary.com/demo/image/upload/a.jpg"), false);
  assert.equal(isPrivateMediaPath(null), false);
  assert.equal(isPrivateMediaPath(""), false);
  assert.equal(privateMediaApiPath("/api/v1/media/private/kyc/a.jpg"), "/v1/media/private/kyc/a.jpg");
});
