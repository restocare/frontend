/**
 * Coordinates → a full postal address. Google first, then OpenStreetMap,
 * then BigDataCloud's coarse locality. The same chain the flow-1 checkout
 * runs inline; lifted out so the hourly booking flow can share it.
 */

import { GOOGLE_MAPS_API_KEY } from "@/src/lib/maps";

export interface GeocodeResult {
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

export const EMPTY_GEOCODE: GeocodeResult = {
  address: "",
  city: "",
  state: "",
  country: "India",
  zipCode: "",
};

async function viaGoogle(lat: number, lng: number): Promise<GeocodeResult | null> {
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
    const best = data.results[0];
    const comps = best.address_components ?? [];
    const pick = (type: string) =>
      comps.find((c) => c.types.includes(type))?.long_name ?? "";
    const city =
      pick("locality") ||
      pick("postal_town") ||
      pick("sublocality") ||
      pick("administrative_area_level_2");
    return {
      address: best.formatted_address ?? "",
      city,
      state: pick("administrative_area_level_1"),
      country: pick("country") || "India",
      zipCode: pick("postal_code"),
    };
  } catch {
    return null;
  }
}

async function viaNominatim(lat: number, lng: number): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
        postcode?: string;
      };
    };
    const a = d.address ?? {};
    const city = a.city || a.town || a.village || a.suburb || a.county || "";
    if (!d.display_name && !city) return null;
    return {
      address: d.display_name || [a.road, a.suburb, city].filter(Boolean).join(", "),
      city,
      state: a.state || "",
      country: a.country || "India",
      zipCode: a.postcode || "",
    };
  } catch {
    return null;
  }
}

async function viaBigDataCloud(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    const d = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
      postcode?: string;
    };
    const city = d.city || d.locality || "";
    return {
      address: [d.locality, city].filter(Boolean).join(", ") || "",
      city,
      state: d.principalSubdivision || "",
      country: d.countryName || "India",
      zipCode: d.postcode || "",
    };
  } catch {
    return EMPTY_GEOCODE;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const google = await viaGoogle(lat, lng);
  if (google && google.address) return google;
  const osm = await viaNominatim(lat, lng);
  if (osm && osm.address) return osm;
  return viaBigDataCloud(lat, lng);
}

/** The browser's current position, or a rejection with a readable message. */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Could not read your location.")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}
