"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BANNER_SPECS,
  bannerApi,
  queryKeys,
  type Banner,
  type BannerPlatform,
} from "@/src/api/api";
import { BannerForm } from "@/src/components/dashboard/banner-form";
import { ImageIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [platformTab, setPlatformTab] = useState<BannerPlatform>("WEB");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.banners,
    queryFn: () => bannerApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bannerApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.banners });
      queryClient.invalidateQueries({ queryKey: queryKeys.bannersActive });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (banner: Banner) =>
      bannerApi.update(banner.bannerId, { isActive: !banner.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.banners });
      queryClient.invalidateQueries({ queryKey: queryKeys.bannersActive });
    },
  });

  const banners = useMemo(() => data ?? [], [data]);
  const platformOf = (b: Banner): BannerPlatform => b.platform ?? "WEB";

  const counts = useMemo(
    () => ({
      WEB: banners.filter((b) => platformOf(b) === "WEB").length,
      MOBILE: banners.filter((b) => platformOf(b) === "MOBILE").length,
      QC: banners.filter((b) => platformOf(b) === "QC").length,
    }),
    [banners],
  );
  const filtered = banners.filter((b) => platformOf(b) === platformTab);
  const spec = BANNER_SPECS[platformTab];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setFormOpen(true);
  };
  const handleDelete = (banner: Banner) => {
    if (confirm("Delete this banner? This cannot be undone.")) {
      deleteMutation.mutate(banner.bannerId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Banner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage {platformTab === "WEB" ? "web storefront" : platformTab === "MOBILE" ? "mobile app" : "QC store app"} banners.
            Recommended size {spec.label}.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add {platformTab === "WEB" ? "Web" : platformTab === "MOBILE" ? "Mobile" : "QC Store"} Banner
        </button>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { value: "WEB" as const, label: "🖥️ Web Banners" },
            { value: "MOBILE" as const, label: "📱 Mobile Banners" },
            { value: "QC" as const, label: "🛍️ QC Store Banners" },
          ]
        ).map((t) => {
          const active = platformTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setPlatformTab(t.value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  active ? "bg-primary-foreground/20" : "bg-muted"
                }`}
              >
                {counts[t.value]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
          <p className="text-muted-foreground">Couldn’t load banners.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No {platformTab === "WEB" ? "web" : platformTab === "MOBILE" ? "mobile" : "QC store"} banners yet.
          </p>
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Add a {platformTab === "WEB" ? "web" : platformTab === "MOBILE" ? "mobile" : "QC store"} banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filtered.map((banner) => (
            <div
              key={banner.bannerId}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div
                className="relative w-full bg-muted"
                style={{ aspectRatio: platformOf(banner) === "MOBILE" ? "2 / 1" : "3 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- external banner image */}
                <img
                  src={banner.imageUrl}
                  alt={banner.title ?? "Banner"}
                  className="h-full w-full object-cover"
                />
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                  {platformOf(banner) === "MOBILE" ? "📱 Mobile" : "🖥️ Web"}
                </span>
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${
                    banner.isActive
                      ? "bg-success/15 text-success"
                      : "bg-black/50 text-white"
                  }`}
                >
                  {banner.isActive ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {banner.title || "Untitled banner"}
                  </p>
                  {banner.subtitle && (
                    <p className="truncate text-sm text-muted-foreground">{banner.subtitle}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Order: {banner.sortOrder}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleMutation.mutate(banner)}
                    disabled={toggleMutation.isPending}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {banner.isActive ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => openEdit(banner)}
                    aria-label="Edit banner"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(banner)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete banner"
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

      {formOpen && (
        <BannerForm
          banner={editing}
          defaultPlatform={platformTab}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
