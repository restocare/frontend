"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatchApi, queryKeys, type GeofenceRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { GeofenceOverviewMap } from "@/src/components/dashboard/dispatch-map";
import {
  PencilIcon,
  PlusIcon,
  PolygonIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/src/components/icons";

export default function GeoFencePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeofenceRow | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.geofences(search.trim()),
    queryFn: () => dispatchApi.listGeofences(search.trim() || undefined),
    placeholderData: keepPreviousData,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dispatcher", "geofences"] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      dispatchApi.updateGeofence(id, { isActive }),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dispatchApi.deleteGeofence(id),
    onSuccess: (res) => {
      setNotice(res.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(e instanceof ApiError ? e.message : "Could not delete the geofence.");
    },
  });

  const fences = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Geo Fence</h1>
          <p className="text-sm text-muted-foreground">
            Polygon service zones — assign a team and service partners to each zone.
          </p>
        </div>
        <Link
          href="/dashboard/dispatcher/geo-fence/new"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Geofence
        </Link>
      </div>

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
            {fences.length} zone{fences.length === 1 ? "" : "s"}
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

      {/* Coverage overview */}
      {fences.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <GeofenceOverviewMap
            fences={fences.map((f) => ({ name: f.name, color: f.color, polygon: f.polygon }))}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load geofences.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : fences.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <PolygonIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? "No zones match your search." : "No geofences yet."}
            </p>
            {!search && (
              <Link
                href="/dashboard/dispatcher/geo-fence/new"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Draw your first zone
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Zone</th>
                  <th className="px-5 py-3 font-medium">Team</th>
                  <th className="px-5 py-3 font-medium">Partners</th>
                  <th className="px-5 py-3 font-medium">Points</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {fences.map((f) => (
                  <tr
                    key={f.geofenceId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/dispatcher/geo-fence/${f.geofenceId}`}
                        className="group flex items-center gap-3"
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-md"
                          style={{ backgroundColor: f.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground group-hover:text-primary group-hover:underline">
                            {f.name}
                          </span>
                          {f.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {f.description}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{f.team?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{f.partnerCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{f.polygon.length}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <button
                          role="switch"
                          aria-checked={f.isActive}
                          onClick={() =>
                            toggleMutation.mutate({ id: f.geofenceId, isActive: !f.isActive })
                          }
                          disabled={toggleMutation.isPending}
                          aria-label={f.isActive ? "Deactivate zone" : "Activate zone"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                            f.isActive ? "bg-success" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              f.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-medium ${
                            f.isActive ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {f.isActive ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/dispatcher/geo-fence/${f.geofenceId}`}
                          aria-label="Edit geofence"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(f)}
                          aria-label="Delete geofence"
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

      {deleteTarget && (
        <ConfirmDialog
          danger
          title="Delete this geofence?"
          confirmLabel="Delete"
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.geofenceId)}
          message={
            <>
              This will delete <strong className="text-foreground">{deleteTarget.name}</strong> and
              its partner assignments. Partners and teams themselves are not affected.
            </>
          }
        />
      )}
    </div>
  );
}
