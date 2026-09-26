/** Deep Cleaning on flow 2: which categories get the cleaning page. */

export function isCleaningCategory(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().includes("clean");
}
