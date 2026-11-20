"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  taxInvoicesApi,
  queryKeys,
  type CreateTaxInvoiceBody,
  type TaxInvoiceLine,
  type TaxInvoiceRow,
} from "@/src/api/api";
import { ApiError, API_BASE_URL } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

const rupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** The three lines the company always bills; a fresh form starts from them. */
const DEFAULT_LINES: TaxInvoiceLine[] = [
  { particulars: "Partner Commission", amount: 0, taxable: false },
  { particulars: "Company Service Charges", amount: 0, taxable: true },
  { particulars: "Platform Fee", amount: 0, taxable: false },
];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  buyerName: "",
  buyerAddress: "",
  buyerGstin: "",
  buyerStateName: "Delhi",
  buyerStateCode: "07",
  gstPercent: 18,
  notes: "",
};

export default function TaxInvoicesPage() {
  const canManage = hasPermission("invoices.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<TaxInvoiceLine[]>(DEFAULT_LINES);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.taxInvoices(search),
    queryFn: () => taxInvoicesApi.list(search || undefined),
  });

  // GST preview, the same maths the server runs: tax on the taxable lines
  // only, split CGST+SGST within the company's state, IGST outside it.
  const lineTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const taxable = lines
    .filter((l) => l.taxable)
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const tax = Math.round(taxable * (Number(form.gstPercent) || 0)) / 100;
  const intraState = form.buyerStateCode.trim() === "07";
  const grandTotal = Math.round((lineTotal + tax) * 100) / 100;

  const openInvoice = async (id: number) => {
    try {
      const { path } = await taxInvoicesApi.link(id);
      window.open(`${API_BASE_URL}/v1${path}`, "_blank", "noopener,noreferrer");
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "Could not open the invoice.");
    }
  };

  const create = useMutation({
    mutationFn: (body: CreateTaxInvoiceBody) => taxInvoicesApi.create(body),
    onSuccess: (created) => {
      setNotice(`Invoice ${created.invoiceNo} created.`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setLines(DEFAULT_LINES);
      queryClient.invalidateQueries({ queryKey: ["tax-invoices"] });
      void openInvoice(created.taxInvoiceId);
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not create the invoice."),
  });

  const submit = () => {
    const kept = lines.filter((l) => l.particulars.trim() && Number(l.amount) > 0);
    if (!form.buyerName.trim() || !form.buyerAddress.trim()) {
      setNotice("Fill in the buyer's name and address.");
      return;
    }
    if (kept.length === 0) {
      setNotice("Add at least one line with an amount.");
      return;
    }
    create.mutate({
      date: form.date,
      buyerName: form.buyerName.trim(),
      buyerAddress: form.buyerAddress.trim(),
      buyerGstin: form.buyerGstin.trim() || undefined,
      buyerStateName: form.buyerStateName.trim(),
      buyerStateCode: form.buyerStateCode.trim(),
      gstPercent: Number(form.gstPercent) || 18,
      notes: form.notes.trim() || undefined,
      lines: kept.map((l) => ({ ...l, amount: Number(l.amount) })),
    });
  };

  const setLine = (i: number, patch: Partial<TaxInvoiceLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
  const label = "text-xs font-medium text-muted-foreground";

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Tax Invoices</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The GST tax invoices issued to client venues, in the company&rsquo;s Tally format.
            Numbers continue per financial year; the letterhead and bank details are edited on the
            Configure page.
          </p>
        </div>
        {canManage ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {showForm ? "Close" : "New invoice"}
          </button>
        ) : null}
      </div>

      {notice ? (
        <div
          className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm text-foreground"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      {showForm && canManage ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={label}>Invoice date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>GST %</label>
              <input
                type="number"
                value={form.gstPercent}
                onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Buyer state name</label>
              <input
                value={form.buyerStateName}
                onChange={(e) => setForm({ ...form, buyerStateName: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Buyer state code</label>
              <input
                value={form.buyerStateCode}
                onChange={(e) => setForm({ ...form, buyerStateCode: e.target.value })}
                className={field}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Buyer name (Bill to)</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                placeholder="NOD: Rhythm Atelier"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Buyer GSTIN (optional)</label>
              <input
                value={form.buyerGstin}
                onChange={(e) => setForm({ ...form, buyerGstin: e.target.value })}
                className={field}
              />
            </div>
          </div>
          <div>
            <label className={label}>Buyer address (the ship-to block repeats it)</label>
            <textarea
              value={form.buyerAddress}
              onChange={(e) => setForm({ ...form, buyerAddress: e.target.value })}
              rows={3}
              className={field}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Particulars</p>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input
                  value={l.particulars}
                  onChange={(e) => setLine(i, { particulars: e.target.value })}
                  placeholder="Particulars"
                  className={`${field} col-span-5`}
                />
                <input
                  value={l.hsn ?? ""}
                  onChange={(e) => setLine(i, { hsn: e.target.value })}
                  placeholder="HSN/SAC"
                  className={`${field} col-span-2`}
                />
                <input
                  type="number"
                  value={l.amount || ""}
                  onChange={(e) => setLine(i, { amount: Number(e.target.value) })}
                  placeholder="Amount"
                  className={`${field} col-span-2 text-right`}
                />
                <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={l.taxable}
                    onChange={(e) => setLine(i, { taxable: e.target.checked })}
                  />
                  GST applies
                </label>
                <button
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  className="col-span-1 text-xs text-danger"
                  aria-label={`Remove line ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setLines((prev) => [...prev, { particulars: "", amount: 0, taxable: false }])
              }
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Add line
            </button>
          </div>

          <div>
            <label className={label}>Notes (printed under the tax amount, optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={field}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Taxable {rupees(taxable)} · {intraState ? "CGST + SGST" : "IGST"} {rupees(tax)} ·{" "}
              <span className="font-semibold text-foreground">Total {rupees(grandTotal)}</span>
            </p>
            <button
              onClick={submit}
              disabled={create.isPending}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? "Creating…" : "Create & open"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice number or buyer…"
          className={`${field} max-w-sm`}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn&rsquo;t load invoices.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-center">
            <p className="text-muted-foreground">
              {search ? "Nothing matches this search." : "No invoices yet. Create the first one."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Invoice No.</th>
                  <th className="px-5 py-3 font-medium">Dated</th>
                  <th className="px-5 py-3 font-medium">Buyer</th>
                  <th className="px-5 py-3 text-right font-medium">Taxable</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: TaxInvoiceRow) => (
                  <tr
                    key={r.taxInvoiceId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-foreground">{r.invoiceNo}</td>
                    <td className="px-5 py-3 text-muted-foreground">{when(r.date)}</td>
                    <td className="px-5 py-3 text-foreground">{r.buyerName}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {rupees(r.taxableValue)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">
                      {rupees(r.total)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => void openInvoice(r.taxInvoiceId)}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                      >
                        Open / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
