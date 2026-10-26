/**
 * TanStack Query keys shared across the admin panel.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import type { ServiceListParams } from "./catalog";
import type { AdminBookingListParams } from "./dashboard";
import type { TaskListParams } from "./tasks";
import type { VendorListParams } from "./vendors";

export const queryKeys = {
  me: ["auth", "me"] as const,
  tasks: (params: TaskListParams) => ["tasks", params] as const,
  task: (id: number) => ["task", id] as const,
  taskEmployees: (search: string) => ["task-employees", search] as const,
  taskReport: (params: Record<string, unknown>) =>
    ["task-report", params] as const,
  myTasks: (status: string) => ["my-tasks", status] as const,
  dashboardOverview: ["dashboard", "overview"] as const,
  analytics: (range: string, from?: string, to?: string) =>
    ["dashboard", "analytics", range, from ?? "", to ?? ""] as const,
  adminBookings: (params: AdminBookingListParams) =>
    ["admin-bookings", params] as const,
  partners: (search: string, status: string, categoryId?: number) =>
    ["dispatcher", "partners", status, search, categoryId ?? "all"] as const,
  partnerStatusCounts: ["dispatcher", "partners", "status-counts"] as const,
  partnerEarnings: (professionalId: number) =>
    ["dispatcher", "partner", professionalId, "earnings"] as const,
  partner: (id: number) => ["dispatcher", "partner", id] as const,
  partnerWallets: (search: string, status?: string) =>
    ["dispatcher", "wallets", search, status ?? "ALL"] as const,
  payouts: (search: string, status: string) =>
    ["dispatcher", "payouts", status, search] as const,
  payoutStatusCounts: ["dispatcher", "payouts", "status-counts"] as const,
  referralSettings: ["dispatcher", "referrals", "settings"] as const,
  referrals: (search: string) => ["dispatcher", "referrals", search] as const,
  dispatchTeams: (search: string) => ["dispatcher", "teams", search] as const,
  dispatchTeam: (id: number) => ["dispatcher", "team", id] as const,
  livePartners: ["dispatcher", "live-partners"] as const,
  geofences: (search: string) => ["dispatcher", "geofences", search] as const,
  geofence: (id: number) => ["dispatcher", "geofence", id] as const,
  warehouses: (search: string) => ["dispatcher", "warehouses", search] as const,
  allocationSettings: ["dispatcher", "allocation"] as const,
  pricingRules: ["dispatcher", "pricing-rules"] as const,
  customers: (search: string) => ["customers", search] as const,
  customer: (id: number) => ["customer", id] as const,
  customerCoupons: (id: number) => ["customer", id, "coupons"] as const,
  vendors: (params: VendorListParams) => ["vendors", params] as const,
  vendor: (id: number) => ["vendor", id] as const,
  categories: ["categories"] as const,
  services: (params: ServiceListParams) => ["services", params] as const,
  categoryTree: ["categoryTree"] as const,
  /** Location-scoped tree: a Delhi answer must never be reused in Mumbai. */
  categoryTreeAt: (coords?: { lat: number; lng: number } | null) =>
    [
      "categoryTree",
      coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : "all",
    ] as const,
  banners: ["banners"] as const,
  bannersActive: ["banners", "active"] as const,
  cart: (sessionId: string) => ["cart", sessionId] as const,
  userAddresses: (userId: string | number) => ["addresses", userId] as const,
  userBookings: (userId: string | number) =>
    ["bookings", "user", userId] as const,
  contactSubmissions: (search: string) => ["contacts", search] as const,
  configure: ["configure"] as const,
  auraOverview: ["aura", "overview"] as const,
  auraUsers: (params: Record<string, unknown>) =>
    ["aura", "users", params] as const,
  auraUser: (userId: number) => ["aura", "user", userId] as const,
  auraCatalog: (params: Record<string, unknown>) =>
    ["aura", "catalog", params] as const,
  auraScoreRules: ["aura", "score-rules"] as const,
  auraSettings: ["aura", "settings"] as const,
};
