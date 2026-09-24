import { OG_IMAGE_ALT, OG_IMAGE_SIZE, renderOgImage } from "./_og-image-content";

export const runtime = "edge";
export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function OgImage() {
  return renderOgImage();
}
