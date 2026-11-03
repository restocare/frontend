"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryApi,
  categoryTreeApi,
  queryKeys,
  serviceApi,
  skillTagApi,
  tagIdsOf,
  type CategoryTreeNode,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { compressImage } from "@/src/lib/image";
import { CloseIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";
import { SkillTagPicker } from "@/src/components/dashboard/skill-tag-picker";

interface CategoryFormProps {
  category: CategoryTreeNode | null; // null => create
  onClose: () => void;
}

interface DraftService {
  name: string;
  price: string;
  durationMinutes: string;
}

const emptyService = (): DraftService => ({ name: "", price: "", durationMinutes: "" });

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const isEdit = Boolean(category);
  const queryClient = useQueryClient();

  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState<number | "">("");
  const [image, setImage] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [services, setServices] = useState<DraftService[]>([]);
  // Set once the category exists, so a retry after a failed service doesn't
  // create the category a second time.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [savedServices, setSavedServices] = useState(0);

  // Skills are their own table and are written after the category exists. Only
  // sent when the picker was touched, so saving a name writes nothing extra.
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [tagsTouched, setTagsTouched] = useState(false);

  useQuery({
    queryKey: queryKeys.skillTagsCategory(category?.categoryId ?? 0),
    queryFn: async () => {
      const links = await skillTagApi.categoryTags(category!.categoryId);
      setTagIds(tagIdsOf(links));
      return links;
    },
    enabled: category != null,
  });

  // Skills belong to a trade: a sub-category borrows its parent's list, a
  // top-level category is its own trade. A brand-new top-level category has no
  // id yet, so it has nothing to pick from until it is saved once.
  const tagSourceId =
    parentId === "" ? (category?.categoryId ?? createdId ?? null) : Number(parentId);

  // Parent dropdown: existing top-level categories (can't be the category itself).
  const { data: tree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });
  const parentOptions = (tree ?? []).filter(
    (c) => c.categoryId !== category?.categoryId,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      // The live API is behind an ~1 MB nginx body cap. Downscale + compress
      // before upload so large photos/screenshots don't 413. Use a tighter
      // budget when both files are sent together.
      const bothFiles = Boolean(image && banner);
      const perFileBudget = bothFiles ? 420_000 : 800_000;
      const [icon, bannerImg] = await Promise.all([
        image ? compressImage(image, { maxWidth: 512, maxBytes: perFileBudget }) : null,
        banner ? compressImage(banner, { maxWidth: 1600, maxBytes: perFileBudget }) : null,
      ]);

      const payload = {
        name: name.trim(),
        // Emptied on edit → cleared; left out on create.
        description: description.trim() || (category ? null : undefined),
        parentId: parentId === "" ? null : Number(parentId),
        image: icon,
        banner: bannerImg,
        // Video is uploaded as-is (no client compression). Size is capped server-side.
        video,
      };

      // Skills last, so a failure here reads as "skills not saved" rather than
      // "the category was not saved".
      const saveTags = async (categoryId: number) => {
        if (!tagsTouched) return;
        try {
          await skillTagApi.setCategoryTags(categoryId, tagIds);
          setTagsTouched(false);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Saved, but its skills were not: ${reason} Save again to retry them.`,
          );
        }
      };

      if (category) {
        await categoryApi.update(category.categoryId, payload);
        await saveTags(category.categoryId);
        return;
      }

      const newId = createdId ?? (await categoryApi.create(payload)).categoryId;
      setCreatedId(newId);
      await saveTags(newId);
      // Attach any drafted services to the freshly created category, skipping
      // the ones a previous attempt already saved.
      const valid = services.filter((s) => s.name.trim() && s.price.trim());
      for (let i = savedServices; i < valid.length; i++) {
        const s = valid[i];
        try {
          await serviceApi.create({
            name: s.name.trim(),
            categoryId: newId,
            basePrice: Number(s.price),
            durationMinutes: s.durationMinutes ? Number(s.durationMinutes) : undefined,
            isActive: true,
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          throw new Error(
            `The category was created, but service "${s.name.trim()}" failed: ${reason} Fix it and save again; the services already added are kept.`,
          );
        }
        setSavedServices(i + 1);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
      onClose();
    },
    // A half-finished create still added the category: show it in the list.
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEdit && !image) return; // image required on create
    mutation.mutate();
  };

  const setService = (i: number, key: keyof DraftService, value: string) =>
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  const errorMessage =
    mutation.error instanceof ApiError || mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit category" : "Add category"}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name *">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chef"
                className={inputClass}
              />
            </Field>
            <Field label="Parent category">
              <select
                value={parentId}
                onChange={(e) =>
                  setParentId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className={inputClass}
              >
                <option value="">Top-level (no parent)</option>
                {parentOptions.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Skills needed"
              hint={
                parentId === ""
                  ? "The trade-wide default. Every service here with no skill of its own inherits these."
                  : "Applies to every service in this sub-category that has no skill of its own."
              }
              full
            >
              {tagSourceId == null ? (
                <p className="text-sm text-muted-foreground">
                  Save the category first — skills are defined per trade, and
                  this one does not exist yet.
                </p>
              ) : (
                <SkillTagPicker
                  includeMainTag={false}
                  categoryId={tagSourceId}
                  value={tagIds}
                  onChange={(next) => {
                    setTagIds(next);
                    setTagsTouched(true);
                  }}
                  emptyHint="No skill chosen — these services reach only the partners who declared no skill, not the specialists."
                />
              )}
            </Field>
            <Field label="Description" full>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Chefs and kitchen staff"
                className={inputClass}
              />
            </Field>
            <Field label={isEdit ? "Icon (leave empty to keep current)" : "Icon *"} full>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
              />
              {!isEdit && !image && (
                <span className="text-xs text-muted-foreground">
                  A square icon is required to create a category.
                </span>
              )}
            </Field>
            <Field
              label={isEdit ? "Banner (leave empty to keep current)" : "Banner (optional)"}
              full
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBanner(e.target.files?.[0] ?? null)}
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
              />
              <span className="text-xs text-muted-foreground">
                Wide image shown at the top of the category page in the app.
              </span>
            </Field>
            <Field
              label={isEdit ? "Banner video (leave empty to keep current)" : "Banner video (optional)"}
              full
            >
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground`}
              />
              <span className="text-xs text-muted-foreground">
                Optional short video shown at the top of the category page. Plays
                muted on loop and takes priority over the banner image (max 50 MB).
              </span>
            </Field>
          </div>

          {/* Optional services (create mode only) */}
          {!isEdit && (
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Services in this category{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setServices((p) => [...p, emptyService()])}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add service
                </button>
              </div>

              {services.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No services added. You can add them now or later.
                </p>
              ) : (
                <div className="space-y-2">
                  {services.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={s.name}
                        onChange={(e) => setService(i, "name", e.target.value)}
                        placeholder="Service name"
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={s.price}
                        onChange={(e) => setService(i, "price", e.target.value)}
                        placeholder="Price"
                        className={`${inputClass} w-28`}
                      />
                      <input
                        type="number"
                        min={0}
                        value={s.durationMinutes}
                        onChange={(e) => setService(i, "durationMinutes", e.target.value)}
                        placeholder="Min"
                        className={`${inputClass} w-20`}
                      />
                      <button
                        type="button"
                        onClick={() => setServices((p) => p.filter((_, idx) => idx !== i))}
                        aria-label="Remove service"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
              {isEdit ? "Save changes" : "Create category"}
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
    <label className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
