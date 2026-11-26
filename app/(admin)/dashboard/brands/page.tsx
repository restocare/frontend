"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brandApi, queryKeys, type Brand } from "@/src/api/api";
import { BrandForm } from "@/src/components/dashboard/brand-form";
import { ImageIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.brands,
    queryFn: () => brandApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => brandApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brandsActive });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (brand: Brand) =>
      brandApi.update(brand.brandId, { name: brand.name, isActive: !brand.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brandsActive });
    },
  });

  const brands = useMemo(() => data ?? [], [data]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setFormOpen(true);
  };
  const handleDelete = (brand: Brand) => {
    if (confirm(`Delete "${brand.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(brand.brandId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Brands</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the associated-brand logos shown on the website.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add brand
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
          <p className="text-muted-foreground">Couldn&apos;t load brands.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : brands.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No brands yet.</p>
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Add a brand
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <div
              key={brand.brandId}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative flex h-32 w-full items-center justify-center bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- external logo image */}
                <img
                  src={brand.imageUrl}
                  alt={brand.name}
                  className="h-20 w-20 object-contain"
                />
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${
                    brand.isActive
                      ? "bg-success/15 text-success"
                      : "bg-black/50 text-white"
                  }`}
                >
                  {brand.isActive ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{brand.name}</p>
                  {brand.title && (
                    <p className="truncate text-sm text-muted-foreground">{brand.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Order: {brand.sortOrder}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleMutation.mutate(brand)}
                    disabled={toggleMutation.isPending}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {brand.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => openEdit(brand)}
                    aria-label="Edit brand"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(brand)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete brand"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && <BrandForm brand={editing} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
