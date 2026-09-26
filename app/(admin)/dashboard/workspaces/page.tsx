"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesApi, type WorkspaceRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { BuildingIcon, PlusIcon, SpinnerIcon, TrashIcon, UsersIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

/**
 * Workspaces a user owns or belongs to. The list endpoint already scopes itself
 * to the caller, so members see only their own workspace(s) while a super admin
 * sees every one.
 */
export default function WorkspacesPage() {
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkspaceRow | null>(null);
  // Creating and deleting a workspace are platform acts, not workspace ones —
  // a workspace owner runs their own workspace but cannot remove it.
  const canManage = hasPermission("workspaces.manage");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["workspaces", "list"],
    queryFn: () => workspacesApi.list(),
  });

  const workspaces = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            A self-contained mini-panel with its own roles, members and task board.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" /> New workspace
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Couldn’t load workspaces.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center">
          <BuildingIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "No workspaces yet. Create one and hand it to a workspace admin."
              : "You don’t belong to a workspace yet."}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
        >
          {workspaces.map((w) => (
            <WorkspaceCard
              key={w.workspaceId}
              workspace={w}
              onDelete={canManage ? () => setDeleting(w) : undefined}
            />
          ))}
        </div>
      )}

      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
      {deleting && (
        <DeleteWorkspaceModal workspace={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function WorkspaceCard({
  workspace: w,
  onDelete,
}: {
  workspace: WorkspaceRow;
  onDelete?: () => void;
}) {
  return (
    <Link
      href={`/dashboard/workspaces/${w.workspaceId}`}
      className="group relative rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BuildingIcon className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {onDelete && (
            <button
              type="button"
              title="Delete workspace"
              // The card is a link, so the click must not also navigate.
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          {w.isOwner && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              Owner
            </span>
          )}
          {!w.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 truncate font-semibold text-foreground group-hover:text-primary">
        {w.name}
      </p>
      <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
        {w.description || "No description"}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="h-3.5 w-3.5" />
          {w.memberCount} member{w.memberCount === 1 ? "" : "s"}
        </span>
        <span>{w.roleCount} roles</span>
        <span>{w.taskCount} tasks</span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">
        Admin: {w.owner?.name ?? "—"}
      </p>
    </Link>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

/** Super-admin action: create a workspace and hand it to a panel user. */
function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Picked from the list below — never typed, so a wrong id is impossible.
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const { data: owners, isLoading: ownersLoading } = useQuery({
    queryKey: ["workspaces", "eligible-owners", ownerSearch],
    queryFn: () => workspacesApi.eligibleOwners(ownerSearch.trim() || undefined),
  });

  const create = useMutation({
    mutationFn: () =>
      workspacesApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        ownerId: ownerId as number,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not create the workspace."),
  });

  const submit = () => {
    if (name.trim().length < 2) return setErr("Enter a workspace name.");
    if (!ownerId) return setErr("Pick the panel user who will run this workspace.");
    setErr(null);
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">New workspace</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Operations"
              className={inputCls}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace admin
            </span>
            <input
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Search panel users by name, email or mobile…"
              className={`${inputCls} mb-2`}
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
              {ownersLoading ? (
                <div className="flex h-16 items-center justify-center text-muted-foreground">
                  <SpinnerIcon className="h-5 w-5" />
                </div>
              ) : (owners ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No panel users match.
                </p>
              ) : (
                (owners ?? []).map((u) => {
                  const picked = ownerId === u.userId;
                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => setOwnerId(u.userId)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition ${
                        picked ? "bg-primary/10 text-primary" : "hover:bg-accent"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email ?? u.mobile ?? `#${u.userId}`}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {u.role.replace("_", " ")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">
              They get full control of this workspace: its roles, members and tasks.
            </span>
          </label>
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={create.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending && <SpinnerIcon className="h-4 w-4" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Deleting a workspace takes its roles, members and task board with it (the
 * schema cascades), so the confirmation says exactly what goes and asks for the
 * name to be typed — the same bar as any other destructive panel action.
 */
function DeleteWorkspaceModal({
  workspace,
  onClose,
}: {
  workspace: WorkspaceRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");

  const remove = useMutation({
    mutationFn: () => workspacesApi.remove(workspace.workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      onClose();
    },
    onError: (e) =>
      setErr(e instanceof ApiError ? e.message : "Could not delete this workspace."),
  });

  const matches = confirmText.trim() === workspace.name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground">Delete “{workspace.name}”?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This removes the workspace along with its{" "}
          <strong className="text-foreground">roles, members and every task on its board</strong>.
          The member logins themselves are kept. This cannot be undone.
        </p>

        <label className="mt-4 block text-sm text-muted-foreground">
          Type <strong className="text-foreground">{workspace.name}</strong> to confirm
          <input
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-danger"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </label>

        {err && <p className="mt-3 text-sm text-danger">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => remove.mutate()}
            disabled={!matches || remove.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {remove.isPending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            Delete workspace
          </button>
        </div>
      </div>
    </div>
  );
}
