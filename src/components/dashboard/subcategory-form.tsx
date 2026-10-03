"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoryApi,
  queryKeys,
  type CategoryTreeGroup,
  type CategoryTreeNode,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { compressImage } from "@/src/lib/image";
import { CloseIcon, SpinnerIcon } from "@/src/components/icons";

interface SubcategoryFormProps {
  /** The top-level category the sub-category sits in. */
  parent: CategoryTreeNode;
  /** null => create */
  group: CategoryTreeGroup | null;
  /** Where a new one goes when no order is typed: after the last. */
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Add or edit a sub-category: the tiles and section headings of a category
 * page ("Washroom" → "Washroom Deep Cleaning", "Priced by fixture count").
 * Only the name is required; an empty field clears it on save.
 */
export function SubcategoryForm({ parent, group, nextSortOrder, onClose, onSaved }: SubcategoryFormProps) {
  const isEdit = Boolean(group);
  const queryClient = useQueryClient();

  const [name, setName] = useState(group?.name ?? "");
  const [title, setTitle] = useState(group?.title ?? "");
  const [subtitle, setSubtitle] = useState(group?.subtitle ?? "");
  const [note, setNote] = useState(group?.note ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(group?.sortOrder ?? nextSortOrder));
  const [isPublished, setIsPublished] = useState(group?.isPublished ?? true);
  const [image, setImage] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Preview URL for a newly picked file; revoked when it changes or closes.
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const mutation = useMutation({
    mutationFn: async () => {
      // The live API sits behind a ~1 MB body cap: shrink photos first.
      const icon = image ? await compressImage(image, { maxWidth: 512, maxBytes: 600_000 }) : null;
      const order = sortOrder.trim() === "" ? null : Number(sortOrder);
      const clear = (v: string) => (v.trim() ? v.trim() : isEdit ? null : undefined);
      const body = {
        name: name.trim(),
        title: clear(title),
        subtitle: clear(subtitle),
        note: clear(note),
        description: clear(description),
        sortOrder: order,
        isPublished,
        image: icon,
      };
      if (group) return categoryApi.update(group.groupId, body);
      return categoryApi.create({ ...body, parentId: parent.categoryId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onSaved(isEdit ? `"${name.trim()}" saved` : `Sub-category "${name.trim()}" added`);
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name is required.");
      return;
    }
    if (sortOrder.trim() !== "" && !Number.isInteger(Number(sortOrder))) {
      setLocalError("Sort order must be a whole number.");
      return;
    }
    mutation.mutate();
  };

  const errorMessage =
    localError ??
    (mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? `Something went wrong: ${mutation.error.message}`
        : null);

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";
  const currentImage = preview ?? (group?.profileImage || null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subcategory-form-title"
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <h2 id="subcategory-form-title" className="text-lg font-semibold text-foreground">
              {isEdit ? "Edit sub-category" : "Add sub-category"}
            </h2>
            <p className="text-sm text-muted-foreground">in {parent.name}</p>
          </div>
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
            <Field label="Name *" hint="The tile label, e.g. Washroom.">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Washroom"
                className={inputClass}
                autoFocus
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
            <Field label="Title" hint="Section heading. Blank uses the name." full>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Washroom Deep Cleaning"
                className={inputClass}
              />
            </Field>
            <Field label="Subtitle" hint="Line under the heading." full>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Priced by fixture count"
                className={inputClass}
              />
            </Field>
            <Field label="Note" hint="Small print shown after the list." full>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Final price is confirmed at booking."
                className={inputClass}
              />
            </Field>
            <Field label="Description" full>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Icon (optional)" full>
              <div className="flex items-center gap-3">
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview / external URL
                  <img src={currentImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
                />
              </div>
            </Field>
          </div>

          <label className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={() => setIsPublished((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPublished ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isPublished ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-sm text-foreground">
              {isPublished ? "Published" : "Coming soon (not bookable yet)"}
            </span>
          </label>

          {errorMessage && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
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
              {isEdit ? "Save changes" : "Add sub-category"}
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
