"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  dispatcherApi,
  queryKeys,
  type DispatchTeamRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import {
  LivePartnerMap,
  type FenceOverlay,
  type LivePartnerMapPoint,
} from "@/src/components/dashboard/dispatch-map";
import {
  CloseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UsersIcon,
} from "@/src/components/icons";

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [editorTarget, setEditorTarget] = useState<DispatchTeamRow | null | "new">(null);
  const [membersTarget, setMembersTarget] = useState<DispatchTeamRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DispatchTeamRow | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.dispatchTeams(search.trim()),
    queryFn: () => dispatchApi.listTeams(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dispatcher", "teams"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dispatchApi.deleteTeam(id),
    onSuccess: (res) => {
      setNotice(res.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(e instanceof ApiError ? e.message : "Could not delete the team.");
    },
  });

  const teams = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Group service partners into dispatch teams for zones and allocation.
          </p>
        </div>
        <button
          onClick={() => setEditorTarget("new")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Team
        </button>
      </div>

      {/* Live partner map */}
      <LivePartnersCard />

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {!isLoading && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {teams.length} team{teams.length === 1 ? "" : "s"}
            {isFetching ? " · updating…" : ""}
          </span>
        )}
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2.5 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load teams.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : teams.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No teams match your search." : "No teams yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">Geofences</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr
                    key={t.teamId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{t.name}</p>
                      {t.description && (
                        <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setMembersTarget(t)}
                        className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-primary/10 hover:text-primary"
                      >
                        {t.memberCount} member{t.memberCount === 1 ? "" : "s"} · manage
                      </button>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{t.geofenceCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditorTarget(t)}
                          aria-label="Edit team"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          aria-label="Delete team"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorTarget !== null && (
        <TeamFormDialog
          team={editorTarget === "new" ? null : editorTarget}
          onClose={() => setEditorTarget(null)}
          onSaved={(message) => {
            setEditorTarget(null);
            setNotice(message);
            invalidate();
          }}
        />
      )}

      {membersTarget && (
        <TeamMembersDialog
          team={membersTarget}
          onClose={() => setMembersTarget(null)}
          onSaved={(message) => {
            setMembersTarget(null);
            setNotice(message);
            invalidate();
            // Team membership also affects partner rows (teamId) everywhere.
            queryClient.invalidateQueries({ queryKey: ["dispatcher", "partners"] });
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          danger
          title="Delete this team?"
          confirmLabel="Delete"
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.teamId)}
          message={
            <>
              This will delete <strong className="text-foreground">{deleteTarget.name}</strong>.
              Its members and geofences are kept but left without a team.
            </>
          }
        />
      )}
    </div>
  );
}

/* --------------------------- Live partner map --------------------------- */

function LivePartnersCard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.livePartners,
    queryFn: () => dispatchApi.livePartners(),
    // Live-ish: refresh the snapshot every 30s while the page is open.
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const zones: FenceOverlay[] = useMemo(
    () =>
      (data?.zones ?? []).map((z) => ({
        // Map tooltip reads "Zone · Team" so the covering team is visible on hover.
        name: z.team ? `${z.name} · ${z.team.name}` : z.name,
        color: z.color,
        polygon: z.polygon,
      })),
    [data],
  );
  const points: LivePartnerMapPoint[] = useMemo(
    () =>
      (data?.partners ?? []).map((p) => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        // Colour the pin by its zone; unzoned partners get a neutral slate tone.
        color: p.zoneColor ?? "#94a3b8",
        zoneName: p.zoneName,
        mobile: p.mobile,
      })),
    [data],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Live partner map</h2>
          <p className="text-xs text-muted-foreground">
            Active partners plotted by current location · {data?.totalActive ?? 0} online
            {isFetching ? " · updating…" : ""}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-2xl bg-muted/30 text-center">
          <p className="text-muted-foreground">Couldn’t load live partners.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <LivePartnerMap zones={zones} partners={points} />

          {/* Per-zone active-partner counts */}
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.zones ?? []).map((z) => (
              <span
                key={z.geofenceId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                {z.name}
                <span className="text-muted-foreground">
                  · {z.team ? z.team.name : "No team"}
                </span>
                <strong className="font-semibold">{z.activeCount}</strong>
              </span>
            ))}
            {(data?.unzonedCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#94a3b8" }} />
                Unzoned
                <strong className="font-semibold">{data?.unzonedCount}</strong>
              </span>
            ) : null}
            {data && data.totalActive === 0 ? (
              <span className="text-xs text-muted-foreground">No partners are online right now.</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------- Create / edit dialog ------------------------- */

function TeamFormDialog({
  team,
  onClose,
  onSaved,
}: {
  team: DispatchTeamRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || undefined };
      return team ? dispatchApi.updateTeam(team.teamId, body) : dispatchApi.createTeam(body);
    },
    onSuccess: () => onSaved(team ? "Team updated." : "Team created."),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the team."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="relative z-10 w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {team ? "Edit Team" : "Add Team"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="South Delhi Riders"
            autoFocus
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Description <span className="font-normal text-muted-foreground">(Optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={name.trim().length < 2 || mutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            {team ? "Save Changes" : "Create Team"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------- Members management -------------------------- */

function TeamMembersDialog({
  team,
  onClose,
  onSaved,
}: {
  team: DispatchTeamRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: detail } = useQuery({
    queryKey: queryKeys.dispatchTeam(team.teamId),
    queryFn: () => dispatchApi.getTeam(team.teamId),
  });

  const { data: partners, isLoading } = useQuery({
    queryKey: queryKeys.partners("", "ACTIVE"),
    queryFn: () => dispatcherApi.listPartners(undefined, "ACTIVE"),
  });

  // Seed the selection once the current membership arrives.
  const currentIds = useMemo(
    () => new Set(detail?.members.map((m) => m.professionalId) ?? []),
    [detail],
  );
  const effectiveSelected = selected ?? currentIds;

  const visible = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const list = partners ?? [];
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q),
    );
  }, [partners, memberSearch]);

  const toggle = (id: number) => {
    const next = new Set(effectiveSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const mutation = useMutation({
    mutationFn: () => dispatchApi.setTeamMembers(team.teamId, [...effectiveSelected]),
    onSuccess: () => onSaved("Team members updated."),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not update members."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Manage Members</h3>
            <p className="text-sm text-muted-foreground">
              {team.name} · {effectiveSelected.size} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search partners"
            className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="min-h-40 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <SpinnerIcon className="h-5 w-5" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {memberSearch ? "No partners match your search." : "No active partners yet."}
            </p>
          ) : (
            visible.map((p) => {
              const onAnotherTeam = p.teamId != null && p.teamId !== team.teamId;
              return (
                <label
                  key={p.professionalId}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 transition hover:border-primary/40"
                >
                  <input
                    type="checkbox"
                    checked={effectiveSelected.has(p.professionalId)}
                    onChange={() => toggle(p.professionalId)}
                    className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.city ?? "—"}
                      {onAnotherTeam ? " · on another team (will be moved)" : ""}
                    </span>
                  </span>
                  {p.isOnline && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" title="Online" />
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !detail}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            Save Members
          </button>
        </div>
      </div>
    </div>
  );
}
