"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersApi, queryKeys, type CustomerDetail } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { getStoredUser, hasPermission } from "@/src/lib/auth";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { SpinnerIcon } from "@/src/components/icons";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const statusStyles: Record<string, string> = {
  Completed: "bg-success/10 text-success",
  Pending: "bg-warning/10 text-warning",
  Cancelled: "bg-danger/10 text-danger",
};

const couponStatusStyles: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success",
  USED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-danger/10 text-danger",
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = Number(params?.id);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.customer(userId),
    queryFn: () => customersApi.get(userId),
    enabled: Number.isFinite(userId),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Go back the way we came. This used to be a fixed link to
          /dashboard/customers, so anyone arriving from CRM → Customers was
          dropped on a different list that has no coupon action and no sidebar
          entry — making the coupon option look like it had disappeared. */}
      <button
        type="button"
        onClick={() =>
          window.history.length > 1 ? router.back() : router.push("/dashboard/crm/customers")
        }
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Back to Customers
      </button>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError || !data ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
          <p className="text-muted-foreground">Couldn’t load this customer.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : (
        <CustomerView customer={data} />
      )}
    </div>
  );
}

function CustomerView({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Permission reads hit localStorage — resolve after mount to avoid SSR/CSR skew.
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    setCanManage(hasPermission("customers.update"));
    const role = getStoredUser()?.role;
    setCanDelete(role === "ADMIN" || role === "SUPER_ADMIN");
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.customer(customer.userId) });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  const blockMutation = useMutation({
    mutationFn: (isBlocked: boolean) => customersApi.setBlocked(customer.userId, isBlocked),
    onSuccess: (res) => {
      setError(null);
      setNotice(res.message);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.remove(customer.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.replace("/dashboard/customers");
    },
    onError: (e) => {
      setConfirmDelete(false);
      setError(e instanceof ApiError ? e.message : "Could not delete customer.");
    },
  });

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <Avatar customer={customer} />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            {customer.name}
            {customer.isBlocked && (
              <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-danger">
                Blocked
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.restaurantName ? `${customer.restaurantName} · ` : ""}Joined{" "}
            {new Date(customer.joinedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                customer.isBlocked ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {customer.isBlocked ? "Blocked" : "Active"}
            </span>
            <button
              role="switch"
              aria-checked={customer.isBlocked}
              disabled={blockMutation.isPending}
              onClick={() => blockMutation.mutate(!customer.isBlocked)}
              title={customer.isBlocked ? "Unblock customer" : "Block customer"}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                customer.isBlocked ? "bg-danger" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  customer.isBlocked ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {notice ? (
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total bookings" value={String(customer.stats.totalBookings)} />
        <Stat label="Completed" value={String(customer.stats.completed)} />
        <Stat label="Cancelled" value={String(customer.stats.cancelled)} />
        <Stat label="Total spent" value={inr(customer.stats.totalSpent)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Profile</h2>
          <Info label="Email" value={customer.email ?? "—"} />
          <Info label="Mobile" value={customer.mobile ?? "—"} />
          <Info
            label="Date of birth"
            value={
              customer.dob
                ? new Date(customer.dob).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <Info label="Restaurant" value={customer.restaurantName ?? "—"} />
          <Info label="GST number" value={customer.gstNumber ?? "—"} />
        </div>

        {/* Addresses */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            Addresses{" "}
            <span className="font-normal text-muted-foreground">({customer.addresses.length})</span>
          </h2>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses.</p>
          ) : (
            <div className="space-y-3">
              {customer.addresses.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{a.label || "Address"}</span>
                    {a.isDefault && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.address}, {a.city}
                    {a.state ? `, ${a.state}` : ""} {a.zipCode}
                    {a.country ? `, ${a.country}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coupons */}
      <CouponsCard userId={customer.userId} />

      {/* Bookings */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Recent bookings{" "}
            <span className="font-normal text-muted-foreground">
              (showing {customer.bookings.length})
            </span>
          </h2>
        </div>
        {customer.bookings.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No bookings yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.bookings.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">{b.id}</td>
                    <td className="px-5 py-3 text-foreground">
                      {b.service}
                      {b.variant ? (
                        <span className="block text-xs text-muted-foreground">{b.variant}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{inr(b.amount)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{b.paymentMode}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[b.status]}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{b.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger zone */}
      {canDelete && (
        <div className="space-y-3 rounded-2xl border border-danger/30 bg-card p-5">
          <h2 className="text-base font-semibold text-danger">Danger zone</h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete this customer and erase all their data. This cannot be undone.
          </p>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Delete customer permanently
          </button>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          danger
          title="Permanently delete this customer?"
          confirmLabel="Delete everything"
          busy={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          message={
            <>
              This will permanently delete{" "}
              <strong className="text-foreground">{customer.name}</strong> and erase{" "}
              <strong className="text-foreground">all associated data</strong> — bookings, coupons,
              addresses and ratings. This action is irreversible.
            </>
          }
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// 🎟️ Lists a customer's coupons and lets an admin grant more one-time 50%-off
// coupons (each granted coupon is single-use and never reusable).
function CouponsCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(5);

  const { data: coupons, isLoading } = useQuery({
    queryKey: queryKeys.customerCoupons(userId),
    queryFn: () => customersApi.coupons(userId),
    enabled: Number.isFinite(userId),
  });

  const grant = useMutation({
    mutationFn: (n: number) => customersApi.grantCoupons(userId, n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerCoupons(userId) });
    },
  });

  const activeCount = coupons?.filter((c) => c.status === "ACTIVE").length ?? 0;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Coupons{" "}
          <span className="font-normal text-muted-foreground">
            ({activeCount} active{coupons ? ` · ${coupons.length} total` : ""})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-16 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            aria-label="Number of coupons to grant"
          />
          <button
            onClick={() => grant.mutate(count)}
            disabled={grant.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {grant.isPending ? "Granting…" : `Grant ${count} × 50% off`}
          </button>
        </div>
      </div>

      {grant.isError ? (
        <p className="text-sm text-danger">Couldn’t grant coupons. Please try again.</p>
      ) : null}
      {grant.isSuccess ? (
        <p className="text-sm text-success">Granted {grant.data?.issued ?? count} coupon(s).</p>
      ) : null}

      {isLoading ? (
        <div className="flex h-20 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-5 w-5" />
        </div>
      ) : !coupons || coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {coupons.map((c) => (
            <div
              key={c.couponId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-foreground">{c.code}</p>
                <p className="text-xs text-muted-foreground">
                  {c.discountPercent}% off · {c.source === "ADMIN" ? "Admin grant" : "Signup"} · exp{" "}
                  {new Date(c.expiresAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${couponStatusStyles[c.status]}`}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function Avatar({ customer }: { customer: CustomerDetail }) {
  if (customer.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external customer image
      <img
        src={customer.profileImage}
        alt={customer.name}
        className="h-14 w-14 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-base font-semibold text-white">
      {initials || "?"}
    </div>
  );
}
