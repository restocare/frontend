"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmFinanceApi,
  crmQueryKeys,
  type InvoiceRow,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
} from "@/src/components/crm/ui";
import { SearchIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const invoiceTone: Record<string, string> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "muted",
};

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PAID", label: "Paid" },
  { key: "FAILED", label: "Failed" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "OVERDUE", label: "Overdue" },
];

const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"];

const clientName = (inv: InvoiceRow) =>
  inv.booking?.user?.restaurantName || inv.booking?.user?.name || "—";

export default function CrmFinancePage() {
  const [tab, setTab] = useState("invoices");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: summary, error: summaryError } = useQuery({
    queryKey: crmQueryKeys.financeSummary,
    queryFn: crmFinanceApi.summary,
  });

  const summaryCards = [
    { label: "Collected", value: inr(summary?.paid.amount), sub: `${summary?.paid.count ?? "…"} paid invoices` },
    { label: "Pending", value: inr(summary?.pending.amount), sub: `${summary?.pending.count ?? "…"} invoices awaiting payment` },
    {
      label: "Overdue",
      value: inr(summary?.overdue.amount),
      sub: `${summary?.overdue.count ?? "…"} pending > ${summary?.overdueAfterDays ?? 7} days`,
      danger: (summary?.overdue.count ?? 0) > 0,
    },
    { label: "Refunded", value: inr(summary?.refunded.amount), sub: `${summary?.refunded.count ?? "…"} invoices` },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Billing & Finance"
        subtitle="Invoices, payment tracking and revenue reports"
      />
      {summaryError instanceof ApiError && <Notice kind="error">{summaryError.message}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label} className={`p-5 ${c.danger ? "border-danger/40" : ""}`}>
            <span className="text-sm text-muted-foreground">{c.label}</span>
            <div className={`mt-2 text-2xl font-semibold ${c.danger ? "text-danger" : "text-foreground"}`}>
              {c.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
          </Card>
        ))}
      </div>

      <Tabs
        tabs={[
          { key: "invoices", label: "Invoices" },
          { key: "revenue", label: "Revenue reports" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "invoices" ? (
        <InvoicesTab
          onNotice={(m) => {
            setActionError(null);
            setNotice(m);
          }}
          onError={(m) => {
            setNotice(null);
            setActionError(m);
          }}
        />
      ) : (
        <RevenueTab monthlyFromSummary={summary?.monthlyCollections} />
      )}
    </div>
  );
}

/* ------------------------------ Invoices ------------------------------- */

function InvoicesTab({
  onNotice,
  onError,
}: {
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [markPaid, setMarkPaid] = useState<InvoiceRow | null>(null);

  const canManage = hasPermission("finance.manage");

  const params = {
    search: search || undefined,
    status: status === "ALL" || status === "OVERDUE" ? undefined : status,
    overdue: status === "OVERDUE" ? "true" : undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.invoices(params),
    queryFn: () => crmFinanceApi.invoices(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm", "invoices"] });
    qc.invalidateQueries({ queryKey: crmQueryKeys.financeSummary });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      <Tabs
        tabs={STATUS_TABS}
        active={status}
        onChange={(key) => {
          setStatus(key);
          setPage(1);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search invoice # or client…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <input
          type="date"
          className={`${inputCls} w-auto`}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <span className="text-sm text-muted-foreground">to</span>
        <input
          type="date"
          className={`${inputCls} w-auto`}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Card>
        <TableShell
          head={["Invoice #", "Client", "Service", "City", "Total", "Status", "Paid at", "Actions"]}
        >
          {isLoading && <EmptyRow cols={8} label="Loading invoices…" />}
          {!isLoading && !data?.invoices.length && (
            <EmptyRow cols={8} label="No invoices match these filters." />
          )}
          {data?.invoices.map((inv) => (
            <tr key={inv.invoiceId} className="text-foreground">
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setDetail(inv)}
                >
                  {inv.invoiceNumber}
                </button>
              </td>
              <td className="px-4 py-3">{clientName(inv)}</td>
              <td className="px-4 py-3 text-muted-foreground">{inv.booking?.service?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{inv.booking?.serviceCity ?? "—"}</td>
              <td className="px-4 py-3 font-medium">{inr(inv.totalAmount)}</td>
              <td className="px-4 py-3">
                <Badge tone={invoiceTone[inv.paymentStatus] ?? "muted"}>{inv.paymentStatus}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.paidAt)}</td>
              <td className="px-4 py-3">
                {canManage && inv.paymentStatus === "PENDING" && (
                  <Btn small tone="success" onClick={() => setMarkPaid(inv)}>
                    Mark paid
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {data?.total ?? "…"} invoices
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Btn>
            <Btn tone="ghost" small disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {detail && (
        <InvoiceDetailModal
          invoice={detail}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={(msg) => {
            setDetail(null);
            onNotice(msg);
            invalidate();
          }}
          onFail={(msg) => {
            setDetail(null);
            onError(msg);
          }}
        />
      )}
      {markPaid && (
        <MarkPaidModal
          invoice={markPaid}
          onClose={() => setMarkPaid(null)}
          onSaved={() => {
            setMarkPaid(null);
            onNotice(`Invoice ${markPaid.invoiceNumber} marked as paid.`);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function MarkPaidModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [method, setMethod] = useState("UPI");
  const [txn, setTxn] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      crmFinanceApi.updateInvoice(invoice.invoiceId, {
        paymentStatus: "PAID",
        paymentMethod: method,
        transactionId: txn.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setFormError(e instanceof ApiError ? e.message : "Could not update the invoice."),
  });

  return (
    <Modal title={`Mark ${invoice.invoiceNumber} as paid`} onClose={onClose}>
      <div className="space-y-4">
        {formError && <Notice kind="error">{formError}</Notice>}
        <p className="text-sm text-muted-foreground">
          {clientName(invoice)} · {inr(invoice.totalAmount)}
        </p>
        <Field label="Payment method">
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Transaction id (optional)">
          <input className={inputCls} value={txn} onChange={(e) => setTxn(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn tone="success" busy={save.isPending} onClick={() => save.mutate()}>
            Mark paid
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceDetailModal({
  invoice,
  canManage,
  onClose,
  onChanged,
  onFail,
}: {
  invoice: InvoiceRow;
  canManage: boolean;
  onClose: () => void;
  onChanged: (msg: string) => void;
  onFail: (msg: string) => void;
}) {
  const [status, setStatus] = useState(invoice.paymentStatus);

  const save = useMutation({
    mutationFn: () => crmFinanceApi.updateInvoice(invoice.invoiceId, { paymentStatus: status }),
    onSuccess: () => onChanged(`Invoice ${invoice.invoiceNumber} set to ${status}.`),
    onError: (e) =>
      onFail(e instanceof ApiError ? e.message : "Could not update the invoice."),
  });

  const money: [string, number][] = [
    ["Service amount", invoice.serviceAmount],
    ["Platform fee", invoice.platformFee],
    ["Tax", invoice.taxAmount],
    ["Discount", invoice.discountAmount],
    ["Total", invoice.totalAmount],
    ["Commission", invoice.commissionAmount],
    ["Partner earning", invoice.professionalEarning],
  ];

  return (
    <Modal title={`Invoice ${invoice.invoiceNumber}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Client:</span>{" "}
            <span className="font-medium text-foreground">{clientName(invoice)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Service:</span>{" "}
            {invoice.booking?.service?.name ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">City:</span>{" "}
            {invoice.booking?.serviceCity ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Booking date:</span>{" "}
            {fmtDate(invoice.booking?.bookingDate)}
          </div>
          <div>
            <span className="text-muted-foreground">Payment method:</span>{" "}
            {invoice.paymentMethod ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Transaction:</span>{" "}
            {invoice.transactionId ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span> {fmtDate(invoice.createdAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Paid at:</span> {fmtDate(invoice.paidAt)}
          </div>
        </div>

        <Card className="divide-y divide-border">
          {money.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className={label === "Total" ? "font-medium text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
              <span className={label === "Total" ? "font-semibold text-foreground" : "text-foreground"}>
                {inr(value)}
              </span>
            </div>
          ))}
        </Card>

        {canManage && (
          <div className="flex items-end gap-3">
            <Field label="Payment status">
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceRow["paymentStatus"])}
              >
                {["PENDING", "PAID", "FAILED", "REFUNDED"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Btn
              busy={save.isPending}
              disabled={status === invoice.paymentStatus}
              onClick={() => save.mutate()}
            >
              Update status
            </Btn>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------- Revenue -------------------------------- */

function BarRow({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full min-w-24 rounded-full bg-muted-foreground/10">
      <div
        className="h-2 rounded-full bg-primary"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function RevenueTab({
  monthlyFromSummary,
}: {
  monthlyFromSummary?: { month: string; amount: number; count: number }[];
}) {
  const [by, setBy] = useState<"restaurant" | "city" | "month">("restaurant");

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.revenue(by),
    queryFn: () => crmFinanceApi.revenue(by),
  });

  const rows = data?.rows ?? [];
  const value = (r: (typeof rows)[number]) => r.revenue ?? r.amount ?? 0;
  const max = Math.max(1, ...rows.map(value));

  const head =
    by === "month"
      ? ["Month", "Invoices", "Collections", "Share"]
      : by === "city"
        ? ["City", "Bookings", "Revenue", "Share"]
        : ["Restaurant / client", "Bookings", "Revenue", "Share"];

  return (
    <div className="space-y-4">
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      <Tabs
        tabs={[
          { key: "restaurant", label: "By restaurant" },
          { key: "city", label: "By city" },
          { key: "month", label: "Monthly collections" },
        ]}
        active={by}
        onChange={(key) => setBy(key as typeof by)}
      />
      <Card>
        <TableShell head={head}>
          {isLoading && <EmptyRow cols={4} label="Crunching revenue…" />}
          {!isLoading && !rows.length && <EmptyRow cols={4} label="No revenue recorded yet." />}
          {rows.map((r, i) => (
            <tr key={i} className="text-foreground">
              <td className="px-4 py-3 font-medium">
                {by === "month" ? r.month : by === "city" ? (r.city ?? "—") : (r.name ?? "—")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.bookings ?? r.count ?? 0}</td>
              <td className="px-4 py-3 font-medium">{inr(value(r))}</td>
              <td className="px-4 py-3">
                <BarRow pct={(value(r) / max) * 100} />
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
      {by === "month" && monthlyFromSummary && (
        <p className="text-xs text-muted-foreground">
          Monthly collections count PAID invoices by their payment date (IST months).
        </p>
      )}
    </div>
  );
}
