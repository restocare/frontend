"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoryApi, categoryTreeApi, queryKeys, type CategoryTreeNode } from "@/src/api/api";
import { CategoryForm } from "@/src/components/dashboard/category-form";
import {
  BagIcon,
  GridIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  WalletIcon,
} from "@/src/components/icons";

/** All services for a category: its direct services plus any in sub-categories. */
function allServices(cat: CategoryTreeNode) {
  return [...cat.services, ...cat.groups.flatMap((g) => g.services)];
}

function countServices(cat: CategoryTreeNode): number {
  return allServices(cat).length;
}

function countVariants(cat: CategoryTreeNode): number {
  return allServices(cat).reduce((sum, svc) => sum + svc.variants.length, 0);
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTreeNode | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoryApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree }),
  });

  // Best-effort backend persistence of the order (so web + app match). If the
  // endpoint isn't deployed yet, the local order still applies in the admin.
  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => categoryApi.reorder(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree }),
  });

  // Publish / unpublish a category. Unpublished categories still appear on the
  // storefront + customer app, but render as a "Coming soon" tile.
  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      categoryApi.setPublished(id, isPublished),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree }),
  });

  const categories = useMemo(() => data ?? [], [data]);

  // ── Drag-and-drop ordering (persisted locally in the admin browser) ──
  const ORDER_KEY = "rc.categoryOrder";
  const [order, setOrder] = useState<number[]>([]);
  const dragId = useRef<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  useEffect(() => {
    // Deferred to a microtask so we never setState synchronously in-effect.
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(ORDER_KEY);
        if (raw) setOrder(JSON.parse(raw) as number[]);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const persistOrder = (ids: number[]) => {
    // Local order = instant admin feedback (and a fallback if the backend
    // reorder endpoint isn't deployed yet).
    setOrder(ids);
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    // Persist to the backend so the website + customer app share this order.
    reorderMutation.mutate(ids);
  };

  // Apply the saved order; unknown/new categories fall to the end (stable).
  const orderedCategories = useMemo(() => {
    if (!order.length) return categories;
    const pos = new Map(order.map((id, i) => [id, i]));
    return categories
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const pa = pos.get(a.c.categoryId) ?? Number.MAX_SAFE_INTEGER;
        const pb = pos.get(b.c.categoryId) ?? Number.MAX_SAFE_INTEGER;
        return pa !== pb ? pa - pb : a.i - b.i;
      })
      .map((x) => x.c);
  }, [categories, order]);

  const isSearching = search.trim().length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedCategories;
    return orderedCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [orderedCategories, search]);

  // Reorder: move the dragged category to where it was dropped, then persist.
  const handleDrop = (targetId: number) => {
    const src = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (src == null || src === targetId) return;
    const ids = orderedCategories.map((c) => c.categoryId);
    const from = ids.indexOf(src);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    persistOrder(ids);
  };

  const stats = useMemo(
    () => ({
      totalCategories: categories.length,
      totalServices: categories.reduce((s, c) => s + countServices(c), 0),
      totalVariants: categories.reduce((s, c) => s + countVariants(c), 0),
    }),
    [categories],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (category: CategoryTreeNode) => {
    setEditing(category);
    setFormOpen(true);
  };

  const handleDelete = (category: CategoryTreeNode) => {
    if (confirm(`Delete category "${category.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(category.categoryId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Categories</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<GridIcon className="h-5 w-5" />} label="Total categories" value={stats.totalCategories} />
        <StatCard icon={<BagIcon className="h-5 w-5" />} label="Total services" value={stats.totalServices} />
        <StatCard icon={<WalletIcon className="h-5 w-5" />} label="Total variants" value={stats.totalVariants} />
      </div>

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by category name"
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
            <p className="text-muted-foreground">Couldn’t load categories.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <GridIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No categories yet.</p>
            <button
              onClick={openCreate}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add your first category
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-2 py-3 font-medium" aria-label="Reorder" />
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Services</th>
                  <th className="px-5 py-3 font-medium">Variants</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((category) => (
                  <tr
                    key={category.categoryId}
                    draggable={!isSearching}
                    onDragStart={() => {
                      dragId.current = category.categoryId;
                    }}
                    onDragOver={(e) => {
                      if (isSearching) return;
                      e.preventDefault();
                      if (dragOverId !== category.categoryId) setDragOverId(category.categoryId);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === category.categoryId) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(category.categoryId);
                    }}
                    onDragEnd={() => {
                      dragId.current = null;
                      setDragOverId(null);
                    }}
                    className={`border-t border-border transition-colors hover:bg-muted/40 ${
                      dragOverId === category.categoryId ? "bg-primary/10" : ""
                    }`}
                  >
                    <td className="px-2 py-3">
                      <span
                        title={isSearching ? "Clear search to reorder" : "Drag to reorder"}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground ${
                          isSearching ? "opacity-30" : "cursor-grab hover:bg-muted active:cursor-grabbing"
                        }`}
                      >
                        <GripIcon className="h-4 w-4" />
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/categories/${category.categoryId}`}
                        className="flex items-center gap-3 group"
                      >
                        <CategoryAvatar category={category} />
                        <p className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                          {category.name}
                        </p>
                      </Link>
                    </td>
                    <td className="max-w-[18rem] truncate px-5 py-3 text-muted-foreground">
                      {category.description || "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {countServices(category)}
                    </td>
                    <td className="px-5 py-3 text-foreground">{countVariants(category)}</td>
                    <td className="px-5 py-3">
                      {(() => {
                        // Missing flag (old backend) → treat as published so nothing hides.
                        const published = category.isPublished !== false;
                        const loading =
                          publishMutation.isPending &&
                          publishMutation.variables?.id === category.categoryId;
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={published}
                              aria-busy={loading}
                              disabled={loading}
                              onClick={() =>
                                publishMutation.mutate({
                                  id: category.categoryId,
                                  isPublished: !published,
                                })
                              }
                              title={
                                published
                                  ? "Published — live on the app. Toggle to show as Coming soon"
                                  : "Coming soon — not yet live. Toggle to publish"
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-wait ${
                                published ? "bg-primary" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
                                  published ? "translate-x-5" : "translate-x-0.5"
                                }`}
                              >
                                {loading && <SpinnerIcon className="h-3 w-3 text-muted-foreground" />}
                              </span>
                            </button>
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                                published
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {published ? "Published" : "Coming soon"}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(category)}
                          aria-label="Edit category"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete category"
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

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span>
              Showing {filtered.length} of {categories.length} entries
            </span>
            <span className="text-xs">
              {isSearching
                ? "Clear the search to reorder categories"
                : "Tip: drag the ⠿ handle to reorder categories"}
            </span>
          </div>
        )}
      </div>

      {formOpen && <CategoryForm category={editing} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
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

function CategoryAvatar({ category }: { category: CategoryTreeNode }) {
  if (category.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- category images are external URLs
      <img
        src={category.profileImage}
        alt={category.name}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initials = category.name
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
