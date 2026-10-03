/**
 * Client-side invoice generation.
 *
 * The backend doesn't expose an invoice document endpoint, so we build a clean,
 * printable invoice from the booking data the app already has and open it in a
 * new window. The user can print it or "Save as PDF" from the print dialog.
 */
import type { BookingRecord } from "@/src/api/api";

export interface InvoiceCustomer {
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
}

const COMPANY = {
  name: "RestoCare",
  legal: "Restroedge Private Limited",
  address: "KD-180 Kohat Enclave, Pitampura, Delhi",
  phone: "+91 99535 32995",
  email: "support@restocare.in",
  gstin: "07AAOCR0865M1ZR",
};

function inr(n: number): string {
  return `₹ ${(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ??
      c,
  );
}

/** Build the standalone HTML document for a booking's invoice. */
export function buildInvoiceHtml(
  booking: BookingRecord,
  customer: InvoiceCustomer,
): string {
  const id = Number(booking.bookingId ?? booking.id) || 0;
  const serviceName = booking.service?.name || booking.serviceName || "Service";
  const variantName = booking.variant?.name || booking.variantName || "";
  const amount = booking.totalAmount || 0;
  const date = booking.bookingDate
    ? new Date(booking.bookingDate).toLocaleDateString("en-GB")
    : booking.createdAt
      ? new Date(booking.createdAt).toLocaleDateString("en-GB")
      : "";
  const payment = booking.paymentMode || "Cash on Delivery";
  const lineLabel = variantName ? `${serviceName} — ${variantName}` : serviceName;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice #${id} — ${esc(COMPANY.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
  .sheet { max-width: 720px; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { font-size: 22px; margin: 0; color: #ea580c; }
  .muted { color: #6b7280; font-size: 13px; }
  .badge { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 700; color: #ea580c; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { text-align: left; padding: 12px 10px; font-size: 14px; }
  thead th { background: #f9fafb; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; border-bottom: 1px solid #e5e7eb; }
  tbody td { border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; }
  .totals { margin-top: 16px; margin-left: auto; width: 260px; }
  .totals .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #1f2937; margin-top: 6px; padding-top: 10px; font-weight: 800; font-size: 16px; }
  .foot { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 12px; color: #6b7280; text-align: center; }
  .grid2 { display: flex; gap: 48px; margin-top: 28px; }
  .grid2 h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; margin: 0 0 6px; }
  .grid2 p { margin: 2px 0; font-size: 13px; }
  @media print { body { padding: 0; } .noprint { display: none; } }
  .btn { display: inline-block; margin-top: 24px; background: #ea580c; color: #fff; border: 0; padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="row">
      <div>
        <h1>${esc(COMPANY.name)}</h1>
        <div class="muted">${esc(COMPANY.legal)}</div>
        <div class="muted">${esc(COMPANY.address)}</div>
        <div class="muted">${esc(COMPANY.phone)} · ${esc(COMPANY.email)}</div>
        <div class="muted">GSTIN: ${esc(COMPANY.gstin)}</div>
      </div>
      <div class="right">
        <div style="font-size:20px;font-weight:800;">INVOICE</div>
        <div class="muted">Invoice No: <b>#${id}</b></div>
        <div class="muted">Date: ${esc(date)}</div>
        <div class="badge">PAID via ${esc(payment)}</div>
      </div>
    </div>

    <div class="grid2">
      <div>
        <h3>Billed To</h3>
        <p><b>${esc(customer.name || "Customer")}</b></p>
        ${customer.mobile ? `<p>${esc(customer.mobile)}</p>` : ""}
        ${customer.email ? `<p>${esc(customer.email)}</p>` : ""}
      </div>
      <div>
        <h3>Service Details</h3>
        <p>Order ID: #${id}</p>
        <p>Status: ${esc(booking.status || "Confirmed")}</p>
        ${booking.startTime ? `<p>Slot: ${esc(booking.startTime)}</p>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Description</th><th class="right">Qty</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(lineLabel)}</td>
          <td class="right">1</td>
          <td class="right">${inr(amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="line"><span>Subtotal</span><span>${inr(amount)}</span></div>
      <div class="line"><span>Taxes</span><span>Included</span></div>
      <div class="line grand"><span>Total</span><span>${inr(amount)}</span></div>
    </div>

    <button class="btn noprint" onclick="window.print()">Print / Save as PDF</button>

    <div class="foot">
      Thank you for choosing ${esc(COMPANY.name)}. This is a computer-generated invoice
      and does not require a signature.
    </div>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;
}

/** Open the invoice for a booking in a new window/tab. */
export function openInvoice(booking: BookingRecord, customer: InvoiceCustomer): void {
  const html = buildInvoiceHtml(booking, customer);
  const win = window.open("", "_blank");
  if (!win) {
    // Popup blocked — fall back to a Blob URL the browser can open directly.
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
