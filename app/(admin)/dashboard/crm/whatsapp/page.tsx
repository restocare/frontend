"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  whatsappInboxApi,
  type WhatsappConversation,
  type WhatsappInboxMessage,
} from "@/src/api/api";
import { API_BASE_URL, ApiError, getToken } from "@/src/api/apiClient";
import { PageHeader } from "@/src/components/crm/ui";
import { SendTemplateModal } from "@/src/components/crm/send-template-modal";
import { SearchIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const LIST_KEY = ["whatsapp-inbox", "conversations"] as const;
const threadKey = (id: number) => ["whatsapp-inbox", "thread", id] as const;

/* ───────────────────────────── formatting ───────────────────────────── */

const IST = "Asia/Kolkata";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

/** "10:42 am" today, "Yesterday", "Mon", or "12/09/26" — as WhatsApp's list does. */
function listStamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => x.toLocaleDateString("en-IN", { timeZone: IST });
  if (day(d) === day(now)) return timeOf(iso);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (day(d) === day(yesterday)) return "Yesterday";
  if (now.getTime() - d.getTime() < 6 * 86_400_000)
    return d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short" });
  return d.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** "Today", "Yesterday", "12 September 2026" — the separators inside a thread. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => x.toLocaleDateString("en-IN", { timeZone: IST });
  if (day(d) === day(now)) return "Today";
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const initials = (name: string | null, phone: string) =>
  (name?.trim() || phone.replace(/\D/g, "").slice(-2))
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Time left in the 24-hour reply window, or null once it has closed. */
function windowLeft(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ─────────────────────────────── page ─────────────────────────────── */

/**
 * The WhatsApp inbox: every thread with the business number on the left, the
 * open one on the right, laid out the way WhatsApp itself is so nobody has to
 * learn it. A customer who replies to a campaign shows up here within a
 * second (the server pushes over the socket); the admin answers in place.
 *
 * WhatsApp's own rule shapes the composer: a typed reply is allowed only for
 * 24 hours after the customer's last message. After that the thread can only
 * be reopened with an approved template, and the composer says so.
 */
export default function WhatsappInboxPage() {
  const qc = useQueryClient();
  const canReply = hasPermission("campaigns.inbox");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: conversations, isLoading } = useQuery({
    queryKey: [...LIST_KEY, debounced],
    queryFn: () => whatsappInboxApi.conversations(debounced || undefined),
    // The socket is the primary signal; this only covers a dropped connection.
    refetchInterval: 30_000,
  });

  // Live updates: the server tells every open panel when a message lands, a
  // reply goes out, or a receipt arrives. Re-fetch just what changed.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const origin = new URL(API_BASE_URL, window.location.origin).origin;
    const socket = io(origin, {
      transports: ["websocket", "polling"],
      auth: { token },
    });
    const join = () => socket.emit("join", { admin: true });
    socket.on("connect", join);
    socket.on(
      "whatsapp_inbox",
      (event: { type: string; conversationId: number }) => {
        qc.invalidateQueries({ queryKey: LIST_KEY });
        qc.invalidateQueries({ queryKey: threadKey(event.conversationId) });
      },
    );
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [qc]);

  const selected = useMemo(
    () => conversations?.find((c) => c.conversationId === selectedId) ?? null,
    [conversations, selectedId],
  );

  const totalUnread = (conversations ?? []).reduce(
    (n, c) => n + c.unreadCount,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="WhatsApp Inbox"
        subtitle={
          totalUnread
            ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"} from customers.`
            : "What customers write back to the business number, and your replies."
        }
      />

      <div className="flex h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Thread list */}
        <aside
          className={`flex w-full flex-col border-r border-border md:w-[360px] md:shrink-0 ${
            selected ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-border p-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                placeholder="Search by name, restaurant or number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            )}
            {!isLoading && !conversations?.length && (
              <p className="p-4 text-sm text-muted-foreground">
                {debounced
                  ? "No conversation matches that."
                  : "No conversations yet. When a customer replies to a campaign or messages the business number, it appears here."}
              </p>
            )}
            {conversations?.map((c) => (
              <ConversationRow
                key={c.conversationId}
                conversation={c}
                active={c.conversationId === selectedId}
                onClick={() => setSelectedId(c.conversationId)}
              />
            ))}
          </div>
        </aside>

        {/* Thread */}
        <section
          className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}
        >
          {selected ? (
            <Thread
              key={selected.conversationId}
              conversation={selected}
              canReply={canReply}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25d366]/15 text-3xl">
                💬
              </div>
              <p className="text-sm font-medium text-foreground">
                Pick a conversation
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Replies to campaigns and anything else a customer sends to the
                business number are listed on the left.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────── list row ─────────────────────────── */

function ConversationRow({
  conversation: c,
  active,
  onClick,
}: {
  conversation: WhatsappConversation;
  active: boolean;
  onClick: () => void;
}) {
  const title = c.name ?? c.phone;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-accent/60 ${
        active ? "bg-accent" : ""
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366]/20 text-sm font-semibold text-[#128c7e]">
        {initials(c.name, c.phone)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <span
            className={`shrink-0 text-[11px] ${c.unreadCount ? "font-semibold text-[#25d366]" : "text-muted-foreground"}`}
          >
            {listStamp(c.lastMessageAt)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {c.restaurantName ? `${c.restaurantName} · ` : ""}
            {c.lastPreview ?? c.phone}
          </span>
          {c.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {c.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* ───────────────────────────── thread ───────────────────────────── */

function Thread({
  conversation: c,
  canReply,
  onBack,
}: {
  conversation: WhatsappConversation;
  canReply: boolean;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: threadKey(c.conversationId),
    queryFn: () => whatsappInboxApi.messages(c.conversationId),
  });

  // Opening the thread reads it, for the badge and for the next admin.
  useEffect(() => {
    if (c.unreadCount > 0) {
      whatsappInboxApi
        .markRead(c.conversationId)
        .then(() => qc.invalidateQueries({ queryKey: LIST_KEY }))
        .catch(() => undefined);
    }
  }, [c.conversationId, c.unreadCount, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  const send = useMutation({
    mutationFn: (body: string) =>
      whatsappInboxApi.reply(c.conversationId, body),
    onSuccess: () => {
      setText("");
      setError(null);
      qc.invalidateQueries({ queryKey: threadKey(c.conversationId) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not send the reply."),
  });

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  };

  const left = windowLeft(c.replyWindowEndsAt);
  const title = c.name ?? c.phone;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-accent md:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25d366]/20 text-sm font-semibold text-[#128c7e]">
          {initials(c.name, c.phone)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {c.phone}
            {c.restaurantName ? ` · ${c.restaurantName}` : ""}
            {c.whatsappName && c.whatsappName !== c.name
              ? ` · on WhatsApp as “${c.whatsappName}”`
              : ""}
          </p>
        </div>
        {c.userId && (
          <a
            href={`/dashboard/crm/customers/${c.userId}`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            Customer record
          </a>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundColor: "#e5ddd5",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      >
        {isLoading && (
          <p className="text-center text-xs text-[#54656f]">Loading…</p>
        )}
        {data?.hasMore && (
          <p className="mb-3 text-center text-[11px] text-[#54656f]">
            Older messages are not shown.
          </p>
        )}
        {data?.messages.map((m, i) => {
          const prev = data.messages[i - 1];
          const newDay = !prev || dayLabel(prev.sentAt) !== dayLabel(m.sentAt);
          return (
            <div key={m.messageId}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-[#54656f] shadow-sm">
                    {dayLabel(m.sentAt)}
                  </span>
                </div>
              )}
              <Bubble message={m} />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3">
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        {c.replyWindowOpen ? (
          <div className="flex items-end gap-2">
            <textarea
              className="max-h-40 min-h-[44px] flex-1 resize-y rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Type a reply…"
              rows={1}
              value={text}
              disabled={!canReply}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!canReply || !text.trim() || send.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white transition hover:opacity-90 disabled:opacity-50"
              aria-label="Send"
              title="Send (Enter). Shift+Enter for a new line."
            >
              {send.isPending ? "…" : "➤"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {c.lastInboundAt
                ? "WhatsApp allows a typed reply only for 24 hours after the customer's last message, and that window has closed."
                : "This customer has not written to you yet, so WhatsApp allows only an approved template."}{" "}
              Send a template to reopen the conversation.
            </p>
            <button
              type="button"
              onClick={() => setTemplateOpen(true)}
              disabled={!canReply}
              className="rounded-xl bg-[#25d366] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Send template
            </button>
          </div>
        )}
        {c.replyWindowOpen && left && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Typed replies allowed for another {left} (WhatsApp&rsquo;s 24-hour
            rule).
          </p>
        )}
      </div>

      {templateOpen && (
        <SendTemplateModal
          userId={c.userId ?? undefined}
          name={c.name}
          mobile={c.waId}
          onClose={() => setTemplateOpen(false)}
          onSent={() => {
            setTemplateOpen(false);
            qc.invalidateQueries({ queryKey: threadKey(c.conversationId) });
            qc.invalidateQueries({ queryKey: LIST_KEY });
          }}
        />
      )}
    </>
  );
}

/* ───────────────────────────── bubble ───────────────────────────── */

const TICK: Record<string, { mark: string; className: string; title: string }> =
  {
    SENT: { mark: "✓", className: "text-[#8696a0]", title: "Sent" },
    DELIVERED: { mark: "✓✓", className: "text-[#8696a0]", title: "Delivered" },
    READ: { mark: "✓✓", className: "text-[#53bdeb]", title: "Read" },
    FAILED: { mark: "!", className: "text-red-600", title: "Failed" },
  };

function Bubble({ message: m }: { message: WhatsappInboxMessage }) {
  const out = m.direction === "OUTBOUND";
  const tick = out && m.status ? TICK[m.status] : null;
  return (
    <div className={`mb-1.5 flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[78%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14px] leading-snug text-[#111b21] shadow-sm ${
          out ? "bg-[#d9fdd3]" : "bg-white"
        }`}
        style={out ? { borderTopRightRadius: 0 } : { borderTopLeftRadius: 0 }}
      >
        {m.type === "template" && (
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#128c7e]">
            Template
          </span>
        )}
        <MediaBlock message={m} />
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        {!m.body && !m.mediaId && !m.mediaUrl && (
          <p className="italic text-[#54656f]">{m.type} message</p>
        )}
        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
          {timeOf(m.sentAt)}
          {tick && (
            <span
              className={`font-semibold ${tick.className}`}
              title={m.status === "FAILED" ? (m.error ?? "Failed") : tick.title}
            >
              {tick.mark}
            </span>
          )}
        </span>
        {m.status === "FAILED" && m.error && (
          <p className="mt-1 text-[11px] text-red-600">{m.error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A picture the customer sent is fetched on demand through the server (Meta
 * keeps media behind the business token); one we sent is just a link.
 */
function MediaBlock({ message: m }: { message: WhatsappInboxMessage }) {
  const isImage =
    m.type === "image" ||
    m.type === "sticker" ||
    (m.mediaMime ?? "").startsWith("image/");
  const { data } = useQuery({
    queryKey: ["whatsapp-inbox", "media", m.messageId],
    queryFn: () => whatsappInboxApi.media(m.messageId),
    enabled: !!m.mediaId && isImage,
    staleTime: Infinity,
  });
  const src = m.mediaUrl ?? data?.dataUrl ?? null;
  if (isImage && src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="mb-1 max-h-72 w-full rounded-md object-cover"
      />
    );
  }
  if (isImage && m.mediaId) {
    return (
      <div className="mb-1 flex h-32 w-56 items-center justify-center rounded-md bg-black/5 text-xs text-[#54656f]">
        Loading photo…
      </div>
    );
  }
  if (m.mediaId || m.mediaUrl) {
    const label: Record<string, string> = {
      video: "🎥 Video",
      audio: "🎤 Voice message",
      document: "📄 Document",
    };
    return (
      <p className="mb-1 text-[13px] text-[#54656f]">
        {label[m.type] ?? `${m.type} attachment`}
        {m.mediaMime ? ` · ${m.mediaMime}` : ""}
      </p>
    );
  }
  return null;
}
