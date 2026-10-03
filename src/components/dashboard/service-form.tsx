"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  serviceApi,
  type CatalogService,
  type ServiceInput,
  type ServiceVariantInput,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { compressImage } from "@/src/lib/image";
import { CloseIcon, SpinnerIcon } from "@/src/components/icons";

const VARIANTS_PLACEHOLDER = `[
  { "name": "north Indian chef", "price": 299, "durationMinutes": 60 },
  { "name": "north Indian chef", "price": 499, "durationMinutes": 60 }
]`;

/** Parse the variants JSON textarea into validated ServiceVariantInput[]. */
function parseVariantsJson(raw: string): ServiceVariantInput[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON — check for missing commas, quotes or brackets.");
  }
  if (!Array.isArray(data)) {
    throw new Error('Variants must be a JSON array, e.g. [{ "name": "...", "price": 299 }]');
  }
  return data.map((item, i) => {
    const pos = `Item ${i + 1}`;
    if (!item || typeof item !== "object") {
      throw new Error(`${pos}: each variant must be an object.`);
    }
    const v = item as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (!name) throw new Error(`${pos}: "name" is required.`);
    const price = Number(v.price);
    if (!Number.isFinite(price)) throw new Error(`${pos}: "price" must be a number.`);
    const variant: ServiceVariantInput = { name, price };
    if (v.durationMinutes != null && v.durationMinutes !== "") {
      const duration = Number(v.durationMinutes);
      if (!Number.isFinite(duration)) {
        throw new Error(`${pos}: "durationMinutes" must be a number.`);
      }
      variant.durationMinutes = Math.round(duration);
    }
    return variant;
  });
}

/** One item per line; blank lines and bullet marks dropped. */
function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

/** "" → null when editing (clears it), undefined when creating (leave default). */
function optionalNumber(text: string, editing: boolean): number | null | undefined {
  if (!text.trim()) return editing ? null : undefined;
  return Number(text);
}

interface ServiceFormProps {
  /** Optional — services created from a category page have no vendor. */
  vendorId?: number;
  defaultCategoryId?: number | null;
  /** Pre-select a sub-category of the default category for a new service. */
  defaultSubcategoryId?: number | null;
  service: CatalogService | null; // null => create
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export function ServiceForm({
  vendorId,
  defaultCategoryId,
  defaultSubcategoryId,
  service,
  onClose,
  onSaved,
}: ServiceFormProps) {
  const isEdit = Boolean(service);
  const queryClient = useQueryClient();

  const { data: tree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });

  // A service in a sub-category sits under its parent here: pick the top-level
  // category first, then (optionally) one of its sub-categories.
  const initialTop = service?.category?.parentId ?? service?.categoryId ?? defaultCategoryId ?? "";
  const initialSub = service?.category?.parentId ? service.categoryId : (defaultSubcategoryId ?? "");
  const [topId, setTopId] = useState<number | "">(initialTop);
  const [subId, setSubId] = useState<number | "">(initialSub);
  const groups = useMemo(
    () => tree?.find((c) => c.categoryId === topId)?.groups ?? [],
    [tree, topId],
  );

  const [name, setName] = useState(service?.name ?? "");
  const [subtitle, setSubtitle] = useState(service?.subtitle ?? "");
  const [basePrice, setBasePrice] = useState(service?.basePrice != null ? String(service.basePrice) : "");
  const [originalPrice, setOriginalPrice] = useState(
    service?.originalPrice != null ? String(service.originalPrice) : "",
  );
  const [isStartingPrice, setIsStartingPrice] = useState(service?.isStartingPrice ?? false);
  const [duration, setDuration] = useState(
    service?.durationMinutes != null ? String(service.durationMinutes) : "",
  );
  const [sortOrder, setSortOrder] = useState(service?.sortOrder != null ? String(service.sortOrder) : "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [highlights, setHighlights] = useState((service?.highlights ?? []).join("\n"));
  const [inclusions, setInclusions] = useState((service?.inclusions ?? []).join("\n"));
  const [exclusions, setExclusions] = useState((service?.exclusions ?? []).join("\n"));
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(service?.isFeatured ?? false);
  const [variantsJson, setVariantsJson] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  // Once saved, a retry (say, after a failed image upload) updates this row
  // instead of creating a second service.
  const [savedId, setSavedId] = useState<number | null>(service?.serviceId ?? null);

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const mutation = useMutation({
    mutationFn: async (parsedVariants?: ServiceVariantInput[]) => {
      const editing = savedId != null;
      const payload: ServiceInput = {
        name: name.trim(),
        categoryId: Number(subId || topId),
        vendorId,
        description: description.trim() || (editing ? null : undefined),
        subtitle: subtitle.trim() || (editing ? null : undefined),
        basePrice: optionalNumber(basePrice, editing),
        originalPrice: optionalNumber(originalPrice, editing),
        isStartingPrice,
        durationMinutes: optionalNumber(duration, editing),
        sortOrder: sortOrder.trim() ? Number(sortOrder) : undefined,
        highlights: toLines(highlights),
        inclusions: toLines(inclusions),
        exclusions: toLines(exclusions),
        isActive,
        isFeatured,
        variants: !editing && parsedVariants?.length ? parsedVariants : undefined,
      };
      const saved = editing
        ? await serviceApi.update(savedId, payload)
        : await serviceApi.create(payload);
      setSavedId(saved.serviceId);

      // Upload the image (if chosen) against the saved id. Compress first so
      // large photos don't hit the live API's ~1 MB body cap.
      if (image) {
        try {
          const compressed = await compressImage(image, { maxWidth: 1024, maxBytes: 800_000 });
          await serviceApi.uploadImage(saved.serviceId, compressed);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          throw new Error(
            `The service was saved, but the image upload failed: ${reason} Save again to retry the image.`,
          );
        }
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
      if (vendorId != null) {
        queryClient.invalidateQueries({ queryKey: ["vendor", vendorId] });
      }
      onSaved?.(isEdit ? `"${saved.name}" saved` : `"${saved.name}" added`);
      onClose();
    },
    // A failed image upload after a successful save still changed the list.
    onError: () => {
      if (savedId != null || !isEdit) queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (name.trim().length < 2) return setLocalError("Name needs at least 2 characters.");
    if (!topId) return setLocalError("Pick a category.");
    for (const [label, value] of [
      ["Price", basePrice],
      ["Original price", originalPrice],
      ["Duration", duration],
      ["Sort order", sortOrder],
    ] as const) {
      if (value.trim() && !Number.isFinite(Number(value))) {
        return setLocalError(`${label} must be a number.`);
      }
    }
    if (
      (duration.trim() && !Number.isInteger(Number(duration))) ||
      (sortOrder.trim() && !Number.isInteger(Number(sortOrder)))
    ) {
      return setLocalError("Duration and sort order must be whole numbers.");
    }

    let parsedVariants: ServiceVariantInput[] | undefined;
    if (savedId == null && variantsJson.trim()) {
      try {
        parsedVariants = parseVariantsJson(variantsJson);
      } catch (err) {
        return setLocalError(err instanceof Error ? err.message : "Invalid variants JSON");
      }
    }
    mutation.mutate(parsedVariants);
  };

  const errorMessage =
    localError ??
    (mutation.error instanceof ApiError || mutation.error instanceof Error
      ? mutation.error.message
      : null);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";
  const shownImage = preview ?? service?.profileImage ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-form-title"
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 id="service-form-title" className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit service" : "Add service"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Service name *" full>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Small kitchen"
                className={inputClass}
              />
            </Field>

            <Field label="Category *">
              <select
                value={topId}
                onChange={(e) => {
                  setTopId(e.target.value ? Number(e.target.value) : "");
                  setSubId("");
                }}
                className={inputClass}
              >
                <option value="">Select category</option>
                {tree?.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Sub-category"
              hint={groups.length ? undefined : "This category has no sub-categories."}
            >
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value ? Number(e.target.value) : "")}
                disabled={!groups.length}
                className={`${inputClass} disabled:opacity-60`}
              >
                <option value="">None (directly in the category)</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subtitle" hint="Size or scope line under the name." full>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="100 to 150 sq ft"
                className={inputClass}
              />
            </Field>

            <Field label="Price (₹, before tax)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="2999"
                className={inputClass}
              />
            </Field>
            <Field label="Original price / MRP (₹)" hint="Shown struck through when above the price.">
              <input
                type="number"
                min={0}
                step="0.01"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="3499"
                className={inputClass}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={0}
                step={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="180"
                className={inputClass}
              />
            </Field>
            <Field label="Sort order" hint="Lower shows first.">
              <input
                type="number"
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Highlights" hint="Card bullets, one per line.">
              <textarea
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </Field>
            <Field label="What's included" hint="One per line.">
              <textarea
                value={inclusions}
                onChange={(e) => setInclusions(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </Field>
            <Field label="Not included" hint="One per line.">
              <textarea
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={`Image${isEdit && service?.profileImage ? " (leave empty to keep current)" : ""}`}>
            <div className="flex items-center gap-3">
              {shownImage && (
                // eslint-disable-next-line @next/next/no-img-element -- local preview / external URL
                <img
                  src={shownImage}
                  alt="Service preview"
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
              />
            </div>
          </Field>

          <div className="flex flex-wrap gap-5">
            <Toggle label="Published" checked={isActive} onChange={setIsActive} />
            <Toggle label="Featured" checked={isFeatured} onChange={setIsFeatured} />
            <Toggle label='Starting price ("from")' checked={isStartingPrice} onChange={setIsStartingPrice} />
          </div>

          {savedId == null && (
            <label className="block space-y-1.5 rounded-lg border border-border p-3">
              <span className="text-sm font-medium text-foreground">
                Variants / Add-ons{" "}
                <span className="font-normal text-muted-foreground">(JSON, optional)</span>
              </span>
              <textarea
                value={variantsJson}
                onChange={(e) => setVariantsJson(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={VARIANTS_PLACEHOLDER}
                className={`${inputClass} font-mono text-xs`}
              />
              <span className="block text-xs text-muted-foreground">
                Or add them one by one afterwards from the Variants button.
              </span>
            </label>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger"
            >
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
              {savedId != null ? "Save changes" : "Create service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
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
