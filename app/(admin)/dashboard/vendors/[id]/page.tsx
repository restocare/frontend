"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  serviceApi,
  vendorApi,
  type CatalogService,
  type ImportResult,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { VendorForm } from "@/src/components/dashboard/vendor-form";
import { ServiceForm } from "@/src/components/dashboard/service-form";
import { VariantsModal } from "@/src/components/dashboard/variants-modal";
import {
  BagIcon,
  ChartIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  StoreIcon,
  TrashIcon,
} from "@/src/components/icons";

type Tab = "catalog" | "categories";

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const vendorId = Number(params.id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("catalog");
  const [search, setSearchState] = useState("");
  const [page, setPage] = useState(1);
  // Rows per page — the admin picks; 10 keeps big catalogs scannable.
  const [pageSize, setPageSizeState] = useState(10);

  // A new search or page size starts from the first page — page 3 of the old
  // results would often not exist under the new filter.
  const setSearch = (v: string) => {
    setSearchState(v);
    setPage(1);
  };
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
  };
  const [editVendor, setEditVendor] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<CatalogService | null>(null);
  const [variantsService, setVariantsService] = useState<CatalogService | null>(null);
  const [importMsg, setImportMsg] = useState<ImportResult | string | null>(null);

  const vendorQuery = useQuery({
    queryKey: queryKeys.vendor(vendorId),
    queryFn: () => vendorApi.get(vendorId),
    enabled: Number.isFinite(vendorId),
  });

  // Server-side pagination — the backend's silent 50-row default used to hide
  // everything past the first 50 services of large vendors.
  const serviceParams = { vendorId, search: search.trim() || undefined, page, limit: pageSize };
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(serviceParams),
    queryFn: () => serviceApi.list(serviceParams),
    enabled: Number.isFinite(vendorId),
    placeholderData: keepPreviousData,
  });

  // The Categories tab groups the ENTIRE catalog by category, so it needs the
  // full list — a single page of it would group incompletely. Fetched only when
  // that tab is open.
  const allServicesParams = { vendorId, limit: 1000 };
  const allServicesQuery = useQuery({
    queryKey: queryKeys.services(allServicesParams),
    queryFn: () => serviceApi.list(allServicesParams),
    enabled: Number.isFinite(vendorId) && tab === "categories",
  });

  const deleteService = useMutation({
    mutationFn: (id: number) => serviceApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    },
  });

  const blockVendor = useMutation({
    mutationFn: () =>
      vendorApi.update(vendorId, {
        status: vendor?.status === "BLOCKED" ? "ACTIVE" : "BLOCKED",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => serviceApi.import(file, { vendorId }),
    onSuccess: (result) => {
      setImportMsg(result);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
    },
    onError: (err) => setImportMsg(err instanceof ApiError ? err.message : "Import failed"),
  });

  const vendor = vendorQuery.data;
  const stats = servicesQuery.data?.stats;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportMsg(null);
      importMutation.mutate(file);
    }
    e.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    const blob = await serviceApi.downloadTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "services-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceFormOpen(true);
  };
  const openEditService = (s: CatalogService) => {
    setEditingService(s);
    setServiceFormOpen(true);
  };

  if (vendorQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-7 w-7" />
      </div>
    );
  }

  if (vendorQuery.isError || !vendor) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">Vendor not found.</p>
        <Link
          href="/dashboard/vendors"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to vendors
        </Link>
      </div>
    );
  }

  const services = servicesQuery.data?.services ?? [];
  const pagination = servicesQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const shownFrom = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const shownTo = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/vendors" className="hover:text-foreground">
          Vendors
        </Link>
        <span>/</span>
        <span className="text-foreground">{vendor.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
            {vendor.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{vendor.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  vendor.isOpen ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                {vendor.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            {vendor.address && (
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{vendor.address}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {vendor.category && (
                <span className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
                  {vendor.category.name}
                </span>
              )}
              <span className="text-muted-foreground">
                Commission {vendor.commissionPercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditVendor(true)}
            className="rounded-lg bg-success/90 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Edit
          </button>
          <button
            onClick={() => blockVendor.mutate()}
            disabled={blockVendor.isPending}
            className="rounded-lg bg-danger/90 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {vendor.status === "BLOCKED" ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Total Services" value={stats?.totalServices} />
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Published" value={stats?.publishedServices} />
        <ProfileStat icon={<ChartIcon className="h-5 w-5" />} label="Featured" value={stats?.featuredServices} />
        <ProfileStat icon={<StoreIcon className="h-5 w-5" />} label="New" value={stats?.newServices} />
        <ProfileStat
          icon={<StoreIcon className="h-5 w-5" />}
          label="Category"
          textValue={vendor.category?.name ?? "—"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabButton active={tab === "catalog"} onClick={() => setTab("catalog")}>
          Catalog
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Categories &amp; Add-Ons
        </TabButton>
      </div>

      {tab === "catalog" ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {/* Catalog toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">Catalog</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search services"
                  className="w-48 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              >
                {importMutation.isPending ? (
                  <SpinnerIcon className="h-4 w-4" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                Import Excel
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={openCreateService}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <PlusIcon className="h-4 w-4" />
                Add Service
              </button>
            </div>
          </div>

          {/* Import result banner */}
          {importMsg && (
            <div
              className={`rounded-lg border px-4 py-2.5 text-sm ${
                typeof importMsg === "string"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-success/30 bg-success/10 text-success"
              }`}
            >
              {typeof importMsg === "string" ? (
                importMsg
              ) : (
                <>
                  {importMsg.message}
                  {importMsg.errors.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-danger">
                      {importMsg.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* Catalog table */}
          {servicesQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <SpinnerIcon className="h-6 w-6" />
            </div>
          ) : services.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <BagIcon className="h-9 w-9 text-muted-foreground" />
              <p className="text-muted-foreground">No services yet.</p>
              <button
                onClick={openCreateService}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Add first service
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Featured</th>
                    <th className="px-4 py-3 font-medium">Add-ons</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.serviceId} className="border-t border-border hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">
                        {s.basePrice != null ? s.basePrice.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            s.isActive
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.isActive ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{s.isFeatured ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setVariantsService(s)}
                          className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:underline"
                        >
                          {s.variantsCount ?? 0} add-ons
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditService(s)}
                            aria-label="Edit service"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete service "${s.name}"?`))
                                deleteService.mutate(s.serviceId);
                            }}
                            aria-label="Delete service"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pager — server-side, with an admin-chosen page size. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {shownFrom}–{shownTo} of {pagination?.total ?? services.length}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Services per page"
                    className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
                  >
                    {[10, 20, 30, 40, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    Page {pagination?.page ?? page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || servicesQuery.isFetching}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || servicesQuery.isFetching}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <CategoriesTab
          services={allServicesQuery.data?.services ?? []}
          onManageAddOns={setVariantsService}
        />
      )}

      {editVendor && (
        <VendorForm vendor={vendor} onClose={() => setEditVendor(false)} />
      )}
      {serviceFormOpen && (
        <ServiceForm
          vendorId={vendorId}
          defaultCategoryId={vendor.categoryId}
          service={editingService}
          onClose={() => setServiceFormOpen(false)}
        />
      )}
      {variantsService && (
        <VariantsModal service={variantsService} onClose={() => setVariantsService(null)} />
      )}
    </div>
  );
}

function CategoriesTab({
  services,
  onManageAddOns,
}: {
  services: CatalogService[];
  onManageAddOns: (s: CatalogService) => void;
}) {
  // Group services by category name.
  const groups = new Map<string, CatalogService[]>();
  for (const s of services) {
    const key = s.category?.name ?? "Uncategorized";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const entries = [...groups.entries()];

  if (entries.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
        No categories yet — add a service first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([category, items]) => (
        <div key={category} className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{category}</h3>
            <span className="text-sm text-muted-foreground">{items.length} services</span>
          </div>
          <div className="divide-y divide-border">
            {items.map((s) => (
              <div key={s.serviceId} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.variantsCount ?? 0} add-ons ·{" "}
                    {s.basePrice != null ? `₹${s.basePrice}` : "no price"}
                  </p>
                </div>
                <button
                  onClick={() => onManageAddOns(s)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Manage add-ons
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileStat({
  icon,
  label,
  value,
  textValue,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  textValue?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
        {icon}
      </div>
      <p className="text-xl font-semibold tracking-tight text-foreground">
        {textValue ?? value ?? "—"}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
