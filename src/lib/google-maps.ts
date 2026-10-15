"use client";

/**
 * Google Maps JavaScript API loader + Places (New) autocomplete for the
 * dispatcher geofence editor — the same search quality as google.com/maps.
 *
 * Requires, on the key saved in Admin → Configure, in the Google Cloud console:
 *   1. "Maps JavaScript API" enabled (for the map itself).
 *   2. "Places API (New)" or the legacy "Places API" enabled (for search —
 *      both paths are implemented; New is preferred, legacy is the fallback).
 * They must also be allowed under the key's API restrictions. Until then the
 * map surfaces an auth error — see {@link onGoogleMapsAuthFailure}.
 */
import { getGoogleMapsApiKey } from "@/src/lib/maps";

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __rcGmapsReady?: () => void;
  }
}

const AUTH_EVENT = "rc:gmaps-auth-failure";

let loadPromise: Promise<typeof google> | null = null;
let authFailed = false;

/** True once Google rejected the key (API not enabled / restricted). */
export function googleMapsAuthFailed(): boolean {
  return authFailed;
}

/**
 * Subscribe to Google Maps auth failures (fires immediately if one already
 * happened). Returns an unsubscribe function.
 */
export function onGoogleMapsAuthFailure(handler: () => void): () => void {
  if (authFailed) {
    handler();
    return () => {};
  }
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

/** Load the Maps JS SDK once and reuse it across all maps/searches. */
export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("Google Maps can only load in the browser");
    }
    if (window.google?.maps) {
      return window.google;
    }
    const key = await getGoogleMapsApiKey();
    return new Promise<typeof google>((resolve, reject) => {
      // Google calls this global when the key is invalid or the Maps JavaScript
      // API isn't enabled — surface it so the UI can explain instead of showing
      // Google's greyed-out map.
      window.gm_authFailure = () => {
        authFailed = true;
        window.dispatchEvent(new Event(AUTH_EVENT));
      };
      window.__rcGmapsReady = () => resolve(window.google);
      const script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js" +
        `?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__rcGmapsReady`;
      script.async = true;
      script.onerror = () => {
        reject(new Error("Failed to load Google Maps"));
      };
      document.head.appendChild(script);
    });
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

/* ----------------------- Places (New) autocomplete ----------------------- */

/** A dropdown row: resolve() fetches coordinates only when the row is picked. */
export interface PlaceSuggestion {
  id: string;
  /** Bold primary line (e.g. "Kohat Enclave"). */
  label: string;
  /** Secondary line (locality/region). */
  address: string;
  /** Resolve to coordinates (+ viewport when Google provides one). */
  resolve: () => Promise<{
    lat: number;
    lng: number;
    viewport: google.maps.LatLngBounds | null;
  }>;
}

// One session token per typing session — Google bills autocomplete + details
// as a single session when the token is reused until a place is resolved.
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

// Places API (New) is preferred, but the current key's project only has the
// legacy Places API enabled — once New is rejected we stick to legacy.
let useLegacyPlaces = false;
let legacyAutocomplete: google.maps.places.AutocompleteService | null = null;
let legacyDetails: google.maps.places.PlacesService | null = null;

async function placesLibrary(): Promise<google.maps.PlacesLibrary> {
  const g = await loadGoogleMaps();
  return (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
}

/**
 * Fetch Google Places autocomplete predictions for what the admin typed —
 * the same predictions google.com/maps shows, biased to India like the
 * customer app. Tries Places API (New) first and falls back to the legacy
 * Places service when the key doesn't allow New. Throws when both fail so
 * the caller can show an error state.
 */
export async function fetchPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  const places = await placesLibrary();
  sessionToken ??= new places.AutocompleteSessionToken();
  if (!useLegacyPlaces) {
    try {
      return await fetchNewSuggestions(places, input);
    } catch {
      useLegacyPlaces = true; // key rejects Places (New) — legacy from now on
    }
  }
  return fetchLegacySuggestions(places, input);
}

/** Places API (New): AutocompleteSuggestion + Place.fetchFields. */
async function fetchNewSuggestions(
  places: google.maps.PlacesLibrary,
  input: string,
): Promise<PlaceSuggestion[]> {
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken: sessionToken ?? undefined,
    includedRegionCodes: ["in"],
  });
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is google.maps.places.PlacePrediction => p != null)
    .map((p) => ({
      id: p.placeId,
      label: p.mainText?.text ?? p.text.text,
      address: p.secondaryText?.text ?? p.text.text,
      resolve: async () => {
        const place = p.toPlace();
        await place.fetchFields({ fields: ["location", "viewport"] });
        sessionToken = null; // session ends on a details fetch
        const loc = place.location;
        if (!loc) throw new Error("Place has no location");
        return { lat: loc.lat(), lng: loc.lng(), viewport: place.viewport ?? null };
      },
    }));
}

/** Legacy Places API: AutocompleteService + PlacesService.getDetails. */
async function fetchLegacySuggestions(
  places: google.maps.PlacesLibrary,
  input: string,
): Promise<PlaceSuggestion[]> {
  legacyAutocomplete ??= new places.AutocompleteService();
  const { predictions } = await legacyAutocomplete.getPlacePredictions({
    input,
    sessionToken: sessionToken ?? undefined,
    componentRestrictions: { country: "in" },
  });
  return predictions.map((p) => ({
    id: p.place_id,
    label: p.structured_formatting?.main_text ?? p.description,
    address: p.structured_formatting?.secondary_text ?? p.description,
    resolve: () => resolveLegacyPlace(places, p.place_id),
  }));
}

function resolveLegacyPlace(
  places: google.maps.PlacesLibrary,
  placeId: string,
): Promise<{ lat: number; lng: number; viewport: google.maps.LatLngBounds | null }> {
  return new Promise((resolve, reject) => {
    // PlacesService needs a node for attributions; a detached div is fine.
    legacyDetails ??= new places.PlacesService(document.createElement("div"));
    legacyDetails.getDetails(
      { placeId, fields: ["geometry"], sessionToken: sessionToken ?? undefined },
      (result, status) => {
        sessionToken = null; // session ends on a details fetch
        const loc = result?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !loc) {
          reject(new Error(`Place details failed: ${status}`));
          return;
        }
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          viewport: result?.geometry?.viewport ?? null,
        });
      },
    );
  });
}
