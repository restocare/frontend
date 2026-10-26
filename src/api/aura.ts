/**
 * Aura productivity assistant.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";

/**
 * Aura — the AI life tracker (React Native app). These endpoints back the
 * panel's Aura tab: fleet observability plus the two knobs that drive the
 * productivity score (the package→category catalog and the per-category
 * weights). Read routes need `aura.view`, writes need `aura.manage`.
 */

export type AuraCategory =
  | "PRODUCTIVITY"
  | "LEARNING"
  | "COMMUNICATION"
  | "SOCIAL"
  | "ENTERTAINMENT"
  | "GAMING"
  | "HEALTH"
  | "FINANCE"
  | "UTILITY"
  | "OTHER";

export const AURA_CATEGORIES: AuraCategory[] = [
  "PRODUCTIVITY",
  "LEARNING",
  "COMMUNICATION",
  "HEALTH",
  "FINANCE",
  "UTILITY",
  "SOCIAL",
  "ENTERTAINMENT",
  "GAMING",
  "OTHER",
];

export interface AuraOverview {
  totals: {
    users: number;
    activeUsers: number;
    suspended: number;
    devices: number;
    activeReminders: number;
    remindersFired24h: number;
    openTasks: number;
    chatTurns7d: number;
    unclassifiedApps: number;
  };
  averages: {
    productivityScore: number;
    screenMinutes: number;
    trackedDays: number;
  };
  dau: { day: string; users: number; averageScore: number }[];
  topApps: { appLabel: string; category: AuraCategory; minutes: number }[];
}

export interface AuraUserRow {
  userId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  profileImage: string | null;
  displayName: string | null;
  timezone: string;
  isActive: boolean;
  suspendedReason: string | null;
  onboardedAt: string | null;
  averageScore7d: number;
  screenMinutes7d: number;
  activeReminders: number;
  devices: number;
  lastSeenAt: string | null;
}

export interface AuraUsersPage {
  page: number;
  limit: number;
  total: number;
  pages: number;
  items: AuraUserRow[];
}

export interface AuraUserDetail {
  profile: {
    timezone: string;
    wakeTime: string;
    sleepTime: string;
    workStart: string;
    workEnd: string;
    isActive: boolean;
    suspendedReason: string | null;
    onboardedAt: string | null;
    aiTone: string;
    morningBriefEnabled: boolean;
    dailyReportEnabled: boolean;
    weeklyReportEnabled: boolean;
  };
  user: {
    userId: number;
    name: string | null;
    email: string | null;
    mobile: string | null;
    profileImage: string | null;
  };
  counts: {
    reminders: number;
    tasks: number;
    habits: number;
    notes: number;
    memories: number;
    chatTurns: number;
  };
  devices: {
    deviceId: string;
    platform: string;
    model: string | null;
    osVersion: string | null;
    appVersion: string | null;
    batteryPercent: number | null;
    storageUsedMb: number | null;
    storageTotalMb: number | null;
    ramUsedMb: number | null;
    ramTotalMb: number | null;
    networkType: string | null;
    pushEnabled: boolean;
    lastSeenAt: string;
  }[];
  stats: {
    day: string;
    productivityScore: number;
    screenMinutes: number;
    productiveMinutes: number;
    distractingMinutes: number;
  }[];
  topApps: { appLabel: string; category: AuraCategory; minutes: number }[];
  reports: {
    id: string;
    kind: "DAILY" | "WEEKLY";
    periodStart: string;
    score: number;
    summary: string;
  }[];
}

export interface AuraCatalogEntry {
  id: string;
  packageName: string;
  appLabel: string;
  category: AuraCategory;
  pointsPerHour: number | null;
  isDistracting: boolean;
  /** Launchers and System UI: excluded from screen time rather than counted. */
  isSystem: boolean;
  updatedAt: string;
  totalMinutes: number;
  userCount: number;
}

export interface AuraScoreRule {
  id: string;
  category: AuraCategory;
  pointsPerHour: number;
  maxPoints: number;
  updatedAt: string;
}

export interface AuraSettings {
  settingId: number;
  aiEnabled: boolean;
  chatModel: string;
  morningBriefHour: number;
  dailyReportHour: number;
  weeklyReportWeekday: number;
  maxRemindersPerUser: number;
  defaultTimezone: string;
  /** Advance warnings before every reminder, in minutes (furthest-out first). */
  leadAlertMinutes: number[];
  registrationOpen: boolean;
  updatedAt: string;
  updatedBy?: {
    userId: number;
    name: string | null;
    email: string | null;
  } | null;
}

export interface AuraUsersParams {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export const auraApi = {
  /** GET /v1/aura/admin/overview — fleet totals, 14-day actives, top apps. */
  overview: () => apiClient.get<AuraOverview>("/v1/aura/admin/overview"),

  /** GET /v1/aura/admin/users — paginated user list with 7-day metrics. */
  users: (params: AuraUsersParams = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.active !== undefined) query.set("active", String(params.active));
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString();
    return apiClient.get<AuraUsersPage>(
      `/v1/aura/admin/users${suffix ? `?${suffix}` : ""}`,
    );
  },

  /** GET /v1/aura/admin/users/:userId — 30-day trend, devices, top apps. */
  user: (userId: number) =>
    apiClient.get<AuraUserDetail>(`/v1/aura/admin/users/${userId}`),

  /** PATCH /v1/aura/admin/users/:userId/status — suspend or restore access. */
  setUserStatus: (
    userId: number,
    body: { isActive: boolean; reason?: string },
  ) =>
    apiClient.patch<{ isActive: boolean }>(
      `/v1/aura/admin/users/${userId}/status`,
      body,
    ),

  /** GET /v1/aura/admin/catalog — package → category map, ranked by usage. */
  catalog: (
    params: {
      search?: string;
      category?: AuraCategory;
      unclassified?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.unclassified) query.set("unclassified", "true");
    const suffix = query.toString();
    return apiClient.get<AuraCatalogEntry[]>(
      `/v1/aura/admin/catalog${suffix ? `?${suffix}` : ""}`,
    );
  },

  /** PUT /v1/aura/admin/catalog — classify an app (re-tags existing usage). */
  saveCatalog: (body: {
    packageName: string;
    appLabel?: string;
    category: AuraCategory;
    pointsPerHour?: number | null;
    isDistracting?: boolean;
    isSystem?: boolean;
  }) => apiClient.put<AuraCatalogEntry>("/v1/aura/admin/catalog", body),

  /** DELETE /v1/aura/admin/catalog/:packageName */
  deleteCatalog: (packageName: string) =>
    apiClient.delete<{ deleted: boolean }>(
      `/v1/aura/admin/catalog/${encodeURIComponent(packageName)}`,
    ),

  /** GET /v1/aura/admin/score-rules — per-category scoring weights. */
  scoreRules: () =>
    apiClient.get<AuraScoreRule[]>("/v1/aura/admin/score-rules"),

  /** PUT /v1/aura/admin/score-rules — retune one category. */
  saveScoreRule: (body: {
    category: AuraCategory;
    pointsPerHour: number;
    maxPoints: number;
  }) => apiClient.put<AuraScoreRule>("/v1/aura/admin/score-rules", body),

  /** GET /v1/aura/admin/settings */
  settings: () => apiClient.get<AuraSettings>("/v1/aura/admin/settings"),

  /** PATCH /v1/aura/admin/settings */
  saveSettings: (
    body: Partial<Omit<AuraSettings, "settingId" | "updatedAt" | "updatedBy">>,
  ) => apiClient.patch<AuraSettings>("/v1/aura/admin/settings", body),

  /** POST /v1/aura/admin/broadcast — announcement push to active users. */
  broadcast: (body: { title: string; body: string; userIds?: number[] }) =>
    apiClient.post<{ targeted: number; sent: number }>(
      "/v1/aura/admin/broadcast",
      body,
    ),
};
