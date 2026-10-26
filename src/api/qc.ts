/**
 * Quick-commerce store settings and catalog.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";
import type { QcDeliveryPartnerRow } from "./dashboard";

/* ═══════════════════ Quick Commerce (store 2) ═══════════════════ */

export interface QcCategory {
  qcCategoryId: number;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface QcProduct {
  qcProductId: number;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
  qcCategoryId: number;
  category?: { name: string } | null;
  createdAt?: string;
}

export interface QcVendorRow {
  qcVendorId: number;
  userId: number;
  storeName: string;
  ownerName: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  /** Store pin — the delivery app's pickup marker. */
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
  user?: { email: string | null };
  _count?: { products: number };
}

export type QcOrderStatus =
  "PLACED" | "ACCEPTED" | "PICKED_UP" | "DELIVERED" | "CANCELLED";

export interface QcAdminOrder {
  qcOrderId: number;
  status: QcOrderStatus;
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  paymentMode: string;
  address: string;
  city: string | null;
  createdAt: string;
  deliveredAt: string | null;
  customer?: { name: string | null; mobile: string | null };
  partner?: { professionalId: number; user: { name: string | null } } | null;
  items: {
    name: string;
    quantity: number;
    amount: number;
    qcVendorId: number;
  }[];
}

export interface QcVendorOrder {
  qcOrderId: number;
  status: QcOrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  address: string;
  city: string | null;
  customer: { name: string | null; mobile: string | null };
  amount: number;
  items: { name: string; price: number; quantity: number; amount: number }[];
}

export interface QcVendorRevenue {
  today: number;
  week: number;
  month: number;
  allTime: number;
  unitsSold: number;
  products: {
    qcProductId: number;
    name: string;
    units: number;
    revenue: number;
  }[];
}

export const qcApi = {
  categories: () =>
    apiClient.get<QcCategory[]>("/v1/qc/categories", { skipAuth: true }),

  /* admin */
  vendors: () => apiClient.get<QcVendorRow[]>("/v1/qc/admin/vendors"),
  createVendor: (body: {
    storeName: string;
    email: string;
    password: string;
    ownerName?: string;
    mobile?: string;
    address?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }) =>
    apiClient.post<{ message: string; vendor: QcVendorRow }>(
      "/v1/qc/admin/vendors",
      body,
    ),
  updateVendor: (
    id: number,
    body: Partial<{
      storeName: string;
      ownerName: string;
      mobile: string;
      address: string;
      city: string;
      lat: number;
      lng: number;
      isActive: boolean;
      password: string;
    }>,
  ) => apiClient.patch<QcVendorRow>(`/v1/qc/admin/vendors/${id}`, body),
  adminOrders: (status?: string) =>
    apiClient.get<QcAdminOrder[]>(
      `/v1/qc/admin/orders${toQueryString({ status })}`,
    ),
  adminStats: () =>
    apiClient.get<{
      orders: number;
      revenue: number;
      vendors: number;
      products: number;
      pendingOrders: number;
    }>("/v1/qc/admin/stats"),

  /* vendor portal (scoped server-side to the caller's store) */
  vendorMe: () =>
    apiClient.get<QcVendorRow & { productCount: number; inStock: number }>(
      "/v1/qc/vendor/me",
    ),
  vendorProducts: () => apiClient.get<QcProduct[]>("/v1/qc/vendor/products"),
  vendorCreateProduct: (body: {
    name: string;
    qcCategoryId: number;
    price: number;
    mrp?: number;
    stock?: number;
    description?: string;
    isActive?: boolean;
  }) => apiClient.post<QcProduct>("/v1/qc/vendor/products", body),
  vendorUpdateProduct: (
    id: number,
    body: Partial<{
      name: string;
      qcCategoryId: number;
      price: number;
      mrp: number;
      stock: number;
      description: string;
      isActive: boolean;
    }>,
  ) => apiClient.patch<QcProduct>(`/v1/qc/vendor/products/${id}`, body),
  vendorDeleteProduct: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/qc/vendor/products/${id}`),
  vendorUploadImage: (id: number, image: File) => {
    const fd = new FormData();
    fd.append("image", image);
    return uploadFile<QcProduct>(`/v1/qc/vendor/products/${id}/image`, fd);
  },
  vendorOrders: () => apiClient.get<QcVendorOrder[]>("/v1/qc/vendor/orders"),

  /* delivery partners (wallet, masked bank details, task stats) */
  deliveryPartners: () =>
    apiClient.get<QcDeliveryPartnerRow[]>("/v1/qc/admin/delivery-partners"),

  /* settings (refund policy shown in the customer app) */
  settings: () =>
    apiClient.get<{
      refundPolicy: string | null;
      supportPhone: string | null;
      supportEmail: string | null;
    }>("/v1/qc/settings", { skipAuth: true }),
  updateSettings: (body: {
    refundPolicy?: string;
    supportPhone?: string;
    supportEmail?: string;
  }) => apiClient.patch<{ message: string }>("/v1/qc/admin/settings", body),
  vendorRevenue: () => apiClient.get<QcVendorRevenue>("/v1/qc/vendor/revenue"),
};
