"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, queryKeys, type RecentOrder } from "@/src/api/api";
import { RevenueChart, StatCard, TrafficDonut } from "@/src/components/dashboard/charts";
import { SpinnerIcon } from "@/src/components/icons";

const statusStyles: Record<RecentOrder["status"], string> = {
  Completed: "bg-success/10 text-success",
  Pending: "bg-warning/10 text-warning",
  Cancelled: "bg-danger/10 text-danger",
};

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.dashboardOverview,
    queryFn: dashboardApi.getOverview,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-7 w-7" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted-foreground">Couldn’t load dashboard data.</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back — here’s what’s happening with RestoCare today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={data.revenue} />
        </div>
        <TrafficDonut data={data.traffic} />
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Recent bookings</h3>
          <Link
            href="/dashboard/bookings"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-5 py-3 font-medium text-foreground">{order.id}</td>
                  <td className="px-5 py-3 text-foreground">{order.customer}</td>
                  <td className="px-5 py-3 text-muted-foreground">{order.service}</td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    ₹{order.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
