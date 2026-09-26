"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customersApi,
  queryKeys,
  type CreateCustomerInput,
  type CustomerRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { getStoredUser, hasPermission } from "@/src/lib/auth";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UsersIcon,
} from "@/src/components/icons";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomerRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Permission reads hit localStorage, so resolve them after mount to keep the
  // server and client render in sync.
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    setCanManage(hasPermission("customers.update"));
    const role = getStoredUser()?.role;
    setCanDelete(role === "ADMIN" || role === "SUPER_ADMIN");
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.customers(search.trim()),
    queryFn: () => customersApi.list(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const customers = data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const blockMutation = useMutation({
    mutationFn: (c: CustomerRow) => customersApi.setBlocked(c.userId, !c.isBlocked),
    onSuccess: (res) => {
      setError(null);
      setNotice(res.message);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => customersApi.remove(userId),
    onSuccess: (res) => {
      setError(null);
      setNotice(res.message);
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e) => {
      setConfirmDelete(null);
      setError(e instanceof ApiError ? e.message : "Could not delete customer.");
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who has signed up on the platform.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setError(null);
              setNotice(null);
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Add customer
          </button>
        )}
      </div>

      {notice ? (
        <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      ) : null}

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, email or restaurant"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load customers.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No customers match your search." : "No customers yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Mobile</th>
                  <th className="px-5 py-3 font-medium">Restaurant</th>
                  <th className="px-5 py-3 font-medium">Bookings</th>
                  <th className="px-5 py-3 font-medium">Addresses</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  {(canManage || canDelete) && (
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {customers.map((c: CustomerRow) => (
                  <tr
                    key={c.userId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/customers/${c.userId}`}
                        className="group flex items-center gap-3"
                      >
                        <CustomerAvatar customer={c} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium text-foreground group-hover:text-primary group-hover:underline">
                            {c.name}
                            {c.isBlocked && (
                              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger no-underline">
                                Blocked
                              </span>
                            )}
                          </p>
                          {c.email && (
                            <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.mobile ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.restaurantName ?? "—"}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{c.bookingsCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.addressCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(c.joinedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    {(canManage || canDelete) && (
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canManage && (
                            <button
                              onClick={() => blockMutation.mutate(c)}
                              disabled={
                                blockMutation.isPending && blockMutation.variables?.userId === c.userId
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                                c.isBlocked
                                  ? "border-success/40 text-success hover:bg-success/10"
                                  : "border-danger/40 text-danger hover:bg-danger/10"
                              }`}
                            >
                              {c.isBlocked ? "Unblock" : "Block"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDelete(c)}
                              title="Delete customer"
                              className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:border-danger/40 hover:text-danger"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onCreated={(name) => {
            setShowAdd(false);
            setError(null);
            setNotice(`Customer “${name}” created.`);
            invalidate();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          danger
          title="Permanently delete this customer?"
          confirmLabel="Delete everything"
          busy={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.userId)}
          message={
            <>
              This will permanently delete{" "}
              <strong className="text-foreground">{confirmDelete.name}</strong> and erase{" "}
              <strong className="text-foreground">all associated data</strong> — bookings, coupons,
              addresses and ratings. This action is irreversible.
            </>
          }
        />
      )}
    </div>
  );
}

// ➕ Modal form to create a customer. Mobile is required (it powers the OTP
// login); everything else is optional.
function AddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [form, setForm] = useState<CreateCustomerInput>({
    name: "",
    mobile: "",
    email: "",
    restaurantName: "",
    gstNumber: "",
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (body: CreateCustomerInput) => customersApi.create(body),
    onSuccess: (row) => onCreated(row.name),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not create customer."),
  });

  const set = (key: keyof CreateCustomerInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    const mobile = form.mobile.replace(/\D/g, "");
    if (!name) return setError("Name is required.");
    if (!/^\d{10}$/.test(mobile)) return setError("Enter a valid 10-digit mobile number.");
    createMutation.mutate({
      name,
      mobile,
      email: form.email?.trim() || undefined,
      restaurantName: form.restaurantName?.trim() || undefined,
      gstNumber: form.gstNumber?.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-foreground">Add customer</h3>
        <p className="mt-1 text-sm text-muted-foreground">Create a new customer account.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="Anil Sharma"
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Mobile" required>
            <input
              value={form.mobile}
              onChange={set("mobile")}
              inputMode="numeric"
              placeholder="9876543210"
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              value={form.email}
              onChange={set("email")}
              type="email"
              placeholder="anil@example.com"
              className={inputClass}
            />
          </Field>
          <Field label="Restaurant name">
            <input
              value={form.restaurantName}
              onChange={set("restaurantName")}
              placeholder="Sharma Restaurant"
              className={inputClass}
            />
          </Field>
          <Field label="GST number">
            <input
              value={form.gstNumber}
              onChange={set("gstNumber")}
              placeholder="22AAAAA0000A1Z5"
              className={inputClass}
            />
          </Field>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {createMutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
              Create customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function CustomerAvatar({ customer }: { customer: CustomerRow }) {
  if (customer.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external customer image
      <img
        src={customer.profileImage}
        alt={customer.name}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">
      {initials || "?"}
    </div>
  );
}
