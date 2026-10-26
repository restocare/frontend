/**
 * Contact enquiries.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";

export type ContactStatus = "UNREAD" | "READ" | "RESOLVED";

export interface ContactSubmission {
  enquiryId: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
  user?: {
    userId: number;
    name: string | null;
    email: string | null;
    mobile: string | null;
    restaurantName: string | null;
  } | null;
}

export interface ContactSubmitRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export const contactApi = {
  /** POST /v1/contact — public endpoint, no auth required. */
  submit: (body: ContactSubmitRequest) =>
    apiClient.post<{ message: string }>("/v1/contact", body, {
      skipAuth: true,
    }),

  /** GET /v1/admin/contact — admin only, lists all submissions. */
  list: (search?: string) =>
    apiClient.get<ContactSubmission[]>(
      `/v1/admin/contact${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),

  /** PATCH /v1/admin/contact/:id — update status (READ / RESOLVED). */
  updateStatus: (id: number, status: ContactStatus) =>
    apiClient.patch<{ message: string; data: ContactSubmission }>(
      `/v1/admin/contact/${id}`,
      { status },
    ),
};
