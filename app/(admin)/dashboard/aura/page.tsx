"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auraApi, queryKeys } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";
import {
  BarChart,
  CategoryBadge,
  RankedBars,
  Section,
  StatTile,
  formatMinutes,
  formatDayLabel,
} from "@/src/components/aura/ui";

export default function AuraOverviewPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.auraOverview,
    queryFn: auraApi.overview,
  });

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
        <p className="text-muted-foreground">Couldn&apos;t load the Aura overview.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  const { totals, averages, dau, topApps } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Users"
          value={totals.users}
          hint={`${totals.activeUsers} active · ${totals.suspended} suspended`}
        />
        <StatTile label="Devices" value={totals.devices} hint="Registered for push" />
        <StatTile
          label="Active reminders"
          value={totals.activeReminders}
          hint={`${totals.remindersFired24h} fired in 24h`}
        />
        <StatTile
          label="Assistant turns"
          value={totals.chatTurns7d}
          hint="Last 7 days"
        />
        <StatTile
          label="Avg productivity"
          value={`${averages.productivityScore}/100`}
          hint={`Across ${averages.trackedDays} tracked user-days (7d)`}
        />
        <StatTile
          label="Avg screen time"
          value={formatMinutes(averages.screenMinutes)}
          hint="Per tracked day"
        />
        <StatTile label="Open tasks" value={totals.openTasks} hint="Across all users" />
        <StatTile
          label="Unclassified apps"
          value={totals.unclassifiedApps}
          tone={totals.unclassifiedApps > 0 ? "warning" : "default"}
          hint={totals.unclassifiedApps > 0 ? "Scoring as OTHER until classified" : "Catalog is complete"}
        />
      </div>

      {totals.unclassifiedApps > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">{totals.unclassifiedApps} app(s)</span> have no category
            yet, so they contribute nothing to anyone&apos;s productivity score.
          </p>
          <Link
            href="/dashboard/aura/catalog?unclassified=1"
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground"
          >
            Classify them
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Daily active users"
          description="Users with a tracked day in the last 14 days."
        >
          <BarChart
            data={dau.map((point) => ({
              label: formatDayLabel(point.day),
              value: point.users,
              title: `${formatDayLabel(point.day)}: ${point.users} users, average score ${point.averageScore}/100`,
            }))}
            valueLabel="users"
          />
        </Section>

        <Section
          title="Most-used apps"
          description="Total foreground time across every user, last 7 days."
        >
          <RankedBars
            rows={topApps.map((app) => ({
              label: app.appLabel,
              value: app.minutes,
              display: formatMinutes(app.minutes),
              badge: <CategoryBadge category={app.category} />,
            }))}
          />
        </Section>
      </div>
    </div>
  );
}
