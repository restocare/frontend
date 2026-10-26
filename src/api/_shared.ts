/**
 * Helpers shared by the API modules: query-string building and tolerant readers for loosely-typed responses.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

export function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function collectRecords(value: unknown): Record<string, unknown>[] {
  const visited = new Set<Record<string, unknown>>();
  const queue: unknown[] = [value];
  const records: Record<string, unknown>[] = [];
  while (queue.length > 0) {
    const current = asRecord(queue.shift());
    if (!current || visited.has(current)) continue;
    visited.add(current);
    records.push(current);
    for (const key of [
      "data",
      "payload",
      "result",
      "tokens",
      "auth",
      "user",
      "profile",
      "booking",
    ]) {
      if (current[key] && typeof current[key] === "object")
        queue.push(current[key]);
    }
  }
  return records;
}

export function pickString(
  records: Record<string, unknown>[],
  keys: string[],
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const v = record[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export function pickNumber(
  records: Record<string, unknown>[],
  keys: string[],
): number | undefined {
  for (const record of records) {
    for (const key of keys) {
      const v = record[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
        return Number(v);
    }
  }
  return undefined;
}

export function pickBoolean(
  records: Record<string, unknown>[],
  keys: string[],
): boolean | undefined {
  for (const record of records) {
    for (const key of keys) {
      if (typeof record[key] === "boolean") return record[key] as boolean;
    }
  }
  return undefined;
}
