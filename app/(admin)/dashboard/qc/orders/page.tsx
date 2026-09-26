"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qcApi, type QcAdminOrder, type QcOrderStatus } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";

const TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "PLACED", label: "Placed" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "PICKED_UP", label: "Picked up" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STATUS_META: Record<QcOrderStatus, { text: string; cls: string }> = {
  PLACED: { text: "Placed", cls: "bg-warning/10 text-warning" },
  ACCEPTED: { text: "Accepted", cls: "bg-primary/10 text-primary" },
  PICKED_UP: { text: "Picked up", cls: "bg-primary/10 text-primary" },
  DELIVERED: { text: "Delivered", cls: "bg-success/10 text-success" },
  CANCELLED: { text: "Cancelled", cls: "bg-danger/10 text-danger" },
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const istDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : "—";

/** All quick-commerce orders, with the store KPI row on top. */
export default function QcOrdersPage() {
  const [tab, setTab] = useState("");

  const { data: stats } = useQuery({ queryKey: ["qc-stats"], queryFn: qcApi.adminStats });
  const { data: orders, isLoading } = useQuery({
    queryKey: ["qc-orders", tab],
    queryFn: () => qcApi.adminOrders(tab || undefined),
    placeholderData: keepPreviousData,
  });

  const kpis = stats
    ? [
        { label: "Total Orders", value: stats.orders },
        { label: "Revenue (delivered)", value: inr(stats.revenue) },
        { label: "Active Vendors", value: stats.vendors },
        { label: "Live Products", value: stats.products },
        { label: "Awaiting Pickup", value: stats.pendingOrders },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">QC Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every quick-commerce order across all vendors.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading && !orders ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  {["Order", "Customer", "Items", "Total", "Payment", "Delivery Partner", "Status", "Placed", "Delivered", "Address"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o: QcAdminOrder) => (
                  <tr key={o.qcOrderId} className="border-t border-border align-top hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">#QC-{o.qcOrderId}</td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{o.customer?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{o.customer?.mobile ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.items.map((i) => (
                        <div key={`${o.qcOrderId}-${i.name}`}>
                          {i.quantity} × {i.name}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {inr(o.total)}
                      <div className="text-[11px] font-normal text-muted-foreground">
                        incl. {inr(o.deliveryFee)} delivery
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.paymentMode}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.partner?.user?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[o.status].cls}`}>
                        {STATUS_META[o.status].text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{istDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{istDateTime(o.deliveredAt)}</td>
                    <td className="max-w-56 truncate px-4 py-3 text-muted-foreground" title={o.address}>
                      {o.address}
                      {o.city ? `, ${o.city}` : ""}
                    </td>
                  </tr>
                ))}
                {!orders?.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                      No orders in this state.
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
