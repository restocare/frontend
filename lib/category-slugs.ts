/**
 * Single id<->slug map for category pages. The backend has no `slug` column
 * yet (that's a follow-up), so this list is maintained by hand — add a row
 * here when a new category needs a public slug.
 */
export interface CategorySlugEntry {
  id: number;
  slug: string;
  name: string;
}

export const CATEGORY_SLUGS: CategorySlugEntry[] = [
  { id: 5, slug: "chef", name: "Chef" },
  { id: 10, slug: "helpers-and-waiters", name: "Helpers & Waiter" },
  { id: 9, slug: "deep-cleaning", name: "Deep Cleaning" },
  { id: 6, slug: "plumber", name: "Plumber" },
  { id: 7, slug: "electrician", name: "Electrician" },
  { id: 8, slug: "technician", name: "Technician" },
  { id: 12, slug: "ac-appliance-repair", name: "AC & Appliance Repair" },
  // DB name is "Pest Controll" (typo) — slug uses the correct spelling.
  { id: 11, slug: "pest-control", name: "Pest Controll" },
];

export function slugForCategoryId(id: number): string | undefined {
  return CATEGORY_SLUGS.find((c) => c.id === id)?.slug;
}

export function categoryIdForSlug(slug: string): number | undefined {
  return CATEGORY_SLUGS.find((c) => c.slug === slug)?.id;
}

/** Falls back to the numeric-id path for a category not yet in the map. */
export function categoryHref(id: number): string {
  const slug = slugForCategoryId(id);
  return `/category/${slug ?? id}`;
}
