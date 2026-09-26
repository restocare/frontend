"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  vendorApi,
  type Vendor,
  type VendorStatus,
} from "@/src/api/api";
import { VendorForm } from "@/src/components/dashboard/vendor-form";
import {
  BagIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  StoreIcon,
  TrashIcon,
  UsersIcon,
  WalletIcon,
} from "@/src/components/icons";

const TABS: { key: VendorStatus; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "AWAITING_APPROVAL", label: "Awaiting Approval" },
  { key: "BLOCKED", label: "Blocked" },
];

export default function VendorsPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<VendorStatus>("ACTIVE");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const params = { status: tab, search: search.trim() || undefined };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.vendors(params),
    queryFn: () => vendorApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vendorApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (vendor: Vendor) => {
    setEditing(vendor);
    setFormOpen(true);
  };

  const handleDelete = (vendor: Vendor) => {
    if (confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(vendor.vendorId);
    }
  };

  const stats = data?.stats;
  const tabs = data?.tabs;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vendors</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Vendor
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<StoreIcon className="h-5 w-5" />} label="Total vendors" value={stats?.totalVendors} />
        <StatCard icon={<UsersIcon className="h-5 w-5" />} label="Open vendors" value={stats?.openVendors} />
        <StatCard icon={<BagIcon className="h-5 w-5" />} label="Total services" value={stats?.totalServices} />
        <StatCard icon={<WalletIcon className="h-5 w-5" />} label="Active vendors" value={stats?.activeVendors} />
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const count =
              t.key === "ACTIVE"
                ? tabs?.active
                : t.key === "AWAITING_APPROVAL"
                  ? tabs?.awaitingApproval
                  : tabs?.blocked;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative -mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <sup className="ml-1 text-xs">({count ?? 0})</sup>
              </button>
            );
          })}
        </div>

        <div className="relative w-full max-w-xs pb-2">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor name"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load vendors.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : data && data.vendors.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <StoreIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No vendors in this list yet.</p>
            <button
              onClick={openCreate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add your first vendor
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium">Offers</th>
                  <th className="px-5 py-3 font-medium">Can Add Category</th>
                  <th className="px-5 py-3 font-medium">Commission %</th>
                  <th className="px-5 py-3 font-medium">Services</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.vendors.map((vendor) => (
                  <tr
                    key={vendor.vendorId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/vendors/${vendor.vendorId}`}
                        className="flex items-center gap-3 group"
                      >
                        <VendorAvatar vendor={vendor} />
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                            {vendor.name}
                          </p>
                          {vendor.email && (
                            <p className="text-xs text-muted-foreground">{vendor.email}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          vendor.isOpen
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {vendor.isOpen ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td className="max-w-[16rem] truncate px-5 py-3 text-muted-foreground">
                      {vendor.address || "—"}
                    </td>
                    <td className="px-5 py-3">
                      {vendor.offersServices ? (
                        <span className="inline-flex rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                          Services
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {vendor.canAddCategory ? "Yes" : "No"}
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {vendor.commissionPercentage.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {vendor.servicesCount}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(vendor)}
                          aria-label="Edit vendor"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete vendor"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.vendors.length > 0 && (
          <div className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
            Showing {data.vendors.length} of {data.pagination.total} entries
          </div>
        )}
      </div>

      {formOpen && <VendorForm vendor={editing} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {value ?? "—"}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function VendorAvatar({ vendor }: { vendor: Vendor }) {
  if (vendor.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- vendor icons are arbitrary external URLs
      <img
        src={vendor.icon}
        alt={vendor.name}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initials = vendor.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
      {initials}
    </div>
  );
}
