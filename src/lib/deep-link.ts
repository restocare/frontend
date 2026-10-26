/**
 * True when the page was opened with `?new=1`, the dashboard's "create" deep
 * link (e.g. /dashboard/crm/tickets?new=1 opens the raise-ticket form).
 *
 * Reads `window` directly: dashboard pages only mount after the client-side
 * auth check in the shell, so there is no server render to keep in sync.
 */
export function openedWithNewParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("new") === "1";
}
