import { useState } from "react";

/**
 * Local state that re-syncs to `source` whenever `source` changes, e.g. a form
 * draft seeded from a query that may refetch. Compares by reference, so pass a
 * stable value (a query result, a string) rather than a fresh object literal.
 *
 * Adjusts state during render instead of in an effect, which avoids an extra
 * render pass and satisfies `react-hooks/set-state-in-effect`.
 */
export function useSyncedState<T>(source: T) {
  const [value, setValue] = useState(source);
  const [syncedSource, setSyncedSource] = useState(source);
  if (source !== syncedSource) {
    setSyncedSource(source);
    setValue(source);
  }
  return [value, setValue] as const;
}
