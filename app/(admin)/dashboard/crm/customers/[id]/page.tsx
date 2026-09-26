"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { customersApi, queryKeys, type CustomerDetail } from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
  inputCls,
  statusTone,
} from "@/src/components/crm/ui";
import { SpinnerIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const DETAIL_TABS = [
  { key: "profile", label: "Profile" },
  { key: "coupons", label: "Coupons" },
  { key: "orders", label: "Order history" },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * A customer's full record — the same treatment restaurants get, because in
 * this business they are the same people: the restaurant is the customer.
 *
 * It lives under /dashboard/crm/customers so the layout's routeAllowed() check
 * accepts it as a child of that sidebar leaf. The older page at
 * /dashboard/customers/:id sits under no leaf at all, so every role except
 * super admin was redirected away from it.
 */
export default function CrmCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);
  const [tab, setTab] = useState("profile");

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.customer(userId),
    queryFn: () => customersApi.get(userId),
    enabled: Number.isFinite(userId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Notice kind="error">
        {error instanceof ApiError ? error.message : "Could not load this customer."}
      </Notice>
    );
  }

  const c = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/crm/customers"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to customers
        </Link>
        <PageHeader
          title={c.name?.trim() || `Customer #${c.userId}`}
          subtitle={[c.restaurantName, c.mobile].filter(Boolean).join(" · ") || undefined}
          action={c.isBlocked ? <Badge tone="danger">Blocked</Badge> : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bookings" value={String(c.stats.totalBookings)} />
        <StatCard label="Total spent" value={inr(c.stats.totalSpent)} />
        <StatCard
          label="Completed"
          value={String(c.stats.completed)}
          hint={c.stats.cancelled ? `${c.stats.cancelled} cancelled` : undefined}
        />
        <StatCard label="Joined" value={fmtDate(c.joinedAt)} />
      </div>

      <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />

      {tab === "profile" && <ProfileTab c={c} />}
      {tab === "coupons" && <CouponsTab userId={c.userId} />}
      {tab === "orders" && <OrdersTab c={c} />}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ProfileTab({ c }: { c: CustomerDetail }) {
  return (
    <Card className="p-6">
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Item label="Name">{c.name?.trim() || "—"}</Item>
        <Item label="Contact number">{c.mobile ?? "—"}</Item>
        <Item label="Email">{c.email ?? "—"}</Item>
        <Item label="GST number">{c.gstNumber ?? "—"}</Item>
        <Item label="Restaurant">{c.restaurantName ?? "—"}</Item>
        <Item label="Date of birth">{c.dob ? fmtDate(c.dob) : "—"}</Item>
        <Item label="Status">{c.isBlocked ? "Blocked" : "Active"}</Item>
        <Item label="Joined">{fmtDate(c.joinedAt)}</Item>
      </dl>

      <h3 className="mt-8 border-t border-border pt-6 text-sm font-semibold text-foreground">
        Saved addresses
      </h3>
      {!c.addresses.length ? (
        <p className="mt-3 text-sm text-muted-foreground">No addresses saved yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {c.addresses.map((a) => (
            <li key={a.id} className="rounded-lg bg-accent/40 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                {a.label && <Badge tone="muted">{a.label}</Badge>}
                <span>{a.address}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {[a.city, a.state, a.zipCode].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A customer's coupons, and granting more — needs customers.update to issue. */
function CouponsTab({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(1);
  const canGrant = hasPermission("customers.update");

  const { data: coupons, isLoading } = useQuery({
    queryKey: queryKeys.customerCoupons(userId),
    queryFn: () => customersApi.coupons(userId),
  });

  const grant = useMutation({
    mutationFn: (n: number) => customersApi.grantCoupons(userId, n),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customerCoupons(userId) }),
  });

  const active = coupons?.filter((x) => x.status === "ACTIVE").length ?? 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Coupons</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active} active{coupons ? ` · ${coupons.length} total` : ""} — each is one-time use.
          </p>
        </div>
        {canGrant && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              aria-label="Number of coupons to grant"
              onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              className={`${inputCls} w-20`}
            />
            <Btn busy={grant.isPending} onClick={() => grant.mutate(count)}>
              Grant
            </Btn>
          </div>
        )}
      </div>

      {grant.isError && (
        <div className="mt-4">
          <Notice kind="error">
            {grant.error instanceof ApiError ? grant.error.message : "Could not grant coupons."}
          </Notice>
        </div>
      )}

      <div className="mt-5">
        <TableShell head={["Code", "Discount", "Source", "Expires", "Status"]}>
          {isLoading && <EmptyRow cols={5} label="Loading…" />}
          {!isLoading && !coupons?.length && <EmptyRow cols={5} label="No coupons yet" />}
          {coupons?.map((x) => (
            <tr key={x.couponId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3 font-mono text-foreground">{x.code}</td>
              <td className="px-4 py-3 text-foreground">{x.discountPercent}%</td>
              <td className="px-4 py-3 text-muted-foreground">{x.source}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(x.expiresAt)}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={x.status === "ACTIVE" ? "success" : x.status === "EXPIRED" ? "danger" : "muted"}
                >
                  {x.status}
                </Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </Card>
  );
}

function OrdersTab({ c }: { c: CustomerDetail }) {
  return (
    <Card>
      <TableShell head={["Booking", "Service", "Date", "Amount", "Payment", "Status"]}>
        {!c.bookings.length && <EmptyRow cols={6} label="No bookings yet" />}
        {c.bookings.map((b) => (
          <tr key={b.id} className="transition-colors hover:bg-accent/50">
            <td className="px-4 py-3 text-foreground">#{b.id}</td>
            <td className="px-4 py-3 text-foreground">
              {b.service}
              {b.variant && (
                <span className="block text-xs text-muted-foreground">{b.variant}</span>
              )}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.date)}</td>
            <td className="px-4 py-3 text-foreground">{inr(b.amount)}</td>
            <td className="px-4 py-3 text-muted-foreground">{b.paymentMode}</td>
            <td className="px-4 py-3">
              <Badge tone={statusTone(b.status)}>{b.status}</Badge>
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
