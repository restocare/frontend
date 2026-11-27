"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BRAND_SPEC, brandApi, queryKeys, type Brand } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { compressImage } from "@/src/lib/image";
import { CloseIcon, SpinnerIcon } from "@/src/components/icons";

interface BrandFormProps {
  brand: Brand | null; // null => create
  onClose: () => void;
}

export function BrandForm({ brand, onClose }: BrandFormProps) {
  const isEdit = Boolean(brand);
  const queryClient = useQueryClient();

  const [name, setName] = useState(brand?.name ?? "");
  const [title, setTitle] = useState(brand?.title ?? "");
  const [description, setDescription] = useState(brand?.description ?? "");
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<string>(String(brand?.sortOrder ?? 0));
  const [review, setReview] = useState(brand?.review ?? "");
  const [reviewerName, setReviewerName] = useState(brand?.reviewerName ?? "");
  const [rating, setRating] = useState<number>(brand?.rating ?? 5);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      // Downscale + compress before upload so large logos don't hit the live
      // API's ~1 MB nginx body cap.
      const compressed = image
        ? await compressImage(image, { maxWidth: BRAND_SPEC.width, maxBytes: 500_000 })
        : null;

      const payload = {
        name: name.trim(),
        title: title.trim(),
        description: description.trim(),
        isActive,
        sortOrder: Number(sortOrder) || 0,
        // "" clears the review on the backend; rating rides along with it.
        review: review.trim(),
        reviewerName: reviewerName.trim(),
        rating,
        image: compressed,
      };
      return brand ? brandApi.update(brand.brandId, payload) : brandApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brandsActive });
      onClose();
    },
  });

  const handleFile = (file: File | null) => {
    setImageError(null);
    setImage(null);
    if (!file) return;

    if (file.size > BRAND_SPEC.maxBytes) {
      setImageError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is ${(
          BRAND_SPEC.maxBytes / 1024 / 1024
        ).toFixed(0)} MB.`,
      );
      return;
    }
    setImage(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (imageError) return;
    if (!name.trim()) return;
    if (!isEdit && !image) {
      setImageError("A brand logo is required.");
      return;
    }
    mutation.mutate();
  };

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

  const previewSrc = image ? URL.createObjectURL(image) : (brand?.imageUrl ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit brand" : "Add brand"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Logo + size guidance */}
          <div className="space-y-2 rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Brand logo {isEdit ? "" : "*"}
              </span>
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                Recommended: {BRAND_SPEC.label}
              </span>
            </div>

            {previewSrc && (
              <div className="flex justify-center overflow-hidden rounded-lg border border-border bg-muted p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview / external URL */}
                <img
                  src={previewSrc}
                  alt="Brand logo preview"
                  className="h-24 w-24 rounded-lg object-contain"
                />
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
            />
            <p className="text-xs text-muted-foreground">
              Square logo works best — {BRAND_SPEC.aspect} (recommended {BRAND_SPEC.width}×
              {BRAND_SPEC.height}px). Max file size {(BRAND_SPEC.maxBytes / 1024 / 1024).toFixed(0)} MB.
            </p>
            {imageError && <p className="text-xs text-danger">{imageError}</p>}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bistro Fifty Seven"
              required
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Our valued partner"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Associated with us since 2022"
              rows={2}
              className={inputClass}
            />
          </label>
          {/* Optional customer review — a brand with one also shows in the
              website's "What our customers say" carousel. */}
          <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
            <p className="text-sm font-medium text-foreground">
              Customer review{" "}
              <span className="font-normal text-muted-foreground">
                (optional — shows in &ldquo;What our customers say&rdquo;)
              </span>
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Review</span>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="RestoCare has been a dependable partner for us…"
                rows={3}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-muted-foreground">Reviewer name</span>
                <input
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Nityam Gupta"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-muted-foreground">Rating</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className={inputClass}
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {"★".repeat(r)} ({r})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">Sort order</span>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={inputClass}
            />
          </label>

          <Toggle label="Show on website" checked={isActive} onChange={setIsActive} />

          {errorMessage && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending && <SpinnerIcon className="h-4 w-4" />}
              {isEdit ? "Save changes" : "Create brand"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
