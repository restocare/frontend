/**
 * Some endpoints return a bare array, others wrap it as `{ data: [...] }`.
 * Returns the array either way, or `[]` when the payload is neither.
 */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const inner = (payload as { data?: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}
