"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AURA_CATEGORIES,
  auraApi,
  queryKeys,
  type AuraCatalogEntry,
  type AuraCategory,
} from "@/src/api/api";
import { SearchIcon, SpinnerIcon } from "@/src/components/icons";
import { Badge, Btn, EmptyRow, Field, Modal, TableShell, inputCls } from "@/src/components/crm/ui";
import { CategoryBadge, categoryLabel, formatMinutes } from "@/src/components/aura/ui";

export default function AuraCatalogPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <CatalogInner />
    </Suspense>
  );
}

function CatalogInner() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuraCategory | "">("");
  const [unclassified, setUnclassified] = useState(searchParams.get("unclassified") === "1");
  const [editing, setEditing] = useState<AuraCatalogEntry | null>(null);
  const queryClient = useQueryClient();

  const params = {
    search: search.trim() || undefined,
    category: category || undefined,
    unclassified: unclassified || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.auraCatalog(params),
    queryFn: () => auraApi.catalog(params),
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: auraApi.saveCatalog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aura"] });
      toast.success("App classified — existing usage was re-tagged");
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Every package a phone reports lands here. Its category decides how that app moves the
        productivity score; anything still in <span className="font-medium">Other</span> scores
        nothing. Changing a category also re-tags the usage already recorded for it.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search package or app name"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as AuraCategory | "")}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">All categories</option>
          {AURA_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {categoryLabel(key)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={unclassified}
            onChange={(event) => setUnclassified(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          Needs classifying
        </label>

        <Btn tone="ghost" small onClick={() => setEditing(BLANK_ENTRY)}>
          Add package
        </Btn>

        {isFetching && <SpinnerIcon className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <TableShell head={["App", "Package", "Category", "Weight override", "Tracked time", "Users", ""]}>
            {rows.length === 0 ? (
              <EmptyRow cols={7} label="No packages match this filter." />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium text-foreground">{row.appLabel}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.packageName}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={row.category} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {row.pointsPerHour == null ? (
                      <span className="text-xs">category default</span>
                    ) : (
                      `${row.pointsPerHour > 0 ? "+" : ""}${row.pointsPerHour}/h`
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatMinutes(row.totalMinutes)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.userCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Btn tone="ghost" small onClick={() => setEditing(row)}>
                      Edit
                    </Btn>
                  </td>
                </tr>
              ))
            )}
          </TableShell>
        )}
      </div>

      {editing && (
        <CatalogModal
          entry={editing}
          busy={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(body) => saveMutation.mutate(body)}
        />
      )}
    </div>
  );
}

const BLANK_ENTRY = {
  id: "",
  packageName: "",
  appLabel: "",
  category: "OTHER" as AuraCategory,
  pointsPerHour: null,
  isDistracting: false,
  isSystem: false,
  updatedAt: "",
  totalMinutes: 0,
  userCount: 0,
} satisfies AuraCatalogEntry;

function CatalogModal({
  entry,
  busy,
  onClose,
  onSave,
}: {
  entry: AuraCatalogEntry;
  busy: boolean;
  onClose: () => void;
  onSave: (body: {
    packageName: string;
    appLabel: string;
    category: AuraCategory;
    pointsPerHour: number | null;
    isDistracting: boolean;
    isSystem: boolean;
  }) => void;
}) {
  const isNew = !entry.id;
  const [packageName, setPackageName] = useState(entry.packageName);
  const [appLabel, setAppLabel] = useState(entry.appLabel);
  const [category, setCategory] = useState<AuraCategory>(entry.category);
  const [override, setOverride] = useState(entry.pointsPerHour?.toString() ?? "");
  const [isDistracting, setIsDistracting] = useState(entry.isDistracting);
  const [isSystem, setIsSystem] = useState(entry.isSystem);

  const submit = () => {
    if (!packageName.trim()) return toast.error("Package name is required");
    const parsed = override.trim() === "" ? null : Number(override);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < -60 || parsed > 60)) {
      return toast.error("Weight override must be a number between -60 and 60");
    }
    onSave({
      packageName: packageName.trim(),
      appLabel: appLabel.trim() || packageName.trim(),
      category,
      pointsPerHour: parsed,
      isDistracting,
      isSystem,
    });
  };

  return (
    <Modal title={isNew ? "Add package" : entry.appLabel} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Package name" hint="Android application id, e.g. com.instagram.android">
          <input
            value={packageName}
            onChange={(event) => setPackageName(event.target.value)}
            disabled={!isNew}
            className={`${inputCls} ${!isNew ? "opacity-60" : ""} font-mono text-xs`}
          />
        </Field>

        <Field label="Display name">
          <input value={appLabel} onChange={(event) => setAppLabel(event.target.value)} className={inputCls} />
        </Field>

        <Field label="Category" hint="Decides which scoring weight this app inherits.">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as AuraCategory)}
            className={inputCls}
          >
            {AURA_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {categoryLabel(key)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Weight override (points per hour)"
          hint="Leave blank to use the category rate. Use this for the odd app that doesn't behave like its category — LinkedIn inside Social, for example."
        >
          <input
            value={override}
            onChange={(event) => setOverride(event.target.value)}
            placeholder="category default"
            inputMode="numeric"
            className={inputCls}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isDistracting}
            onChange={(event) => setIsDistracting(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          Flag as distracting in the app&apos;s screen-time view
        </label>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isSystem}
            onChange={(event) => setIsSystem(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          <span>
            Phone plumbing — exclude from screen time
            <span className="mt-0.5 block text-xs text-muted-foreground">
              For launchers, System UI and permission dialogs. Their minutes are the gaps between
              real apps, so counting them inflates every total.
            </span>
          </span>
        </label>

        {!isNew && entry.totalMinutes > 0 && (
          <Badge tone="muted">
            {formatMinutes(entry.totalMinutes)} already tracked across {entry.userCount} user(s) — it
            will be re-scored
          </Badge>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn busy={busy} onClick={submit}>
          Save
        </Btn>
      </div>
    </Modal>
  );
}
