// Compresses the hero banner PNGs into WebP for faster LCP.
//
// Run from the repo root:  node scripts/compress-banners.mjs
//
// Reads public/Banner/{1,2,3}.png (the PNG originals are the source of truth and
// are never modified) and writes public/Banner/{1,2,3}.webp, at most 900 px tall
// (never upscaled, aspect ratio preserved). Idempotent: output depends only on
// the PNGs. Requires `sharp` to be resolvable from node_modules.
import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve("public/Banner");
const MAX_HEIGHT = 900;
const MAX_BYTES = 200 * 1024;
const QUALITIES = [80, 76, 72, 68, 64, 60, 55, 50];

for (const name of ["1", "2", "3"]) {
  const src = path.join(DIR, `${name}.png`);
  const out = path.join(DIR, `${name}.webp`);

  let info;
  for (const quality of QUALITIES) {
    info = await sharp(src)
      .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(out);
    if (info.size <= MAX_BYTES) break;
  }

  const before = (await stat(src)).size;
  console.log(
    `${path.relative(process.cwd(), out)} ${info.width}x${info.height} ` +
      `${(info.size / 1024).toFixed(1)} KB (png ${(before / 1024).toFixed(1)} KB)`,
  );
}
