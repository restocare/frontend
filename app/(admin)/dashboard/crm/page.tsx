"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { crmApi, crmQueryKeys } from "@/src/api/api";
import { Card, PageHeader } from "@/src/components/crm/ui";
import {
  BagIcon,
  BriefcaseIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  MailIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
} from "@/src/components/icons";
import { getPermissions, getStoredUser } from "@/src/lib/auth";

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function CrmOverviewPage() {
  const { data } = useQuery({ queryKey: crmQueryKeys.summary, queryFn: crmApi.summary });
  const user = getStoredUser();
  const perms = getPermissions();
  const can = (p: string) => perms.includes("*") || perms.includes(p);

  // Business overview (spec dashboard grid).
  const overview = [
    { label: "Active restaurants", value: data?.activeRestaurants, icon: StoreIcon, href: "/dashboard/crm/restaurants", show: can("restaurants.view") },
    { label: "New leads", value: data?.newLeads, icon: TagIcon, href: "/dashboard/crm/sales-leads", show: can("sales-leads.view") },
    { label: "Active workforce", value: data?.activeWorkforce, icon: UsersIcon, href: "/dashboard/crm/partners", show: can("partners.view") },
    { label: "Open orders", value: data?.openOrders, icon: BagIcon, href: "/dashboard/crm/bookings", show: can("bookings.view") },
    { label: "Monthly revenue", value: inr(data?.monthlyRevenue), icon: WalletIcon, href: "/dashboard/crm/finance", show: can("finance.view") },
    { label: "Pending payments", value: inr(data?.pendingPayments), icon: WalletIcon, href: "/dashboard/crm/finance", show: can("finance.view") },
    {
      label: "Customer satisfaction",
      value: data?.customerSatisfaction != null ? `${data.customerSatisfaction} / 5` : "—",
      icon: StarIcon,
      href: "/dashboard/crm/reports",
      show: can("crm-reports.view"),
    },
    {
      label: "Workforce utilization",
      value: data?.workforceUtilizationPct != null ? `${data.workforceUtilizationPct}%` : "—",
      icon: ChartIcon,
      href: "/dashboard/crm/reports",
      show: can("crm-reports.view"),
    },
    { label: "Open tickets", value: data?.openTickets, icon: MailIcon, href: "/dashboard/crm/tickets", show: can("tickets.view") },
    { label: "Due follow-ups", value: data?.dueFollowUps, icon: ClockIcon, href: "/dashboard/crm/sales-leads", show: can("sales-leads.view") },
    { label: "Customers", value: data?.customers, icon: UsersIcon, href: "/dashboard/crm/customers", show: can("customers.view") },
    { label: "Bookings today", value: data?.bookingsToday, icon: BagIcon, href: "/dashboard/crm/bookings", show: can("bookings.view") },
    { label: "Active employees", value: data?.employees, icon: BriefcaseIcon, href: "/dashboard/crm/employees", show: can("employees.view") },
    { label: "Pending leaves", value: data?.pendingLeaves, icon: CalendarIcon, href: "/dashboard/crm/leaves", show: can("leaves.view") },
  ].filter((s) => s.show);

  const quickActions = [
    { label: "Add restaurant", href: "/dashboard/crm/restaurants?new=1", show: can("restaurants.create") },
    { label: "Add sales lead", href: "/dashboard/crm/sales-leads?new=1", show: can("sales-leads.create") },
    { label: "View bookings", href: "/dashboard/crm/bookings", show: can("bookings.view") },
    { label: "Add workforce", href: "/dashboard/crm/employees", show: can("employees.create") },
    { label: "Invoices", href: "/dashboard/crm/finance", show: can("finance.view") },
    { label: "Raise ticket", href: "/dashboard/crm/tickets?new=1", show: can("tickets.create") },
    { label: "New campaign", href: "/dashboard/crm/campaigns?new=1", show: can("campaigns.manage") },
    { label: "Live ops board", href: "/dashboard/crm/operations", show: can("ops.view") },
  ].filter((a) => a.show);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
        subtitle="Business overview — restaurants, sales pipeline, workforce, operations and finance."
      />

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {overview.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="p-5 transition-colors hover:border-primary/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-2 text-3xl font-semibold text-foreground">
                  {s.value ?? "—"}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="p-5 text-sm text-muted-foreground">
        Use <span className="font-medium text-foreground">Attendance</span> to mark your
        geofenced check-in (within your office radius),{" "}
        <span className="font-medium text-foreground">Leaves</span> to apply against your yearly
        allowance, and <span className="font-medium text-foreground">Staff &amp; Roles</span> to
        control what each staff member can access.
      </Card>
    </div>
  );
}
