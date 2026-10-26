/**
 * Typed API surface for the app. Every function here goes through `apiClient`
 * and is meant to be consumed by TanStack Query (`useQuery` / `useMutation`).
 *
 * The surface is split by domain (one module per area); this barrel keeps the
 * `@/src/api/api` import path working. Prefer importing from the domain module
 * in new code, e.g. `@/src/api/bookings`.
 */
export * from "./admin";
export * from "./ai";
export * from "./aura";
export * from "./auth";
export * from "./bookings";
export * from "./cart";
export * from "./catalog";
export * from "./contact";
export * from "./crm";
export * from "./customer";
export * from "./customers";
export * from "./dashboard";
export * from "./dispatch";
export * from "./hr";
export * from "./partners";
export * from "./qc";
export * from "./query-keys";
export * from "./tasks";
export * from "./vendors";
export * from "./workspaces";
