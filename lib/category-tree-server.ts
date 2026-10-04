import { queryKeys, type CategoryTreeNode } from "@/src/api/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";

/**
 * The React Query slot for the no-location tree. The tree fetched here is
 * placed in that slot, so the client components read it on their first render.
 */
export const CATEGORY_TREE_ALL_KEY = queryKeys.categoryTreeAt(null);

/**
 * The public category -> service tree, fetched on the server with no
 * coordinates (so no per-location filtering). The page renders from it and the
 * layout builds metadata from it. Both calls use the same URL and cache
 * options, so Next fetches it once per revalidation window.
 *
 * Returns null on any failure. Callers must fall back to the client-side
 * fetch, never throw: an API outage must not take the page down.
 */
export async function fetchCategoryTree(): Promise<CategoryTreeNode[] | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/catagories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const tree = (await res.json()) as CategoryTreeNode[];
    if (!Array.isArray(tree)) return null;
    // Same display patch categoryTreeApi.tree() applies on the client.
    return tree.map((c) =>
      /\bcontroll\b/i.test(c.name)
        ? { ...c, name: c.name.replace(/\bControll\b/gi, "Control") }
        : c,
    );
  } catch {
    return null;
  }
}
