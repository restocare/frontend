/** Deep Cleaning on flow 2: which categories get the cleaning page. */

export function isCleaningCategory(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes("clean");
}

/**
 * URL part for a sub-category page, from its name:
 * "Duct/Hood" → "duct-hood", "Sitting Area" → "sitting-area".
 * The API has no slug field, so the name is the stable handle.
 */
export function subSlugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
