import type { BookingRecord } from "@/src/api/api";

export type BookingActivity = "waiting" | "accepted" | "travelling" | "in-progress";

/** A profile can be assigned before it accepts. Only accepted, unfinished work
 * belongs in the connection panel; terminal statuses always win. */
export function bookingActivity(booking: BookingRecord): BookingActivity | null {
  const status = booking.status?.trim().toLowerCase().replace(/[_\s]+/g, "-") ?? "";
  if (/cancel|reject|complete|finished|done/.test(status)) return null;
  if (/^(pending|confirmed|assigned|requested)$/.test(status)) return "waiting";
  if (!(booking.professionalId || booking.professional)) return null;
  if (/^(on-the-way|en-route)$/.test(status)) return "travelling";
  if (/^(started|in-progress|inprogress|arrived|progress)$/.test(status)) return "in-progress";
  if (status === "accepted") return "accepted";
  return null;
}

const clean = (value?: string | null) => value?.replace(/\s+/g, " ").trim() || "";

/** Prefer the locality directly before the booking city in a comma-separated
 * postal address. Never mistake a house number or postcode for an area. */
export function customerBookingArea(booking: BookingRecord): string {
  const city = clean(booking.serviceCity);
  const parts = clean(booking.serviceAddress).split(",").map((part) => part.trim()).filter(Boolean);
  const cityIndex = parts.findIndex((part) => city && part.toLowerCase() === city.toLowerCase());
  const locality = cityIndex > 0 ? parts[cityIndex - 1] : "";
  if (locality && !/^\d|^(?:flat|plot|house|shop|floor|unit|block)\b/i.test(locality) && locality.length <= 40) {
    return locality;
  }
  return city || "Area not available";
}

export function partnerBookingArea(booking: BookingRecord): string {
  return clean(booking.professional?.district) || clean(booking.professional?.city) || "Area not available";
}
