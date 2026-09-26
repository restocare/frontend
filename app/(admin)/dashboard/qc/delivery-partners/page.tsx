"use client";

import { useQuery } from "@tanstack/react-query";
import { qcApi, type QcDeliveryPartnerRow } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const istDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/**
 * Every partner who delivers for the quick-commerce store: task counts,
 * earnings, live wallet balance and their payout bank details (account
 * numbers arrive masked from the API — the full number never leaves it).
 */
export default function QcDeliveryPartnersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["qc-delivery-partners"],
    queryFn: qcApi.deliveryPartners,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">QC Delivery Partners</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tasks, earnings, wallet and payout details of everyone delivering for the store.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  {["Partner", "Mobile", "City", "Delivered", "Active", "Earnings", "Wallet", "Bank", "Account", "IFSC", "UPI", "Joined"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((p: QcDeliveryPartnerRow) => (
                  <tr key={p.professionalId} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.name ?? "—"}</div>
                      {p.isBlocked && (
                        <span className="text-[11px] font-semibold text-danger">BLOCKED</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.mobile ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.city ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{p.deliveredTasks}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.activeTasks}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{inr(p.earnings)}</td>
                    <td className="px-4 py-3 text-foreground">{inr(p.walletBalance)}</td>
                    <td className="px-4 py-3">
                      {p.bankProvided ? (
                        <span className="text-muted-foreground">{p.bankName ?? "—"}</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                          Not provided
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.accountMasked ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.ifsc ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.upiId ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{istDate(p.joinedAt)}</td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                      No delivery partners yet — they appear after their first accepted order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
