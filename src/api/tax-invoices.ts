import { apiClient } from "./apiClient";

/**
 * Admin → Tax Invoices: the Tally-format B2B GST invoices. Composed here,
 * numbered per financial year on the server, opened for print through a
 * signed short-lived link.
 */

export interface TaxInvoiceLine {
  particulars: string;
  hsn?: string | null;
  quantity?: number | null;
  rate?: number | null;
  per?: string | null;
  amount: number;
  /** GST applies to this line (the company's own supply). */
  taxable: boolean;
}

export interface TaxInvoiceRow {
  taxInvoiceId: number;
  invoiceNo: string;
  date: string;
  buyerName: string;
  taxableValue: number;
  total: number;
  createdAt: string;
}

export interface CreateTaxInvoiceBody {
  date: string;
  buyerName: string;
  buyerAddress: string;
  buyerGstin?: string;
  buyerStateName: string;
  buyerStateCode: string;
  consigneeName?: string;
  consigneeAddress?: string;
  lines: TaxInvoiceLine[];
  gstPercent?: number;
  /** Seed the per-FY sequence to continue the Tally counter. */
  seq?: number;
  notes?: string;
}

export const taxInvoicesApi = {
  list: (search?: string) =>
    apiClient.get<TaxInvoiceRow[]>(
      `/v1/admin/tax-invoices${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  create: (body: CreateTaxInvoiceBody) =>
    apiClient.post<TaxInvoiceRow>(`/v1/admin/tax-invoices`, body),
  /** Signed short-lived link; open `path` against the API base. */
  link: (id: number) =>
    apiClient.get<{ token: string; expiresAt: string; path: string }>(
      `/v1/admin/tax-invoices/${id}/link`,
    ),
};
