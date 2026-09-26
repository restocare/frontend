"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi, type PartnerMisParams, type PartnerMisRow } from "@/src/api/api";
import { API_BASE_URL, getToken } from "@/src/api/apiClient";
import { SearchIcon, SpinnerIcon } from "@/src/components/icons";

/*
 * Chart colors. The two donuts encode STATE (verified/pending/rejected,
 * available/busy/unavailable), so they wear the panel's status tokens — and
 * identity is never carried by color alone: every segment has a legend row
 * with label + count + % in legend order, and segments are separated by 2px
 * surface gaps. The bar chart shows ONE measure across categories, so it uses
 * a single hue (primary) with a direct value label per bar.
 */
const STATUS_COLORS = {
  good: "var(--success)",
  warn: "var(--warning)",
  bad: "var(--danger)",
} as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function istDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/* ------------------------------- Donut ---------------------------------- */

function Donut({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: { label: string; value: number; color: string }[];
}) {
  const R = 15.9155; // circumference ≈ 100 for easy percent math
  const shown = segments.filter((s) => s.value > 0);
  // Precompute each segment's start offset (12 o'clock = 25) — no mutation in render.
  const withOffsets = shown.map((s, i) => ({
    ...s,
    pct: total > 0 ? (s.value / total) * 100 : 0,
    offset:
      25 -
      shown.slice(0, i).reduce((sum, x) => sum + (total > 0 ? (x.value / total) * 100 : 0), 0),
  }));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full -rotate-0">
            <circle cx="21" cy="21" r={R} fill="none" stroke="var(--muted)" strokeWidth="6" />
            {withOffsets.map((s) => {
              // 2px surface gap between fills, expressed in circumference units.
              const gap = withOffsets.length > 1 ? 2 : 0;
              const arc = Math.max(0, s.pct - gap);
              return (
                <circle
                  key={s.label}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="6"
                  strokeDasharray={`${arc} ${100 - arc}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap="butt"
                >
                  <title>{`${s.label}: ${s.value} (${s.pct.toFixed(1)}%)`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground">{total.toLocaleString("en-IN")}</span>
            <span className="text-[11px] text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="space-y-2">
          {segments.map((s) => {
            const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-foreground">{s.label}</span>
                <span className="text-muted-foreground">
                  {s.value.toLocaleString("en-IN")} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Bar chart -------------------------------- */

function CategoryBars({ data }: { data: { category: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const shown = data.slice(0, 8); // fixed order by volume; the rest stays in the CSV
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Orders by Service Category</h3>
      {shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No orders in this period.
        </p>
      ) : (
        <div className="mt-4 flex h-48 items-end gap-3">
          {shown.map((d) => (
            <div key={d.category} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium text-foreground">{d.count}</span>
              <div
                className="w-full max-w-14 rounded-t-[4px] bg-primary transition group-hover:opacity-80"
                style={{ height: `${Math.max(3, (d.count / max) * 150)}px` }}
                title={`${d.category}: ${d.count} orders`}
              />
              <span
                className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground"
                title={d.category}
              >
                {d.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Page ----------------------------------- */

function StatusChip({ kind, text }: { kind: "good" | "warn" | "bad" | "info"; text: string }) {
  const cls =
    kind === "good"
      ? "bg-success/10 text-success"
      : kind === "warn"
        ? "bg-warning/10 text-warning"
        : kind === "bad"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

export default function PartnerMisPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [city, setCity] = useState("");
  const [teamId, setTeamId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const params: PartnerMisParams = {
    from: from || undefined,
    to: to || undefined,
    city: city || undefined,
    teamId: teamId ? Number(teamId) : undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    status: status || undefined,
    search: search.trim() || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partner-mis", params],
    queryFn: () => dashboardApi.partnerMis(params),
    placeholderData: keepPreviousData,
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][],
      ).toString();
      const res = await fetch(`${API_BASE_URL}/v1/admin/partner-mis/export${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `partner-mis-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed — try again.");
    } finally {
      setExporting(false);
    }
  };

  const k = data?.kpis;
  const selectCls =
    "rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  const kpiCards = k
    ? [
        { label: "Total Partners", value: k.totalPartners.toLocaleString("en-IN"), sub: "100%" },
        { label: "Active Partners", value: k.activePartners.toLocaleString("en-IN"), sub: `${k.activePct}%` },
        { label: "Verified Partners", value: k.verifiedPartners.toLocaleString("en-IN"), sub: `${k.verifiedPct}%` },
        { label: "Available Today", value: k.availableToday.toLocaleString("en-IN"), sub: `${k.availablePct}%` },
        {
          label: "Completion Rate",
          value: `${k.completionRate}%`,
          sub: `${k.completionDelta >= 0 ? "+" : ""}${k.completionDelta}% vs last period`,
          tone: k.completionDelta >= 0 ? "up" : "down",
        },
        {
          label: "Total Earnings",
          value: inr(k.totalEarnings),
          sub:
            k.earningsDeltaPct == null
              ? "no prior period"
              : `${k.earningsDeltaPct >= 0 ? "+" : ""}${k.earningsDeltaPct}% vs last period`,
          tone: (k.earningsDeltaPct ?? 0) >= 0 ? "up" : "down",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner MIS Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Partner performance, verification, availability and order stats
            {data ? ` · ${istDate(data.range.from)} – ${istDate(data.range.to)}` : ""}.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "⬇ Export Report"}
        </button>
      </div>

      {/* Filters — one row above the charts. */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} aria-label="From date" />
        <span className="text-muted-foreground">–</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} aria-label="To date" />
        <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls} aria-label="City">
          <option value="">City: All</option>
          {(data?.filters.cities ?? []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={selectCls} aria-label="Zone">
          <option value="">Zone: All</option>
          {(data?.filters.teams ?? []).map((t) => (
            <option key={t.teamId} value={t.teamId}>{t.name}</option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls} aria-label="Service category">
          <option value="">Category: All</option>
          {(data?.filters.categories ?? []).map((c) => (
            <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Partner status">
          <option value="">Status: All</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="ACTIVE">Active</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Partner ID or Name"
            className={`${selectCls} w-64 pl-9`}
          />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Couldn’t load the report.</p>
          <button onClick={() => refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpiCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{card.value}</p>
                <p
                  className={`mt-0.5 text-[11px] ${
                    card.tone === "up"
                      ? "text-success"
                      : card.tone === "down"
                        ? "text-danger"
                        : "text-muted-foreground"
                  }`}
                >
                  {card.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    {[
                      "Partner ID", "Partner Name", "Mobile", "Category", "Skill / Service",
                      "Registered", "Verification", "Training", "Zone", "Availability",
                      "Assigned", "Accepted", "Completed", "Cancelled",
                      "Acceptance", "Completion", "Rating", "Earnings",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.partners.map((p: PartnerMisRow) => (
                    <tr key={p.professionalId} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-2.5 text-muted-foreground">{p.partnerId}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{p.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.mobile ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.category ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.service ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{istDate(p.registeredAt)}</td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          kind={p.verificationStatus === "Verified" ? "good" : p.verificationStatus === "Pending" ? "warn" : "bad"}
                          text={p.verificationStatus}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          kind={p.trainingStatus === "Completed" ? "good" : p.trainingStatus === "In Progress" ? "info" : "warn"}
                          text={p.trainingStatus}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.zone ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusChip
                          kind={p.availability === "Available" ? "good" : p.availability === "Busy" ? "warn" : "bad"}
                          text={p.availability}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{p.assigned}</td>
                      <td className="px-4 py-2.5 text-foreground">{p.accepted}</td>
                      <td className="px-4 py-2.5 text-foreground">{p.completed}</td>
                      <td className={`px-4 py-2.5 ${p.cancelled > 0 ? "font-medium text-danger" : "text-muted-foreground"}`}>
                        {p.cancelled}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{p.acceptanceRate}%</td>
                      <td className="px-4 py-2.5 text-foreground">{p.completionRate}%</td>
                      <td className="px-4 py-2.5 text-foreground">{p.rating.toFixed(1)} ★</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{inr(p.earnings)}</td>
                    </tr>
                  ))}
                  {data.partners.length === 0 && (
                    <tr>
                      <td colSpan={18} className="px-4 py-10 text-center text-muted-foreground">
                        No partners match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              {data.partners.length} partner(s) · order stats for {istDate(data.range.from)} – {istDate(data.range.to)}
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Donut
              title="Verification Status"
              total={data.kpis.totalPartners}
              segments={[
                { label: "Verified", value: data.charts.verification.verified, color: STATUS_COLORS.good },
                { label: "Pending", value: data.charts.verification.pending, color: STATUS_COLORS.warn },
                { label: "Rejected", value: data.charts.verification.rejected, color: STATUS_COLORS.bad },
              ]}
            />
            <Donut
              title="Availability Status"
              total={data.kpis.totalPartners}
              segments={[
                { label: "Available", value: data.charts.availability.available, color: STATUS_COLORS.good },
                { label: "Busy", value: data.charts.availability.busy, color: STATUS_COLORS.warn },
                { label: "Unavailable", value: data.charts.availability.unavailable, color: STATUS_COLORS.bad },
              ]}
            />
            <CategoryBars data={data.charts.ordersByCategory} />
          </div>
        </>
      ) : null}
    </div>
  );
}
