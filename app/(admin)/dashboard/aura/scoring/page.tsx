"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auraApi, queryKeys, type AuraCategory, type AuraScoreRule } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";
import { Btn } from "@/src/components/crm/ui";
import { CategoryBadge, Section, categoryLabel } from "@/src/components/aura/ui";

/**
 * The knobs behind the productivity score. Each category contributes
 * `points per hour × hours`, clamped to its daily cap, on top of a fixed
 * 50-point baseline. Changes apply the next time a day is scored — which
 * happens whenever a user opens the app or the nightly job runs.
 */
export default function AuraScoringPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auraScoreRules,
    queryFn: auraApi.scoreRules,
  });

  const saveMutation = useMutation({
    mutationFn: auraApi.saveScoreRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auraScoreRules });
      toast.success("Weight updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const rules = data ?? [];

  return (
    <div className="space-y-6">
      <Section
        title="How the score is built"
        description="Every day starts at 50. Categories move it from there, then habits, completed tasks, sleep and steps add their own bonuses, and more than 8 hours of screen time takes points back off. The result is clamped to 0–100."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Explainer title="Points per hour" body="How much one hour in this category is worth. Negative values cost the user points." />
          <Explainer title="Daily cap" body="The most this category can add or subtract in a single day, so one long session can't swamp the score." />
          <Explainer title="Per-app overrides" body="Set on individual packages in App Catalog — they beat the category rate." />
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            busy={saveMutation.isPending}
            onSave={(body) => saveMutation.mutate(body)}
          />
        ))}
      </div>
    </div>
  );
}

function Explainer({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function RuleCard({
  rule,
  busy,
  onSave,
}: {
  rule: AuraScoreRule;
  busy: boolean;
  onSave: (body: { category: AuraCategory; pointsPerHour: number; maxPoints: number }) => void;
}) {
  const [points, setPoints] = useState(rule.pointsPerHour);
  const [cap, setCap] = useState(rule.maxPoints);

  // Keep the sliders in step with a refetch (another admin may have changed it).
  useEffect(() => {
    setPoints(rule.pointsPerHour);
    setCap(rule.maxPoints);
  }, [rule.pointsPerHour, rule.maxPoints]);

  const dirty = points !== rule.pointsPerHour || cap !== rule.maxPoints;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <CategoryBadge category={rule.category} />
        <span className="tabular-nums text-sm font-medium text-foreground">
          {points > 0 ? "+" : ""}
          {points} pts/hour
        </span>
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Points per hour</span>
          <span className="tabular-nums">−20 … +20</span>
        </span>
        <input
          type="range"
          min={-20}
          max={20}
          value={points}
          onChange={(event) => setPoints(Number(event.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label={`Points per hour for ${categoryLabel(rule.category)}`}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Daily cap</span>
          <span className="tabular-nums">{cap} pts</span>
        </span>
        <input
          type="range"
          min={0}
          max={60}
          value={cap}
          onChange={(event) => setCap(Number(event.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label={`Daily cap for ${categoryLabel(rule.category)}`}
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {points === 0
            ? "Neutral — no effect on the score."
            : `3 hours here ${points > 0 ? "adds" : "costs"} ${Math.min(Math.abs(points * 3), cap)} pts.`}
        </p>
        <Btn
          small
          busy={busy}
          disabled={!dirty}
          onClick={() => onSave({ category: rule.category, pointsPerHour: points, maxPoints: cap })}
        >
          {dirty ? "Save" : "Saved"}
        </Btn>
      </div>
    </div>
  );
}
