"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  chatApi,
  chatKeys,
  type ChatConversationRow,
  type ChatMessageRow,
  type ChatTeam,
  type DirectoryEntry,
} from "@/src/api/chat-api";
import { useChatSocket } from "@/src/lib/use-chat-socket";
import { getStoredUser, hasPermission } from "@/src/lib/auth";
import { dayOf, initials, timeOf } from "@/src/components/chat/chat-utils";
import { Btn, Field, Modal, Notice, inputCls } from "@/src/components/crm/ui";
import { SearchIcon, SpinnerIcon, UsersIcon } from "@/src/components/icons";

type Pane = "chats" | "teams";

/**
 * Organisation chat — a Teams-style workspace over the existing messaging
 * engine: team channels on the left rail, direct messages and groups beside
 * them, the conversation on the right. Realtime arrives over the /chat socket.
 */
export default function ChatPage() {
  const qc = useQueryClient();
  const me = getStoredUser();
  const [pane, setPane] = useState<Pane>("chats");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  // Groups and channels are created by chat admins — the same rule the server
  // enforces, mirrored here so the button isn't offered and then refused.
  const canManage = hasPermission("chat.manage");
  const [typingIn, setTypingIn] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Per-conversation "they stopped typing" timers, and our own send-stop timer.
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const myTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: conversations,
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: chatKeys.conversations({}),
    // 50 is the API's ceiling for both this and the message list.
    queryFn: () => chatApi.conversations({ limit: 50 }),
  });
  const { data: teams } = useQuery({ queryKey: chatKeys.myTeams, queryFn: () => chatApi.myTeams() });
  const { data: thread, isFetching: loadingThread } = useQuery({
    queryKey: chatKeys.messages(activeId ?? ""),
    queryFn: () => chatApi.messages(activeId as string),
    enabled: !!activeId,
  });

  const refreshList = () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
  const refreshThread = (id: string) =>
    qc.invalidateQueries({ queryKey: chatKeys.messages(id) });

  /**
   * Put a message straight into the open thread's cache.
   *
   * Refetching the whole thread on every arrival is what made the chat feel
   * slow — a round trip before the text appears. Splicing is instant, and the
   * messageId check keeps the socket echo of our own send from duplicating the
   * optimistic copy already on screen.
   */
  const spliceMessage = (conversationId: string, message: ChatMessageRow) => {
    qc.setQueryData<{ items: ChatMessageRow[] }>(
      chatKeys.messages(conversationId),
      (old) => {
        if (!old) return old;
        if (old.items.some((m) => m.messageId === message.messageId)) return old;
        // Our own message can arrive back over the socket before the POST
        // resolves. Swap it for the placeholder rather than adding a second
        // copy — whichever of the two lands first wins, and the other is a
        // no-op.
        const mine = message.senderId != null && message.senderId === me?.id;
        const placeholder = mine
          ? old.items.find((m) => m.messageId < 0 && m.content === message.content)
          : undefined;
        if (placeholder) {
          return {
            ...old,
            items: old.items.map((m) => (m.messageId === placeholder.messageId ? message : m)),
          };
        }
        // items are newest-first (the API pages backwards), so the newest goes
        // on the front.
        return { ...old, items: [message, ...old.items] };
      },
    );
  };

  // Live updates. A message for the open conversation is spliced in directly;
  // anything else just re-sorts the list and moves the unread badges.
  const { subscribe, unsubscribe, sendTyping } = useChatSocket({
    onMessage: (payload) => {
      const msg = payload as { conversationId?: string; message?: ChatMessageRow };
      if (msg?.conversationId === activeId && msg.message) {
        spliceMessage(msg.conversationId, msg.message);
        // Their message arriving means they have stopped typing.
        setTypingIn((prev) => {
          const next = { ...prev };
          delete next[msg.conversationId as string];
          return next;
        });
      } else if (msg?.conversationId && msg.conversationId === activeId) {
        refreshThread(msg.conversationId);
      }
      refreshList();
    },
    onMessageDeleted: (payload) => {
      const msg = payload as { conversationId?: string };
      if (msg?.conversationId) refreshThread(msg.conversationId);
    },
    onTyping: (payload) => {
      const t = payload as {
        conversationId: string;
        userId: number;
        name?: string;
        isTyping: boolean;
      };
      if (!t?.conversationId || t.userId === me?.id) return;
      setTypingIn((prev) => {
        const next = { ...prev };
        if (t.isTyping) next[t.conversationId] = t.name ?? "Someone";
        else delete next[t.conversationId];
        return next;
      });
      // Self-expire. A "stopped typing" event can be missed (tab closed, socket
      // blip) and a label that says someone is typing forever is worse than a
      // label that disappears a moment early.
      if (t.isTyping) {
        const existing = typingTimers.current[t.conversationId];
        if (existing) clearTimeout(existing);
        typingTimers.current[t.conversationId] = setTimeout(() => {
          setTypingIn((prev) => {
            const next = { ...prev };
            delete next[t.conversationId];
            return next;
          });
        }, 4000);
      }
    },
    onConversationChanged: () => {
      refreshList();
      void qc.invalidateQueries({ queryKey: chatKeys.myTeams });
    },
  });

  // Join/leave the open conversation's room so typing indicators arrive.
  useEffect(() => {
    if (!activeId) return;
    subscribe(activeId);
    void chatApi.markRead(activeId).then(refreshList).catch(() => undefined);
    return () => unsubscribe(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- socket helpers are stable
  }, [activeId]);

  // Drop any pending typing timers when the page goes away.
  useEffect(() => {
    const timers = typingTimers.current;
    const mine = myTypingTimer;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (mine.current) clearTimeout(mine.current);
    };
  }, []);

  // Pin the thread to the newest message whenever it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.items?.length, activeId]);

  /**
   * Optimistic send, WhatsApp-style: the bubble appears the instant you press
   * Enter and the request happens behind it. Waiting for the POST — and then a
   * refetch — before drawing anything is what made this feel sluggish.
   *
   * The placeholder carries a negative id so the socket echo (a real, positive
   * id) can replace it without ever showing the line twice.
   */
  const send = useMutation({
    mutationFn: ({ text }: { text: string; tempId: number }) =>
      chatApi.sendMessage(activeId as string, text),
    onMutate: ({ text, tempId }) => {
      const conversationId = activeId as string;
      const optimistic: ChatMessageRow = {
        messageId: tempId,
        conversationId,
        senderId: me?.id ?? null,
        sender: me ? { userId: me.id, name: me.name, email: me.email } : null,
        type: "TEXT",
        content: text,
        mediaUrl: null,
        isEdited: false,
        deletedForEveryone: false,
        createdAt: new Date().toISOString(),
      };
      spliceMessage(conversationId, optimistic);
      return { conversationId, tempId };
    },
    onSuccess: (saved, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData<{ items: ChatMessageRow[] }>(chatKeys.messages(ctx.conversationId), (old) => {
        if (!old) return old;
        // Three orders are possible and all must end with exactly one copy:
        // the socket echo landed first, the placeholder is still there, or
        // neither (the thread was refetched in between).
        const echoed = old.items.some((m) => m.messageId === saved.messageId);
        if (echoed) {
          return { ...old, items: old.items.filter((m) => m.messageId !== ctx.tempId) };
        }
        if (old.items.some((m) => m.messageId === ctx.tempId)) {
          return {
            ...old,
            items: old.items.map((m) => (m.messageId === ctx.tempId ? saved : m)),
          };
        }
        return { ...old, items: [saved, ...old.items] };
      });
      refreshList();
    },
    onError: (e, _vars, ctx) => {
      // Take the placeholder back out — a bubble that was never delivered must
      // not sit there looking sent.
      if (ctx) {
        qc.setQueryData<{ items: ChatMessageRow[] }>(
          chatKeys.messages(ctx.conversationId),
          (old) =>
            old ? { ...old, items: old.items.filter((m) => m.messageId !== ctx.tempId) } : old,
        );
      }
      setErr(e instanceof ApiError ? e.message : "Message not sent");
    },
  });

  const deleteMessage = useMutation({
    mutationFn: ({ messageId, forEveryone }: { messageId: number; forEveryone: boolean }) =>
      chatApi.deleteMessage(messageId, forEveryone),
    onSuccess: (res) => {
      if (!activeId) return;
      // Mirror the server's outcome in the cache: for-me rows vanish for this
      // user only; for-everyone rows keep their bubble as "removed".
      qc.setQueryData<{ items: ChatMessageRow[] }>(chatKeys.messages(activeId), (old) =>
        old
          ? {
              ...old,
              items: res.deletedForMe
                ? old.items.filter((m) => m.messageId !== res.messageId)
                : old.items.map((m) =>
                    m.messageId === res.messageId
                      ? { ...m, deletedForEveryone: true, content: null }
                      : m,
                  ),
            }
          : old,
      );
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete the message"),
  });

  /** "Delete chat for me": my history clears; the conversation lives on. */
  const clearChat = useMutation({
    mutationFn: (id: string) => chatApi.clearForMe(id),
    onSuccess: (_r, id) => {
      setChatMenuOpen(false);
      qc.setQueryData<{ items: ChatMessageRow[] }>(chatKeys.messages(id), { items: [] });
      refreshList();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not clear the chat"),
  });

  /** Hard delete for everyone — chat admins only; the server re-checks. */
  const deleteChat = useMutation({
    mutationFn: (id: string) => chatApi.adminDeleteConversation(id),
    onSuccess: () => {
      setConfirmDeleteChat(false);
      setChatMenuOpen(false);
      setActiveId(null);
      refreshList();
      void qc.invalidateQueries({ queryKey: chatKeys.myTeams });
    },
    onError: (e) => {
      setConfirmDeleteChat(false);
      setErr(e instanceof ApiError ? e.message : "Could not delete");
    },
  });

  /** Clear the box immediately, tell the room we stopped typing, then send. */
  const submit = () => {
    const text = composer.trim();
    if (!text || !activeId) return;
    setComposer("");
    setErr("");
    if (myTypingTimer.current) clearTimeout(myTypingTimer.current);
    sendTyping(activeId, false);
    send.mutate({ text, tempId: -Date.now() });
  };

  /** Typing pings, throttled, with an automatic "stopped" after a short pause. */
  const onComposerChange = (value: string) => {
    setComposer(value);
    if (!activeId) return;
    sendTyping(activeId, value.length > 0);
    if (myTypingTimer.current) clearTimeout(myTypingTimer.current);
    if (value.length > 0) {
      myTypingTimer.current = setTimeout(() => sendTyping(activeId, false), 2500);
    }
  };

  const items = conversations?.items ?? [];
  // The API returns messages newest-first (it pages backwards from the latest).
  // A transcript reads the other way round: oldest at the top, newest against
  // the composer — which is also where the auto-scroll parks.
  const messages = [...(thread?.items ?? [])].reverse();
  const channelIds = new Set(
    (teams ?? []).flatMap((t) => t.channels.map((c) => c.id)),
  );
  // Channels are shown under their team, so keep them out of the flat list.
  const chats = items.filter((c) => !channelIds.has(c.conversationId));
  const filtered = search.trim()
    ? chats.filter((c) =>
        (c.name ?? c.peer?.name ?? "").toLowerCase().includes(search.trim().toLowerCase()),
      )
    : chats;

  // Computed straight from the queries — the React Compiler memoizes it.
  const active = (() => {
    const inList = items.find((c) => c.conversationId === activeId);
    if (inList) return inList;
    // A channel opened from the rail may not be in the flat list.
    for (const team of teams ?? []) {
      const ch = team.channels.find((c) => c.id === activeId);
      if (ch) {
        return {
          conversationId: ch.id,
          type: "GROUP" as const,
          name: ch.name,
          description: ch.description,
          peer: null,
          participantCount: ch._count?.participants ?? 0,
          avatarUrl: null,
          myRole: "MEMBER" as const,
          unreadCount: 0,
          lastMessage: null,
          lastMessageAt: ch.lastMessageAt,
          isPinned: false,
          isMuted: false,
          teamName: team.name,
        };
      }
    }
    return null;
  })();

  const title = active?.name ?? active?.peer?.name ?? "Select a conversation";

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-[110rem] overflow-hidden rounded-2xl border border-border bg-card">
      {/* ── Rail: teams + chats ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-1 border-b border-border p-2">
          {(["chats", "teams"] as Pane[]).map((p) => (
            <button
              key={p}
              onClick={() => setPane(p)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                pane === p ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {pane === "chats" ? (
          <>
            <div className="relative border-b border-border p-2">
              <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats"
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="flex gap-2 border-b border-border p-2">
              <Btn small onClick={() => setNewChatOpen(true)}>
                New chat
              </Btn>
              {canManage && (
                <Btn small tone="ghost" onClick={() => setNewGroupOpen(true)}>
                  New group
                </Btn>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center p-6 text-muted-foreground">
                  <SpinnerIcon className="h-5 w-5" />
                </div>
              )}
              {filtered.map((c) => (
                <ConversationRow
                  key={c.conversationId}
                  row={c}
                  active={c.conversationId === activeId}
                  typing={typingIn[c.conversationId]}
                  onClick={() => setActiveId(c.conversationId)}
                />
              ))}
              {/* A failed load must not masquerade as an empty inbox. */}
              {!isLoading && listError && (
                <p className="px-4 py-8 text-center text-sm text-danger">
                  {(listError as ApiError).message || "Could not load your chats."}
                </p>
              )}
              {!isLoading && !listError && !filtered.length && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {canManage
                    ? "No conversations yet — start one with a colleague."
                    : "No conversations yet. Your admin adds you to teams and groups."}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            {(teams ?? []).map((team) => (
              <TeamBlock
                key={team.chatTeamId}
                team={team}
                activeId={activeId}
                onOpen={setActiveId}
              />
            ))}
            {!teams?.length && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                You are not in any team yet. An admin can add you from Chat admin.
              </p>
            )}
          </div>
        )}
      </aside>

      {/* ── Conversation ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
            {active ? initials(title) : "—"}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {activeId && typingIn[activeId]
                ? `${typingIn[activeId]} is typing…`
                : active
                  ? active.type === "DIRECT"
                    ? (active.peer?.email ?? "Direct message")
                    : `${active.participantCount} members`
                  : "Pick a chat or channel on the left"}
            </p>
          </div>
          {active && (
            <div className="relative ml-auto flex items-center gap-2">
              {active.type === "GROUP" && (
                <button
                  onClick={() => setMembersOpen(true)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Members
                </button>
              )}
              <button
                onClick={() => setChatMenuOpen((v) => !v)}
                aria-label="Chat options"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                ⋯
              </button>
              {chatMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <button
                    onClick={() => activeId && clearChat.mutate(activeId)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent"
                  >
                    Delete chat for me
                    <span className="block text-xs text-muted-foreground">
                      Clears your copy only
                    </span>
                  </button>
                  {canManage && active.type === "GROUP" && (
                    <button
                      onClick={() => {
                        setChatMenuOpen(false);
                        setConfirmDeleteChat(true);
                      }}
                      className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/10"
                    >
                      Delete group for everyone
                      <span className="block text-xs text-muted-foreground">
                        Removes it and its messages for all members
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {err && (
          <div className="px-5 pt-3">
            <Notice kind="error">{err}</Notice>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {!activeId && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a conversation to start messaging.
            </div>
          )}
          {activeId && loadingThread && !thread && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <SpinnerIcon className="h-5 w-5" />
            </div>
          )}
          {messages.map((m, i, arr) => {
            const prev = arr[i - 1];
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            return (
              <div key={m.messageId}>
                {newDay && (
                  <div className="my-3 text-center text-xs text-muted-foreground">
                    {dayOf(m.createdAt)}
                  </div>
                )}
                <MessageBubble
                  message={m}
                  mine={m.senderId === me?.id}
                  // The server's rule: your own message (48h), or any message
                  // when you run this group (OWNER/ADMIN) or hold chat.manage.
                  canDeleteForEveryone={
                    m.senderId === me?.id ||
                    canManage ||
                    active?.myRole === "OWNER" ||
                    active?.myRole === "ADMIN"
                  }
                  onDelete={(forEveryone) =>
                    deleteMessage.mutate({ messageId: m.messageId, forEveryone })
                  }
                />
              </div>
            );
          })}
        </div>

        {activeId && (
          <div className="border-t border-border p-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <textarea
                value={composer}
                onChange={(e) => onComposerChange(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter starts a new line — chat convention.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder={`Message ${title}`}
                className={`${inputCls} max-h-32 min-h-11 resize-none`}
              />
              <Btn onClick={submit}>Send</Btn>
            </form>
          </div>
        )}
      </section>

      {newChatOpen && (
        <NewChatModal
          onClose={() => setNewChatOpen(false)}
          onOpened={(id) => {
            setNewChatOpen(false);
            setActiveId(id);
            refreshList();
          }}
        />
      )}
      {confirmDeleteChat && activeId && (
        <Modal title="Delete group for everyone" onClose={() => setConfirmDeleteChat(false)}>
          <p className="text-sm text-muted-foreground">
            This permanently removes <span className="font-medium text-foreground">{title}</span>{" "}
            and its entire history for every member. There is no undo.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setConfirmDeleteChat(false)}>
              Cancel
            </Btn>
            <Btn tone="danger" busy={deleteChat.isPending} onClick={() => deleteChat.mutate(activeId)}>
              Delete for everyone
            </Btn>
          </div>
        </Modal>
      )}
      {membersOpen && activeId && (
        <MembersPanel
          conversationId={activeId}
          canManage={canManage}
          onClose={() => setMembersOpen(false)}
        />
      )}
      {newGroupOpen && (
        <NewGroupModal
          onClose={() => setNewGroupOpen(false)}
          onCreated={(id) => {
            setNewGroupOpen(false);
            setActiveId(id);
            refreshList();
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── Pieces ───────────────────────────── */

function ConversationRow({
  row,
  active,
  typing,
  onClick,
}: {
  row: ChatConversationRow;
  active: boolean;
  typing?: string;
  onClick: () => void;
}) {
  const name = row.name ?? row.peer?.name ?? "Unnamed";
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors ${
        active ? "bg-primary/10" : "hover:bg-accent"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-semibold text-foreground">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeOf(row.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {typing ? `${typing} is typing…` : (row.lastMessage?.content ?? "No messages yet")}
          </span>
          {row.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {row.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TeamBlock({
  team,
  activeId,
  onOpen,
}: {
  team: ChatTeam;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-accent"
      >
        <UsersIcon className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{team.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{team.members.length}</span>
      </button>
      {open && (
        <div className="ml-3 border-l border-border pl-2">
          {team.channels.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                activeId === c.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="text-muted-foreground">{c.isPrivateChannel ? "🔒" : "#"}</span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  canDeleteForEveryone,
  onDelete,
}: {
  message: ChatMessageRow;
  mine: boolean;
  canDeleteForEveryone: boolean;
  onDelete: (forEveryone: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (message.type === "SYSTEM") {
    return <p className="my-2 text-center text-xs text-muted-foreground">{message.content}</p>;
  }
  const removed = message.deletedForEveryone;
  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`relative max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        {!mine && (
          <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">
            {message.sender?.name ?? "Unknown"}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {/* WhatsApp-style per-message menu, revealed on hover. */}
          {!removed && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Message options"
              className={`${mine ? "order-first" : "order-last"} rounded p-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100`}
            >
              ▾
            </button>
          )}
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm ${
              mine
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted text-foreground"
            }`}
          >
            {removed ? (
              <span className="italic opacity-70">This message was removed</span>
            ) : (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            )}
          </div>
        </div>
        {menuOpen && !removed && (
          <div
            className={`absolute top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-xl ${mine ? "right-0" : "left-0"}`}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(false);
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-foreground hover:bg-accent"
            >
              Delete for me
            </button>
            {canDeleteForEveryone && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(true);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-danger hover:bg-danger/10"
              >
                Delete for everyone
              </button>
            )}
          </div>
        )}
        <span
          className={`mt-0.5 block text-[10px] text-muted-foreground ${mine ? "text-right" : ""}`}
        >
          {timeOf(message.createdAt)}
          {message.isEdited && " · edited"}
        </span>
      </div>
    </div>
  );
}


function NewChatModal({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (conversationId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const { data } = useQuery({
    queryKey: chatKeys.directory(search),
    queryFn: () => chatApi.directory(search || undefined),
  });

  const start = useMutation({
    mutationFn: (userId: number) => chatApi.startDirect(userId),
    onSuccess: (c) => onOpened(c.conversationId),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not open the chat"),
  });

  return (
    <Modal title="New chat" onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <Field label="Find a colleague">
        <input
          className={inputCls}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or designation"
        />
      </Field>
      <div className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {(data ?? []).map((p: DirectoryEntry) => (
          <button
            key={p.userId}
            onClick={() => start.mutate(p.userId)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
              {initials(p.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-foreground">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[p.designation, p.department].filter(Boolean).join(" · ") || p.email}
              </span>
            </span>
          </button>
        ))}
        {!data?.length && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No colleagues matched.
          </p>
        )}
      </div>
    </Modal>
  );
}

function NewGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const { data } = useQuery({ queryKey: chatKeys.directory(""), queryFn: () => chatApi.directory() });

  const create = useMutation({
    mutationFn: () => chatApi.createGroup({ name: name.trim(), participantIds: picked }),
    onSuccess: (c) => onCreated(c.conversationId),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not create the group"),
  });

  return (
    <Modal title="New group" onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <Field label="Group name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="mb-1 mt-4 text-sm font-medium text-foreground">Members</p>
      <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {(data ?? []).map((p) => (
          <label key={p.userId} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent">
            <input
              type="checkbox"
              checked={picked.includes(p.userId)}
              onChange={() =>
                setPicked((prev) =>
                  prev.includes(p.userId)
                    ? prev.filter((id) => id !== p.userId)
                    : [...prev, p.userId],
                )
              }
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm text-foreground">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.department ?? ""}</span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={create.isPending}
          onClick={() => {
            setErr("");
            if (!name.trim()) return setErr("Give the group a name.");
            if (!picked.length) return setErr("Pick at least one member.");
            create.mutate();
          }}
        >
          Create group
        </Btn>
      </div>
    </Modal>
  );
}

/**
 * Who is in this group, and adding or removing people.
 *
 * The server decides: a group's OWNER/ADMIN may manage its roster, and so may
 * a chat admin. Members without that standing see the list read-only.
 */
function MembersPanel({
  conversationId,
  canManage,
  onClose,
}: {
  conversationId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const { data: conversation } = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatApi.conversation(conversationId),
  });
  const { data: people } = useQuery({
    queryKey: chatKeys.directory(""),
    queryFn: () => chatApi.directory(),
  });

  const iRunThis = canManage || conversation?.myRole === "OWNER" || conversation?.myRole === "ADMIN";
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
    void qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
  };

  const add = useMutation({
    mutationFn: () => chatApi.addParticipants(conversationId, picked),
    onSuccess: () => {
      setPicked([]);
      setErr("");
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not add members"),
  });
  const remove = useMutation({
    mutationFn: (userId: number) => chatApi.removeParticipant(conversationId, userId),
    onSuccess: refresh,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not remove"),
  });

  const current = conversation?.participants ?? [];
  const inGroup = new Set(current.map((p) => p.userId));
  const candidates = (people ?? []).filter((p) => !inGroup.has(p.userId));

  return (
    <Modal title={`${conversation?.name ?? "Group"} · members`} onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
        {current.map((p) => (
          <div key={p.userId} className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                {initials(p.name ?? p.email ?? "?")}
              </span>
              <span>
                <span className="block text-sm text-foreground">{p.name ?? p.email}</span>
                <span className="block text-xs text-muted-foreground">{p.role}</span>
              </span>
            </span>
            {iRunThis && p.role !== "OWNER" && (
              <Btn tone="ghost" small onClick={() => remove.mutate(p.userId)}>
                Remove
              </Btn>
            )}
          </div>
        ))}
        {!current.length && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading members…</p>
        )}
      </div>

      {iRunThis ? (
        <>
          <p className="mb-1 mt-4 text-sm font-medium text-foreground">Add people</p>
          <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {candidates.map((p) => (
              <label
                key={p.userId}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(p.userId)}
                  onChange={() =>
                    setPicked((prev) =>
                      prev.includes(p.userId)
                        ? prev.filter((id) => id !== p.userId)
                        : [...prev, p.userId],
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
            {!candidates.length && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Everyone available is already in this group.
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Btn busy={add.isPending} disabled={!picked.length} onClick={() => add.mutate()}>
              Add {picked.length || ""}
            </Btn>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Only this group&apos;s admins can change who is in it.
        </p>
      )}
    </Modal>
  );
}
