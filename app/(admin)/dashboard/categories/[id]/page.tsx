"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  serviceApi,
  type CatalogService,
  type ImportResult,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { CategoryForm } from "@/src/components/dashboard/category-form";
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

export default function CategoryProfilePage() {
  const params = useParams<{ id: string }>();
  const categoryId = Number(params.id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearchState] = useState("");
  const [page, setPage] = useState(1);
  // Rows per page — the admin picks; 10 keeps big categories scannable.
  // ALL_ROWS asks for everything in one page: a 126-service category capped at
  // 50 a page read as "only 50 services" to the people counting them.
  const ALL_ROWS = 1000;
  const [pageSize, setPageSizeState] = useState(10);
  const [toast, setToast] = useState<string | null>(null);

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

  // Auto-dismiss the toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  const [editCategory, setEditCategory] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<CatalogService | null>(null);
  const [variantsService, setVariantsService] = useState<CatalogService | null>(null);
  const [importMsg, setImportMsg] = useState<ImportResult | string | null>(null);

  // Category header info comes from the tree (top-level categories).
  const treeQuery = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });
  const category = treeQuery.data?.find((c) => c.categoryId === categoryId) ?? null;

  // Server-side pagination — the backend's silent 50-row default used to hide
  // everything past the first 50 services of large categories.
  const serviceParams = { categoryId, search: search.trim() || undefined, page, limit: pageSize };
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(serviceParams),
    queryFn: () => serviceApi.list(serviceParams),
    enabled: Number.isFinite(categoryId),
    placeholderData: keepPreviousData,
  });

  const deleteService = useMutation({
    mutationFn: (id: number) => serviceApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
    },
  });

  // Toggle whether a service is featured — featured services are the ones shown
  // in the landing page's "Popular services" row.
  const toggleFeatured = useMutation({
    mutationFn: (s: CatalogService) =>
      serviceApi.update(s.serviceId, { isFeatured: !s.isFeatured }),
    onSuccess: (_data, s) => {
      setToast(
        s.isFeatured
          ? `"${s.name}" removed from Popular services`
          : `"${s.name}" successfully added to Popular services`,
      );
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
    },
    onError: () => setToast("Couldn't update. Please try again."),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => serviceApi.import(file, { categoryId }),
    onSuccess: (result) => {
      setImportMsg(result);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
    },
    onError: (err) => setImportMsg(err instanceof ApiError ? err.message : "Import failed"),
  });

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

  if (treeQuery.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-7 w-7" />
      </div>
    );
  }

  if (treeQuery.isError || !category) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">Category not found.</p>
        <Link
          href="/dashboard/categories"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to categories
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
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <span className="text-success">✓</span>
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/categories" className="hover:text-foreground">
          Categories
        </Link>
        <span>/</span>
        <span className="text-foreground">{category.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          {category.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- external category image
            <img
              src={category.profileImage}
              alt={category.name}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
              {category.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">{category.name}</h1>
            {category.description && (
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {category.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditCategory(true)}
          className="flex items-center gap-1.5 rounded-lg bg-success/90 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <PencilIcon className="h-4 w-4" />
          Edit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Total Services" value={stats?.totalServices} />
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Published" value={stats?.publishedServices} />
        <ProfileStat icon={<ChartIcon className="h-5 w-5" />} label="Featured" value={stats?.featuredServices} />
        <ProfileStat icon={<StoreIcon className="h-5 w-5" />} label="New" value={stats?.newServices} />
      </div>

      {/* Catalog */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
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
                  <th className="px-4 py-3 font-medium">Variants</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.serviceId} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <ServiceAvatar service={s} />
                        <span>{s.name}</span>
                      </div>
                    </td>
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
                    <td className="px-4 py-3">
                      {(() => {
                        const loading =
                          toggleFeatured.isPending &&
                          toggleFeatured.variables?.serviceId === s.serviceId;
                        return (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={s.isFeatured}
                            aria-busy={loading}
                            disabled={loading}
                            onClick={() => toggleFeatured.mutate(s)}
                            title={
                              s.isFeatured
                                ? "Featured — shown in Popular services"
                                : "Not featured — toggle to show in Popular services"
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-wait ${
                              s.isFeatured ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
                                s.isFeatured ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            >
                              {loading && (
                                <SpinnerIcon className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setVariantsService(s)}
                        className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:underline"
                      >
                        {s.variantsCount ?? 0} variants
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
                  {[10, 20, 50, 100, ALL_ROWS].map((n) => (
                    <option key={n} value={n}>
                      {n === ALL_ROWS ? "All" : `${n} / page`}
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

      {editCategory && (
        <CategoryForm category={category} onClose={() => setEditCategory(false)} />
      )}
      {serviceFormOpen && (
        <ServiceForm
          defaultCategoryId={categoryId}
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

function ServiceAvatar({ service }: { service: CatalogService }) {
  if (service.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- service images are external URLs
      <img
        src={service.profileImage}
        alt={service.name}
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
    );
  }
  const initials = service.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
      {initials}
    </div>
  );
}

function ProfileStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
        {icon}
      </div>
      <p className="text-xl font-semibold tracking-tight text-foreground">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
