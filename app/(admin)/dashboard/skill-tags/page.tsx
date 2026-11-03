"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryTreeApi,
  flattenTags,
  queryKeys,
  skillTagApi,
  type CategoryTreeNode,
  type SkillTag,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import {
  BadgeCheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TagIcon,
  TrashIcon,
} from "@/src/components/icons";

/**
 * Skill Tags — the taxonomy behind lead targeting.
 *
 * One trade at a time, because a tag only means anything inside its trade. Three
 * views: the tags themselves, whether each one can actually be served
 * (Coverage), and what is still untagged.
 */

type Tab = "tags" | "coverage" | "untagged";

const TABS: { id: Tab; label: string }[] = [
  { id: "tags", label: "Tags" },
  { id: "coverage", label: "Coverage" },
  { id: "untagged", label: "Not tagged yet" },
];

export default function SkillTagsPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("tags");
  const [tradeId, setTradeId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Tags hang off top-level categories only, so the picker lists just those.
  const { data: tree } = useQuery({
    queryKey: queryKeys.categoryTree,
    queryFn: () => categoryTreeApi.tree(),
  });

  const trades: CategoryTreeNode[] = useMemo(() => tree ?? [], [tree]);
  const trade = trades.find((c) => c.categoryId === tradeId) ?? null;

  // Default to the first trade once the tree arrives.
  const activeTradeId = tradeId ?? trades[0]?.categoryId ?? null;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["skill-tags"], exact: false });

  const fail = (e: unknown, fallback: string) =>
    setNotice({ kind: "error", text: e instanceof ApiError ? e.message : fallback });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <TagIcon className="h-5 w-5" />
            Skill Tags
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            A skill is what a lead is matched on. Attach one to a main category,
            a sub-category or a single service — the most specific level wins —
            and partners declare the same skills. A partner who declares none
            keeps receiving every lead in their category, so tagging never cuts
            anyone off from work.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Trade</span>
          <select
            value={activeTradeId ?? ""}
            onChange={(e) => setTradeId(Number(e.target.value) || null)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {trades.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-success/40 bg-success/10 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-foreground"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "tags" && (
        <TagsTab
          tradeId={activeTradeId}
          tradeName={trade?.name ?? trades[0]?.name ?? ""}
          onDone={(text) => {
            setNotice({ kind: "ok", text });
            invalidate();
          }}
          onError={fail}
        />
      )}

      {tab === "coverage" && <CoverageTab tradeId={activeTradeId} />}

      {tab === "untagged" && (
        <UntaggedTab
          tradeId={activeTradeId}
          onDone={(text) => {
            setNotice({ kind: "ok", text });
            invalidate();
          }}
          onError={fail}
        />
      )}
    </div>
  );
}

/* ------------------------------- Tags tab ------------------------------- */

function TagsTab({
  tradeId,
  tradeName,
  onDone,
  onError,
}: {
  tradeId: number | null;
  tradeName: string;
  onDone: (text: string) => void;
  onError: (e: unknown, fallback: string) => void;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ tagId: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.skillTags(tradeId ?? undefined, showInactive),
    queryFn: () =>
      skillTagApi.list({ categoryId: tradeId ?? undefined, includeInactive: showInactive }),
    enabled: tradeId != null,
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      skillTagApi.create({ name, categoryId: tradeId as number, sortOrder: data?.length ?? 0 }),
    onSuccess: (tag) => {
      setNewName("");
      onDone(`“${tag.name}” added to ${tradeName}.`);
    },
    onError: (e) => onError(e, "Could not add the skill."),
  });

  const rename = useMutation({
    mutationFn: ({ tagId, name }: { tagId: number; name: string }) =>
      skillTagApi.update(tagId, { name }),
    onSuccess: () => {
      setEditing(null);
      onDone("Skill renamed. Everything already tagged keeps its tag.");
    },
    onError: (e) => onError(e, "Could not rename the skill."),
  });

  const setActive = useMutation({
    mutationFn: ({ tagId, isActive }: { tagId: number; isActive: boolean }) =>
      skillTagApi.update(tagId, { isActive }),
    onSuccess: (tag) =>
      onDone(
        tag.isActive
          ? `“${tag.name}” is active again.`
          : `“${tag.name}” deactivated — it is hidden everywhere, and its history is kept.`,
      ),
    onError: (e) => onError(e, "Could not change the skill."),
  });

  const sync = useMutation({
    mutationFn: () => skillTagApi.syncMainTags(),
    onSuccess: (res) =>
      onDone(
        res.created > 0
          ? `Created ${res.created} missing main tag(s). Every one of the ${res.total} categories now has one.`
          : `All ${res.total} categories already have a main tag.`,
      ),
    onError: (e) => onError(e, "Could not sync the main tags."),
  });

  if (tradeId == null) {
    return <p className="text-sm text-muted-foreground">Pick a trade to manage its skills.</p>;
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerIcon className="h-4 w-4 animate-spin" /> Loading skills…
      </p>
    );
  }

  // Scoped to one trade, so this is its main tag and the sub-skills under it.
  const main: SkillTag | undefined = (data ?? [])[0];
  const subSkills: SkillTag[] = main?.children ?? [];

  if (!main) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {tradeName} has no main tag yet. Every category gets one automatically
          — this one was added before skills existed.
        </p>
        <button
          type="button"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {sync.isPending ? "Syncing…" : "Create main tags for all categories"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          Main tag: {main.name}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Created from the category, one per trade. A partner who holds only
          this is a generalist — they are rung for every {tradeName} lead,
          whichever sub-skill it asks for. Add sub-skills below to narrow.
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (name) create.mutate(name);
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`New sub-skill under ${main.name} — e.g. Tandoor Chef`}
          className="min-w-64 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={!newName.trim() || create.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {create.isPending ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          ) : (
            <PlusIcon className="h-4 w-4" />
          )}
          Add sub-skill
        </button>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show deactivated
        </label>
      </form>

      {subSkills.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No sub-skills under {main.name} yet. Until there are, every{" "}
          {tradeName} lead goes to every {tradeName} partner — which is exactly
          how it worked before.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Sub-skill</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Used by</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subSkills.map((tag) => (
                <tr key={tag.tagId} className="border-t border-border">
                  <td className="px-4 py-3">
                    {editing?.tagId === tag.tagId ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = editing.name.trim();
                          if (name) rename.mutate({ tagId: tag.tagId, name });
                        }}
                      >
                        <input
                          autoFocus
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          className="rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                        <button type="submit" className="text-xs font-medium text-primary">
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-xs text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <span
                        className={
                          tag.isActive ? "font-medium text-foreground" : "text-muted-foreground"
                        }
                      >
                        {tag.name}
                        {!tag.isActive && " (deactivated)"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tag.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tag._count
                      ? `${tag._count.services} services · ${tag._count.categories} categories · ${tag._count.partners} partners`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => setEditing({ tagId: tag.tagId, name: tag.name })}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      {tag.isActive ? (
                        <button
                          type="button"
                          title="Deactivate"
                          onClick={() => setActive.mutate({ tagId: tag.tagId, isActive: false })}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActive.mutate({ tagId: tag.tagId, isActive: true })}
                          className="text-xs font-medium text-primary"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A skill is never deleted — deactivating hides it while keeping the
        dispatch history that points at it. Renaming is safe too: matching runs
        on the slug, which never changes. The main tag itself cannot be
        deactivated; unpublish the category instead.
      </p>
    </div>
  );
}

/* ----------------------------- Coverage tab ----------------------------- */

function CoverageTab({ tradeId }: { tradeId: number | null }) {
  const [city, setCity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.skillTagCoverage(tradeId ?? undefined, city || undefined),
    queryFn: () =>
      skillTagApi.coverage({ categoryId: tradeId ?? undefined, city: city || undefined }),
    enabled: tradeId != null,
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerIcon className="h-4 w-4 animate-spin" /> Counting partners…
      </p>
    );
  }

  const rows = data ?? [];
  const blind = rows.filter((r) => r.services > 0 && r.onlinePartners === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city — e.g. Delhi"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <p className="text-sm text-muted-foreground">
          Read this before switching skill matching on.
        </p>
      </div>

      {blind.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <strong className="font-semibold">
            {blind.length} skill{blind.length > 1 ? "s" : ""} have services but nobody online
            {city ? ` in ${city}` : ""}:
          </strong>{" "}
          {blind.map((r) => r.name).join(", ")}. With matching on, those leads
          reach nobody — tag more partners, or leave “fall back to the whole
          category” switched on.
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No skills to report on yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Skill</th>
                <th className="px-4 py-3 font-medium">Required by</th>
                <th className="px-4 py-3 font-medium">Partners</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Online now</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dark = row.services > 0 && row.onlinePartners === 0;
                return (
                  <tr key={row.tagId} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.services} service{row.services === 1 ? "" : "s"}
                      {row.categories > 0 && ` · ${row.categories} categories`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.activePartners}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {row.verifiedPartners > 0 && <BadgeCheckIcon className="h-3.5 w-3.5" />}
                        {row.verifiedPartners}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        dark ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {row.onlinePartners}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Untagged tab ----------------------------- */

function UntaggedTab({
  tradeId,
  onDone,
  onError,
}: {
  tradeId: number | null;
  onDone: (text: string) => void;
  onError: (e: unknown, fallback: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.skillTagsUntagged(tradeId ?? undefined),
    queryFn: () => skillTagApi.untagged(tradeId ?? undefined),
    enabled: tradeId != null,
  });

  const { data: tagTree } = useQuery({
    queryKey: queryKeys.skillTags(tradeId ?? undefined),
    queryFn: () => skillTagApi.list({ categoryId: tradeId ?? undefined }),
    enabled: tradeId != null,
  });

  // Main tag plus its sub-skills — bulk apply can stamp either. Tagging a group
  // with the main tag is the same as leaving it untagged, so only the
  // sub-skills are worth offering here.
  const tags = useMemo(
    () => flattenTags(tagTree).filter((t) => t.parentTagId !== null),
    [tagTree],
  );

  // Bulk apply is scoped to a category, so the picker offers the sub-categories
  // the untagged services actually sit in — tagging a whole group at once is
  // the only practical way through a few hundred services.
  const groups = useMemo(() => {
    const seen = new Map<number, string>();
    for (const row of data?.services.rows ?? []) {
      seen.set(row.category.categoryId, row.category.name);
    }
    return [...seen].map(([categoryId, name]) => ({ categoryId, name }));
  }, [data]);

  const [groupId, setGroupId] = useState<number | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);

  const bulk = useMutation({
    mutationFn: () =>
      skillTagApi.bulkApply({
        categoryId: groupId as number,
        tagIds,
        mode: "add",
      }),
    onSuccess: (res) => {
      setTagIds([]);
      onDone(`Applied ${res.tags} skill(s) to ${res.services} service(s).`);
    },
    onError: (e) => onError(e, "Could not apply the skills."),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerIcon className="h-4 w-4 animate-spin" /> Checking what is left…
      </p>
    );
  }

  const services = data?.services;
  const partners = data?.partners;
  const activeGroup = groupId ?? groups[0]?.categoryId ?? null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Services with nothing to inherit — {services?.count ?? 0}
        </h2>
        <p className="text-sm text-muted-foreground">
          These have no skill of their own, and neither does their category or
          its parent. Their leads go to everyone in the trade.
        </p>

        {groups.length > 0 && tags.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">
              Tag a whole group at once
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeGroup ?? ""}
                onChange={(e) => setGroupId(Number(e.target.value) || null)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {groups.map((g) => (
                  <option key={g.categoryId} value={g.categoryId}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const on = tagIds.includes(tag.tagId);
                  return (
                    <button
                      key={tag.tagId}
                      type="button"
                      onClick={() =>
                        setTagIds(
                          on
                            ? tagIds.filter((id) => id !== tag.tagId)
                            : [...tagIds, tag.tagId],
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        on
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!activeGroup || tagIds.length === 0 || bulk.isPending}
                onClick={() => bulk.mutate()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {bulk.isPending ? "Applying…" : "Apply to every service in the group"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Adds to whatever each service already has; nothing is overwritten.
            </p>
          </div>
        )}

        {services && services.count > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {services.rows.slice(0, 50).map((row) => (
              <li key={row.serviceId} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{row.name}</span>
                <span className="text-muted-foreground">{row.category.name}</span>
              </li>
            ))}
            {services.count > 50 && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground">
                …and {services.count - 50} more.
              </li>
            )}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Every active service inherits a skill. Nothing to do here.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Partners who declared no skills — {partners?.count ?? 0}
        </h2>
        <p className="text-sm text-muted-foreground">
          This is not an error. They keep receiving every lead in their category,
          which is how dispatch worked before skills existed. Tag them to narrow
          what they are alarmed for.
        </p>

        {partners && partners.count > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {partners.rows.slice(0, 50).map((row) => (
              <li
                key={row.professionalId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span className="text-foreground">
                  {row.user?.name ?? `Partner #${row.professionalId}`}
                  {row.user?.mobile && (
                    <span className="ml-2 text-muted-foreground">{row.user.mobile}</span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {row.category?.name ?? "—"}
                  {row.city && ` · ${row.city}`}
                  {row.isOnline && " · online"}
                </span>
              </li>
            ))}
            {partners.count > 50 && (
              <li className="px-4 py-2.5 text-xs text-muted-foreground">
                …and {partners.count - 50} more.
              </li>
            )}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Every active partner has declared at least one skill.
          </p>
        )}
      </section>
    </div>
  );
}
