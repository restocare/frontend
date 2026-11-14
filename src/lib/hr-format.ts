/**
 * Formatting for the staff-plan ops pages. Pure, with no imports, so the tests can load it directly.
 *
 * Money is integer paise (₹1,23,456 = 12345600). Times are Asia/Kolkata (UTC+5:30, no daylight
 * saving), whatever time zone the browser is in: ops sit in India, but a laptop on the wrong zone
 * must not shift a shift. Dates over the wire are `YYYY-MM-DD` calendar days.
 */

const IST_OFFSET_MS = 330 * 60_000;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Indian digit grouping: 1234567 -> "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

/** `₹1,23,456` for whole rupees, `₹1,23,456.50` when there are paise. "—" for nothing. */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return "—";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}₹${groupIndian(String(rupees))}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

/** Rupees as typed ("1,85,000" or "1850.5") to integer paise, or null when it is not a valid amount. */
export function rupeesToPaise(text: string): number | null {
  const t = text.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** The IST wall clock of an instant: { day: "2026-11-12", minutes: 690 }. */
function istParts(instant: string | number | Date): { day: string; minutes: number; weekday: number } {
  const shifted = new Date(new Date(instant).getTime() + IST_OFFSET_MS);
  return {
    day: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** `11:00 AM` in IST. */
export function istTime(instant: string | null | undefined): string {
  if (!instant) return "—";
  const { minutes } = istParts(instant);
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** `Thu, 12 Nov` for a `YYYY-MM-DD` day. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return "—";
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/** `12 Nov 2026` for a `YYYY-MM-DD` day (contracts and invoices, where the year matters). */
export function formatDayYear(day: string | null | undefined): string {
  if (!day) return "—";
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `Thu, 12 Nov, 11:00 AM` for an instant, in IST. */
export function istDateTime(instant: string | null | undefined): string {
  if (!instant) return "—";
  return `${formatDay(istParts(instant).day)}, ${istTime(instant)}`;
}

/** The IST calendar day of an instant, as `YYYY-MM-DD`. */
export function istDayOf(instant: string | number | Date = Date.now()): string {
  return istParts(instant).day;
}

/** `Nov 2026` for a `YYYY-MM` invoice period. */
export function formatPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return `${MONTH_NAMES[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** `needs_input` -> "Needs input". */
export function pretty(value: string): string {
  const t = value.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Ten digits from a pasted number ("+91 98111 00001", "09811100001"), or null when it is not one. */
export function tenDigitMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** "28.6469, 77.1167" (as copied from Google Maps) to { lat, lng }, or null when it is not a coordinate pair. */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
