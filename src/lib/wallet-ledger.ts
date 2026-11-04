/*
 * Partner wallet ledger helpers for the admin panel (accounts view).
 *
 * The backend writes wallet rows with a free-text `description`; accounts needs
 * them grouped by what they are. The prefixes below are the backend's
 * conventions (booking.service.ts, wallet.service.ts) and are matched, never
 * rewritten, so an unrecognised description just shows as "Other".
 *
 * GST on a COD job is debited from the partner wallet because the partner
 * collected it in cash. It is the government's money, not the partner's
 * earning and not the platform's revenue.
 */

export type LedgerKind =
  | "earning"
  | "commission"
  | "lead-fee"
  | "lead-fee-refund"
  | "gst"
  | "coupon"
  | "other";

export interface LedgerKindInfo {
  kind: LedgerKind;
  /** Short badge text. */
  label: string;
  /** One-line explanation for accounts, shown as a tooltip. */
  hint: string | null;
}

const RULES: { test: RegExp; info: LedgerKindInfo }[] = [
  {
    test: /^Earning for booking #/,
    info: {
      kind: "earning",
      label: "Earning",
      hint: "Online job: the service price we collected, credited to the partner.",
    },
  },
  {
    test: /^Commission \(\d+%\) for booking #/,
    info: { kind: "commission", label: "Commission", hint: "Platform commission on the job." },
  },
  {
    test: /^Lead fee refund/,
    info: { kind: "lead-fee-refund", label: "Lead fee refund", hint: "Lead fee returned on cancel or release." },
  },
  {
    test: /^Lead fee for booking #/,
    info: { kind: "lead-fee", label: "Lead fee", hint: "Charged when the partner accepts a lead." },
  },
  {
    test: /^GST collected on booking #/,
    info: {
      kind: "gst",
      label: "GST",
      hint: "COD job: the partner collected this GST in cash. It is held for remittance to the government, not the partner's earning.",
    },
  },
  {
    test: /^Coupon reimbursement for booking #/,
    info: {
      kind: "coupon",
      label: "Coupon",
      hint: "COD job with a coupon: the platform pays the partner the pre-tax discount the customer did not pay.",
    },
  },
];

const OTHER: LedgerKindInfo = { kind: "other", label: "Other", hint: null };

export function classifyLedgerEntry(description: string | null | undefined): LedgerKindInfo {
  const text = description ?? "";
  return RULES.find((r) => r.test.test(text))?.info ?? OTHER;
}

const grouped = (n: number, maxFractionDigits: number) =>
  Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: maxFractionDigits });

/**
 * A wallet balance or net payable for accounts. A negative figure means the
 * partner owes the platform (commission or GST debited past what the wallet
 * held, so there is nothing to pay out), so it reads "Owes ₹X", not "₹-X".
 */
export function rupeesOrOwes(amount: number, maxFractionDigits = 2): string {
  return amount < 0
    ? `Owes ₹${grouped(amount, maxFractionDigits)}`
    : `₹${grouped(amount, maxFractionDigits)}`;
}
