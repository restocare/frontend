/**
 * Google Maps platform config.
 *
 * Required: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, restricted to this app's origin
 * in the Google Cloud console. There is no fallback — a key that works for
 * one environment (e.g. the partner Android app's key) is wrong for others
 * and, being unrestricted, is billable by anyone who lifts it from the
 * bundle. See PR description for the key each environment should use.
 */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  const message =
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — maps features (checkout geocoding, address autocomplete) will fail.";
  if (process.env.NODE_ENV === "development") {
    throw new Error(message);
  } else {
    console.error(message);
  }
}
