"use client";

/**
 * The bookings table, shared by BOTH routes:
 *   /dashboard/bookings      (admin panel)
 *   /dashboard/crm/bookings  (CRM section)
 *
 * They used to be separate implementations with different columns and a
 * different API, so the same booking looked different depending on where you
 * opened it. One component means one data source and one format — anything
 * added here shows up in both places automatically.
 */

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  crmApi,
  customersApi,
  dashboardApi,
  dispatcherApi,
  queryKeys,
  type AdminBooking,
  type AdminBookingStatus,
  type CreateBookingInput,
  type CustomerRow,
  type PartnerRow,
} from "@/src/api/api";
import { ApiError, API_BASE_URL, getToken } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import {
  fetchPlaceSuggestions,
  type PlaceSuggestion,
} from "@/src/lib/google-maps";
import {
  BagIcon,
  ChevronDownIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UsersIcon,
} from "@/src/components/icons";
import { BookingAnalytics } from "@/src/components/dashboard/booking-analytics";
import { BookingLeadActivityPanel } from "@/src/components/dashboard/lead-activity";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";

const PAGE_SIZE = 20;

/** Filter tabs. "OUT_OF_ZONE" is not a status — it filters bookings placed
 *  outside every active service zone (the "coming soon in your area" demand).
 *  "ANALYTICS" is not a filter at all: it swaps the table for the booking
 *  analytics report. */
type BookingTab = AdminBookingStatus | "ALL" | "OUT_OF_ZONE" | "ANALYTICS";

const TABS: { key: BookingTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "OUT_OF_ZONE", label: "Coming Soon" },
  { key: "ANALYTICS", label: "Analytics" },
];

/** Tailwind classes per booking status badge. */
const STATUS_STYLES: Record<AdminBookingStatus, string> = {
  PENDING: "bg-warning/10 text-warning",
  ASSIGNED: "bg-primary/10 text-primary",
  ACCEPTED: "bg-primary/10 text-primary",
  ON_THE_WAY: "bg-primary/10 text-primary",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-danger/10 text-danger",
};

/** Tailwind classes per slot day-part chip. */
const PERIOD_STYLES: Record<string, string> = {
  Morning: "bg-amber-500/10 text-amber-600",
  Afternoon: "bg-sky-500/10 text-sky-600",
  Evening: "bg-indigo-500/10 text-indigo-600",
  Night: "bg-slate-500/10 text-slate-500",
};

/** "19:00" → "7:00 PM"; tolerates the "24:00" midnight end our slots use. */
/** Total booked time: 300 → "5 h", 330 → "5 h 30 min", 45 → "45 min". */
function formatTotalTime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr = "00"] = t.split(":");
  const raw = Number(hStr);
  if (!Number.isFinite(raw)) return t;
  const h = ((raw % 24) + 24) % 24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

function prettyStatus(status: AdminBookingStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The statuses an admin may move a booking to from where it is. Pending takes
 * the partner off it (or undoes a cancellation) so it can be allocated again;
 * Completed and Cancelled go through their own dialogs. The in-between states
 * (accepted, on the way, in progress) belong to the partner's app.
 */
function adminStatusMoves(b: AdminBooking): AdminBookingStatus[] {
  const moves: AdminBookingStatus[] = [];
  const open = b.status === "PENDING" && !b.professionalId;
  if (!open && b.status !== "COMPLETED" && b.status !== "IN_PROGRESS") {
    moves.push("PENDING");
  }
  if (b.status !== "COMPLETED" && b.status !== "CANCELLED") {
    moves.push("COMPLETED", "CANCELLED");
  }
  return moves;
}

/** A booking is allocatable when no partner has taken it and it isn't finished. */
function canAllocate(b: AdminBooking): boolean {
  return (
    !b.professionalId && b.status !== "COMPLETED" && b.status !== "CANCELLED"
  );
}

/** Completed bookings — old or new — can have their invoice downloaded. The
 *  invoice is rendered on demand from the booking, so no stored document or
 *  creation date is required. */
/** Save a fetched blob under `filename` — used by both downloads below. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The .xlsx an admin fills in before a bulk import. */
async function downloadImportTemplate(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/v1/admin/bookings/import-template`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok)
    throw new Error(`Could not download the template (${res.status})`);
  saveBlob(await res.blob(), "booking-import-template.xlsx");
}

/** Upload a filled template; returns a per-row result so failures are visible. */
async function uploadImportFile(file: File): Promise<{
  message: string;
  importedCount: number;
  failedCount: number;
  errors: { row: number; reason: string }[];
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE_URL}/v1/admin/bookings/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data?.message ?? `Import failed (${res.status})`);
  return data;
}

/**
 * Download the CSV of every booking matching the current filters.
 *
 * A plain link can't carry the bearer token, so this fetches the file and
 * saves the blob. Filters are forwarded so the export matches what's on screen.
 */
async function downloadBookingsCsv(
  params: Record<string, string | undefined>,
): Promise<void> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "") as [
      string,
      string,
    ][],
  );
  const res = await fetch(`${API_BASE_URL}/v1/admin/bookings/export?${qs}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  saveBlob(
    await res.blob(),
    `bookings-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function openInvoice(bookingId: number): void {
  window.open(
    `${API_BASE_URL}/v1/booking/${bookingId}/invoice`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function BookingsView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<BookingTab>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allocating, setAllocating] = useState<AdminBooking | null>(null);
  // Rows expanded to reveal every field the API returns.
  // Cancelling from the panel captures a reason, which is stored on the booking
  // and shown in the table — otherwise a cancellation has no explanation.
  const [cancelTarget, setCancelTarget] = useState<AdminBooking | null>(null);
  // Completing bills the customer and unlocks the invoice, so it confirms first.
  const [completeTarget, setCompleteTarget] = useState<AdminBooking | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminBooking | null>(null);
  // "Pending" from the status dropdown: confirmed first, because it takes the
  // job away from whoever holds it.
  const [reopenTarget, setReopenTarget] = useState<AdminBooking | null>(null);
  // Checkbox multi-select for bulk delete (ids survive page/filter changes so
  // an admin can gather a selection across pages).
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  // Manual booking creation — phone orders and walk-ins that never came
  // through the app.
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    message: string;
    importedCount: number;
    failedCount: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplate = async () => {
    setNotice(null);
    try {
      await downloadImportTemplate();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Could not download the template.",
      );
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setNotice(null);
    setImportResult(null);
    try {
      const result = await uploadImportFile(file);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
      // Reset so re-uploading the same file still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      // Same filters as the table, so the file matches what's on screen.
      await downloadBookingsCsv({
        status:
          tab === "ALL" || tab === "OUT_OF_ZONE" || tab === "ANALYTICS"
            ? undefined
            : tab,
        outOfServiceArea: tab === "OUT_OF_ZONE" ? "true" : undefined,
        search: search.trim() || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not export bookings.");
    } finally {
      setExporting(false);
    }
  };
  const [cancelChoice, setCancelChoice] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [notice, setNotice] = useState<string | null>(null);
  // Date-range filter (by booking date), "YYYY-MM-DD" or "" when unset.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [canManage, setCanManage] = useState(false);
  // Creating is its own grant, so a role that may edit bookings isn't
  // automatically offered a button the backend would refuse.
  const [canCreate, setCanCreate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    setCanManage(hasPermission("bookings.update"));
    setCanCreate(hasPermission("bookings.create"));
    setCanDelete(hasPermission("bookings.delete"));
  }, []);

  // Reset to the first page whenever the filter, search or date range changes.
  useEffect(() => {
    setPage(1);
  }, [tab, search, dateFrom, dateTo]);

  const params = {
    status:
      tab === "ALL" || tab === "OUT_OF_ZONE" || tab === "ANALYTICS"
        ? undefined
        : tab,
    outOfServiceArea: tab === "OUT_OF_ZONE" ? true : undefined,
    search: search.trim() || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminBookings(params),
    queryFn: () => dashboardApi.listBookings(params),
    placeholderData: keepPreviousData,
    // The analytics tab renders its own report — don't fetch the table behind it.
    enabled: tab !== "ANALYTICS",
  });

  const reopenBooking = useMutation({
    mutationFn: (id: number) => dashboardApi.reopenBooking(id),
    onSuccess: (r) => {
      setReopenTarget(null);
      setNotice(r.message);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (e) => {
      setReopenTarget(null);
      setNotice(
        e instanceof ApiError ? e.message : "Could not reopen the booking.",
      );
    },
  });

  const deleteBooking = useMutation({
    mutationFn: (id: number) => crmApi.deleteBooking(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setNotice("Booking deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(
        e instanceof ApiError ? e.message : "Could not delete the booking.",
      );
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => crmApi.bulkDeleteBookings(ids),
    onSuccess: (r) => {
      setConfirmBulk(false);
      setSelected(new Set());
      const skippedNote = r.skipped.length
        ? ` Skipped: ${r.skipped.map((x) => `#RC-${x.bookingId} (${x.reason})`).join("; ")}`
        : "";
      setNotice(`${r.message}.${skippedNote}`);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (e) => {
      setConfirmBulk(false);
      setNotice(
        e instanceof ApiError ? e.message : "Could not delete the selection.",
      );
    },
  });

  const cancelBooking = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      crmApi.updateBookingStatus(id, "CANCELLED", reason),
    onSuccess: () => {
      setCancelTarget(null);
      setNotice("Booking cancelled.");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (e) => {
      setCancelTarget(null);
      setNotice(
        e instanceof ApiError ? e.message : "Could not cancel the booking.",
      );
    },
  });

  const completeBooking = useMutation({
    mutationFn: (id: number) => crmApi.updateBookingStatus(id, "COMPLETED"),
    onSuccess: () => {
      setCompleteTarget(null);
      setNotice("Booking marked complete.");
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (e) => {
      setCompleteTarget(null);
      setNotice(
        e instanceof ApiError ? e.message : "Could not complete the booking.",
      );
    },
  });

  const counts = data?.counts;
  const pagination = data?.pagination;
  const bookings = data?.bookings ?? [];

  // Select-all covers the CURRENT page; the set itself accumulates across
  // pages so a cross-page selection is possible.
  const pageIds = bookings.map((b: AdminBooking) => b.bookingId);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id: number) => selected.has(id));
  const toggleRow = (bookingId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id: number) => next.delete(id));
      else pageIds.forEach((id: number) => next.add(id));
      return next;
    });
  const showActions = canManage;

  const from =
    pagination && pagination.total > 0
      ? (pagination.page - 1) * pagination.limit + 1
      : 0;
  const to = pagination
    ? Math.min(pagination.page * pagination.limit, pagination.total)
    : 0;

  return (
    <div className="mx-auto max-w-10xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            The complete booking history across all customers and services.
          </p>
        </div>
        {/* Exports every booking matching the current filters — not just this page. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Download these bookings as a CSV file"
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            {exporting ? <SpinnerIcon className="h-4 w-4" /> : <span>⬇</span>}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          {canCreate && (
            <button
              onClick={() => setCreating(true)}
              title="Create a booking for a customer (phone order, walk-in)"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <span>＋</span>
              Create booking
            </button>
          )}
          {showActions && (
            <>
              <button
                onClick={handleTemplate}
                title="Download the Excel template to fill in"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
              >
                📄 Template
              </button>
              {/* The button proxies to a hidden input so the file picker is styled. */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Upload a filled template to create bookings in bulk"
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {importing ? (
                  <SpinnerIcon className="h-4 w-4" />
                ) : (
                  <span>⬆</span>
                )}
                {importing ? "Importing…" : "Bulk import"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import outcome: a hand-filled sheet usually has a few bad rows, so every
          failure is listed with its row number instead of a bare count. */}
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

      {notice ? (
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </div>
      ) : null}

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const count =
              t.key === "ALL"
                ? counts?.all
                : t.key === "OUT_OF_ZONE"
                  ? counts?.outOfServiceArea
                  : counts?.[t.key];
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative -mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.key !== "ANALYTICS" && (
                  <sup className="ml-1 text-xs">({count ?? 0})</sup>
                )}
              </button>
            );
          })}
        </div>

        {tab !== "ANALYTICS" && (
          <div className="relative w-full max-w-sm pb-2">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, mobile, booking ID or date"
              className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        )}
      </div>

      {tab === "ANALYTICS" ? (
        <BookingAnalytics />
      ) : (
        <>
          {/* Date-range filter (by booking date) */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="date-from"
                className="text-xs font-medium text-muted-foreground"
              >
                From date
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="date-to"
                className="text-xs font-medium text-muted-foreground"
              >
                To date
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {(dateFrom || dateTo) && (
              <>
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  Clear dates
                </button>
                <span className="pb-2 text-xs text-muted-foreground">
                  {dateFrom && dateTo
                    ? `Showing bookings from ${dateFrom} to ${dateTo}`
                    : dateFrom
                      ? `Showing bookings on/after ${dateFrom}`
                      : `Showing bookings on/before ${dateTo}`}
                </span>
              </>
            )}
            {/* Bulk delete — always visible next to the filters, disabled until at
            least one row is ticked. */}
            {canDelete && (
              <div className="ml-auto flex items-end gap-2">
                {selected.size > 0 && (
                  <>
                    <span className="pb-2 text-xs font-semibold text-foreground">
                      {selected.size} selected
                    </span>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      Clear
                    </button>
                  </>
                )}
                <button
                  onClick={() => setConfirmBulk(true)}
                  disabled={selected.size === 0}
                  title={
                    selected.size === 0
                      ? "Tick bookings in the table to enable"
                      : undefined
                  }
                  className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🗑 Delete selected
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {isLoading ? (
              <div className="flex h-60 items-center justify-center text-muted-foreground">
                <SpinnerIcon className="h-6 w-6" />
              </div>
            ) : isError ? (
              <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
                <p className="text-muted-foreground">Couldn’t load bookings.</p>
                <button
                  onClick={() => refetch()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Retry
                </button>
              </div>
            ) : bookings.length === 0 ? (
              <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
                <BagIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {search || tab !== "ALL"
                    ? "No bookings match this filter."
                    : "No bookings yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      {canDelete && (
                        <th className="py-3 pl-4 pr-0 font-medium">
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            onChange={toggleAllOnPage}
                            title="Select all on this page"
                            className="h-4 w-4 accent-primary"
                          />
                        </th>
                      )}
                      <th className="py-3 pl-4 pr-0 font-medium" />
                      <th className="px-5 py-3 font-medium">Booking</th>
                      <th className="px-5 py-3 font-medium">Restaurant</th>
                      <th className="px-5 py-3 font-medium">Owner</th>
                      <th className="px-5 py-3 font-medium">GST</th>
                      <th className="px-5 py-3 font-medium">Mobile</th>
                      <th className="px-5 py-3 font-medium">Service</th>
                      <th className="px-5 py-3 font-medium">Slot / Shift</th>
                      <th className="px-5 py-3 font-medium">Area</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Payment</th>
                      <th className="px-5 py-3 font-medium">Lead sent</th>
                      <th className="px-5 py-3 font-medium">Partner</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="w-px whitespace-nowrap px-5 py-3 font-medium">
                        Date
                      </th>
                      <th className="w-px whitespace-nowrap py-3 pl-2 pr-5 text-right font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b: AdminBooking) => {
                      const isOpen = expanded.has(b.bookingId);
                      return (
                        <Fragment key={b.bookingId}>
                          <tr
                            className={`border-t border-border transition-colors hover:bg-muted/40 ${selected.has(b.bookingId) ? "bg-primary/5" : ""}`}
                          >
                            {canDelete && (
                              <td className="py-3 pl-4 pr-0 align-top">
                                <input
                                  type="checkbox"
                                  checked={selected.has(b.bookingId)}
                                  onChange={() => toggleRow(b.bookingId)}
                                  className="h-4 w-4 accent-primary"
                                />
                              </td>
                            )}
                            <td className="py-3 pl-4 pr-0 align-top">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(b.bookingId)}
                                aria-expanded={isOpen}
                                title={
                                  isOpen
                                    ? "Hide full details"
                                    : "Show full details"
                                }
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              >
                                <ChevronDownIcon
                                  className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                                />
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                              {b.id}
                            </td>
                            {/* Business profile captured at checkout, split into its own
                        columns: the restaurant, who owns it, and its GST. */}
                            <td className="whitespace-nowrap px-5 py-3 text-foreground">
                              {b.restaurantName ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                              {b.customer}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                              {b.gstNumber ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                              {b.mobile ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                              {b.service}
                            </td>
                            <td className="px-5 py-3">
                              {b.startTime || b.shift ? (
                                <div className="flex max-w-[15rem] flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    {b.slotPeriod && (
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                          PERIOD_STYLES[b.slotPeriod] ??
                                          "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {b.slotPeriod}
                                      </span>
                                    )}
                                    {b.startTime && (
                                      <span className="text-xs text-foreground">
                                        {formatTime(b.startTime)}
                                        {b.endTime
                                          ? ` – ${formatTime(b.endTime)}`
                                          : ""}
                                      </span>
                                    )}
                                    {formatTotalTime(b.totalMinutes) && (
                                      <span
                                        className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground"
                                        title="Total booked time"
                                      >
                                        {formatTotalTime(b.totalMinutes)}
                                      </span>
                                    )}
                                  </div>
                                  {b.shift && (
                                    <span
                                      className="truncate text-xs text-muted-foreground"
                                      title={b.shift}
                                    >
                                      {b.shift}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex max-w-[14rem] flex-col gap-1">
                                <span
                                  className="truncate text-foreground"
                                  title={b.address ?? undefined}
                                >
                                  {b.city || "—"}
                                </span>
                                {b.outOfServiceArea && (
                                  <span
                                    className="inline-flex w-fit items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning"
                                    title="Placed outside every active service zone — recorded as demand, shown to the customer as “Coming soon in your area” and not dispatched to a partner."
                                  >
                                    Coming soon · out of zone
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 font-medium text-foreground">
                              ₹{b.amount.toLocaleString("en-IN")}
                              {/* Older bookings stored a pre-tax total and have no split. */}
                              {b.taxAmount != null && b.baseAmount != null && (
                                <div
                                  className="text-[11px] font-normal text-muted-foreground"
                                  title={`Base ₹${b.baseAmount.toLocaleString("en-IN")} + GST ₹${b.taxAmount.toLocaleString("en-IN")}`}
                                >
                                  incl. GST ₹
                                  {b.taxAmount.toLocaleString("en-IN")}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="text-muted-foreground">
                                {b.paymentMode}
                              </div>
                              {/* Partner's in-app confirmation that the money is in hand. */}
                              {b.paymentCollected && (
                                <span
                                  className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success"
                                  title={
                                    b.paymentCollectedAt
                                      ? `Partner confirmed on ${new Date(b.paymentCollectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                                      : "Partner confirmed payment received"
                                  }
                                >
                                  ✓ Collected
                                </span>
                              )}
                            </td>
                            {/* How far the lead actually got: partners reached and
                                how many rounds it took. Expand the row for the
                                roster of who accepted, rejected or never
                                answered. */}
                            <td className="whitespace-nowrap px-5 py-3">
                              {b.broadcastCount > 0 ||
                              b.leadPartnerCount > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-foreground">
                                    {b.leadPartnerCount} partner
                                    {b.leadPartnerCount === 1 ? "" : "s"}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {b.broadcastCount} round
                                    {b.broadcastCount === 1 ? "" : "s"}
                                    {b.rejectionCount > 0
                                      ? ` · ${b.rejectionCount} rejected`
                                      : ""}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className="text-xs text-muted-foreground"
                                  title="No roster recorded — this lead went out before dispatch logging existed, or was never broadcast"
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {b.professionalName ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-foreground">
                                    {b.professionalName}
                                  </span>
                                  {b.assignmentSource && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                        b.assignmentSource === "MANUAL"
                                          ? "bg-primary/10 text-primary"
                                          : "bg-success/10 text-success"
                                      }`}
                                      title={
                                        b.assignmentSource === "MANUAL"
                                          ? "Allocated manually by an admin"
                                          : "Accepted from the auto-allocation broadcast"
                                      }
                                    >
                                      {b.assignmentSource === "MANUAL"
                                        ? "Manual"
                                        : "Auto"}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-warning">
                                  Unassigned
                                </span>
                              )}
                              {/* Declines explain WHY a lead is still unassigned, instead
                          of it looking like nobody was ever asked. Named, and
                          set apart from the assigned partner above: "Rejected by
                          1 partner" under "Tinku Sharma" read as Tinku rejecting. */}
                              {b.rejectionCount > 0 && (
                                <div
                                  className="mt-1.5 cursor-help border-t border-border/60 pt-1 text-[11px] font-medium text-danger"
                                  title={b.rejections
                                    .map(
                                      (r) =>
                                        `${r.professionalName}${r.reason ? ` — ${r.reason}` : ""} (${new Date(
                                          r.rejectedAt,
                                        ).toLocaleString("en-IN", {
                                          timeZone: "Asia/Kolkata",
                                        })})`,
                                    )
                                    .join("\n")}
                                >
                                  ✕ Declined by {rejecterNames(b.rejections)}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 align-top">
                              {showActions && adminStatusMoves(b).length ? (
                                // The badge is a dropdown: pick Pending to take
                                // the job back and allocate it again, Completed
                                // or Cancelled to finish it through their dialogs.
                                <span className="relative inline-flex">
                                  <select
                                    value={b.status}
                                    title="Change status"
                                    onChange={(e) => {
                                      const next = e.target
                                        .value as AdminBookingStatus;
                                      if (next === b.status) return;
                                      setNotice(null);
                                      if (next === "PENDING")
                                        setReopenTarget(b);
                                      else if (next === "COMPLETED")
                                        setCompleteTarget(b);
                                      else if (next === "CANCELLED") {
                                        setCancelChoice(null);
                                        setCancelReason("");
                                        setCancelTarget(b);
                                      }
                                    }}
                                    className={`cursor-pointer appearance-none whitespace-nowrap rounded-full py-1 pl-2.5 pr-6 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/30 ${STATUS_STYLES[b.status]}`}
                                  >
                                    <option value={b.status}>
                                      {prettyStatus(b.status)}
                                    </option>
                                    {adminStatusMoves(b).map((st) => (
                                      <option key={st} value={st}>
                                        {st === "PENDING"
                                          ? b.professionalId
                                            ? "Pending — take back & reallocate"
                                            : "Pending — reopen"
                                          : prettyStatus(st)}
                                      </option>
                                    ))}
                                  </select>
                                  <svg
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden
                                    className={`pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${STATUS_STYLES[b.status].split(" ")[1]}`}
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[b.status]}`}
                                >
                                  {prettyStatus(b.status)}
                                </span>
                              )}
                              {b.status === "CANCELLED" && (
                                <div className="mt-1 max-w-[200px] text-[11px] text-danger">
                                  {b.cancelledAt && (
                                    <div className="whitespace-nowrap">
                                      {new Date(b.cancelledAt).toLocaleString(
                                        "en-IN",
                                        {
                                          day: "2-digit",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          timeZone: "Asia/Kolkata",
                                        },
                                      )}
                                    </div>
                                  )}
                                  {b.cancellationReason && (
                                    <div
                                      className="line-clamp-2 text-muted-foreground"
                                      title={b.cancellationReason}
                                    >
                                      “{b.cancellationReason}”
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="w-px whitespace-nowrap px-5 py-3 text-muted-foreground">
                              <div>{b.date}</div>
                              <div className="text-[11px]">
                                Created{" "}
                                {new Date(b.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    timeZone: "Asia/Kolkata",
                                  },
                                )}
                              </div>
                            </td>
                            <td className="w-px py-3 pl-2 pr-5">
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                {b.status === "COMPLETED" && (
                                  <button
                                    onClick={() => openInvoice(b.bookingId)}
                                    title="Download the invoice (PDF)"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent"
                                  >
                                    🧾 Invoice
                                  </button>
                                )}
                                {showActions && canAllocate(b) ? (
                                  <button
                                    onClick={() => {
                                      setNotice(null);
                                      setAllocating(b);
                                    }}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                                  >
                                    Allocate
                                  </button>
                                ) : null}
                                {showActions && (
                                  <button
                                    onClick={() => {
                                      setNotice(null);
                                      setDeleteTarget(b);
                                    }}
                                    title="Delete this booking"
                                    className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                                {showActions &&
                                b.status !== "COMPLETED" &&
                                b.status !== "CANCELLED" ? (
                                  <button
                                    onClick={() => {
                                      setNotice(null);
                                      setCompleteTarget(b);
                                    }}
                                    title="Mark this booking as completed"
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/10"
                                  >
                                    Complete
                                  </button>
                                ) : null}
                                {/* Cancelling asks for a reason, stored on the booking
                            and shown in this table. */}
                                {showActions &&
                                b.status !== "COMPLETED" &&
                                b.status !== "CANCELLED" ? (
                                  <button
                                    onClick={() => {
                                      setNotice(null);
                                      setCancelChoice(null);
                                      setCancelReason("");
                                      setCancelTarget(b);
                                    }}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/10"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                                {!showActions && b.status !== "COMPLETED" ? (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {isOpen && <BookingDetailsRow booking={b} />}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {pagination && bookings.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground">
                <span>
                  Showing {from}–{to} of {pagination.total} bookings
                  {isFetching ? " · updating…" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground transition hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    ‹ Prev
                  </button>
                  <span className="text-xs">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded-lg border border-border px-3 py-1.5 font-medium text-foreground transition hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {completeTarget && (
        <ConfirmDialog
          title={`Mark ${completeTarget.id} as completed?`}
          message="This closes the job as done, bills the customer for it and makes the invoice available. It can't be reopened afterwards."
          confirmLabel="Mark complete"
          busy={completeBooking.isPending}
          onConfirm={() => completeBooking.mutate(completeTarget.bookingId)}
          onCancel={() => setCompleteTarget(null)}
        />
      )}

      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmBulk(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">
              Delete {selected.size} booking{selected.size === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes the selected bookings — completed ones
              included — along with their ratings, invoices and lead records.
              This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmBulk(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDelete.mutate([...selected])}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {bulkDelete.isPending && <SpinnerIcon className="h-4 w-4" />}
                Delete {selected.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteTarget(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              Delete {deleteTarget.id}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteTarget.restaurantName
                ? `${deleteTarget.restaurantName} · `
                : ""}
              {deleteTarget.customer} · ₹
              {deleteTarget.amount.toLocaleString("en-IN")}
            </p>
            <p className="mt-3 text-sm text-danger">
              This permanently removes the booking and its rejection history. It
              cannot be undone.
              {deleteTarget.status === "COMPLETED"
                ? " Completed bookings are refused — cancel it instead."
                : ""}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Keep it
              </button>
              <button
                onClick={() => deleteBooking.mutate(deleteTarget.bookingId)}
                disabled={deleteBooking.isPending}
                className="flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleteBooking.isPending && <SpinnerIcon className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setReopenTarget(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">
              Set {reopenTarget.id} back to Pending?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {reopenTarget.restaurantName
                ? `${reopenTarget.restaurantName} · `
                : ""}
              {reopenTarget.customer} · ₹
              {reopenTarget.amount.toLocaleString("en-IN")}
            </p>
            <p className="mt-3 text-sm text-foreground">
              {reopenTarget.professionalId
                ? `${reopenTarget.professionalName ?? "The assigned partner"} is taken off the booking — their job screen closes and their lead fee is refunded. `
                : reopenTarget.status === "CANCELLED"
                  ? "The cancellation is undone. "
                  : ""}
              The booking then waits unassigned, with the Allocate button back,
              until you pick a partner. It is not re-broadcast on its own.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setReopenTarget(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Keep as is
              </button>
              <button
                onClick={() => reopenBooking.mutate(reopenTarget.bookingId)}
                disabled={reopenBooking.isPending}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {reopenBooking.isPending && <SpinnerIcon className="h-4 w-4" />}
                Set to Pending
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelBookingDialog
          booking={cancelTarget}
          choice={cancelChoice}
          onChoiceChange={setCancelChoice}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          busy={cancelBooking.isPending}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            if (!cancelTarget || !cancelChoice) return;
            const note = cancelReason.trim();
            // "Other" stores just the note; a preset stores the preset plus any note.
            const reason =
              cancelChoice === "Other"
                ? note
                : note
                  ? `${cancelChoice} — ${note}`
                  : cancelChoice;
            cancelBooking.mutate({ id: cancelTarget.bookingId, reason });
          }}
        />
      )}
      {allocating && (
        <AllocatePartnerModal
          booking={allocating}
          onClose={() => setAllocating(null)}
          onDone={(msg) => {
            setAllocating(null);
            setNotice(msg);
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
          }}
        />
      )}
      {creating && (
        <NewBookingModal
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setCreating(false);
            setNotice(msg);
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
          }}
        />
      )}
    </div>
  );
}

/* --------------------------- Manual booking ------------------------------ */

/** Must match the backend's GST_RATE — used only to preview the total. */
const GST_RATE = 0.18;

/** One labelled field, so the form's rows line up without repeating classes. */
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

/**
 * Google Places search for the booking's service location — the same search
 * quality as google.com/maps (shared loader with the geofence editor). Picking
 * a result hands back the exact coordinates plus a best-effort address/city
 * split; the caller fills the form fields, which stay editable.
 */
function LocationSearchField({
  onPick,
}: {
  onPick: (place: {
    address: string;
    city: string | null;
    lat: number;
    lng: number;
  }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0); // drop responses from superseded keystrokes

  useEffect(() => {
    const q = query.trim();
    const seq = ++seqRef.current;
    if (q.length < 3) {
      queueMicrotask(() => {
        if (seq !== seqRef.current) return;
        setResults([]);
        setSearching(false);
        setFailed(false);
      });
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setFailed(false);
      try {
        const found = await fetchPlaceSuggestions(q);
        if (seq !== seqRef.current) return;
        setResults(found);
        setOpen(true);
      } catch {
        if (seq !== seqRef.current) return;
        setFailed(true);
        setResults([]);
        setOpen(true);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    setQuery(`${s.label}, ${s.address}`);
    try {
      const { lat, lng } = await s.resolve();
      // The secondary line reads like "Pitampura, Delhi, India" — the part
      // before "India" is the city more often than not. A guess is fine: the
      // City field stays editable.
      const parts = s.address
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p && p.toLowerCase() !== "india");
      onPick({
        address: `${s.label}, ${s.address}`,
        city: parts.length ? parts[parts.length - 1] : null,
        lat,
        lng,
      });
    } catch {
      setFailed(true);
      setOpen(true);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search location on Google Maps…"
          className={`${inputClass} pl-9`}
        />
        {searching && (
          <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
      {open && query.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
          {failed ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Location search is unavailable — enter the coordinates manually
              below.
            </p>
          ) : results.length === 0 && !searching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No places found.
            </p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition hover:bg-accent"
              >
                <span className="text-sm font-medium text-foreground">
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.address}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create a booking for a customer from the panel — phone orders and walk-ins
 * that never came through the app.
 *
 * The amount entered is PRE-GST: tax and the inclusive total are added by the
 * backend, so a manual booking is priced exactly like an app one (the total is
 * previewed here so the admin isn't surprised by it).
 */
function NewBookingModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Customer: an existing account, or a new one created from the mobile number.
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  // Category first, then its services — picking from 260+ services in one flat
  // list is unusable, and it mirrors how the customer app asks for a service.
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("11:00");
  const [endTime, setEndTime] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"COD" | "RAZORPAY">("COD");
  const [serviceCity, setServiceCity] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Optional immediate assignment — otherwise the lead is broadcast as usual.
  const [assign, setAssign] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [professionalId, setProfessionalId] = useState("");

  const [err, setErr] = useState<string | null>(null);

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: queryKeys.customers(customerSearch.trim()),
    queryFn: () => customersApi.list(customerSearch.trim() || undefined),
    enabled: mode === "existing",
    placeholderData: keepPreviousData,
  });

  const { data: services } = useQuery({
    queryKey: ["admin", "bookable-services"],
    queryFn: () => dashboardApi.bookableServices(),
  });

  const { data: partners } = useQuery({
    queryKey: queryKeys.partners(partnerSearch.trim(), "ACTIVE"),
    queryFn: () =>
      dispatcherApi.listPartners(partnerSearch.trim() || undefined, "ACTIVE"),
    enabled: assign,
    placeholderData: keepPreviousData,
  });

  const selectedService =
    services?.find((s) => String(s.serviceId) === serviceId) ?? null;

  // Categories in the order the backend sorted them, de-duplicated.
  const categories: { id: string; name: string }[] = [];
  for (const s of services ?? []) {
    const id = String(s.categoryId ?? "");
    if (!id || categories.some((c) => c.id === id)) continue;
    categories.push({ id, name: s.category ?? "Uncategorised" });
  }
  const servicesInCategory = (services ?? []).filter(
    (s) => String(s.categoryId ?? "") === categoryId,
  );

  // Changing the category invalidates whatever service was chosen under the old
  // one, so clear it rather than leave a mismatched selection behind.
  const chooseCategory = (id: string) => {
    setCategoryId(id);
    setServiceId("");
    setVariantId("");
  };

  // Picking a service (or one of its shifts) pre-fills the price, which is what
  // the admin would otherwise have to look up. It stays editable.
  const chooseService = (id: string) => {
    setServiceId(id);
    setVariantId("");
    const svc = services?.find((s) => String(s.serviceId) === id);
    if (svc?.basePrice != null) setBaseAmount(String(svc.basePrice));
  };
  const chooseVariant = (id: string) => {
    setVariantId(id);
    const v = selectedService?.variants.find((x) => String(x.variantId) === id);
    if (v?.price != null) setBaseAmount(String(v.price));
  };

  const base = Number(baseAmount);
  const validAmount = Number.isFinite(base) && base > 0;
  const tax = validAmount ? Math.round(base * GST_RATE * 100) / 100 : 0;
  const total = validAmount ? Math.round((base + tax) * 100) / 100 : 0;

  const digits = mobile.replace(/\D/g, "");
  const customerOk =
    mode === "existing" ? customer != null : digits.length >= 10;
  const canSubmit =
    customerOk &&
    serviceId !== "" &&
    /^\d{4}-\d{2}-\d{2}$/.test(bookingDate) &&
    /^\d{1,2}:\d{2}$/.test(startTime) &&
    validAmount &&
    serviceCity.trim() !== "" &&
    serviceAddress.trim() !== "" &&
    (!assign || professionalId !== "");

  const create = useMutation({
    mutationFn: () => {
      const body: CreateBookingInput = {
        ...(mode === "existing"
          ? { userId: customer!.userId }
          : {
              customerMobile: digits,
              customerName: name.trim() || undefined,
              restaurantName: restaurantName.trim() || undefined,
              gstNumber: gstNumber.trim() || undefined,
            }),
        serviceId: Number(serviceId),
        variantId: variantId ? Number(variantId) : undefined,
        bookingDate,
        startTime,
        endTime: endTime || undefined,
        baseAmount: base,
        paymentMode,
        serviceCity: serviceCity.trim(),
        serviceAddress: serviceAddress.trim(),
        serviceLat: lat.trim() ? Number(lat) : undefined,
        serviceLng: lng.trim() ? Number(lng) : undefined,
        professionalId:
          assign && professionalId ? Number(professionalId) : undefined,
      };
      return dashboardApi.createBooking(body);
    },
    // The note explains what happened to the lead (broadcast, assigned, or
    // demand-only), which the admin can't tell from the booking id alone.
    onSuccess: (res) => onDone(`${res.message}. ${res.note}`),
    onError: (e) =>
      setErr(
        e instanceof ApiError ? e.message : "Could not create the booking.",
      ),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={create.isPending ? undefined : onClose}
        aria-hidden
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Create booking
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a booking on a customer&apos;s behalf. GST is added
            automatically, exactly as in the app.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Customer */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">
                Customer
              </h4>
              <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
                {(["existing", "new"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {m === "existing" ? "Existing" : "New"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "existing" ? (
              <>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customers by name, mobile or restaurant"
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border">
                  {loadingCustomers ? (
                    <div className="flex h-24 items-center justify-center text-muted-foreground">
                      <SpinnerIcon className="h-5 w-5" />
                    </div>
                  ) : (customers ?? []).length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      No customer found. Switch to{" "}
                      <span className="font-medium">New</span> to create one.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {(customers ?? []).slice(0, 50).map((c) => {
                        const on = customer?.userId === c.userId;
                        return (
                          <li key={c.userId}>
                            <button
                              type="button"
                              onClick={() => setCustomer(c)}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                                on ? "bg-primary/5" : "hover:bg-muted/50"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {c.name || "Unnamed"}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {[c.mobile, c.restaurantName]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </span>
                              </span>
                              {on && (
                                <span className="shrink-0 text-xs font-semibold text-primary">
                                  Selected
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Mobile"
                  required
                  hint="An existing account with this number is reused."
                >
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    inputMode="numeric"
                    placeholder="9876543210"
                    className={inputClass}
                  />
                </Field>
                <Field label="Customer name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ravi Mehta"
                    className={inputClass}
                  />
                </Field>
                <Field label="Restaurant name">
                  <input
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="Spice Garden"
                    className={inputClass}
                  />
                </Field>
                <Field label="GST number">
                  <input
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="27AABCU9603R1ZX"
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </section>

          {/* Service + money */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Service</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" required>
                <select
                  value={categoryId}
                  onChange={(e) => chooseCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Service"
                required
                hint={
                  categoryId && servicesInCategory.length === 0
                    ? "This category has no services yet."
                    : undefined
                }
              >
                <select
                  value={serviceId}
                  onChange={(e) => chooseService(e.target.value)}
                  disabled={!categoryId}
                  className={`${inputClass} disabled:opacity-50`}
                >
                  <option value="">
                    {categoryId ? "Select a service" : "Pick a category first"}
                  </option>
                  {servicesInCategory.map((s) => (
                    <option key={s.serviceId} value={s.serviceId}>
                      {s.name}
                      {s.basePrice != null ? ` — ₹${s.basePrice}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Shift"
                hint={
                  selectedService && selectedService.variants.length === 0
                    ? "This service has no shifts."
                    : undefined
                }
              >
                <select
                  value={variantId}
                  onChange={(e) => chooseVariant(e.target.value)}
                  disabled={
                    !selectedService || selectedService.variants.length === 0
                  }
                  className={`${inputClass} disabled:opacity-50`}
                >
                  <option value="">None</option>
                  {(selectedService?.variants ?? []).map((v) => (
                    <option key={v.variantId} value={v.variantId}>
                      {v.name}
                      {v.price != null ? ` — ₹${v.price}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Amount (pre-GST)"
                required
                hint={
                  validAmount
                    ? `+ ₹${tax.toLocaleString("en-IN")} GST = ₹${total.toLocaleString("en-IN")} payable`
                    : "18% GST is added on top."
                }
              >
                <input
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="1000"
                  className={inputClass}
                />
              </Field>
              <Field label="Payment mode">
                <select
                  value={paymentMode}
                  onChange={(e) =>
                    setPaymentMode(e.target.value as "COD" | "RAZORPAY")
                  }
                  className={inputClass}
                >
                  <option value="COD">COD</option>
                  <option value="RAZORPAY">Razorpay</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Schedule */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Schedule</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Booking date" required>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Start time" required>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End time" hint="Defaults to the start time.">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* Location */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Location</h4>
            {/* Google Places search — picking a result fills address, city and
                exact coordinates; every field stays editable afterwards. */}
            <LocationSearchField
              onPick={({ address, city, lat: la, lng: ln }) => {
                setServiceAddress(address);
                if (city) setServiceCity(city);
                setLat(la.toFixed(6));
                setLng(ln.toFixed(6));
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" required>
                <input
                  value={serviceCity}
                  onChange={(e) => setServiceCity(e.target.value)}
                  placeholder="Delhi"
                  className={inputClass}
                />
              </Field>
              <Field label="Address" required>
                <input
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  placeholder="12 MG Road, Pitampura"
                  className={inputClass}
                />
              </Field>
              <Field label="Latitude">
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  inputMode="decimal"
                  placeholder="28.6983"
                  className={inputClass}
                />
              </Field>
              <Field label="Longitude">
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  inputMode="decimal"
                  placeholder="77.1421"
                  className={inputClass}
                />
              </Field>
            </div>
            {/* Said up front, because a booking that reaches nobody looks like a
                bug rather than a choice. */}
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {lat.trim() && lng.trim()
                ? "The lead will be sent to matching partners in this area."
                : "Without coordinates the booking is saved as demand and NOT sent to partners — allocate it manually from the table."}
            </p>
          </section>

          {/* Optional direct assignment */}
          <section className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={assign}
                onChange={(e) => {
                  setAssign(e.target.checked);
                  if (!e.target.checked) setProfessionalId("");
                }}
                className="h-4 w-4 rounded border-border"
              />
              Assign a partner now
            </label>
            {assign && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Find partner">
                  <input
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    placeholder="Name, mobile or city"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Partner"
                  required
                  hint="₹30 lead fee is charged, as on allocation."
                >
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select a partner</option>
                    {(partners ?? [])
                      .filter((p) => !p.isBlocked)
                      .map((p) => (
                        <option key={p.professionalId} value={p.professionalId}>
                          {p.name}
                          {p.city ? ` · ${p.city}` : ""}
                          {p.isOnline ? " · online" : ""}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            )}
          </section>
        </div>

        {err ? (
          <div className="border-t border-border px-5 py-3 text-sm text-danger">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <span className="text-sm text-muted-foreground">
            {validAmount
              ? `Payable ₹${total.toLocaleString("en-IN")} (incl. GST)`
              : ""}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={create.isPending}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit || create.isPending}
              onClick={() => {
                setErr(null);
                create.mutate();
              }}
              title={
                canSubmit ? undefined : "Fill in every required field first"
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
              Create booking
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

// 🧭 Pick an active partner to manually assign to an unaccepted booking.
function AllocatePartnerModal({
  booking,
  onClose,
  onDone,
}: {
  booking: AdminBooking;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PartnerRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.partners(search.trim(), "ACTIVE"),
    queryFn: () =>
      dispatcherApi.listPartners(search.trim() || undefined, "ACTIVE"),
    placeholderData: keepPreviousData,
  });
  const partners = (data ?? []).filter((p) => !p.isBlocked);

  const allocate = useMutation({
    mutationFn: (professionalId: number) =>
      dashboardApi.allocateBooking(booking.bookingId, professionalId),
    onSuccess: (res) => onDone(res.message),
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : "Could not allocate partner."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={allocate.isPending ? undefined : onClose}
        aria-hidden
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-5">
          <h3 className="text-lg font-semibold text-foreground">
            Allocate a partner
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Booking{" "}
            <span className="font-medium text-foreground">{booking.id}</span> ·{" "}
            {booking.service} · {booking.customer}
          </p>
        </div>

        <div className="border-b border-border p-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search active partners by name, mobile or city"
              autoFocus
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="min-h-48 flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <SpinnerIcon className="h-6 w-6" />
            </div>
          ) : partners.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <UsersIcon className="h-8 w-8" />
              <p className="text-sm">No active partners found.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {partners.map((p) => {
                const isSel = selected?.professionalId === p.professionalId;
                return (
                  <li key={p.professionalId}>
                    <button
                      onClick={() => setSelected(p)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        isSel
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                          {p.name}
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              p.isOnline
                                ? "bg-success"
                                : "bg-muted-foreground/40"
                            }`}
                            title={p.isOnline ? "Online" : "Offline"}
                          />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.category, p.city, p.mobile]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                      {isSel && (
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          Selected
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {err ? (
          <div className="border-t border-border px-5 py-3 text-sm text-danger">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={allocate.isPending}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || allocate.isPending}
            onClick={() => selected && allocate.mutate(selected.professionalId)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {allocate.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            {selected ? `Assign ${selected.name}` : "Assign partner"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Expanded "complete data" ----------------------- */

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** IST throughout — the business timezone the backend reports in. */
function istDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** "Akhtar Ali", "Akhtar Ali and Rahul", "Akhtar Ali, Rahul and 2 more". */
function rejecterNames(rejections: { professionalName: string }[]): string {
  const names = [...new Set(rejections.map((r) => r.professionalName))];
  if (names.length <= 2) return names.join(" and ");
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/**
 * Everything the columns can't fit, so a booking's full record is visible
 * without leaving the table. Identical in the admin and CRM tabs.
 */
function BookingDetailsRow({ booking: b }: { booking: AdminBooking }) {
  return (
    <tr className="border-t border-border bg-muted/30">
      <td />
      <td colSpan={16} className="px-5 pb-5 pt-1">
        <VisiblePane>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Restaurant">{b.restaurantName ?? "—"}</Detail>
            <Detail label="Owner">{b.customer}</Detail>
            <Detail label="GST number">{b.gstNumber ?? "—"}</Detail>
            <Detail label="Mobile">{b.mobile ?? "—"}</Detail>

            <Detail label="Service">{b.service}</Detail>
            <Detail label="Shift">{b.shift ?? "—"}</Detail>
            <Detail label="Slot">
              {b.startTime && b.endTime ? `${b.startTime} – ${b.endTime}` : "—"}
              {b.slotPeriod ? ` · ${b.slotPeriod}` : ""}
            </Detail>
            <Detail label="Total time">
              {formatTotalTime(b.totalMinutes) ?? "—"}
            </Detail>
            <Detail label="Payment">{b.paymentMode}</Detail>
            {b.addons.length > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Detail label={`Added on site (${b.addons.length})`}>
                  <span className="flex flex-col gap-0.5">
                    {b.addons.map((a) => (
                      <span key={a.addonId}>
                        {a.quantity} × {a.name} — ₹
                        {a.amount.toLocaleString("en-IN")}
                        {a.quantity > 1
                          ? ` (₹${a.unitPrice.toLocaleString("en-IN")} each)`
                          : ""}
                      </span>
                    ))}
                  </span>
                </Detail>
              </div>
            )}
            <Detail label="Payment collected">
              {b.paymentCollected
                ? `Yes — partner confirmed${b.paymentCollectedAt ? ` on ${istDateTime(b.paymentCollectedAt)}` : ""}`
                : "Not confirmed by partner yet"}
            </Detail>

            <Detail label="Amount paid">
              ₹{b.amount.toLocaleString("en-IN")}
            </Detail>
            <Detail label="Base (pre-GST)">
              {b.baseAmount != null
                ? `₹${b.baseAmount.toLocaleString("en-IN")}`
                : "—"}
            </Detail>
            <Detail label="GST">
              {b.taxAmount != null
                ? `₹${b.taxAmount.toLocaleString("en-IN")}`
                : "—"}
            </Detail>
            <Detail label="Partner">
              {b.professionalName ?? "Unassigned"}
              {b.assignmentSource
                ? ` (${b.assignmentSource === "MANUAL" ? "manual" : "auto"})`
                : ""}
            </Detail>

            <div className="sm:col-span-2 lg:col-span-4">
              <Detail label="Service address">
                {b.address ?? "—"}
                {b.city ? ` · ${b.city}` : ""}
                {b.outOfServiceArea ? " · outside every active zone" : ""}
              </Detail>
            </div>

            <Detail label="Booked for">{b.date}</Detail>
            <Detail label="Created">{istDateTime(b.createdAt)}</Detail>
            <Detail label="Cancelled">{istDateTime(b.cancelledAt)}</Detail>
            <Detail label="Cancellation reason">
              {b.cancellationReason ? `“${b.cancellationReason}”` : "—"}
            </Detail>

            {b.rejectionCount > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Detail label={`Rejected by ${b.rejectionCount}`}>
                  <span className="flex flex-col gap-0.5">
                    {b.rejections.map((r) => (
                      <span
                        key={r.rejectionId}
                        className="text-xs text-muted-foreground"
                      >
                        {r.professionalName}
                        {r.reason ? ` — ${r.reason}` : ""} ·{" "}
                        {istDateTime(r.rejectedAt)}
                      </span>
                    ))}
                  </span>
                </Detail>
              </div>
            )}
          </dl>

          {/* Who the lead actually reached. The rejection list above names only
            the partners who said no; this shows everyone it went to, including
            the ones who never answered at all. */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lead activity
            </p>
            <BookingLeadActivityPanel bookingId={b.bookingId} />
          </div>
        </VisiblePane>
      </td>
    </tr>
  );
}

/**
 * Keeps an expanded row's content inside the part of the table you can see.
 *
 * The details cell spans every column of a table that is much wider than the
 * screen, so anything laid out "full width" inside it — the detail grid, the
 * lead activity table — stretched across the whole scroll width and its right
 * half (Delivery, Outcome, who rejected) sat off-screen where nobody found it.
 * This pins the content to the visible edge and sizes it to the viewport of
 * the scroll container, following it as the window resizes.
 */
function VisiblePane({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest(".overflow-x-auto") as HTMLElement | null;
    if (!el || !scroller) return;
    const cell = el.parentElement;
    const update = () => {
      const pad = cell
        ? parseFloat(getComputedStyle(cell).paddingLeft) +
          parseFloat(getComputedStyle(cell).paddingRight)
        : 0;
      setWidth(Math.max(0, scroller.clientWidth - pad));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="sticky left-5"
      style={width != null ? { width } : undefined}
    >
      {children}
    </div>
  );
}

// Same presets the customer app offers, so cancellations from either side are
// comparable. One must be chosen — a cancellation with no reason tells
// operations nothing. "Other" requires the note.
const CANCEL_REASONS = [
  "Booked by mistake",
  "Price is too high",
  "Change of plan",
  "Booked wrong date or time",
  "Customer requested cancellation",
  "No partner available",
  "Other",
] as const;

/** Cancel a booking, capturing WHY — the reason is stored and shown in the table. */
function CancelBookingDialog({
  booking,
  choice,
  onChoiceChange,
  reason,
  onReasonChange,
  busy,
  onClose,
  onConfirm,
}: {
  booking: AdminBooking | null;
  choice: string | null;
  onChoiceChange: (v: string) => void;
  reason: string;
  onReasonChange: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!booking) return null;
  // "Other" carries only the typed note, so it must not be empty.
  const valid =
    choice != null && (choice !== "Other" || reason.trim().length > 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">
            Cancel {booking.id}?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.restaurantName ? `${booking.restaurantName} · ` : ""}
            {booking.customer} · ₹{booking.amount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Reason <span className="text-danger">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map((r) => {
              const on = choice === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChoiceChange(r)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={
              choice === "Other"
                ? "Tell us what happened"
                : "Anything to add? (optional)"
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <span className="block text-xs text-muted-foreground">
            Stored on the booking and shown in this table.
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || !valid}
            title={valid ? undefined : "Pick a reason first"}
            className="flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy && <SpinnerIcon className="h-4 w-4" />}
            Cancel booking
          </button>
        </div>
      </div>
    </div>
  );
}
