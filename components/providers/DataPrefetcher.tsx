"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { projectApi, usersApi, rolesApi, permissionsApi, reportsApi, type ApiProject } from "@/app/api/api";
import { manualLeadsApi } from "@/app/api/manualLeadsApi";
import { fetchAllFormAndWhatsappLeads } from "@/app/real-estate/lead-management/lib/formLeads";
import apiClient from "@/app/api/apiClient";
import { unwrapList } from "@/app/api/unwrapList";
import { normalizeProject } from "@/app/real-estate/project/lib/normalize-project";

export function DataPrefetcher() {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();

  // Keep track of whether we've prefetched to avoid re-triggering unnecessarily
  // if this component remounts during development.
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Only prefetch if we have an active session and haven't prefetched yet.
    if (!user || !accessToken || hasPrefetched.current) return;

    hasPrefetched.current = true;

    // Determine user roles to optimize what we prefetch
    const userRole = user.roles?.[0];
    const roleName = typeof userRole === 'string'
      ? userRole
      : (userRole?.role?.name || userRole?.name || "");

    const isSuperAdmin = (roleName || "").toLowerCase().replace(/[_\s]/g, "") === "superadmin";

    // 1. Prefetch Projects, in the same shape manage-projects/page.tsx reads.
    queryClient.prefetchQuery({
      queryKey: ["projects"],
      queryFn: async () => unwrapList<ApiProject>(await projectApi.getProjects()).map(normalizeProject),
    });

    // 2. Prefetch Users (both keys used in the app)
    const fetchUsers = () => usersApi.getUsers({ tenantId: user.tenantId ?? undefined });
    queryClient.prefetchQuery({
      queryKey: ["users"],
      queryFn: fetchUsers,
    });
    queryClient.prefetchQuery({
      queryKey: ["users", user.tenantId],
      queryFn: fetchUsers,
    });

    // 3. Prefetch Roles
    queryClient.prefetchQuery({
      queryKey: ["roles"],
      queryFn: () => rolesApi.getRoles(),
    });

    // 4. Prefetch Permissions
    queryClient.prefetchQuery({
      queryKey: ["permissions", "grouped"],
      queryFn: () => permissionsApi.getGrouped(),
    });

    // 5. Prefetch Dashboard Stats
    queryClient.prefetchQuery({
      queryKey: ["dashboard-stats"],
      queryFn: async () => {
        const res = await apiClient.get("/api/v1/calls/dashboard-stats");
        return res.data.data;
      },
    });

    // 6. Prefetch Leads (if not super admin, matching dashboard logic)
    if (!isSuperAdmin) {
      queryClient.prefetchQuery({
        queryKey: ["manual-leads"],
        queryFn: () => manualLeadsApi.getAll(),
      });

      queryClient.prefetchQuery({
        queryKey: ["form-whatsapp-leads-all"],
        queryFn: () => fetchAllFormAndWhatsappLeads(),
      });

      // 7. Prefetch Reports Data
      queryClient.prefetchQuery({
        queryKey: ["reports-leads"],
        queryFn: () => reportsApi.getLeads(),
      });

      queryClient.prefetchQuery({
        queryKey: ["reports-conversions"],
        queryFn: () => reportsApi.getConversions(),
      });
    }
  }, [queryClient, user, accessToken]);

  return null;
}
