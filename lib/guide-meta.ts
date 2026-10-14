/** Dates for the staffing price guide: the only place they are written down. */
export const GUIDE_PUBLISHED = "2026-10-05";
export const GUIDE_UPDATED = "2026-10-14";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10-14" -> "14 October 2026", independent of server locale/timezone. */
export function formatGuideDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
