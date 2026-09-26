"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, crmReportsApi } from "@/src/api/api";
import {
  Badge,
  Card,
  EmptyRow,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
} from "@/src/components/crm/ui";
import { SpinnerIcon } from "@/src/components/icons";

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const pretty = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full min-w-24 rounded-full bg-muted-foreground/10">
      <div
        className="h-2 rounded-full bg-primary"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-2 text-3xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <SpinnerIcon className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function CrmReportsPage() {
  const [tab, setTab] = useState("sales");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Sales pipeline, workforce utilization and restaurant revenue"
      />
      <Tabs
        tabs={[
          { key: "sales", label: "Sales" },
          { key: "workforce", label: "Workforce" },
          { key: "restaurants", label: "Restaurants" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "sales" && <SalesTab />}
      {tab === "workforce" && <WorkforceTab />}
      {tab === "restaurants" && <RestaurantsTab />}
    </div>
  );
}

/* -------------------------------- Sales --------------------------------- */

function SalesTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.reportSales(12),
    queryFn: () => crmReportsApi.sales(12),
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return (
      <Notice kind="error">
        {error instanceof ApiError ? error.message : "Could not load the sales report."}
      </Notice>
    );

  const maxRevenue = Math.max(1, ...data.monthly.map((m) => m.revenue));
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total leads" value={data.totalLeads} />
        <Kpi label="Won" value={data.won} />
        <Kpi label="Lost" value={data.lost} />
        <Kpi
          label="Conversion rate"
          value={data.conversionRate != null ? `${data.conversionRate}%` : "—"}
          hint="won ÷ closed (won + lost)"
        />
      </div>

      <Card>
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          Monthly performance (last 12 months)
        </div>
        <TableShell head={["Month", "Revenue", "", "Bookings", "New leads"]}>
          {!data.monthly.length && <EmptyRow cols={5} label="No data yet." />}
          {data.monthly.map((m) => (
            <tr key={m.month} className="text-foreground">
              <td className="px-4 py-3 font-medium">{m.month}</td>
              <td className="px-4 py-3">{inr(m.revenue)}</td>
              <td className="w-1/3 px-4 py-3">
                <Bar pct={(m.revenue / maxRevenue) * 100} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">{m.bookings}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.newLeads}</td>
            </tr>
          ))}
        </TableShell>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-foreground">Pipeline funnel</h2>
          <div className="mt-4 space-y-3">
            {data.funnel.map((f) => (
              <div key={f.stage} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-muted-foreground">{pretty(f.stage)}</span>
                <Bar pct={(f.count / maxFunnel) * 100} />
                <span className="w-8 shrink-0 text-right font-medium text-foreground">
                  {f.count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Lead sources
          </div>
          <TableShell head={["Source", "Leads", "Won", "Win %", "Value"]}>
            {!data.sources.length && <EmptyRow cols={5} label="No leads recorded yet." />}
            {data.sources.map((s) => (
              <tr key={s.source} className="text-foreground">
                <td className="px-4 py-3 font-medium">{pretty(s.source)}</td>
                <td className="px-4 py-3">{s.total}</td>
                <td className="px-4 py-3">{s.won}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {s.total ? `${Math.round((s.won / s.total) * 100)}%` : "—"}
                </td>
                <td className="px-4 py-3">{inr(s.value)}</td>
              </tr>
            ))}
          </TableShell>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Workforce ------------------------------- */

function WorkforceTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.reportWorkforce,
    queryFn: crmReportsApi.workforce,
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return (
      <Notice kind="error">
        {error instanceof ApiError ? error.message : "Could not load the workforce report."}
      </Notice>
    );

  const trainingTone: Record<string, string> = {
    COMPLETED: "success",
    IN_PROGRESS: "primary",
    NOT_STARTED: "muted",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Active partners" value={data.activePartners} />
        <Kpi label="Online now" value={data.onlinePartners} />
        <Kpi
          label="Utilization"
          value={data.utilizationPct != null ? `${data.utilizationPct}%` : "—"}
          hint={`${data.busyPartnersThisMonth} worked ≥1 job this month`}
        />
        <Kpi label="Active employees" value={data.employeesActive} />
        <Kpi label="Attendance today" value={data.attendanceToday} />
      </div>

      <Card>
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          Top performers
        </div>
        <TableShell head={["#", "Name", "Service", "City", "Jobs", "Rating", "Training"]}>
          {!data.topPerformers.length && (
            <EmptyRow cols={7} label="No active partners with completed jobs yet." />
          )}
          {data.topPerformers.map((p, i) => (
            <tr key={p.professionalId} className="text-foreground">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{p.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.service ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.city ?? "—"}</td>
              <td className="px-4 py-3">{p.totalJobs}</td>
              <td className="px-4 py-3">★ {p.rating.toFixed(1)}</td>
              <td className="px-4 py-3">
                <Badge tone={trainingTone[p.trainingStatus] ?? "muted"}>
                  {pretty(p.trainingStatus)}
                </Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
    </div>
  );
}

/* ------------------------------ Restaurants ----------------------------- */

function RestaurantsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.reportRestaurants,
    queryFn: crmReportsApi.restaurants,
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return (
      <Notice kind="error">
        {error instanceof ApiError ? error.message : "Could not load the restaurant report."}
      </Notice>
    );

  const maxRevenue = Math.max(1, ...data.topByRevenue.map((r) => r.revenue));
  const maxFreq = Math.max(1, ...data.serviceFrequency.map((s) => s.bookings));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Active restaurants" value={data.activeRestaurants} />
        <Kpi
          label="Repeat customers"
          value={data.repeatCustomers}
          hint={
            data.repeatRatePct != null
              ? `${data.repeatRatePct}% of ${data.totalCustomersWithBookings} customers with bookings`
              : undefined
          }
        />
        <Kpi label="Customers with bookings" value={data.totalCustomersWithBookings} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Revenue contribution
          </div>
          <TableShell head={["Client", "Bookings", "Revenue", "Share"]}>
            {!data.topByRevenue.length && <EmptyRow cols={4} label="No completed bookings yet." />}
            {data.topByRevenue.map((r) => (
              <tr key={r.userId} className="text-foreground">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.bookings}</td>
                <td className="px-4 py-3">{inr(r.revenue)}</td>
                <td className="px-4 py-3">
                  <Bar pct={(r.revenue / maxRevenue) * 100} />
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
            Service frequency
          </div>
          <TableShell head={["Service", "Bookings", "Share"]}>
            {!data.serviceFrequency.length && <EmptyRow cols={3} label="No bookings yet." />}
            {data.serviceFrequency.map((s) => (
              <tr key={s.serviceId} className="text-foreground">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.bookings}</td>
                <td className="px-4 py-3">
                  <Bar pct={(s.bookings / maxFreq) * 100} />
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      </div>
    </div>
  );
}
