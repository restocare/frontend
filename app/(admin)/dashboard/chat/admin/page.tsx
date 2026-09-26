"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  chatApi,
  chatKeys,
  type AdminConversationRow,
  type ChatTeam,
  type DirectoryEntry,
} from "@/src/api/chat-api";
import { initials } from "@/src/components/chat/chat-utils";
import { crmQueryKeys, hrApi } from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
  inputCls,
} from "@/src/components/crm/ui";
import { PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

/**
 * Chat administration: the teams and channels that shape the workspace, and
 * oversight of every conversation in the organisation.
 */
export default function ChatAdminPage() {
  const tabs = [
    { key: "teams", label: "Teams & channels" },
    { key: "conversations", label: "All conversations" },
  ];
  const [tab, setTab] = useState("teams");

  const { data: overview } = useQuery({
    queryKey: chatKeys.adminOverview,
    queryFn: () => chatApi.adminOverview(),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Chat admin"
        subtitle="Teams, channels and every conversation in the organisation."
      />

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Teams", value: overview.teams },
            { label: "Channels", value: overview.channels },
            { label: "Groups", value: overview.groups },
            { label: "Direct chats", value: overview.directs },
            { label: "Messages", value: overview.messages },
            { label: "Active today", value: overview.activeUsersToday },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <span className="block text-xs text-muted-foreground">{s.label}</span>
              <span className="mt-1 block text-2xl font-semibold text-foreground">{s.value}</span>
            </Card>
          ))}
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "teams" && <TeamsTab />}
      {tab === "conversations" && <ConversationsTab />}
    </div>
  );
}

/* ───────────────────────── Teams & channels ───────────────────────── */

function TeamsTab() {
  const qc = useQueryClient();
  const canManage = hasPermission("chat.manage");
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<ChatTeam | null>(null);
  const [channelFor, setChannelFor] = useState<ChatTeam | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data: teams, error } = useQuery({ queryKey: chatKeys.teams, queryFn: () => chatApi.teams() });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["chat"] });
  };

  const removeTeam = useMutation({
    mutationFn: (id: number) => chatApi.deleteTeam(id),
    onSuccess: (r) => {
      setErr("");
      setNotice(r.message);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete the team"),
  });

  const removeChannel = useMutation({
    mutationFn: (id: string) => chatApi.deleteChannel(id),
    onSuccess: (r) => {
      setErr("");
      setNotice(r.message);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete the channel"),
  });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {canManage && (
        <div className="flex justify-end">
          <Btn onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> Create team
          </Btn>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(teams ?? []).map((team) => (
          <Card key={team.chatTeamId} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">{team.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {team.description || "No description"}
                  {team.department && ` · ${team.department.name}`}
                </p>
              </div>
              <Badge tone="primary">{team.members.length} members</Badge>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Channels
              </p>
              <div className="space-y-1">
                {team.channels.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5"
                  >
                    <span className="truncate text-sm text-foreground">
                      {c.isPrivateChannel ? "🔒" : "#"} {c.name}
                      {c.isDefaultChannel && (
                        <span className="ml-2 text-xs text-muted-foreground">default</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {c._count?.participants ?? 0}
                      </span>
                      {canManage && !c.isDefaultChannel && (
                        <Btn tone="ghost" small onClick={() => removeChannel.mutate(c.id)}>
                          Delete
                        </Btn>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Btn tone="ghost" small onClick={() => setManaging(team)}>
                Members
              </Btn>
              {canManage && (
                <>
                  <Btn tone="ghost" small onClick={() => setChannelFor(team)}>
                    Add channel
                  </Btn>
                  <Btn
                    tone="danger"
                    small
                    busy={removeTeam.isPending}
                    onClick={() => removeTeam.mutate(team.chatTeamId)}
                  >
                    Delete team
                  </Btn>
                </>
              )}
            </div>
          </Card>
        ))}
        {!teams?.length && (
          <Card className="p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            No teams yet — create the first one and everyone in it gets a General channel.
          </Card>
        )}
      </div>

      {creating && (
        <TeamModal
          onClose={() => setCreating(false)}
          onDone={(msg) => {
            setCreating(false);
            setNotice(msg);
            refresh();
          }}
        />
      )}
      {managing && (
        <MembersModal
          team={managing}
          onClose={() => setManaging(null)}
          onChanged={() => refresh()}
        />
      )}
      {channelFor && (
        <ChannelModal
          team={channelFor}
          onClose={() => setChannelFor(null)}
          onDone={(msg) => {
            setChannelFor(null);
            setNotice(msg);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TeamModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const { data: people } = useQuery({
    queryKey: chatKeys.directory(""),
    queryFn: () => chatApi.directory(),
  });
  const { data: departments } = useQuery({
    queryKey: crmQueryKeys.departments,
    queryFn: hrApi.departments,
  });

  const create = useMutation({
    mutationFn: () =>
      chatApi.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
        // Picking a department pulls its whole staff in — the fastest way to
        // stand up a department-wide team.
        departmentId: departmentId ? Number(departmentId) : undefined,
        userIds: picked,
      }),
    onSuccess: (t) => onDone(`Team "${t.name}" created with a General channel`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not create the team"),
  });

  return (
    <Modal title="Create team" onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <Field label="Team name">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kitchen Operations"
        />
      </Field>
      <div className="mt-3">
        <Field label="Description" hint="optional">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Department" hint="everyone in it joins the team automatically">
          <select
            className={inputCls}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">— None —</option>
            {departments?.map((d) => (
              <option key={d.departmentId} value={d.departmentId}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mb-1 mt-4 text-sm font-medium text-foreground">
        {departmentId ? "Anyone else to include" : "Members"}
      </p>
      <PeoplePicker people={people ?? []} picked={picked} onToggle={setPicked} />
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={create.isPending}
          onClick={() => {
            setErr("");
            if (!name.trim()) return setErr("Give the team a name.");
            create.mutate();
          }}
        >
          Create team
        </Btn>
      </div>
    </Modal>
  );
}

function ChannelModal({
  team,
  onClose,
  onDone,
}: {
  team: ChatTeam;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const create = useMutation({
    mutationFn: () =>
      chatApi.createChannel(team.chatTeamId, {
        name: name.trim(),
        isPrivate,
        userIds: isPrivate ? picked : undefined,
      }),
    onSuccess: () => onDone(`Channel "${name.trim()}" added to ${team.name}`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not create the channel"),
  });

  return (
    <Modal title={`New channel in ${team.name}`} onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <Field label="Channel name">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="rota, announcements, incidents…"
        />
      </Field>
      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className="text-sm text-foreground">
          Private — only the people picked below, and new team members are not added
        </span>
      </label>
      {isPrivate && (
        <div className="mt-3">
          <PeoplePicker
            people={team.members.map((m) => ({
              userId: m.userId,
              employeeId: 0,
              name: m.user.name ?? m.user.email ?? `#${m.userId}`,
              email: m.user.email ?? "",
              designation: null,
              department: null,
              avatarUrl: null,
            }))}
            picked={picked}
            onToggle={setPicked}
          />
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={create.isPending}
          onClick={() => {
            setErr("");
            if (!name.trim()) return setErr("Give the channel a name.");
            create.mutate();
          }}
        >
          Create channel
        </Btn>
      </div>
    </Modal>
  );
}

function MembersModal({
  team,
  onClose,
  onChanged,
}: {
  team: ChatTeam;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canManage = hasPermission("chat.manage");
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const { data: people } = useQuery({
    queryKey: chatKeys.directory(""),
    queryFn: () => chatApi.directory(),
  });

  const add = useMutation({
    mutationFn: () => chatApi.addTeamMembers(team.chatTeamId, { userIds: picked }),
    onSuccess: () => {
      setPicked([]);
      onChanged();
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not add members"),
  });
  const remove = useMutation({
    mutationFn: (userId: number) => chatApi.removeTeamMember(team.chatTeamId, userId),
    onSuccess: onChanged,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not remove"),
  });

  const inTeam = new Set(team.members.map((m) => m.userId));
  const candidates = (people ?? []).filter((p) => !inTeam.has(p.userId));

  return (
    <Modal title={`${team.name} · members`} onClose={onClose} wide>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {team.members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                {initials(m.user.name ?? m.user.email ?? "?")}
              </span>
              <span>
                <span className="block text-sm text-foreground">{m.user.name ?? m.user.email}</span>
                <span className="block text-xs text-muted-foreground">{m.role}</span>
              </span>
            </span>
            {canManage && m.role !== "OWNER" && (
              <Btn tone="ghost" small onClick={() => remove.mutate(m.userId)}>
                Remove
              </Btn>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <p className="mb-1 mt-4 text-sm font-medium text-foreground">
            Add people — they join every open channel
          </p>
          <PeoplePicker people={candidates} picked={picked} onToggle={setPicked} />
          <div className="mt-4 flex justify-end">
            <Btn busy={add.isPending} disabled={!picked.length} onClick={() => add.mutate()}>
              Add {picked.length || ""} to {team.name}
            </Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

function PeoplePicker({
  people,
  picked,
  onToggle,
}: {
  people: DirectoryEntry[];
  picked: number[];
  onToggle: (next: number[]) => void;
}) {
  return (
    <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
      {people.map((p) => (
        <label
          key={p.userId}
          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
        >
          <input
            type="checkbox"
            checked={picked.includes(p.userId)}
            onChange={() =>
              onToggle(
                picked.includes(p.userId)
                  ? picked.filter((id) => id !== p.userId)
                  : [...picked, p.userId],
              )
            }
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{p.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {[p.designation, p.department].filter(Boolean).join(" · ") || p.email}
            </span>
          </span>
        </label>
      ))}
      {!people.length && (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nobody left to add.</p>
      )}
    </div>
  );
}

/* ──────────────────────── All conversations ──────────────────────── */

function ConversationsTab() {
  const qc = useQueryClient();
  const canManage = hasPermission("chat.manage");
  const [type, setType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("org");
  const [reading, setReading] = useState<AdminConversationRow | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const params = { type, search: search.trim() || undefined, scope };
  const { data, error } = useQuery({
    queryKey: chatKeys.adminConversations(params),
    queryFn: () => chatApi.adminConversations(params),
  });

  const remove = useMutation({
    mutationFn: (id: string) => chatApi.adminDeleteConversation(id),
    onSuccess: (r) => {
      setErr("");
      setNotice(r.message);
      void qc.invalidateQueries({ queryKey: ["chat", "admin"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete"),
  });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {["ALL", "CHANNEL", "GROUP", "DIRECT"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className={`${inputCls} ml-auto max-w-xs`}
        />
      </div>

      {/* This backend also carries the consumer app's chats. Reading those is a
          deliberate act, not the default view. */}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={scope === "all"}
          onChange={(e) => setScope(e.target.checked ? "all" : "org")}
          className="h-3.5 w-3.5 accent-[var(--color-primary)]"
        />
        Include conversations outside the organisation (customer app chats)
      </label>

      <Card>
        <TableShell head={["Conversation", "Type", "People", "Messages", "Last activity", ""]}>
          {(data ?? []).map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.team ? `Team: ${c.team.name}` : "—"}
                  {c.isPrivateChannel && " · private"}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={c.type === "CHANNEL" ? "primary" : c.type === "GROUP" ? "success" : "muted"}>
                  {c.type}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{c.participantCount}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.messageCount}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.lastMessageAt)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Btn tone="ghost" small onClick={() => setReading(c)}>
                    Open
                  </Btn>
                  {canManage && !c.isDefaultChannel && (
                    <Btn
                      tone="danger"
                      small
                      busy={remove.isPending}
                      onClick={() => remove.mutate(c.id)}
                    >
                      Delete
                    </Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!data?.length && <EmptyRow cols={6} label="No conversations in this view." />}
        </TableShell>
      </Card>

      {reading && <TranscriptModal row={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

function TranscriptModal({
  row,
  onClose,
}: {
  row: AdminConversationRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const canManage = hasPermission("chat.manage");
  const [err, setErr] = useState("");
  const { data } = useQuery({
    queryKey: ["chat", "admin", "transcript", row.id],
    queryFn: () => chatApi.adminMessages(row.id),
  });

  const removeMessage = useMutation({
    mutationFn: (messageId: number) => chatApi.adminDeleteMessage(messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "admin", "transcript", row.id] }),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not remove the message"),
  });

  return (
    <Modal title={row.name} onClose={onClose} wide>
      {err && <Notice kind="error">{err}</Notice>}
      <p className="mb-3 text-xs text-muted-foreground">
        {row.participantCount} people · {row.messageCount} messages
        {row.team && ` · team ${row.team.name}`}
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
        {(data?.messages ?? []).map((m) => (
          <div key={m.messageId} className="group flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold">
              {initials(m.sender?.name ?? "?")}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground">
                {m.sender?.name ?? "System"}
              </span>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {m.deletedForEveryone ? <em>removed</em> : m.content}
              </p>
            </div>
            {canManage && !m.deletedForEveryone && (
              <button
                onClick={() => removeMessage.mutate(m.messageId)}
                className="shrink-0 text-xs text-danger opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!data?.messages.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
      </div>
    </Modal>
  );
}
