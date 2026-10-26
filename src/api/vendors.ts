/**
 * Vendor directory.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

export type VendorStatus = "ACTIVE" | "AWAITING_APPROVAL" | "BLOCKED";

export interface Vendor {
  vendorId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  icon: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: number | null;
  isOpen: boolean;
  status: VendorStatus;
  offersServices: boolean;
  canAddCategory: boolean;
  commissionPercentage: number;
  createdAt: string;
  updatedAt: string;
  servicesCount: number;
}

export interface VendorListResponse {
  vendors: Vendor[];
  stats: {
    totalVendors: number;
    openVendors: number;
    totalServices: number;
    activeVendors: number;
  };
  tabs: { active: number; awaitingApproval: number; blocked: number };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VendorInput {
  name: string;
  email?: string;
  mobile?: string;
  icon?: string;
  description?: string;
  address?: string;
  city?: string;
  isOpen?: boolean;
  status?: VendorStatus;
  offersServices?: boolean;
  canAddCategory?: boolean;
  commissionPercentage?: number;
}

export interface VendorListParams {
  status?: VendorStatus;
  search?: string;
}

export interface VendorWithCategory extends Vendor {
  category?: { categoryId: number; name: string } | null;
}

export const vendorApi = {
  list: (params: VendorListParams = {}) =>
    apiClient.get<VendorListResponse>(
      `/v1/vendor${toQueryString({ status: params.status, search: params.search })}`,
    ),
  get: (id: number) => apiClient.get<VendorWithCategory>(`/v1/vendor/${id}`),
  create: (body: VendorInput) => apiClient.post<Vendor>("/v1/vendor", body),
  update: (id: number, body: Partial<VendorInput>) =>
    apiClient.patch<Vendor>(`/v1/vendor/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/vendor/${id}`),
};
