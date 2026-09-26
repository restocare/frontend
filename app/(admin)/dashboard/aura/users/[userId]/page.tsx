"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auraApi, queryKeys } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";
import { Badge, TableShell, EmptyRow, fmtDate } from "@/src/components/crm/ui";
import {
  CategoryBadge,
  RankedBars,
  ScoreLine,
  Section,
  StatTile,
  formatMinutes,
} from "@/src/components/aura/ui";

export default function AuraUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: userIdParam } = use(params);
  const userId = Number(userIdParam);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.auraUser(userId),
    queryFn: () => auraApi.user(userId),
    enabled: Number.isFinite(userId),
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
        <p className="text-muted-foreground">This user hasn&apos;t set up Aura.</p>
        <Link href="/dashboard/aura/users" className="text-sm font-medium text-primary">
          Back to users
        </Link>
      </div>
    );
  }

  const { user, profile, counts, devices, stats, topApps, reports } = data;
  const totalScreen = topApps.reduce((sum, app) => sum + app.minutes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/aura/users" className="text-sm text-muted-foreground hover:text-foreground">
            ← Users
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-foreground">
            {user.name || `User #${user.userId}`}
          </h2>
          <p className="text-sm text-muted-foreground">{user.email || user.mobile || "—"}</p>
        </div>
        <Badge tone={profile.isActive ? "success" : "danger"}>
          {profile.isActive ? "Active" : `Suspended — ${profile.suspendedReason ?? "no reason given"}`}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatTile label="Reminders" value={counts.reminders} />
        <StatTile label="Tasks" value={counts.tasks} />
        <StatTile label="Habits" value={counts.habits} />
        <StatTile label="Notes" value={counts.notes} />
        <StatTile label="Memories" value={counts.memories} />
        <StatTile label="Chat turns" value={counts.chatTurns} />
      </div>

      <Section
        title="Productivity score"
        description="Last 30 days, on the fixed 0–100 index."
      >
        <ScoreLine data={stats.map((stat) => ({ day: stat.day, score: stat.productivityScore }))} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Most-used apps"
          description={`${formatMinutes(totalScreen)} of tracked screen time in 30 days.`}
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

        <Section title="Routine" description="What the schedulers key off for this user.">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <Detail label="Timezone" value={profile.timezone} />
            <Detail label="Assistant tone" value={profile.aiTone} />
            <Detail label="Wakes / sleeps" value={`${profile.wakeTime} – ${profile.sleepTime}`} />
            <Detail label="Work hours" value={`${profile.workStart} – ${profile.workEnd}`} />
            <Detail label="Morning brief" value={profile.morningBriefEnabled ? "On" : "Off"} />
            <Detail label="Daily report" value={profile.dailyReportEnabled ? "On" : "Off"} />
            <Detail label="Weekly report" value={profile.weeklyReportEnabled ? "On" : "Off"} />
            <Detail label="Onboarded" value={fmtDate(profile.onboardedAt)} />
          </dl>
        </Section>
      </div>

      <Section title="Devices" description="Latest health sample reported by each install.">
        <TableShell head={["Device", "OS", "App", "Battery", "Storage", "RAM", "Network", "Push", "Last seen"]}>
          {devices.length === 0 ? (
            <EmptyRow cols={9} label="No devices registered." />
          ) : (
            devices.map((device) => (
              <tr key={device.deviceId}>
                <td className="px-4 py-3 font-medium text-foreground">{device.model ?? device.platform}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {device.platform} {device.osVersion ?? ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{device.appVersion ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {device.batteryPercent != null ? `${device.batteryPercent}%` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {ratio(device.storageUsedMb, device.storageTotalMb)}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {ratio(device.ramUsedMb, device.ramTotalMb)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{device.networkType ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={device.pushEnabled ? "success" : "muted"}>
                    {device.pushEnabled ? "On" : "Off"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(device.lastSeenAt)}</td>
              </tr>
            ))
          )}
        </TableShell>
      </Section>

      <Section title="Recent reports" description="The nightly and weekly summaries Aura generated.">
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports generated yet.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => (
              <li key={report.id} className="rounded-xl border border-border p-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {report.kind === "DAILY" ? "Daily" : "Weekly"} · {report.periodStart}
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">{report.score}/100</span>
                </div>
                <p className="text-sm text-muted-foreground">{report.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs text-muted-foreground">
        Aggregates only — reminder titles, notes, memories and chat transcripts are never exposed to
        the admin panel.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </>
  );
}

function ratio(used: number | null, total: number | null): string {
  if (used == null || total == null || !total) return "—";
  return `${Math.round((used / total) * 100)}%`;
}
