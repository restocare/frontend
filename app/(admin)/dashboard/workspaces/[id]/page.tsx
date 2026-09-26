"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workspacesApi,
  type WorkspaceMemberRow,
  type WorkspaceRoleRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * One workspace: its members (with who invited whom) and the roles its admin
 * defines. Every control is gated on `myPermissions` from the API, so a member
 * only sees the actions their workspace role actually allows.
 */
export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = Number(params.id);
  const [tab, setTab] = useState<"members" | "roles">("members");

  const { data: ws, isLoading, isError } = useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn: () => workspacesApi.get(workspaceId),
    enabled: Number.isFinite(workspaceId),
  });

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }
  if (isError || !ws) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Link href="/dashboard/workspaces" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to workspaces
        </Link>
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          You don’t have access to this workspace, or it doesn’t exist.
        </p>
      </div>
    );
  }

  const can = (key: string) => ws.isOwner || ws.myPermissions.includes(key);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/dashboard/workspaces" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to workspaces
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ws.name}</h1>
          {ws.isOwner && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              Owner
            </span>
          )}
          {!ws.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              Inactive
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {ws.description || "No description"} · admin {ws.owner?.name ?? "—"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Members" value={ws.memberCount} />
        <Stat label="Roles" value={ws.roleCount} />
        <Stat label="Tasks" value={ws.taskCount} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["members", "roles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <MembersTab workspaceId={workspaceId} can={can} />
      ) : (
        <RolesTab workspaceId={workspaceId} can={can} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

/* --------------------------------- Members -------------------------------- */

function MembersTab({
  workspaceId,
  can,
}: {
  workspaceId: number;
  can: (key: string) => boolean;
}) {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: () => workspacesApi.members(workspaceId),
  });
  const { data: roles } = useQuery({
    queryKey: ["workspaces", workspaceId, "roles"],
    queryFn: () => workspacesApi.roles(workspaceId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspaces", workspaceId] });

  const setRole = useMutation({
    mutationFn: ({ memberId, roleId }: { memberId: number; roleId: number | null }) =>
      workspacesApi.updateMember(workspaceId, memberId, { workspaceRoleId: roleId }),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not update the member."),
  });

  const remove = useMutation({
    mutationFn: (memberId: number) => workspacesApi.removeMember(workspaceId, memberId),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not remove the member."),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{notice}</p>
      )}
      {can("members.invite") && (
        <div className="flex justify-end">
          <button
            onClick={() => setInviting(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" /> Add member
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Added by</th>
              <th className="px-4 py-3 font-medium">Juniors</th>
              <th className="px-4 py-3 font-medium">Tasks</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No members yet.
                </td>
              </tr>
            )}
            {(members ?? []).map((m: WorkspaceMemberRow) => (
              <tr key={m.memberId} className="transition-colors hover:bg-accent/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email ?? m.mobile ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  {can("members.update") ? (
                    <select
                      value={m.role?.workspaceRoleId ?? ""}
                      onChange={(e) =>
                        setRole.mutate({
                          memberId: m.memberId,
                          roleId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      disabled={setRole.isPending}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                    >
                      <option value="">No role</option>
                      {(roles ?? []).map((r) => (
                        <option key={r.workspaceRoleId} value={r.workspaceRoleId}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground">{m.role?.name ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.invitedBy?.name ?? "— (by owner)"}
                </td>
                <td className="px-4 py-3 text-foreground">{m.juniorCount}</td>
                <td className="px-4 py-3 text-foreground">{m.taskCount}</td>
                <td className="px-4 py-3 text-right">
                  {can("members.remove") && (
                    <button
                      onClick={() => remove.mutate(m.memberId)}
                      title="Remove from workspace"
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviting && (
        <InviteMemberModal
          workspaceId={workspaceId}
          roles={roles ?? []}
          onClose={() => setInviting(false)}
        />
      )}
    </div>
  );
}

function InviteMemberModal({
  workspaceId,
  roles,
  onClose,
}: {
  workspaceId: number;
  roles: WorkspaceRoleRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", roleId: "" });
  const [err, setErr] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () =>
      workspacesApi.inviteMember(workspaceId, {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || undefined,
        password: form.password || undefined,
        workspaceRoleId: form.roleId ? Number(form.roleId) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not add the member."),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">Add member</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <input value={form.name} onChange={set("name")} placeholder="Full name" className={inputCls} autoFocus />
          <input value={form.email} onChange={set("email")} placeholder="Email" type="email" className={inputCls} />
          <input value={form.mobile} onChange={set("mobile")} placeholder="Mobile (optional)" className={inputCls} />
          <div>
            <input
              value={form.password}
              onChange={set("password")}
              placeholder="Initial password"
              type="text"
              className={inputCls}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Required for a new person; leave blank if this email already has a panel login.
            </span>
          </div>
          <select value={form.roleId} onChange={set("roleId")} className={inputCls}>
            <option value="">No role</option>
            {roles.map((r) => (
              <option key={r.workspaceRoleId} value={r.workspaceRoleId}>
                {r.name}
              </option>
            ))}
          </select>
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => invite.mutate()}
            disabled={invite.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {invite.isPending && <SpinnerIcon className="h-4 w-4" />} Add member
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Roles --------------------------------- */

function RolesTab({ workspaceId, can }: { workspaceId: number; can: (key: string) => boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WorkspaceRoleRow | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "roles"],
    queryFn: () => workspacesApi.roles(workspaceId),
  });
  const { data: catalog } = useQuery({
    queryKey: ["workspaces", "catalog"],
    queryFn: () => workspacesApi.catalog(),
  });

  const remove = useMutation({
    mutationFn: (roleId: number) => workspacesApi.removeRole(workspaceId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", workspaceId] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not delete the role."),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{notice}</p>}
      {can("roles.manage") && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" /> New role
          </button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {(roles ?? []).map((r) => (
          <div key={r.workspaceRoleId} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{r.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {r.description || "No description"}
                </p>
              </div>
              {can("roles.manage") && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing(r)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove.mutate(r.workspaceRoleId)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {r.permissions.slice(0, 6).map((p) => (
                <span key={p} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {p}
                </span>
              ))}
              {r.permissions.length > 6 && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  +{r.permissions.length - 6}
                </span>
              )}
            </div>
            <p className="mt-3 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
              <span className="font-semibold text-primary">{r.permissions.length}</span> permissions ·{" "}
              {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      {editing && (
        <RoleModal
          workspaceId={workspaceId}
          role={editing === "new" ? null : editing}
          catalog={catalog ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RoleModal({
  workspaceId,
  role,
  catalog,
  onClose,
}: {
  workspaceId: number;
  role: WorkspaceRoleRow | null;
  catalog: { module: string; actions: string[]; keys: string[] }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [err, setErr] = useState<string | null>(null);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: [...selected],
      };
      return role
        ? workspacesApi.updateRole(workspaceId, role.workspaceRoleId, body)
        : workspacesApi.createRole(workspaceId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save the role."),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">
            {role ? `Edit “${role.name}”` : "New role"}
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name" className={inputCls} autoFocus />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role is for (optional)"
            className={inputCls}
          />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Permissions — these only ever apply inside this workspace
            </p>
            {catalog.map((mod) => (
              <div key={mod.module} className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-medium text-foreground">{titleCase(mod.module)}</p>
                <div className="flex flex-wrap gap-2">
                  {mod.actions.map((action, i) => {
                    const key = mod.keys[i];
                    const on = selected.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggle(key)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {titleCase(action)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={() => (name.trim().length >= 2 ? save.mutate() : setErr("Enter a role name."))}
            disabled={save.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending && <SpinnerIcon className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
