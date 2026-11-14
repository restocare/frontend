"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hrPlanApi, type HrInvoice } from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  PageHeader,
  TableShell,
} from "@/src/components/crm/ui";
import {
  canManage,
  ErrorBox,
  errorText,
  FormModal,
  Loading,
  OrgSelect,
  Pager,
  Select,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { SearchIcon } from "@/src/components/icons";
import {
  formatDayYear,
  formatPaise,
  formatPeriod,
  istDateTime,
  istDayOf,
} from "@/src/lib/hr-format";

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [orgId, setOrgId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState<HrInvoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useDebounced(search);
  const refresh = useRefreshHr();
  const manage = canManage();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "invoices", { status, period, orgId, q, page }],
    queryFn: () =>
      hrPlanApi.invoices({
        status: status || undefined,
        period: period || undefined,
        orgId: orgId || undefined,
        q: q || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  async function download(inv: HrInvoice) {
    setBusyId(inv.invoiceId);
    try {
      const { url } = await hrPlanApi.invoicePdf(inv.invoiceId);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function regenerate(inv: HrInvoice) {
    setBusyId(inv.invoiceId);
    try {
      await hrPlanApi.regeneratePdf(inv.invoiceId);
      await refresh();
      toast.success("PDF drawn again");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Monthly staff-plan invoices (the fee, pro-rated in the first and last month, plus GST). Amounts are fixed once raised."
        action={
          manage ? <Btn onClick={() => setGenerating(true)}>Generate invoices</Btn> : undefined
        }
      />
      <Card>
        <Toolbar>
          <Select value={status} onChange={reset(setStatus)} className="max-w-[10rem]" ariaLabel="Status">
            <option value="">Any status</option>
            <option value="issued">Issued</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="void">Cancelled</option>
          </Select>
          <input
            type="month"
            value={period}
            onChange={(e) => reset(setPeriod)(e.target.value)}
            className={`${inputCls} max-w-[11rem]`}
            aria-label="Month"
          />
          <OrgSelect value={orgId} onChange={reset(setOrgId)} allLabel="All organizations" className="max-w-[14rem]" />
          <div className="relative w-full max-w-[14rem]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="Invoice number or name"
              className={`${inputCls} pl-9`}
            />
          </div>
        </Toolbar>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Invoice", "Restaurant", "Month", "Amount", "Due", "Status", ""]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={7} label="No invoices. Use Generate invoices to raise this month's." />
              )}
              {data?.items.map((i) => {
                const busy = busyId === i.invoiceId;
                return (
                  <tr key={i.invoiceId}>
                    <td className="px-4 py-3 text-xs">{i.number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{i.org.name}</div>
                      <div className="text-xs text-muted-foreground">{i.outlet.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {formatPeriod(i.period)}
                      {i.daysBilled !== null && i.daysInPeriod !== null && i.daysBilled !== i.daysInPeriod && (
                        <div className="text-xs text-muted-foreground">
                          {i.daysBilled} of {i.daysInPeriod} days
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{formatPaise(i.totalPaise)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatPaise(i.amountPaise)} + GST {formatPaise(i.gstPaise)}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatDayYear(i.dueDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={i.effectiveStatus} />
                      {i.paidAt && <div className="mt-1 text-xs text-muted-foreground">{istDateTime(i.paidAt)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1.5">
                        {i.pdfAvailable && (
                          <Btn tone="ghost" small busy={busy} onClick={() => download(i)}>
                            Download
                          </Btn>
                        )}
                        {manage && i.status !== "void" && (
                          <Btn tone="ghost" small disabled={busy} onClick={() => regenerate(i)}>
                            {i.pdfAvailable ? "Redraw PDF" : "Create PDF"}
                          </Btn>
                        )}
                        {manage && (i.status === "issued" || i.status === "overdue") && (
                          <Btn tone="success" small disabled={busy} onClick={() => setPaying(i)}>
                            Mark paid
                          </Btn>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      {generating && (
        <GenerateModal
          onClose={() => setGenerating(false)}
          onDone={(message) => {
            setGenerating(false);
            refresh();
            toast.success(message);
          }}
        />
      )}
      {paying && (
        <MarkPaidModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            refresh();
            toast.success("Marked paid. The owner is told.");
          }}
        />
      )}
    </div>
  );
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [period, setPeriod] = useState(istDayOf().slice(0, 7));
  return (
    <FormModal
      title="Generate invoices"
      submitLabel="Generate"
      onClose={onClose}
      onSubmit={async () => {
        const res = await hrPlanApi.generateInvoices(period);
        onDone(
          res.created === 0
            ? `Nothing new for ${formatPeriod(res.period)}: ${res.existing} already raised.`
            : `${res.created} invoice${res.created === 1 ? "" : "s"} raised for ${formatPeriod(res.period)}.`,
        );
      }}
    >
      <p className="text-sm text-muted-foreground">
        Raises the missing invoices for every contract in force in that month, with a PDF, and tells the
        owners. Invoices that exist are left alone, so running it twice is harmless.
      </p>
      <Field label="Month">
        <input
          type="month"
          value={period}
          max={istDayOf().slice(0, 7)}
          onChange={(e) => setPeriod(e.target.value)}
          required
          className={inputCls}
        />
      </Field>
    </FormModal>
  );
}

function MarkPaidModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: HrInvoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <FormModal
      title={`Mark ${invoice.number ?? "invoice"} paid`}
      submitLabel="Mark paid"
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.markPaid(invoice.invoiceId, note.trim() || undefined);
        onDone();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {invoice.org.name}, {formatPeriod(invoice.period)}: {formatPaise(invoice.totalPaise)} paid outside the
        app (bank transfer, cash).
      </p>
      <Field label="How it was paid (optional)" hint="Kept in the audit log, for example the bank reference.">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="NEFT, UTR 4021" autoFocus />
      </Field>
    </FormModal>
  );
}
