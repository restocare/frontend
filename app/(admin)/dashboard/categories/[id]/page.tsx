"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryApi,
  categoryTreeApi,
  queryKeys,
  serviceApi,
  type CatalogService,
  type CategoryTreeGroup,
  type ImportResult,
  type ServiceListParams,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { CategoryForm } from "@/src/components/dashboard/category-form";
import { ServiceForm } from "@/src/components/dashboard/service-form";
import { VariantsModal } from "@/src/components/dashboard/variants-modal";
import { SubcategoryForm } from "@/src/components/dashboard/subcategory-form";
import { ImportPreviewModal } from "@/src/components/dashboard/import-preview-modal";
import {
  BagIcon,
  ChartIcon,
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  StoreIcon,
  TrashIcon,
} from "@/src/components/icons";

type Toast = { text: string; tone: "success" | "error" };
/** Which part of the catalog the table shows. */
type Scope = "all" | "direct" | number;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function CategoryProfilePage() {
  const params = useParams<{ id: string }>();
  const categoryId = Number(params.id);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearchState] = useState("");
  const [scope, setScopeState] = useState<Scope>("all");
  const [page, setPage] = useState(1);
  // Rows per page — the admin picks; 10 keeps big categories scannable.
  // ALL_ROWS asks for everything in one page: a 126-service category capped at
  // 50 a page read as "only 50 services" to the people counting them.
  const ALL_ROWS = 1000;
  const [pageSize, setPageSizeState] = useState(10);
  const [toast, setToast] = useState<Toast | null>(null);

  // A new search, scope or page size starts from the first page — page 3 of
  // the old results would often not exist under the new filter.
  const setSearch = (v: string) => {
    setSearchState(v);
    setPage(1);
  };
  const setScope = (v: Scope) => {
    setScopeState(v);
    setPage(1);
  };
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
  };

  // Auto-dismiss the toast; errors stay up longer so they can be read.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "error" ? 8000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);
  const ok = (text: string) => setToast({ text, tone: "success" });
  const fail = (text: string) => setToast({ text, tone: "error" });

  const [editCategory, setEditCategory] = useState(false);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<CatalogService | null>(null);
  const [variantsService, setVariantsService] = useState<CatalogService | null>(null);
  const [subForm, setSubForm] = useState<{ group: CategoryTreeGroup | null } | null>(null);
  const [importState, setImportState] = useState<{ file: File; result: ImportResult } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<"template" | "export" | null>(null);

  // Category header info comes from the tree (top-level categories).
  const treeQuery = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });
  const category = treeQuery.data?.find((c) => c.categoryId === categoryId) ?? null;
  const groups = category?.groups ?? [];

  // Server-side pagination — the backend's silent 50-row default used to hide
  // everything past the first 50 services of large categories.
  const serviceParams: ServiceListParams = {
    categoryId: typeof scope === "number" ? scope : categoryId,
    includeSubcategories: scope === "all" || undefined,
    search: search.trim() || undefined,
    page,
    limit: pageSize,
  };
  const servicesQuery = useQuery({
    queryKey: queryKeys.services(serviceParams),
    queryFn: () => serviceApi.list(serviceParams),
    enabled: Number.isFinite(categoryId),
    placeholderData: keepPreviousData,
  });

  const refreshCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["services"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
  };

  const deleteService = useMutation({
    mutationFn: (s: CatalogService) => serviceApi.remove(s.serviceId).then(() => s),
    onSuccess: (s) => {
      ok(`"${s.name}" deleted`);
      refreshCatalog();
    },
    onError: (e) => fail(messageOf(e, "Couldn't delete the service.")),
  });

  // Toggle whether a service is featured — featured services are the ones shown
  // in the landing page's "Popular services" row.
  const toggleFeatured = useMutation({
    mutationFn: (s: CatalogService) =>
      serviceApi.update(s.serviceId, { isFeatured: !s.isFeatured }),
    onSuccess: (_data, s) => {
      ok(
        s.isFeatured
          ? `"${s.name}" removed from Popular services`
          : `"${s.name}" successfully added to Popular services`,
      );
      refreshCatalog();
    },
    onError: (e) => fail(messageOf(e, "Couldn't update. Please try again.")),
  });

  const deleteGroup = useMutation({
    mutationFn: (g: CategoryTreeGroup) => categoryApi.remove(g.groupId).then(() => g),
    onSuccess: (g) => {
      ok(`Sub-category "${g.name}" deleted`);
      if (scope === g.groupId) setScope("all");
      refreshCatalog();
    },
    onError: (e) => fail(messageOf(e, "Couldn't delete the sub-category.")),
  });

  const reorderGroups = useMutation({
    mutationFn: (ordered: CategoryTreeGroup[]) => categoryApi.reorder(ordered.map((g) => g.groupId)),
    onSuccess: () => {
      ok("Order saved");
      refreshCatalog();
    },
    onError: (e) => fail(messageOf(e, "Couldn't save the order.")),
  });

  const togglePublished = useMutation({
    mutationFn: (g: CategoryTreeGroup) => categoryApi.setPublished(g.groupId, !(g.isPublished ?? true)),
    onSuccess: (_d, g) => {
      ok(`"${g.name}" ${(g.isPublished ?? true) ? "set to Coming soon" : "published"}`);
      refreshCatalog();
    },
    onError: (e) => fail(messageOf(e, "Couldn't change the status.")),
  });

  // Import is two calls: a dry run for the preview, then the real one.
  const previewImport = useMutation({
    mutationFn: (file: File) => serviceApi.import(file, { categoryId, dryRun: true }),
    onSuccess: (result, file) => {
      setImportError(null);
      setImportState({ file, result });
    },
    onError: (e) => fail(`Import preview failed: ${messageOf(e, "unknown error")}`),
  });
  const runImport = useMutation({
    mutationFn: (file: File) => serviceApi.import(file, { categoryId }),
    onSuccess: (result, file) => {
      setImportError(null);
      setImportState({ file, result });
      refreshCatalog();
    },
    onError: (e) => setImportError(messageOf(e, "Import failed.")),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      fail("Choose an .xlsx file (Excel Workbook). Older .xls and .csv files aren't supported.");
      return;
    }
    previewImport.mutate(file);
  };

  const download = async (kind: "template" | "export") => {
    setDownloading(kind);
    try {
      if (kind === "template") {
        saveBlob(await serviceApi.downloadTemplate(), "catalog-template.xlsx");
      } else {
        saveBlob(await serviceApi.exportCatalog(categoryId), `catalog-${slug(category?.name ?? String(categoryId))}.xlsx`);
      }
    } catch (e) {
      fail(`${kind === "template" ? "Template" : "Export"} download failed: ${messageOf(e, "unknown error")}`);
    } finally {
      setDownloading(null);
    }
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceFormOpen(true);
  };
  const openEditService = (s: CatalogService) => {
    setEditingService(s);
    setServiceFormOpen(true);
  };

  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    reorderGroups.mutate(next);
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
        <p className="text-muted-foreground">
          {treeQuery.isError
            ? `Couldn't load the category: ${messageOf(treeQuery.error, "unknown error")}`
            : "Category not found."}
        </p>
        <div className="flex gap-2">
          {treeQuery.isError ? (
            <button
              onClick={() => treeQuery.refetch()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Try again
            </button>
          ) : null}
          <Link
            href="/dashboard/categories"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to categories
          </Link>
        </div>
      </div>
    );
  }

  const stats = servicesQuery.data?.stats;
  const services = servicesQuery.data?.services ?? [];
  const pagination = servicesQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const shownFrom = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const shownTo = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;
  const scopeGroup = typeof scope === "number" ? groups.find((g) => g.groupId === scope) : undefined;
  const nextGroupOrder = groups.reduce((max, g) => Math.max(max, (g.sortOrder ?? 0) + 1), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          className={`fixed bottom-6 right-6 z-[60] flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === "error" ? "bg-danger text-white" : "bg-foreground text-background"
          }`}
        >
          <span className={toast.tone === "error" ? "" : "text-success"}>{toast.tone === "error" ? "!" : "✓"}</span>
          <span className="min-w-0 flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            ×
          </button>
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
        <ProfileStat icon={<StoreIcon className="h-5 w-5" />} label="Sub-categories" value={groups.length} />
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Total Services" value={stats?.totalServices} />
        <ProfileStat icon={<BagIcon className="h-5 w-5" />} label="Published" value={stats?.publishedServices} />
        <ProfileStat icon={<ChartIcon className="h-5 w-5" />} label="Featured" value={stats?.featuredServices} />
      </div>

      {/* Sub-categories */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Sub-categories</h3>
            <p className="text-xs text-muted-foreground">
              The tiles and sections on the category page, in this order.
            </p>
          </div>
          <button
            onClick={() => setSubForm({ group: null })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Add sub-category
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No sub-categories. Services sit directly in {category.name}. Add sub-categories here or with
            the Subcategories sheet of an Excel import.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g, i) => {
              const published = g.isPublished ?? true;
              return (
                <li key={g.groupId} className="flex gap-3 rounded-xl border border-border p-3">
                  {g.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external category image
                    <img src={g.profileImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-semibold text-accent-foreground">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => setScope(g.groupId)}
                      className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:underline"
                      title="Show its services"
                    >
                      {g.name}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.subtitle || g.title || "No subtitle"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{g.services.length} services</span>
                      <button
                        onClick={() => togglePublished.mutate(g)}
                        disabled={togglePublished.isPending}
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}
                        title="Toggle Published / Coming soon"
                      >
                        {published ? "Published" : "Coming soon"}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <div className="flex">
                      <SmallButton label="Move up" disabled={i === 0 || reorderGroups.isPending} onClick={() => moveGroup(i, -1)}>
                        <ChevronDownIcon className="h-4 w-4 rotate-180" />
                      </SmallButton>
                      <SmallButton
                        label="Move down"
                        disabled={i === groups.length - 1 || reorderGroups.isPending}
                        onClick={() => moveGroup(i, 1)}
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </SmallButton>
                    </div>
                    <div className="flex">
                      <SmallButton label="Edit" onClick={() => setSubForm({ group: g })}>
                        <PencilIcon className="h-4 w-4" />
                      </SmallButton>
                      <SmallButton
                        label="Delete"
                        danger
                        disabled={deleteGroup.isPending}
                        onClick={() => {
                          const n = g.services.length;
                          if (
                            confirm(
                              n
                                ? `Delete "${g.name}" and its ${n} service${n === 1 ? "" : "s"}? This can't be undone.`
                                : `Delete "${g.name}"?`,
                            )
                          ) {
                            deleteGroup.mutate(g);
                          }
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </SmallButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
            <select
              value={String(scope)}
              onChange={(e) => {
                const v = e.target.value;
                setScope(v === "all" || v === "direct" ? v : Number(v));
              }}
              aria-label="Which services to show"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All services</option>
              <option value="direct">Not in a sub-category</option>
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => download("template")}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              title="Download an empty workbook with examples and instructions"
            >
              {downloading === "template" && <SpinnerIcon className="h-4 w-4" />}
              Template
            </button>
            <button
              onClick={() => download("export")}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
              title="Download this category's catalog; edit it and import it back"
            >
              {downloading === "export" && <SpinnerIcon className="h-4 w-4" />}
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={previewImport.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
            >
              {previewImport.isPending ? <SpinnerIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              Import Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="hidden"
              aria-label="Excel file to import"
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

        {/* Catalog table */}
        {servicesQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : servicesQuery.isError ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm">
            <p className="text-danger">
              Couldn&apos;t load the services: {messageOf(servicesQuery.error, "unknown error")}
            </p>
            <button
              onClick={() => servicesQuery.refetch()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Try again
            </button>
          </div>
        ) : services.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <BagIcon className="h-9 w-9 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search.trim()
                ? `No services match "${search.trim()}".`
                : scopeGroup
                  ? `No services in ${scopeGroup.name} yet.`
                  : "No services yet."}
            </p>
            <button
              onClick={openCreateService}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add a service
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Sub-category</th>
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
                        <div className="min-w-0">
                          <span className="block">{s.name}</span>
                          {s.subtitle ? (
                            <span className="block text-xs font-normal text-muted-foreground">{s.subtitle}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.category?.parentId ? s.category.name : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {s.basePrice != null ? (
                        <>
                          {s.isStartingPrice ? <span className="mr-1 text-xs text-muted-foreground">from</span> : null}
                          {s.basePrice.toFixed(2)}
                          {s.originalPrice != null && s.originalPrice > s.basePrice ? (
                            <span className="ml-1.5 text-xs text-muted-foreground line-through">
                              {s.originalPrice.toFixed(2)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
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
                            if (confirm(`Delete service "${s.name}"?`)) deleteService.mutate(s);
                          }}
                          disabled={deleteService.isPending}
                          aria-label="Delete service"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:opacity-40"
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
          defaultSubcategoryId={typeof scope === "number" ? scope : null}
          service={editingService}
          onClose={() => setServiceFormOpen(false)}
          onSaved={ok}
        />
      )}
      {variantsService && (
        <VariantsModal service={variantsService} onClose={() => setVariantsService(null)} />
      )}
      {subForm && (
        <SubcategoryForm
          parent={category}
          group={subForm.group}
          nextSortOrder={nextGroupOrder}
          onClose={() => setSubForm(null)}
          onSaved={ok}
        />
      )}
      {importState && (
        <ImportPreviewModal
          fileName={importState.file.name}
          result={importState.result}
          importing={runImport.isPending}
          error={importError}
          onConfirm={() => runImport.mutate(importState.file)}
          onClose={() => {
            if (importState.result.dryRun === false) ok(importState.result.message);
            setImportState(null);
            setImportError(null);
          }}
        />
      )}
    </div>
  );
}

function SmallButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition disabled:opacity-30 ${
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-accent hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function ServiceAvatar({ service }: { service: CatalogService }) {
  const [broken, setBroken] = useState(false);
  if (service.profileImage && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- service images are external URLs
      <img
        src={service.profileImage}
        alt={service.name}
        onError={() => setBroken(true)}
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
