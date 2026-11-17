/**
 * URLs of uploaded images.
 *
 * New uploads live on the RestoCare media server (MEDIA_PUBLIC_BASE_URL on the
 * backend). Each public image there has three small WebP copies next to it:
 * `<name>.w96.webp`, `<name>.w400.webp` and `<name>.w800.webp`. Images uploaded
 * before the move are still on Cloudinary, which resizes through its URL, so
 * both kinds are understood until the old ones are copied across.
 *
 * Partner KYC documents are private: they are stored as `/api/v1/media/private/...`
 * paths and can only be fetched with the signed-in admin's token.
 */

export type MediaWidth = 96 | 400 | 800;

const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Public media base; build-time, like the other NEXT_PUBLIC settings. */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "https://api.restocare.in/media").replace(
  /\/+$/,
  "",
);

/** A resizable image on the media server: jpg, jpeg, png or webp. GIFs have no copies. */
const RESIZABLE_EXT = /^(.+)\.(?:jpe?g|png|webp)$/i;
const ALREADY_A_COPY = /\.w(?:96|400|800)$/;

/**
 * The smallest copy of `url` that is at least `width` px wide.
 * Anything else (other hosts, GIFs, data URLs, private paths) comes back unchanged.
 */
export function mediaSized(url: string, width: MediaWidth): string {
  const cloudinary = url.match(CLOUDINARY_IMAGE);
  if (cloudinary) {
    // Already carries a transformation segment (e.g. "w_400,…/") — leave it alone.
    if (/^[a-z]{1,3}_[^/]*\//.test(cloudinary[2])) return url;
    return `${cloudinary[1]}f_auto,q_auto,w_${width}/${cloudinary[2]}`;
  }
  if (url.startsWith(`${MEDIA_BASE}/`)) {
    const parts = url.match(RESIZABLE_EXT);
    if (parts && !ALREADY_A_COPY.test(parts[1])) return `${parts[1]}.w${width}.webp`;
  }
  return url;
}

/** Where the backend serves private files (the value stored on the partner's profile). */
export const PRIVATE_MEDIA_PREFIX = "/api/v1/media/private/";

export function isPrivateMediaPath(value: string | null | undefined): value is string {
  return !!value && value.startsWith(PRIVATE_MEDIA_PREFIX);
}

/** The same file as a path relative to the API base (which already ends in "/api"). */
export function privateMediaApiPath(value: string): string {
  return value.replace(/^\/api(?=\/)/, "");
}
