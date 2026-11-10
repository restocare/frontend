import { apiClient, uploadFile } from "./apiClient";

/**
 * Dispatcher → Customer Notifications: the push notifications a customer gets
 * about a booking, each editable here. See the backend's
 * customer-notifications.rules.ts for when each one fires.
 */
export type CustomerNotificationKey =
  | "INSTANT_HEAVY_RUSH"
  | "SCHEDULED_WELCOME"
  | "SCHEDULED_THANKS"
  | "SCHEDULED_HEAVY_RUSH";

export interface CustomerNotificationTemplate {
  key: CustomerNotificationKey;
  enabled: boolean;
  /** INSTANT_*: minutes after booking. SCHEDULED_*: minutes before the start. */
  offsetMinutes: number;
  /** May use {customerName} {serviceName} {date} {time} {address} {bookingId}. */
  title: string;
  body: string;
  imageUrl: string | null;
  /** Only the heavy-rush notifications have a pop-up. */
  popupTitle: string | null;
  popupBody: string | null;
  waitLabel: string | null;
  cancelLabel: string | null;
}

export type CustomerNotificationInput = Partial<
  Omit<CustomerNotificationTemplate, "key">
>;

export interface CustomerNotificationsView {
  templates: CustomerNotificationTemplate[];
  /** Per key: pushes sent in the last 7 days, and steps closed without sending. */
  last7Days: Record<CustomerNotificationKey, { sent: number; skipped: number }>;
  placeholders: string[];
}

export const customerNotificationsApi = {
  /** GET /v1/admin/customer-notifications */
  list: () =>
    apiClient.get<CustomerNotificationsView>(
      "/v1/admin/customer-notifications",
    ),

  /** PUT /v1/admin/customer-notifications/:key — only the fields given change. */
  update: (key: CustomerNotificationKey, body: CustomerNotificationInput) =>
    apiClient.put<CustomerNotificationTemplate>(
      `/v1/admin/customer-notifications/${key}`,
      body,
    ),

  /** POST /v1/admin/customer-notifications/:key/test — a sample to a phone (default: mine). */
  test: (key: CustomerNotificationKey, userId?: number) =>
    apiClient.post<{ result: "SENT" | "NO_DEVICE"; devices: number }>(
      `/v1/admin/customer-notifications/${key}/test`,
      userId ? { userId } : {},
    ),

  /** POST /v1/admin/customer-notifications/image — upload a picture; save its URL on the template. */
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<{ url: string }>(
      "/v1/admin/customer-notifications/image",
      fd,
    );
  },
};
