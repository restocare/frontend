"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi, queryKeys, type AnalyticsRange, type AnalyticsResponse } from "@/src/api/api";
import {
  BarList,
  BookingsTrendCard,
  ChartCard,
  KpiTile,
  PaymentSplitCard,
  RevenueTrendCard,
  inr,
  num,
} from "@/src/components/dashboard/analytics-charts";
import { SpinnerIcon, StarIcon } from "@/src/components/icons";
import { AiAnalystPanel } from "@/src/components/analytics/ai-analyst-panel";

/** Date-range presets — one filter row that scopes every chart below it. */
const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  ON_THE_WAY: "On the way",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Today in IST as YYYY-MM-DD — the business day, not the browser's. */
function istToday(offsetDays = 0) {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + offsetDays * 86400000);
  return ist.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  // Seeded with the last 7 days so switching to Custom shows something useful
  // immediately rather than an empty pair of date boxes.
  const [from, setFrom] = useState(() => istToday(-6));
  const [to, setTo] = useState(() => istToday());

  const isCustom = range === "custom";
  // An inverted pair would ask the server for a window it must reject, so the
  // query simply waits until the dates make sense.
  const datesValid = !isCustom || (!!from && !!to && from <= to);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.analytics(range, isCustom ? from : undefined, isCustom ? to : undefined),
    queryFn: () => dashboardApi.getAnalytics(range, from, to),
    placeholderData: keepPreviousData,
    enabled: datesValid,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-7 w-7" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">Couldn’t load analytics.</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, bookings and marketplace performance for the selected period.
        </p>
      </div>

      {/* Ask questions of the same data the charts below are drawn from. */}
      <AiAnalystPanel />

      {/* Range filter row — scopes everything below it. */}
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
              range === r.key
                ? // dark:bg-blue-600 — the dark --primary (#3b82f6) is only ~3.7:1
                  // under white text; blue-600 keeps the selected label AA-readable.
                  "bg-primary text-primary-foreground shadow-sm shadow-primary/30 dark:bg-blue-600"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}

        <button
          onClick={() => setRange("custom")}
          aria-pressed={isCustom}
          className={`rounded-xl px-3.5 py-2 text-sm font-medium transition ${
            isCustom
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 dark:bg-blue-600"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Custom
        </button>

        {isCustom && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From date"
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={istToday()}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To date"
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            {!datesValid && (
              <span className="text-xs text-danger">Pick an end date on or after the start.</span>
            )}
          </div>
        )}
        {isFetching && (
          <span className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <SpinnerIcon className="h-3.5 w-3.5" /> updating…
          </span>
        )}
      </div>

      <div className={`space-y-6 transition-opacity ${isFetching ? "opacity-75" : ""}`}>
        <KpiGrid data={data} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueTrendCard series={data.series} />
          </div>
          <PaymentSplitCard modes={data.paymentModes} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BookingsTrendCard series={data.series} />
          </div>
          <ChartCard title="Booking status" subtitle="All bookings in this period">
            <BarList
              rows={data.statusBreakdown.map((s) => ({
                label: STATUS_LABELS[s.status] ?? s.status,
                value: s.count,
              }))}
            />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Top services" subtitle="By completed-booking revenue">
            <BarList
              rows={data.topServices.map((s) => ({
                id: s.serviceId,
                label: s.name,
                value: s.revenue,
                display: inr(s.revenue),
                secondary: `${num(s.bookings)} booking${s.bookings === 1 ? "" : "s"}`,
              }))}
            />
          </ChartCard>
          <ChartCard title="Top categories" subtitle="By completed-booking revenue">
            <BarList
              rows={data.topCategories.map((c) => ({
                id: c.categoryId,
                label: c.name,
                value: c.revenue,
                display: inr(c.revenue),
                secondary: `${num(c.bookings)} booking${c.bookings === 1 ? "" : "s"}`,
              }))}
            />
          </ChartCard>
          <ChartCard title="Top cities" subtitle="By completed-booking revenue">
            <BarList
              rows={data.topCities.map((c) => ({
                label: c.city,
                value: c.revenue,
                display: inr(c.revenue),
                secondary: `${num(c.bookings)} booking${c.bookings === 1 ? "" : "s"}`,
              }))}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Bookings & revenue by zone"
          subtitle="Geo-fence zones · bookings placed by service location, revenue from completed bookings"
        >
          <BarList
            rows={data.zones.map((z) => ({
              id: z.geofenceId,
              label: z.name,
              value: z.revenue,
              display: inr(z.revenue),
              secondary: `${num(z.bookings)} booking${z.bookings === 1 ? "" : "s"}`,
            }))}
          />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TopPartnersCard data={data} />
          </div>
          <RatingsCard data={data} />
        </div>
      </div>
    </div>
  );
}

function KpiGrid({ data }: { data: AnalyticsResponse }) {
  const { kpis, series } = data;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Revenue"
        value={inr(kpis.revenue.value)}
        delta={kpis.revenue.delta}
        spark={series.map((p) => p.revenue)}
      />
      <KpiTile
        label="Bookings"
        value={num(kpis.bookings.value)}
        delta={kpis.bookings.delta}
        spark={series.map((p) => p.bookings)}
      />
      <KpiTile label="Avg order value" value={inr(kpis.avgOrderValue.value)} delta={kpis.avgOrderValue.delta} />
      <KpiTile
        label="Completion rate"
        value={`${kpis.completionRate.value}%`}
        delta={kpis.completionRate.delta}
        deltaSuffix="pp"
      />
      <KpiTile label="New customers" value={num(kpis.newCustomers.value)} delta={kpis.newCustomers.delta} />
      <KpiTile label="New partners" value={num(kpis.newPartners.value)} delta={kpis.newPartners.delta} />
      <KpiTile label="Payouts paid" value={inr(kpis.payoutsPaid.value)} delta={kpis.payoutsPaid.delta} />
      <KpiTile
        label="Cancellation rate"
        value={`${kpis.cancellationRate.value}%`}
        delta={kpis.cancellationRate.delta}
        deltaSuffix="pp"
        goodWhenDown
      />
    </div>
  );
}

function TopPartnersCard({ data }: { data: AnalyticsResponse }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-foreground">Top partners</h3>
        <p className="text-sm text-muted-foreground">Ranked by completed-booking revenue</p>
      </div>
      {data.topPartners.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No completed jobs in this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Partner</th>
                <th className="px-5 py-3 text-right font-medium">Jobs</th>
                <th className="px-5 py-3 text-right font-medium">Revenue</th>
                <th className="px-5 py-3 text-right font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {data.topPartners.map((p, i) => (
                <tr key={p.professionalId} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <span className="mr-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {i + 1}
                    </span>
                    <span className="font-medium text-foreground">{p.name}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {num(p.jobs)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {inr(p.revenue)}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.rating != null ? p.rating.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RatingsCard({ data }: { data: AnalyticsResponse }) {
  const { ratings } = data;
  return (
    <ChartCard
      title="Customer ratings"
      subtitle={ratings.count > 0 ? `${num(ratings.count)} rating${ratings.count === 1 ? "" : "s"} in this period` : undefined}
    >
      {ratings.count === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No ratings in this period.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight text-foreground">{ratings.average}</span>
            <StarIcon className="h-5 w-5 text-warning" />
            <span className="text-sm text-muted-foreground">average</span>
          </div>
          <BarList
            rows={ratings.distribution.map((d) => ({
              label: `${d.stars} star${d.stars === 1 ? "" : "s"}`,
              value: d.count,
            }))}
          />
        </div>
      )}
    </ChartCard>
  );
}
