/**
 * Dispatcher domain: assigning partners to bookings.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

/* Teams, geofences (polygon zones), warehouses, auto-allocation settings
   and delivery pricing rules — all under /v1/admin/dispatch. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Lightweight partner row shared by team + geofence pickers. */
export interface DispatchPartnerRow {
  professionalId: number;
  name: string;
  mobile: string | null;
  city: string | null;
  isOnline: boolean;
  profileImage: string | null;
  teamId: number | null;
}

export interface DispatchTeamRow {
  teamId: number;
  name: string;
  description: string | null;
  memberCount: number;
  geofenceCount: number;
  createdAt: string;
}

export interface DispatchTeamDetail {
  teamId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: DispatchPartnerRow[];
  geofences: {
    geofenceId: number;
    name: string;
    color: string;
    isActive: boolean;
  }[];
}

export interface GeofenceRow {
  geofenceId: number;
  name: string;
  description: string | null;
  color: string;
  polygon: LatLng[];
  isActive: boolean;
  team: { teamId: number; name: string } | null;
  partnerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceDetail {
  geofenceId: number;
  name: string;
  description: string | null;
  color: string;
  polygon: LatLng[];
  isActive: boolean;
  teamId: number | null;
  team: { teamId: number; name: string } | null;
  partners: DispatchPartnerRow[];
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceInput {
  name: string;
  description?: string;
  color?: string;
  polygon: LatLng[];
  /**
   * The team that covers this zone — a zone is scoped to a team, never to
   * individual service partners. null clears it; omit to leave it unchanged.
   */
  teamId?: number | null;
  isActive?: boolean;
}

export interface WarehouseRow {
  warehouseId: number;
  name: string;
  address: string;
  city: string | null;
  latitude: number;
  longitude: number;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInput {
  name: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  contactName?: string;
  contactPhone?: string;
  isActive?: boolean;
}

/** How auto-allocation pushes leads to eligible partners. */
export type AllocationMethod = "BROADCAST" | "NEAREST" | "ROUND_ROBIN";

export interface AllocationSettings {
  settingId: number;
  /** Master switch — when false, new bookings are not broadcast at all. */
  enabled: boolean;
  method: AllocationMethod;
  radiusKm: number;
  /** Partner cap per lead for NEAREST / ROUND_ROBIN; 0 = no cap. */
  maxAgents: number;
  /** Restrict leads to partners of the geofence covering the booking point. */
  restrictToGeofence: boolean;
  /** Apply the radius inside a zone too; off = a zone's team is trusted at any distance. */
  radiusInsideZone: boolean;
  /** Alarm partners whose profile has no GPS; off = the radius is strict. */
  includeUnlocatedPartners: boolean;
  /** Extra times an unaccepted lead is re-offered; 0 = broadcast once and stop. */
  leadRetryCount: number;
  /** Minutes to wait after a broadcast before re-offering. */
  leadRetryAfterMinutes: number;
  /** Metres a partner must be within to enter the OTP and start the job. */
  startRadiusMeters: number;
  /** Minutes the app may be silent before duty hours pause (duty status is untouched). */
  presenceStaleMinutes: number;
  /** The most one duty session can be worth, in hours. */
  dutySessionMaxHours: number;
  /** How many MORE times a lead rings each partner who has not answered; 0 = ring once. */
  leadRingRepeatCount: number;
  /** Seconds between repeat rings. */
  leadRingRepeatSeconds: number;
  updatedAt: string;
}

export interface PricingRuleRow {
  ruleId: number;
  name: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmFare: number;
  perMinuteFare: number;
  waitingFarePerMin: number;
  minFare: number | null;
  teamId: number | null;
  geofenceId: number | null;
  team: { teamId: number; name: string } | null;
  geofence: { geofenceId: number; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRuleInput {
  name: string;
  baseFare: number;
  baseDistanceKm?: number;
  perKmFare?: number;
  perMinuteFare?: number;
  waitingFarePerMin?: number;
  minFare?: number;
  teamId?: number | null;
  geofenceId?: number | null;
  isActive?: boolean;
}

export interface LivePartnerPoint {
  professionalId: number;
  name: string;
  mobile: string | null;
  city: string | null;
  lat: number;
  lng: number;
  teamId: number | null;
  geofenceId: number | null;
  zoneName: string | null;
  zoneColor: string | null;
}

export interface LivePartnerZone {
  geofenceId: number;
  name: string;
  color: string;
  polygon: LatLng[];
  /** The dispatch team assigned to this zone, if any. */
  team: { teamId: number; name: string } | null;
  activeCount: number;
}

export interface LivePartnersResponse {
  totalActive: number;
  unzonedCount: number;
  zones: LivePartnerZone[];
  partners: LivePartnerPoint[];
}

export const dispatchApi = {
  /** GET /v1/admin/dispatch/live-partners — active partners placed on their zone. */
  livePartners: () =>
    apiClient.get<LivePartnersResponse>(`/v1/admin/dispatch/live-partners`),

  /** GET /v1/admin/dispatch/teams — teams with member/geofence counts. */
  listTeams: (search?: string) =>
    apiClient.get<DispatchTeamRow[]>(
      `/v1/admin/dispatch/teams${toQueryString({ search })}`,
    ),

  /** GET /v1/admin/dispatch/teams/:id — a team with members and geofences. */
  getTeam: (teamId: number) =>
    apiClient.get<DispatchTeamDetail>(`/v1/admin/dispatch/teams/${teamId}`),

  /** POST /v1/admin/dispatch/teams — create a team. */
  createTeam: (body: { name: string; description?: string }) =>
    apiClient.post<DispatchTeamRow>(`/v1/admin/dispatch/teams`, body),

  /** PATCH /v1/admin/dispatch/teams/:id — rename / redescribe a team. */
  updateTeam: (teamId: number, body: { name?: string; description?: string }) =>
    apiClient.patch<DispatchTeamRow>(
      `/v1/admin/dispatch/teams/${teamId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/teams/:id — members/zones are unassigned, not deleted. */
  deleteTeam: (teamId: number) =>
    apiClient.delete<{ message: string }>(`/v1/admin/dispatch/teams/${teamId}`),

  /** PUT /v1/admin/dispatch/teams/:id/members — replace the full member list. */
  setTeamMembers: (teamId: number, professionalIds: number[]) =>
    apiClient.put<DispatchTeamDetail>(
      `/v1/admin/dispatch/teams/${teamId}/members`,
      {
        professionalIds,
      },
    ),

  /** GET /v1/admin/dispatch/geofences — zones with team + partner counts. */
  listGeofences: (search?: string) =>
    apiClient.get<GeofenceRow[]>(
      `/v1/admin/dispatch/geofences${toQueryString({ search })}`,
    ),

  /** GET /v1/admin/dispatch/geofences/:id — polygon, team and partners. */
  getGeofence: (geofenceId: number) =>
    apiClient.get<GeofenceDetail>(`/v1/admin/dispatch/geofences/${geofenceId}`),

  /** POST /v1/admin/dispatch/geofences — create a zone. */
  createGeofence: (body: GeofenceInput) =>
    apiClient.post<GeofenceDetail>(`/v1/admin/dispatch/geofences`, body),

  /** PATCH /v1/admin/dispatch/geofences/:id */
  updateGeofence: (geofenceId: number, body: Partial<GeofenceInput>) =>
    apiClient.patch<GeofenceDetail>(
      `/v1/admin/dispatch/geofences/${geofenceId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/geofences/:id */
  deleteGeofence: (geofenceId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/geofences/${geofenceId}`,
    ),

  /** GET /v1/admin/dispatch/warehouses */
  listWarehouses: (search?: string) =>
    apiClient.get<WarehouseRow[]>(
      `/v1/admin/dispatch/warehouses${toQueryString({ search })}`,
    ),

  /** POST /v1/admin/dispatch/warehouses */
  createWarehouse: (body: WarehouseInput) =>
    apiClient.post<WarehouseRow>(`/v1/admin/dispatch/warehouses`, body),

  /** PATCH /v1/admin/dispatch/warehouses/:id */
  updateWarehouse: (warehouseId: number, body: Partial<WarehouseInput>) =>
    apiClient.patch<WarehouseRow>(
      `/v1/admin/dispatch/warehouses/${warehouseId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/warehouses/:id */
  deleteWarehouse: (warehouseId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/warehouses/${warehouseId}`,
    ),

  /** GET /v1/admin/dispatch/allocation — the auto-allocation settings singleton. */
  getAllocationSettings: () =>
    apiClient.get<AllocationSettings>(`/v1/admin/dispatch/allocation`),

  /** PUT /v1/admin/dispatch/allocation — update the auto-allocation settings. */
  updateAllocationSettings: (
    body: Partial<Omit<AllocationSettings, "settingId" | "updatedAt">>,
  ) => apiClient.put<AllocationSettings>(`/v1/admin/dispatch/allocation`, body),

  /** GET /v1/admin/dispatch/pricing-rules */
  listPricingRules: () =>
    apiClient.get<PricingRuleRow[]>(`/v1/admin/dispatch/pricing-rules`),

  /** POST /v1/admin/dispatch/pricing-rules */
  createPricingRule: (body: PricingRuleInput) =>
    apiClient.post<PricingRuleRow>(`/v1/admin/dispatch/pricing-rules`, body),

  /** PATCH /v1/admin/dispatch/pricing-rules/:id */
  updatePricingRule: (ruleId: number, body: Partial<PricingRuleInput>) =>
    apiClient.patch<PricingRuleRow>(
      `/v1/admin/dispatch/pricing-rules/${ruleId}`,
      body,
    ),

  /** DELETE /v1/admin/dispatch/pricing-rules/:id */
  deletePricingRule: (ruleId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/admin/dispatch/pricing-rules/${ruleId}`,
    ),
};
