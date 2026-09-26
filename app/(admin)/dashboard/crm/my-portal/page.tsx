"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, essApi } from "@/src/api/api";
import { Notice, PageHeader } from "@/src/components/crm/ui";
import { SpinnerIcon } from "@/src/components/icons";
import { AnalyticsSection, OverviewSection, PortalStatsHeader } from "@/src/components/crm/portal";

export default function MyPortalPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.myPortal,
    queryFn: essApi.portal,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <SpinnerIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="My Portal" />
        <Notice kind="error">
          {error instanceof ApiError
            ? error.message
            : "Could not load your portal. Ask HR to link your login to an employee profile."}
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PortalStatsHeader portal={data} />
      <OverviewSection checkedInToday={data.attendanceThisMonth.checkedInToday} />
      <AnalyticsSection portal={data} />
    </div>
  );
}
