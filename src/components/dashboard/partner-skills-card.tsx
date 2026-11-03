"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, skillTagApi, tagIdsOf } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { BadgeCheckIcon, SpinnerIcon } from "@/src/components/icons";
import { SkillTagPicker } from "@/src/components/dashboard/skill-tag-picker";

/**
 * What this partner can do, and what ops has actually checked.
 *
 * Its own card rather than part of the profile form: skills are a separate
 * table with their own verify action, and declaring a skill is a different
 * decision from confirming it.
 *
 * `categoryId` is the partner's trade. Null means they are unassigned, and
 * there is no trade to take skills from.
 */
export function PartnerSkillsCard({
  professionalId,
  categoryId,
}: {
  professionalId: number;
  categoryId: number | null;
}) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<number[] | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: queryKeys.skillTagsPartner(professionalId),
    queryFn: () => skillTagApi.partnerTags(professionalId),
  });

  const declared = tagIdsOf(links);
  const value = draft ?? declared;
  const dirty = draft != null;

  const verifiedIds = (links ?? []).filter((l) => l.verifiedAt).map((l) => l.tagId);
  // Only what the partner has already declared AND saved can be verified.
  const unverified = declared.filter((id) => !verifiedIds.includes(id));

  const refresh = (saved: Awaited<ReturnType<typeof skillTagApi.partnerTags>>) => {
    queryClient.setQueryData(queryKeys.skillTagsPartner(professionalId), saved);
    queryClient.invalidateQueries({ queryKey: ["skill-tags", "coverage"], exact: false });
    queryClient.invalidateQueries({ queryKey: ["skill-tags", "untagged"], exact: false });
    setDraft(null);
  };

  const save = useMutation({
    mutationFn: () => skillTagApi.setPartnerTags(professionalId, value),
    onSuccess: (saved) => {
      refresh(saved);
      setNotice({
        kind: "ok",
        text: saved.length
          ? "Skills saved. New leads use them right away."
          : "Skills cleared — this partner now receives every lead in their category.",
      });
    },
    onError: (e) =>
      setNotice({
        kind: "error",
        text: e instanceof ApiError ? e.message : "Could not save the skills.",
      }),
  });

  const verify = useMutation({
    mutationFn: () => skillTagApi.verifyPartnerTags(professionalId, unverified),
    onSuccess: (saved) => {
      refresh(saved);
      setNotice({ kind: "ok", text: "Marked as verified." });
    },
    onError: (e) =>
      setNotice({
        kind: "error",
        text: e instanceof ApiError ? e.message : "Could not verify the skills.",
      }),
  });

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Skills</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Which leads this partner is alarmed for. Leaving it empty is a real
            choice — they then receive every lead in their category, exactly as
            before skills existed.
          </p>
        </div>
        {verifiedIds.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-foreground">
            <BadgeCheckIcon className="h-3.5 w-3.5" />
            {verifiedIds.length} verified
          </span>
        )}
      </div>

      {notice && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "bg-success/10 text-foreground"
              : "bg-destructive/10 text-foreground"
          }`}
        >
          {notice.text}
        </p>
      )}

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <SpinnerIcon className="h-4 w-4 animate-spin" /> Loading skills…
        </p>
      ) : (
        <SkillTagPicker
          categoryId={categoryId}
          value={value}
          onChange={setDraft}
          verifiedTagIds={verifiedIds}
          emptyHint="No skill declared — this partner receives every lead in their category."
        />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {save.isPending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
          Save skills
        </button>

        {dirty && (
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Discard
          </button>
        )}

        {unverified.length > 0 && !dirty && (
          <button
            type="button"
            disabled={verify.isPending}
            onClick={() => verify.mutate()}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {verify.isPending ? (
              <SpinnerIcon className="h-4 w-4 animate-spin" />
            ) : (
              <BadgeCheckIcon className="h-4 w-4" />
            )}
            Verify {unverified.length} skill{unverified.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Verifying records that ops checked the skill — it does not change who
        gets a lead, so a half-finished verification pass can never starve
        dispatch. Save a change first, then verify it.
      </p>
    </div>
  );
}
