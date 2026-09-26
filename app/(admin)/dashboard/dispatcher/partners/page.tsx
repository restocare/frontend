"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryTreeApi,
  dispatcherApi,
  groomingApi,
  queryKeys,
  type PartnerImportResult,
  type PartnerOnboardingStatus,
  type PartnerRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { PartnerStatusBadge } from "@/src/components/dashboard/partner-status";
import { PartnerActivityModal } from "@/src/components/dashboard/partner-activity-modal";
import { PartnerAnalytics } from "@/src/components/dashboard/partner-analytics";
import {
  ClockIcon,
  PencilIcon,
  SearchIcon,
  SpinnerIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
} from "@/src/components/icons";

/** 8100 → "2h 15m"; a partner who hasn't clocked on today reads as "—". */
function dutyLabel(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Platform switch for the grooming module.
 *
 * While OFF, grooming photos are still collected and reviewable — they just
 * don't gate anything. Turning it ON makes grooming approval a requirement:
 * from then on a partner whose three photos aren't all approved stops receiving
 * leads. Flipping it does NOT retroactively block anyone, so it's reversible.
 */
function GroomingModuleCard() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["grooming", "setting"],
    queryFn: () => groomingApi.getSetting(),
  });

  const toggle = useMutation({
    mutationFn: (enforced: boolean) => groomingApi.setSetting(enforced),
    onSuccess: () => {
      setConfirming(false);
      setErr(null);
      queryClient.invalidateQueries({ queryKey: ["grooming", "setting"] });
    },
    onError: (e) => {
      setConfirming(false);
      setErr(e instanceof ApiError ? e.message : "Could not change the grooming module.");
    },
  });

  if (isLoading || !data) return null;
  const on = data.enforced;

  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        on ? "border-success/40 bg-success/[0.05]" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Grooming module</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                on ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {on ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {on
              ? "Partners must have all three grooming photos approved to receive leads. Photos they re-upload go back to pending review."
              : "Grooming photos are collected and can be reviewed, but they don’t affect who receives leads yet."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{data.impact.compliant}</span> of{" "}
            {data.impact.totalPartners} partners fully approved ·{" "}
            <span className="font-semibold text-warning">{data.impact.nonCompliant}</span> would
            stop receiving leads while active
            {data.updatedBy?.name ? ` · last changed by ${data.updatedBy.name}` : ""}
          </p>
        </div>
        <button
          onClick={() => (on ? toggle.mutate(false) : setConfirming(true))}
          disabled={toggle.isPending}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
            on
              ? "border border-border text-foreground hover:bg-accent"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {toggle.isPending && <SpinnerIcon className="h-4 w-4" />}
          {on ? "Deactivate module" : "Activate module"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-danger">{err}</p>}

      {confirming && (
        <ConfirmDialog
          title="Activate the grooming module?"
          message={
            `From now on, only partners whose passport, hands & nails and full-size photos are ALL approved will receive leads. ` +
            `Right now ${data.impact.nonCompliant} of ${data.impact.totalPartners} partners are not fully approved and would stop getting leads until you review them. ` +
            `Nobody is blocked or deactivated by this — you can switch it off again at any time.`
          }
          confirmLabel="Activate module"
          onCancel={() => setConfirming(false)}
          onConfirm={() => toggle.mutate(true)}
          busy={toggle.isPending}
        />
      )}
    </div>
  );
}

/** "ANALYTICS" is not an onboarding filter — it swaps the partner table for
 *  the partner analytics report. */
type StatusTab = PartnerOnboardingStatus | "ALL" | "ANALYTICS" | "BLOCKED";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "ACTIVE", label: "Active" },
  { key: "REJECTED", label: "Rejected" },
  // Blocked is not an onboarding stage — a blocked partner can be at any of
  // them — so it gets its own tab instead of hiding inside Active.
  { key: "BLOCKED", label: "Blocked" },
  { key: "ALL", label: "All" },
  { key: "ANALYTICS", label: "Analytics" },
];

// Duty filter, applied on top of the onboarding tab: onboarding status says
// whether a partner may work, `isOnline` says whether they are on duty now.
type DutyFilter = "ALL" | "ONLINE" | "OFFLINE";

const DUTY_FILTERS: { key: DutyFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ONLINE", label: "Online" },
  { key: "OFFLINE", label: "Offline" },
];

export default function ServicePartnersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // Default to the pending queue — the applications awaiting admin review.
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  // Filter by the category a partner registered under (Chef, Technician, …).
  // Undefined means every category, which is the default view.
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [duty, setDuty] = useState<DutyFilter>("ALL");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null);
  const [activityTarget, setActivityTarget] = useState<PartnerRow | null>(null);
  // Panel-side partner registration — same flow as first-time app signup.
  const [addOpen, setAddOpen] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  useEffect(() => {
    // Deferred so no setState runs synchronously inside the effect body.
    queueMicrotask(() => setCanCreate(hasPermission("partners.create")));
  }, []);

  // Bulk CSV import — same permission as creating one partner by hand.
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importResult, setImportResult] = useState<PartnerImportResult | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.partners(search.trim(), statusTab, categoryId),
    queryFn: () =>
      dispatcherApi.listPartners(
        search.trim() || undefined,
        statusTab === "ANALYTICS" ? "ALL" : statusTab,
        categoryId,
      ),
    placeholderData: keepPreviousData,
    // The analytics tab renders its own report — don't fetch the table behind it.
    enabled: statusTab !== "ANALYTICS",
  });

  const { data: counts } = useQuery({
    queryKey: queryKeys.partnerStatusCounts,
    queryFn: () => dispatcherApi.partnerStatusCounts(),
  });

  // Partners register under a TOP-LEVEL category, so only those are offered —
  // listing sub-categories would show options that can never match anyone.
  const { data: categoryTree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dispatcher", "partners"] });

  const blockMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: number; isBlocked: boolean }) =>
      dispatcherApi.setPartnerBlocked(id, isBlocked),
    onSuccess: (res) => {
      setNotice(res.message);
      invalidate();
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dispatcherApi.deletePartner(id),
    onSuccess: (res) => {
      setNotice(res.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(e instanceof ApiError ? e.message : "Could not delete partner.");
    },
  });

  /** Fetch the CSV template — a plain link can't carry the bearer token. */
  const handleTemplate = async () => {
    try {
      const blob = await dispatcherApi.partnerImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "partner-import-template.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Could not download the template.");
    }
  };

  const importPartners = useMutation({
    mutationFn: (file: File) => dispatcherApi.importPartners(file),
    onSuccess: (res) => {
      setImportResult(res);
      invalidate();
      queryClient.invalidateQueries({ queryKey: queryKeys.partnerStatusCounts });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Import failed."),
  });

  const busy = blockMutation.isPending;
  const allPartners = data ?? [];
  // Online/offline is filtered client-side: the list endpoint returns every
  // partner for the tab, so no extra request is needed and counts stay exact.
  // A blocked partner is never "on duty", whatever the flag says: blocking
  // clears it going forward, and this keeps historical rows honest too.
  const isOnDuty = (p: PartnerRow) => p.isOnline && !p.isBlocked;
  const onlineCount = allPartners.filter(isOnDuty).length;
  const dutyCounts: Record<DutyFilter, number> = {
    ALL: allPartners.length,
    ONLINE: onlineCount,
    OFFLINE: allPartners.length - onlineCount,
  };
  const partners =
    duty === "ALL" ? allPartners : allPartners.filter((p) => (duty === "ONLINE" ? isOnDuty(p) : !isOnDuty(p)));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Service Partners</h1>
          <p className="text-sm text-muted-foreground">
            Service professionals onboarded on the platform.
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handleTemplate()}
              title="Download the CSV template to fill in"
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              📄 Template
            </button>
            {/* The button proxies to a hidden input so the file picker is styled. */}
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so re-picking the same corrected file still fires.
                e.target.value = "";
                if (file) importPartners.mutate(file);
              }}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importPartners.isPending}
              title="Upload a filled sheet to register partners in bulk"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {importPartners.isPending ? <SpinnerIcon className="h-4 w-4" /> : <span>⬆</span>}
              {importPartners.isPending ? "Importing…" : "Import partners"}
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              ＋ Add partner
            </button>
          </div>
        )}
      </div>

      {/* Import outcome. A hand-filled sheet usually has a few bad rows, so
          every failure is listed with its row number instead of a bare count. */}
      {importResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            importResult.failedCount > 0
              ? "border-warning/40 bg-warning/10 text-foreground"
              : "border-success/40 bg-success/10 text-foreground"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{importResult.message}</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {importResult.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <GroomingModuleCard />

      {/* Search */}
      {statusTab !== "ANALYTICS" && (
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile or city"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          aria-label="Filter partners by category"
          className="shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
        >
          <option value="">All categories</option>
          {(categoryTree ?? []).map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {partners.length} partner{partners.length === 1 ? "" : "s"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>
      )}

      {/* Onboarding tabs — Pending is the review queue admins act on first. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.key;
          const count = tab.key === "ANALYTICS" ? undefined : counts?.[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`relative -mb-px flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "border-b-2 border-primary text-primary"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    tab.key === "PENDING" && !active
                      ? "bg-warning/15 text-warning"
                      : active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {statusTab === "ANALYTICS" ? (
        <PartnerAnalytics />
      ) : (
        <>
      {/* Duty filter — who is on duty right now, within the tab above. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Duty
        </span>
        <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
          {DUTY_FILTERS.map((f) => {
            const active = duty === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setDuty(f.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.key !== "ALL" && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      f.key === "ONLINE"
                        ? active
                          ? "bg-primary-foreground"
                          : "bg-success"
                        : active
                          ? "bg-primary-foreground"
                          : "bg-muted-foreground/50"
                    }`}
                  />
                )}
                {f.label}
                <span className={`text-xs ${active ? "opacity-80" : "opacity-70"}`}>
                  ({dutyCounts[f.key]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2.5 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load service partners.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : partners.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search
                ? "No partners match your search."
                : duty !== "ALL"
                  ? `No ${duty.toLowerCase()} partners${statusTab === "ALL" ? "" : ` in ${statusTab.toLowerCase()}`}.`
                  : statusTab === "PENDING"
                    ? "No partners awaiting review."
                    : statusTab === "ALL"
                      ? "No service partners yet."
                      : `No ${statusTab.toLowerCase()} partners.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Mobile</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">City</th>
                  <th className="px-5 py-3 font-medium">Rating</th>
                  <th className="px-5 py-3 font-medium">Wallet</th>
                  <th className="px-5 py-3 font-medium">Today on duty</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p: PartnerRow) => (
                  <tr
                    key={p.professionalId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/dispatcher/partners/${p.professionalId}`}
                        className="group flex items-center gap-3"
                      >
                        <PartnerAvatar partner={p} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary group-hover:underline">
                            {p.name}
                          </p>
                          {p.email && (
                            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.mobile ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {p.service ?? p.category ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.city ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <StarIcon className="h-3.5 w-3.5 text-warning" />
                        {p.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{inr(p.walletBalance)}</td>
                    {/* Duty time so far today — click through for the full
                        per-day log instead of hunting for the clock icon. */}
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setActivityTarget(p)}
                        title="Active hours & online/offline log"
                        className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {dutyLabel(p.todayActiveSeconds ?? 0)}
                        {p.isOnline && (
                          <span className="ml-1.5 text-xs font-normal text-success">• live</span>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PartnerStatusBadge status={p.onboardingStatus} />
                        {p.isBlocked && (
                          <span className="inline-flex rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
                            Blocked
                          </span>
                        )}
                        {/* Once active, always show whether they're on duty —
                            an offline partner previously showed nothing. */}
                        {p.onboardingStatus === "ACTIVE" &&
                          !p.isBlocked &&
                          (p.isOnline ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                              <span className="h-1.5 w-1.5 rounded-full bg-success" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                              Offline
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActivityTarget(p)}
                          aria-label="Active hours & login logs"
                          title="Active hours & login logs"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <ClockIcon className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/dashboard/dispatcher/partners/${p.professionalId}`}
                          aria-label="Edit partner"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                        <span className="mx-1 flex items-center gap-1.5">
                          <button
                            role="switch"
                            aria-checked={p.isBlocked}
                            onClick={() =>
                              blockMutation.mutate({ id: p.professionalId, isBlocked: !p.isBlocked })
                            }
                            disabled={busy}
                            aria-label={p.isBlocked ? "Unblock partner" : "Block partner"}
                            title={p.isBlocked ? "Unblock partner" : "Block partner"}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                              p.isBlocked ? "bg-danger" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                p.isBlocked ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-medium ${
                              p.isBlocked ? "text-danger" : "text-muted-foreground"
                            }`}
                          >
                            {p.isBlocked ? "Blocked" : "Block"}
                          </span>
                        </span>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          aria-label="Delete partner"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          danger
          title="Permanently delete this partner?"
          confirmLabel="Delete everything"
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.professionalId)}
          message={
            <>
              This will permanently delete{" "}
              <strong className="text-foreground">{deleteTarget.name}</strong> and erase{" "}
              <strong className="text-foreground">all associated data</strong> — profile, bookings,
              wallet &amp; transactions, ratings, availability and subscriptions. This action is
              irreversible.
            </>
          }
        />
      )}

      {addOpen && (
        <AddPartnerModal
          onClose={() => setAddOpen(false)}
          onDone={(msg) => {
            setAddOpen(false);
            setNotice(msg);
            invalidate();
            queryClient.invalidateQueries({ queryKey: queryKeys.partnerStatusCounts });
          }}
        />
      )}
      {activityTarget && (
        <PartnerActivityModal
          professionalId={activityTarget.professionalId}
          partnerName={activityTarget.name}
          onClose={() => setActivityTarget(null)}
        />
      )}
    </div>
  );
}

function PartnerAvatar({ partner }: { partner: PartnerRow }) {
  if (partner.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external partner image
      <img
        src={partner.profileImage}
        alt={partner.name}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = partner.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
      {initials || "?"}
    </div>
  );
}

/* ── Add partner — mirrors the app's first-time registration form ── */

const fieldCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary";

function FileField({
  label,
  file,
  onPick,
  required,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
  required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`${fieldCls} text-left ${file ? "text-foreground" : "text-muted-foreground"}`}
      >
        {file ? `📎 ${file.name}` : "Choose image…"}
      </button>
    </div>
  );
}

function AddPartnerModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [aadharFront, setAadharFront] = useState<File | null>(null);
  const [aadharBack, setAadharBack] = useState<File | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [experience, setExperience] = useState("0");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [aadharNo, setAadharNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [markVerified, setMarkVerified] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { data: tree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("mobile", mobile.trim());
      if (name.trim()) fd.append("name", name.trim());
      fd.append("serviceId", categoryId); // category id — same contract as the app
      fd.append("experience", experience || "0");
      if (description.trim()) fd.append("description", description.trim());
      if (city.trim()) fd.append("city", city.trim());
      if (aadharNo.trim()) fd.append("aadharNo", aadharNo.trim());
      if (licenseNo.trim()) fd.append("licenseNo", licenseNo.trim());
      if (vehicleType.trim()) fd.append("vehicleType", vehicleType.trim());
      if (vehicleColor.trim()) fd.append("vehicleColor", vehicleColor.trim());
      if (referralCode.trim()) fd.append("referralCode", referralCode.trim().toUpperCase());
      fd.append("markVerified", String(markVerified));
      if (photo) fd.append("professional", photo);
      if (aadharFront) fd.append("aadharFront", aadharFront);
      if (aadharBack) fd.append("aadharBack", aadharBack);
      if (licenseDoc) fd.append("licenseDoc", licenseDoc);
      return dispatcherApi.createPartner(fd);
    },
    onSuccess: (r) => onDone(r.message),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not register the partner."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-5">
          <h3 className="text-lg font-semibold text-foreground">Add partner</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Registers the partner exactly like first-time app signup — they log into the partner
            app with this mobile number afterwards.
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Full name
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mobile <span className="text-danger">*</span>
              </span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                placeholder="10-digit mobile (their app login)"
                className={fieldCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category <span className="text-danger">*</span>
              </span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls}>
                <option value="">Select…</option>
                {(tree ?? []).map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Experience (years)
              </span>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                className={fieldCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Delhi" className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Referral code</span>
              <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Optional" className={fieldCls} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Electrician expert" className={fieldCls} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aadhar number</span>
              <input value={aadharNo} onChange={(e) => setAadharNo(e.target.value)} className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">License number</span>
              <input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle type</span>
              <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Bike / Scooter" className={fieldCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicle color</span>
              <input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} className={fieldCls} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FileField label="Profile photo" file={photo} onPick={setPhoto} required />
            <FileField label="Aadhar front" file={aadharFront} onPick={setAadharFront} />
            <FileField label="Aadhar back" file={aadharBack} onPick={setAadharBack} />
            <FileField label="Driving license" file={licenseDoc} onPick={setLicenseDoc} />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={markVerified}
              onChange={(e) => setMarkVerified(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Mark documents verified (skips the review queue — training/activation still apply)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setErr(null);
              if (mobile.length !== 10) return setErr("Enter the partner's 10-digit mobile.");
              if (!categoryId) return setErr("Pick a category.");
              if (!photo) return setErr("A profile photo is required — same as app signup.");
              save.mutate();
            }}
            disabled={save.isPending}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? "Registering…" : "Register partner"}
          </button>
        </div>
      </div>
    </div>
  );
}
