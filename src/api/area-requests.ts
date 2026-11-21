import { apiClient } from "./apiClient";

/**
 * Admin → Area Requests (BUG-011): out-of-area demand recorded by the customer
 * app's "Notify me when you launch here" — one row per request, never a
 * booking. This is where demand by area is read now that out-of-zone
 * checkouts no longer create fake bookings.
 */

export interface AreaRequestRow {
  requestId: number;
  customer: string;
  mobile: string | null;
  userId: number | null;
  lat: number;
  lng: number;
  address: string | null;
  serviceName: string | null;
  createdAt: string;
}

export interface AreaRequestList {
  requests: AreaRequestRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const areaRequestsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<AreaRequestList>(`/v1/admin/area-requests?page=${page}&limit=${limit}`),
};
