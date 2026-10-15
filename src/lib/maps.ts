import { API_BASE_URL } from "@/src/api/apiClient";

/** The admin Configure page stores this browser-visible key in the backend. */
let keyPromise: Promise<string> | null = null;

export function getGoogleMapsApiKey(): Promise<string> {
  if (keyPromise) return keyPromise;

  keyPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/v1/configure/public`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Could not load the Google Maps key from Admin → Configure.");
    }

    const config = (await response.json()) as { googleMapsApiKey?: unknown };
    const key = typeof config.googleMapsApiKey === "string"
      ? config.googleMapsApiKey.trim()
      : "";
    if (!key) {
      throw new Error("Add a Google Maps key in Admin → Configure → Map Configuration.");
    }
    return key;
  })().catch((error) => {
    keyPromise = null; // A later attempt can recover after the config is fixed.
    throw error;
  });

  return keyPromise;
}
