// Reuses the same design as the OG image so the Twitter card and Facebook/WhatsApp
// previews are consistent. Each of `runtime`/`alt`/`size`/`contentType` must be
// declared directly in this file — Next.js rejects re-exporting them from a
// sibling route file — so only the render logic itself is shared.
import { OG_IMAGE_ALT, OG_IMAGE_SIZE, renderOgImage } from "./_og-image-content";

export const runtime = "edge";
export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage();
}
