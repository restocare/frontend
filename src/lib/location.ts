"use client";

import { useEffect, useSyncExternalStore } from "react";
import { GOOGLE_MAPS_API_KEY } from "@/src/lib/maps";

export interface LocationState {
  label: string;
  /** Short "locality, city" form for tight spots like the header pill. */
  shortLabel: string;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
}

interface GeocodedAddress {
  label: string;
  shortLabel: string;
}

// Versioned: bumped when the stored shape changed (v3 added shortLabel), so
// stale caches are ignored and re-detected.
const STORAGE_KEY = "rc.location.v3";

/**
 * Reverse-geocode lat/lng to a precise, full street-level address via the Google
 * Maps Geocoding API — the same source the customer app uses, so the result
 * matches what users expect. Returns null on any failure so the caller can fall
 * back.
 */
async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GeocodedAddress | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
    );
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const first = data.results[0];
    const label = first.formatted_address || null;
    if (!label) return null;
    const components = first.address_components ?? [];
    const find = (...types: string[]) =>
      components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;
    const area = find("sublocality_level_2", "neighborhood", "sublocality_level_3");
    const locality = find("sublocality_level_1", "sublocality");
    const city = find("locality", "administrative_area_level_2");
    const parts: string[] = [];
    for (const p of [area, locality, city]) {
      if (p && !parts.includes(p)) parts.push(p);
    }
    const shortLabel = parts.join(", ");
    return { label, shortLabel: shortLabel || label };
  } catch {
    return null;
  }
}

/** OpenStreetMap (Nominatim) reverse geocoder — free, key-less. Returns the full
 *  street-level address (display_name) like Google Maps. */
async function reverseGeocodeOSM(lat: number, lng: number): Promise<GeocodedAddress | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        neighbourhood?: string;
        quarter?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
      };
    };
    const a = data.address ?? {};
    const area = a.neighbourhood || a.quarter || "";
    const city = a.city || a.town || a.village || a.county || "";
    const locality = a.suburb || "";
    const shortParts: string[] = [];
    for (const p of [area, locality, city]) {
      if (p && !shortParts.includes(p)) shortParts.push(p);
    }
    const shortLabel = shortParts.join(", ") || a.state || "";
    const label =
      data.display_name || [a.road, city, a.state].filter(Boolean).join(", ");
    if (!label) return null;
    return { label, shortLabel: shortLabel || label };
  } catch {
    return null;
  }
}

/** Resolve coordinates to a full, precise address: Google first, then OSM, then raw coords. */
async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
  const raw = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  return (
    (await reverseGeocodeGoogle(lat, lng)) ??
    (await reverseGeocodeOSM(lat, lng)) ?? { label: raw, shortLabel: raw }
  );
}

/**
 * Detects the user's current location via the browser Geolocation API and
 * resolves it to a readable label. Persists the last result in localStorage so
 * the header doesn't flash on every navigation.
 */
function readCachedLocation(): LocationState | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as {
      label: string;
      shortLabel?: string;
      coords: { lat: number; lng: number };
    };
    return {
      label: parsed.label,
      shortLabel: parsed.shortLabel || parsed.label,
      loading: false,
      error: null,
      coords: parsed.coords,
    };
  } catch {
    return null;
  }
}

/* ---------------------------- shared store ------------------------------ */
/*
 * One location for the whole app. Every useCurrentLocation() instance reads
 * the same store, so changing the location in the header immediately re-runs
 * every location-scoped query (category tree, services, search) — that's what
 * unblocks categories that were "coming soon" only for the old area.
 */

const INITIAL_STATE: LocationState = {
  label: "Detecting location…",
  shortLabel: "Detecting location…",
  loading: true,
  error: null,
  coords: null,
};

let store: LocationState = INITIAL_STATE;
const listeners = new Set<() => void>();

function setStore(next: LocationState): void {
  store = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => store;
const getServerSnapshot = () => INITIAL_STATE;

function persist(place: {
  label: string;
  shortLabel: string;
  coords: { lat: number; lng: number };
}): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    /* ignore quota/availability errors */
  }
}

function detect(): void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    setStore({
      label: "Set location",
      shortLabel: "Set location",
      loading: false,
      error: "Geolocation not supported",
      coords: null,
    });
    return;
  }

  setStore({ ...store, loading: true, error: null });
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const { label, shortLabel } = await reverseGeocode(coords.lat, coords.lng);
      setStore({ label, shortLabel, loading: false, error: null, coords });
      persist({ label, shortLabel, coords });
    },
    (err) => {
      setStore({
        label: "Set location",
        shortLabel: "Set location",
        loading: false,
        error: err.message,
        coords: null,
      });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
}

/** A place the user picked from search — replaces the detected location. */
function setPlace(place: {
  label: string;
  shortLabel: string;
  coords: { lat: number; lng: number };
}): void {
  setStore({ ...place, loading: false, error: null });
  persist(place);
}

let hydrated = false;

export function useCurrentLocation() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Hydrate once for the whole app: from the cached location if present
    // (avoids a flash on navigation), otherwise detect the current one. The
    // cache read is deferred to a microtask so we never call setStore
    // synchronously inside the effect body of the first subscriber.
    if (hydrated) return;
    hydrated = true;
    const cached = readCachedLocation();
    queueMicrotask(() => {
      if (cached) setStore(cached);
      else detect();
    });
  }, []);

  return { ...state, detect, setPlace };
}
