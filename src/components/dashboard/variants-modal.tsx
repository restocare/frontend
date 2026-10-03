"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  serviceApi,
  type CatalogService,
  type ServiceVariant,
  type ServiceVariantInput,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { compressImage } from "@/src/lib/image";
import {
  ChevronDownIcon,
  CloseIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/src/components/icons";

interface VariantsModalProps {
  service: CatalogService;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

function messageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface Draft {
  name: string;
  price: string;
  originalPrice: string;
  duration: string;
  subtitle: string;
}

const emptyDraft: Draft = { name: "", price: "", originalPrice: "", duration: "", subtitle: "" };

function draftOf(v: ServiceVariant): Draft {
  return {
    name: v.name,
    price: String(v.price),
    originalPrice: v.originalPrice != null ? String(v.originalPrice) : "",
    duration: v.durationMinutes != null ? String(v.durationMinutes) : "",
    subtitle: v.subtitle ?? "",
  };
}

/** Validate a draft into an API body, or return the problem to show. */
function bodyOf(d: Draft, editing: boolean): ServiceVariantInput | string {
  if (!d.name.trim()) return "Name is required.";
  const price = Number(d.price);
  if (d.price.trim() === "" || !Number.isFinite(price) || price < 0) return "Price must be 0 or more.";
  const original = d.originalPrice.trim() === "" ? null : Number(d.originalPrice);
  if (original != null && (!Number.isFinite(original) || original < 0)) return "MRP must be 0 or more.";
  const duration = d.duration.trim() === "" ? null : Number(d.duration);
  if (duration != null && (!Number.isInteger(duration) || duration < 0)) {
    return "Duration must be a whole number of minutes.";
  }
  return {
    name: d.name.trim(),
    price,
    // On edit an emptied field clears; on create it's simply not sent.
    originalPrice: original ?? (editing ? null : undefined),
    durationMinutes: duration ?? (editing ? null : undefined),
    subtitle: d.subtitle.trim() || (editing ? null : undefined),
  };
}

/**
 * A service's variants: options the customer picks between ("Standard
 * clean", "With exhaust duct"). Add, edit in place, reorder, upload an image
 * and delete — every action reports its own error.
 */
export function VariantsModal({ service, onClose }: VariantsModalProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFor, setImageFor] = useState<number | null>(null);

  const variantsKey = ["service", service.serviceId, "variants"] as const;
  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: variantsKey,
    queryFn: () => serviceApi.listVariants(service.serviceId),
  });
  const variants = data?.variants ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: variantsKey });
    queryClient.invalidateQueries({ queryKey: ["services"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
  };
  const report = (e: unknown) => {
    setNotice(null);
    setError(messageOf(e));
  };
  const succeed = (message: string) => {
    setError(null);
    setNotice(message);
    invalidate();
  };

  const addMutation = useMutation({
    mutationFn: (body: ServiceVariantInput) => serviceApi.addVariant(service.serviceId, body),
    onSuccess: (v) => {
      setDraft(emptyDraft);
      succeed(`"${v.name}" added`);
    },
    onError: report,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ServiceVariantInput }) =>
      serviceApi.updateVariant(id, body),
    onSuccess: (v) => {
      setEditingId(null);
      succeed(`"${v.name}" saved`);
    },
    onError: report,
  });

  const deleteMutation = useMutation({
    mutationFn: (v: ServiceVariant) => serviceApi.removeVariant(v.variantId).then(() => v),
    onSuccess: (v) => succeed(`"${v.name}" deleted`),
    onError: report,
  });

  // Moving renumbers every variant 0..n so the order is explicit afterwards.
  const reorderMutation = useMutation({
    mutationFn: (ordered: ServiceVariant[]) =>
      serviceApi.updateVariants(
        service.serviceId,
        ordered.map((v, i) => ({ variantId: v.variantId, sortOrder: i })),
      ),
    onSuccess: () => succeed("Order saved"),
    onError: report,
  });

  const imageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const compressed = await compressImage(file, { maxWidth: 800, maxBytes: 600_000 });
      return serviceApi.uploadVariantImage(id, compressed);
    },
    onSuccess: (v) => succeed(`Image saved for "${v.name}"`),
    onError: report,
    onSettled: () => setImageFor(null),
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const body = bodyOf(draft, false);
    if (typeof body === "string") return setError(body);
    addMutation.mutate(body);
  };

  const handleSave = (id: number) => {
    const body = bodyOf(editDraft, true);
    if (typeof body === "string") return setError(body);
    saveMutation.mutate({ id, body });
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= variants.length) return;
    const next = [...variants];
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next);
  };

  const pickImage = (id: number) => {
    setImageFor(id);
    fileRef.current?.click();
  };

  const busy =
    addMutation.isPending || saveMutation.isPending || deleteMutation.isPending || reorderMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="variants-title"
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 id="variants-title" className="text-lg font-semibold text-foreground">
              Variants
            </h2>
            <p className="text-sm text-muted-foreground">{service.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && imageFor != null) imageMutation.mutate({ id: imageFor, file });
            else setImageFor(null);
          }}
        />

        <div className="space-y-4 px-6 py-5">
          <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-border p-3" noValidate>
            <p className="text-sm font-medium text-foreground">Add a variant</p>
            <DraftFields draft={draft} onChange={setDraft} />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {addMutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                Add
              </button>
            </div>
          </form>

          {error && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}
          {notice && !error && (
            <div role="status" className="rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
              {notice}
            </div>
          )}

          <div className="divide-y divide-border rounded-lg border border-border">
            {isLoading ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                <SpinnerIcon className="h-5 w-5" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-danger">
                Couldn&apos;t load the variants: {messageOf(loadError)}
                <button onClick={() => refetch()} className="text-xs font-semibold text-foreground underline">
                  Try again
                </button>
              </div>
            ) : variants.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No variants yet.</p>
            ) : (
              variants.map((v, i) =>
                editingId === v.variantId ? (
                  <div key={v.variantId} className="space-y-2 bg-muted/30 px-4 py-3">
                    <DraftFields draft={editDraft} onChange={setEditDraft} />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(v.variantId)}
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {saveMutation.isPending && <SpinnerIcon className="h-3.5 w-3.5" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={v.variantId} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => pickImage(v.variantId)}
                      disabled={imageMutation.isPending}
                      title="Upload an image"
                      aria-label={`Upload an image for ${v.name}`}
                      className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground hover:border-primary"
                    >
                      {imageMutation.isPending && imageFor === v.variantId ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : v.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external variant image
                        <img src={v.profileImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                      {v.subtitle ? <p className="truncate text-xs text-muted-foreground">{v.subtitle}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        ₹{v.price.toLocaleString("en-IN")}
                        {v.originalPrice != null && v.originalPrice > v.price ? (
                          <span className="ml-1.5 line-through">₹{v.originalPrice.toLocaleString("en-IN")}</span>
                        ) : null}
                        {v.durationMinutes != null ? ` · ${v.durationMinutes} min` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconButton label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                        <ChevronDownIcon className="h-4 w-4 rotate-180" />
                      </IconButton>
                      <IconButton
                        label="Move down"
                        disabled={i === variants.length - 1 || busy}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Edit"
                        onClick={() => {
                          setError(null);
                          setEditDraft(draftOf(v));
                          setEditingId(v.variantId);
                        }}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Delete"
                        danger
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Delete variant "${v.name}"?`)) deleteMutation.mutate(v);
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...draft, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <input
        aria-label="Variant name"
        value={draft.name}
        onChange={set("name")}
        placeholder="Name *"
        className={`${inputClass} col-span-2 sm:col-span-3`}
      />
      <input
        aria-label="Price"
        type="number"
        min={0}
        value={draft.price}
        onChange={set("price")}
        placeholder="Price *"
        className={inputClass}
      />
      <input
        aria-label="Original price (MRP)"
        type="number"
        min={0}
        value={draft.originalPrice}
        onChange={set("originalPrice")}
        placeholder="MRP"
        className={inputClass}
      />
      <input
        aria-label="Duration in minutes"
        type="number"
        min={0}
        value={draft.duration}
        onChange={set("duration")}
        placeholder="Min"
        className={inputClass}
      />
      <input
        aria-label="Subtitle"
        value={draft.subtitle}
        onChange={set("subtitle")}
        placeholder="Subtitle (optional)"
        className={`${inputClass} col-span-2 sm:col-span-6`}
      />
    </div>
  );
}

function IconButton({
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition disabled:opacity-30 ${
        danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-accent hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
