"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys, skillTagApi, type SkillTag } from "@/src/api/api";
import { BadgeCheckIcon, SpinnerIcon } from "@/src/components/icons";

/**
 * Multi-select for skill tags, used wherever something declares a skill: a
 * service, a category, or a partner.
 *
 * `categoryId` is the trade the tags come from. A sub-category id is fine — the
 * backend resolves it up to its top-level parent.
 *
 * Selecting nothing is a real, supported choice, and it means different things
 * on each side: a service with no tags falls back to its category's, while a
 * partner with no tags receives every lead in their category. `emptyHint` is
 * how the caller says which.
 */
export function SkillTagPicker({
  categoryId,
  value,
  onChange,
  disabled = false,
  emptyHint,
  /** Partner pickers pass the verified tag ids so ops can see what was checked. */
  verifiedTagIds,
  /**
   * Whether the trade's main tag can be picked. True on a partner ("I take all
   * of this trade"), false on a job — requiring a whole trade is the same as
   * requiring nothing, so offering it would only mislead.
   */
  includeMainTag = true,
}: {
  categoryId: number | null | undefined;
  value: number[];
  onChange: (tagIds: number[]) => void;
  disabled?: boolean;
  emptyHint?: string;
  verifiedTagIds?: number[];
  includeMainTag?: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.skillTags(categoryId ?? undefined),
    queryFn: () => skillTagApi.list({ categoryId: categoryId ?? undefined }),
    enabled: categoryId != null,
  });

  if (categoryId == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Pick a category first — skills belong to a trade.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerIcon className="h-4 w-4 animate-spin" />
        Loading skills…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load skills. Saving still works — the tags are left unchanged.
      </p>
    );
  }

  const tree: SkillTag[] = data ?? [];

  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This category has no main tag yet. Open Skill Tags and sync them.
      </p>
    );
  }

  const verified = new Set(verifiedTagIds ?? []);

  const toggle = (tagId: number) => {
    if (disabled) return;
    onChange(
      value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId],
    );
  };

  const Chip = ({ tag, main }: { tag: SkillTag; main?: boolean }) => {
    const selected = value.includes(tag.tagId);
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={() => toggle(tag.tagId)}
        title={main ? "The whole trade — everything under it" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
          selected
            ? "border-primary bg-primary/10 font-medium text-primary"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
        } ${main ? "border-dashed" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        {main ? `All ${tag.name}` : tag.name}
        {selected && verified.has(tag.tagId) && (
          <BadgeCheckIcon className="h-3.5 w-3.5" aria-label="Verified by ops" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {tree.map((main) => (
        <div key={main.tagId} className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {includeMainTag ? (
              <Chip tag={main} main />
            ) : (
              <span className="text-sm text-muted-foreground">{main.name}:</span>
            )}
            {(main.children ?? []).map((child) => (
              <Chip key={child.tagId} tag={child} />
            ))}
          </div>
          {(main.children ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No sub-skills under {main.name} yet — add them in Skill Tags to
              narrow further.
            </p>
          )}
        </div>
      ))}

      {value.length === 0 && emptyHint && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}
