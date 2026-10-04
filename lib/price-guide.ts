import type { CategoryTreeNode, CategoryTreeService } from "@/src/api/api";

/**
 * Reads the price guide's tables out of the live category tree. Nothing here
 * holds a price: every figure comes from the tree, so the guide matches what
 * checkout charges.
 */

export type PriceCell = { price: number; from: boolean } | null;

export interface ShiftRow {
  label: string;
  day: PriceCell;
  night: PriceCell;
}

export interface ShiftTable {
  /** Per-hour rate the catalogue lists on the services, or null if it has none. */
  hourly: number | null;
  rows: ShiftRow[];
}

export interface ItemRow {
  name: string;
  price: number;
  unit: string;
}

const SHIFT_ROWS = [
  { key: "5h", label: "5 hours" },
  { key: "10h", label: "10 hours" },
  { key: "week", label: "1 week" },
] as const;

type ShiftKey = (typeof SHIFT_ROWS)[number]["key"];
type Period = "day" | "night";

/** "5 Hour Shift (11 AM – 4 PM)", "1 Week Night Shift (2PM - 12 Midnight)". */
function classify(
  name: string,
  durationMinutes: number | null | undefined,
): { shift: ShiftKey; period: Period } | null {
  let shift: ShiftKey | null = null;
  if (/\bweek\b/i.test(name)) shift = "week";
  else if (durationMinutes === 300) shift = "5h";
  else if (durationMinutes === 600) shift = "10h";
  if (!shift) return null;
  // The 5 and 10 hour night shifts say "Midnight" rather than "Night".
  return { shift, period: /night|midnight/i.test(name) ? "night" : "day" };
}

const isActive = (s: CategoryTreeService) => s.isActive !== false;

function allServices(category: CategoryTreeNode): CategoryTreeService[] {
  return [...category.services, ...category.groups.flatMap((g) => g.services)].filter(
    isActive,
  );
}

/**
 * Shift price table for a staffing category. Where services in the category
 * disagree on a slot (they don't today) the cell shows the lowest price
 * marked "from". Returns null when the category has no shift variants at all.
 */
export function shiftTable(category: CategoryTreeNode): ShiftTable | null {
  const services = allServices(category);
  const found = new Map<string, number[]>();
  for (const s of services) {
    for (const v of s.variants) {
      const c = classify(v.name, v.durationMinutes);
      if (!c || !(v.price > 0)) continue;
      const k = `${c.shift}:${c.period}`;
      found.set(k, [...(found.get(k) ?? []), v.price]);
    }
  }
  if (found.size === 0) return null;

  const cell = (shift: ShiftKey, period: Period): PriceCell => {
    const prices = found.get(`${shift}:${period}`);
    if (!prices) return null;
    const min = Math.min(...prices);
    return { price: min, from: prices.some((p) => p !== min) };
  };

  // The service-level price is the hourly rate only when every shift costs
  // more than it (same rule the category page uses before saying "/hour").
  const variantPrices = [...found.values()].flat();
  const lowestShift = Math.min(...variantPrices);
  const rates = services
    .map((s) => s.price)
    .filter((p): p is number => p != null && p > 0 && p < lowestShift);

  return {
    hourly: rates.length ? Math.min(...rates) : null,
    rows: SHIFT_ROWS.map((r) => ({
      label: r.label,
      day: cell(r.key, "day"),
      night: cell(r.key, "night"),
    })),
  };
}

/**
 * Units ops confirmed for the Deep Cleaning items (docs/seo/category-briefs.md).
 * Keyed by service id; the name and price on the page still come from the
 * catalogue. Items with no confirmed unit are left off the table rather than
 * guessed.
 */
const CLEANING_UNITS: Record<number, string> = {
  243: "per burner", // Burner Cleaning
  247: "per piece", // Ovens
  249: "per piece", // Exhaust Units
  261: "per job", // Kitchen Cleaning (Floor & Walls)
  257: "per job", // Dine-In Area Cleaning
  259: "per piece", // Bain-Marie
  245: "per piece", // Display Counter
  252: "per piece", // Deep Freezer
};

export function cleaningTable(category: CategoryTreeNode): {
  rows: ItemRow[];
  totalItems: number;
} | null {
  const services = allServices(category);
  const rows = services.flatMap((s) =>
    CLEANING_UNITS[s.serviceId] && s.price != null && s.price > 0
      ? [{ name: s.name, price: s.price, unit: CLEANING_UNITS[s.serviceId] }]
      : [],
  );
  return rows.length ? { rows, totalItems: services.length } : null;
}

export const formatInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
