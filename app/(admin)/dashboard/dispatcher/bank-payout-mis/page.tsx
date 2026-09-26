"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi, type BankPayoutMisParams, type BankPayoutMisRow } from "@/src/api/api";
import { API_BASE_URL, getToken } from "@/src/api/apiClient";
import { SearchIcon, SpinnerIcon } from "@/src/components/icons";

/*
 * Chart colors follow the dataviz rules used on the Partner MIS page: the
 * payout donut encodes STATE so it wears status tokens, with a legend that
 * carries label + amount + % (identity never color-alone) and 2px gaps between
 * segments. The category bars and the daily line each show ONE measure, so
 * they use a single hue with direct labels / hover values.
 */
const STATUS_COLORS = {
  good: "var(--success)",
  warn: "var(--warning)",
  bad: "var(--danger)",
} as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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

function AmountDonut({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const R = 15.9155;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0);
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
      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">No payouts in this period.</p>
      ) : (
        <div className="mt-4 flex items-center gap-6">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 42 42" className="h-full w-full">
              <circle cx="21" cy="21" r={R} fill="none" stroke="var(--muted)" strokeWidth="6" />
              {withOffsets.map((s) => {
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
                    <title>{`${s.label}: ${inr2(s.value)} (${s.pct.toFixed(1)}%)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-bold text-foreground">{inr(total)}</span>
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
                    {inr2(s.value)} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Bar chart -------------------------------- */

function CategoryBars({
  basis,
  bars,
}: {
  basis: "paid" | "netPayable";
  bars: { category: string; amount: number }[];
}) {
  const max = Math.max(1, ...bars.map((d) => d.amount));
  const shown = bars.slice(0, 8);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Payouts by Partner Category</h3>
      {basis === "netPayable" && shown.length > 0 && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          No paid payouts in this range — showing net payable instead.
        </p>
      )}
      {shown.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
      ) : (
        <div className="mt-4 flex h-44 items-end gap-3">
          {shown.map((d) => (
            <div key={d.category} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-foreground">{inr(d.amount)}</span>
              <div
                className="w-full max-w-14 rounded-t-[4px] bg-primary transition group-hover:opacity-80"
                style={{ height: `${Math.max(3, (d.amount / max) * 130)}px` }}
                title={`${d.category}: ${inr2(d.amount)}`}
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

/* ------------------------------ Line chart -------------------------------- */

function DailyPaidLine({ data }: { data: { date: string; amount: number }[] }) {
  const W = 320;
  const H = 130;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.amount));
  const any = data.some((d) => d.amount > 0);
  const pts = data.map((d, i) => ({
    x: PAD + (i / Math.max(1, data.length - 1)) * (W - PAD * 2),
    y: H - PAD - (d.amount / max) * (H - PAD * 2),
    ...d,
  }));
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Daily Payout Amount</h3>
      {!any ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No paid payouts in this period.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full">
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {pts
              .filter((p) => p.amount > 0)
              .map((p) => (
                <circle key={p.date} cx={p.x} cy={p.y} r="3.5" fill="var(--primary)" stroke="var(--card)" strokeWidth="2">
                  <title>{`${fmtDay(p.date)}: ${inr2(p.amount)}`}</title>
                </circle>
              ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{fmtDay(data[0].date)}</span>
            <span>{fmtDay(data[data.length - 1].date)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------- Page ----------------------------------- */

function Chip({ kind, text }: { kind: "good" | "warn" | "bad" | "muted"; text: string }) {
  const cls =
    kind === "good"
      ? "bg-success/10 text-success"
      : kind === "warn"
        ? "bg-warning/10 text-warning"
        : kind === "bad"
          ? "bg-danger/10 text-danger"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {text}
    </span>
  );
}

export default function BankPayoutMisPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [city, setCity] = useState("");
  const [teamId, setTeamId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [verification, setVerification] = useState("");
  const [payoutStatus, setPayoutStatus] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const params: BankPayoutMisParams = {
    from: from || undefined,
    to: to || undefined,
    city: city || undefined,
    teamId: teamId ? Number(teamId) : undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    verification: verification || undefined,
    payoutStatus: payoutStatus || undefined,
    search: search.trim() || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bank-payout-mis", params],
    queryFn: () => dashboardApi.bankPayoutMis(params),
    placeholderData: keepPreviousData,
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null) as [string, string][],
      ).toString();
      const res = await fetch(
        `${API_BASE_URL}/v1/admin/bank-payout-mis/export${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${getToken() ?? ""}` } },
      );
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank-payout-mis-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const delta = (v: number | null, invert = false) =>
    v == null
      ? { text: "no prior period", cls: "text-muted-foreground" }
      : {
          text: `${v >= 0 ? "+" : ""}${v}% vs last period`,
          cls: (invert ? v <= 0 : v >= 0) ? "text-success" : "text-danger",
        };

  const kpiCards = k
    ? [
        { label: "Total Partner Earnings", value: inr(k.totalEarnings), d: delta(k.earningsDeltaPct) },
        { label: "Total Commission", value: inr(k.totalCommission), d: delta(k.commissionDeltaPct) },
        { label: "Net Payable", value: inr(k.netPayable), d: null },
        { label: "Paid Amount", value: inr(k.paidAmount), d: delta(k.paidDeltaPct) },
        {
          label: "Pending Payouts",
          value: inr(k.pendingPayouts),
          d: { text: `${k.pendingCount} request(s) awaiting approval`, cls: "text-muted-foreground" },
        },
        { label: "Failed Payouts", value: inr(k.failedPayouts), d: delta(k.failedDeltaPct, true) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bank and Payout MIS Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earnings, commission, deductions and payout money flow
            {data ? ` · ${istDate(data.range.from)} – ${istDate(data.range.to)}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            🛡 Sensitive bank details are masked
          </span>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "⬇ Export Report"}
          </button>
        </div>
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
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls} aria-label="Partner category">
          <option value="">Category: All</option>
          {(data?.filters.categories ?? []).map((c) => (
            <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
          ))}
        </select>
        <select value={verification} onChange={(e) => setVerification(e.target.value)} className={selectCls} aria-label="Bank verification">
          <option value="">Bank Verification: All</option>
          <option value="Verified">Verified</option>
          <option value="Pending">Pending</option>
          <option value="Not Provided">Not Provided</option>
        </select>
        <select value={payoutStatus} onChange={(e) => setPayoutStatus(e.target.value)} className={selectCls} aria-label="Payout status">
          <option value="">Payout Status: All</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Partner ID / Name"
            className={`${selectCls} w-56 pl-9`}
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
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">{card.value}</p>
                {card.d && <p className={`mt-0.5 text-[11px] ${card.d.cls}`}>{card.d.text}</p>}
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
                      "Partner ID", "Partner Name", "Account Holder", "Bank Name", "Account Number",
                      "IFSC", "UPI ID", "Bank Verification", "Gross Earnings", "Commission",
                      "Other Deductions", "Net Payable", "Wallet Balance", "Payout Request",
                      "Payout Status", "Payout Date / Txn",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.partners.map((p: BankPayoutMisRow) => (
                    <tr key={p.professionalId} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-2.5 text-muted-foreground">{p.partnerId}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{p.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.accountHolder ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.bankName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.accountMasked ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.ifsc ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.upiId ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Chip
                          kind={p.bankVerification === "Verified" ? "good" : p.bankVerification === "Pending" ? "warn" : "muted"}
                          text={p.bankVerification}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-foreground">{inr2(p.grossEarnings)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inr2(p.commission)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inr2(p.otherDeductions)}</td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{inr2(p.netPayable)}</td>
                      <td className="px-4 py-2.5 text-foreground">{inr2(p.walletBalance)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{p.payoutRequestId ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {p.payoutStatus ? (
                          <Chip
                            kind={p.payoutStatus === "Paid" ? "good" : p.payoutStatus === "Pending" ? "warn" : "bad"}
                            text={p.payoutStatus}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.payoutDate ? istDate(p.payoutDate) : "—"}
                        {p.transactionId ? ` / ${p.transactionId}` : ""}
                      </td>
                    </tr>
                  ))}
                  {data.partners.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-muted-foreground">
                        No partners match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              {data.partners.length} partner(s) · money flow for {istDate(data.range.from)} –{" "}
              {istDate(data.range.to)} · account numbers masked to the last 4 digits
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            <AmountDonut
              title="Payout Status"
              segments={[
                { label: "Paid", value: data.charts.payoutStatus.paid, color: STATUS_COLORS.good },
                { label: "Pending", value: data.charts.payoutStatus.pending, color: STATUS_COLORS.warn },
                { label: "Failed", value: data.charts.payoutStatus.failed, color: STATUS_COLORS.bad },
              ]}
            />
            <CategoryBars basis={data.charts.byCategory.basis} bars={data.charts.byCategory.bars} />
            <DailyPaidLine data={data.charts.dailyPaid} />
          </div>
        </>
      ) : null}
    </div>
  );
}
