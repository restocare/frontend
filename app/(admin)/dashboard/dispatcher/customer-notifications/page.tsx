"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customerNotificationsApi,
  queryKeys,
  type CustomerNotificationInput,
  type CustomerNotificationKey,
  type CustomerNotificationTemplate,
  type CustomerNotificationsView,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { hasPermission } from "@/src/lib/auth";
import { SpinnerIcon } from "@/src/components/icons";

/**
 * Dispatcher → Customer Notifications: the four pushes a customer gets about
 * a booking, each its own card with its own Save. The server fills in the
 * booking's details for the placeholders and sends within a minute of the
 * moment; a saved change applies to steps that fire from then on.
 */

const INPUT =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50";

/** How each card describes itself; the timing unit differs by model. */
const CARD: Record<
  CustomerNotificationKey,
  {
    title: string;
    intro: string;
    timingLabel: string;
    timingHint: string;
    unit: "minutes" | "hours";
  }
> = {
  INSTANT_HEAVY_RUSH: {
    title: "Instant booking · heavy rush",
    intro:
      "Optional extra for a booking made less than 6 hours before its start: if no partner has taken it this many minutes after booking, the customer is told and can wait or cancel. Off by default; the heavy-rush push below covers every booking.",
    timingLabel: "Send after (minutes)",
    timingHint:
      "Counted from the moment of booking. Not sent once a partner has the job.",
    unit: "minutes",
  },
  SCHEDULED_WELCOME: {
    title: "Scheduled booking · welcome",
    intro:
      "The first touch, with the service details. Goes to every booking made before this moment.",
    timingLabel: "Send before start (hours)",
    timingHint: "Skipped when the booking was made after this moment.",
    unit: "hours",
  },
  SCHEDULED_THANKS: {
    title: "Scheduled booking · thanks for waiting",
    intro: "A short reminder closer to the start, with the service details.",
    timingLabel: "Send before start (hours)",
    timingHint: "Skipped when the booking was made after this moment.",
    unit: "hours",
  },
  SCHEDULED_HEAVY_RUSH: {
    title: "Scheduled booking · heavy rush",
    intro:
      "Close to the start and still no partner: the customer is told and can wait or cancel. Goes to every booking (bookings need 1 hour 30 minutes' notice, so 1 hour before the start is always after the booking). Not sent once a partner has the job.",
    timingLabel: "Send before start (hours)",
    timingHint: "Only while no partner is assigned.",
    unit: "hours",
  },
};

/** The sample booking every preview is rendered with (same as the server's test send). */
const SAMPLE: Record<string, string> = {
  customerName: "Prakash",
  serviceName: "Kitchen Helper",
  date: "Today",
  time: "5:00 PM – 12 Midnight",
  address: "Cloud kitchen, RC",
  bookingId: "#4821",
};

function render(text: string): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => SAMPLE[k] ?? m);
}

const isHeavyRush = (key: CustomerNotificationKey) =>
  key.endsWith("HEAVY_RUSH");

/** What is typed on a card, as strings so a half-typed number is not clobbered. */
interface Draft {
  enabled: boolean;
  timing: string;
  title: string;
  body: string;
  imageUrl: string;
  popupTitle: string;
  popupBody: string;
  waitLabel: string;
  cancelLabel: string;
}

function draftOf(t: CustomerNotificationTemplate): Draft {
  const hours = CARD[t.key].unit === "hours";
  return {
    enabled: t.enabled,
    timing: String(hours ? t.offsetMinutes / 60 : t.offsetMinutes),
    title: t.title,
    body: t.body,
    imageUrl: t.imageUrl ?? "",
    popupTitle: t.popupTitle ?? "",
    popupBody: t.popupBody ?? "",
    waitLabel: t.waitLabel ?? "",
    cancelLabel: t.cancelLabel ?? "",
  };
}

/** The draft as the request body: only what differs from the saved template. */
function changes(
  t: CustomerNotificationTemplate,
  d: Draft,
): CustomerNotificationInput {
  const hours = CARD[t.key].unit === "hours";
  const timing = Number(d.timing);
  const offsetMinutes = hours ? Math.round(timing * 60) : Math.round(timing);
  const out: CustomerNotificationInput = {};
  if (d.enabled !== t.enabled) out.enabled = d.enabled;
  if (offsetMinutes !== t.offsetMinutes) out.offsetMinutes = offsetMinutes;
  if (d.title.trim() !== t.title) out.title = d.title.trim();
  if (d.body.trim() !== t.body) out.body = d.body.trim();
  if ((d.imageUrl.trim() || null) !== t.imageUrl)
    out.imageUrl = d.imageUrl.trim() || null;
  if (isHeavyRush(t.key)) {
    if ((d.popupTitle.trim() || null) !== t.popupTitle)
      out.popupTitle = d.popupTitle.trim() || null;
    if ((d.popupBody.trim() || null) !== t.popupBody)
      out.popupBody = d.popupBody.trim() || null;
    if ((d.waitLabel.trim() || null) !== t.waitLabel)
      out.waitLabel = d.waitLabel.trim() || null;
    if ((d.cancelLabel.trim() || null) !== t.cancelLabel)
      out.cancelLabel = d.cancelLabel.trim() || null;
  }
  return out;
}

function problemsOf(key: CustomerNotificationKey, d: Draft): string | null {
  const n = Number(d.timing.trim());
  const hours = CARD[key].unit === "hours";
  if (d.timing.trim() === "" || !Number.isFinite(n) || n <= 0)
    return "Enter the timing.";
  if (hours ? n > 72 : n > 24 * 60)
    return hours ? "At most 72 hours." : "At most 1440 minutes.";
  if (!d.title.trim()) return "Enter a title.";
  if (d.title.trim().length > 80)
    return "The title is too long (80 characters).";
  if (!d.body.trim()) return "Enter the text.";
  if (d.body.trim().length > 300)
    return "The text is too long (300 characters).";
  if (isHeavyRush(key) && (!d.waitLabel.trim() || !d.cancelLabel.trim()))
    return "Both buttons need a label.";
  return null;
}

export default function CustomerNotificationsPage() {
  // Safe at render: the dashboard shell mounts pages only after the client auth check.
  const canManage = hasPermission("dispatcher.manage");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.customerNotifications,
    queryFn: () => customerNotificationsApi.list(),
  });

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">
          Couldn’t load the notifications.
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Customer Notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          The push notifications a customer gets about a booking. Each card
          saves on its own and is live within a minute. Every notification is
          sent once per booking, and never after the booking is cancelled,
          completed or has started.
        </p>
        <p className="text-xs text-muted-foreground">
          Placeholders for the title and text:{" "}
          {data.placeholders.map((p) => (
            <code
              key={p}
              className="mr-1 rounded bg-muted px-1 py-0.5"
            >{`{${p}}`}</code>
          ))}
        </p>
      </div>

      {data.templates.map((t) => (
        <TemplateCard
          key={t.key}
          template={t}
          stats={data.last7Days[t.key]}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  stats,
  canManage,
}: {
  template: CustomerNotificationTemplate;
  stats: { sent: number; skipped: number } | undefined;
  canManage: boolean;
}) {
  const card = CARD[template.key];
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftOf(template));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const body = changes(template, draft);
  const dirty = Object.keys(body).length > 0;
  const problem = problemsOf(template.key, draft);
  const disabled = !canManage;

  const save = useMutation({
    mutationFn: () => customerNotificationsApi.update(template.key, body),
    onSuccess: (res) => {
      setError(null);
      setNotice("Saved. Applies to notifications sent from now on.");
      queryClient.setQueryData<CustomerNotificationsView>(
        queryKeys.customerNotifications,
        (v) =>
          v
            ? {
                ...v,
                templates: v.templates.map((x) =>
                  x.key === res.key ? res : x,
                ),
              }
            : v,
      );
      setDraft(draftOf(res));
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : "Could not save.");
    },
  });

  const test = useMutation({
    mutationFn: () => customerNotificationsApi.test(template.key),
    onSuccess: (res) => {
      setError(null);
      setNotice(
        res.result === "SENT"
          ? "Test sent to your phone with the saved text."
          : "No phone with the customer app is signed in to your account, so nothing was sent.",
      );
    },
    onError: (e) => {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : "Could not send the test.");
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => customerNotificationsApi.uploadImage(file),
    onSuccess: (res) => {
      setError(null);
      patch({ imageUrl: res.url });
    },
    onError: (e) => {
      setError(
        e instanceof ApiError ? e.message : "Could not upload the image.",
      );
    },
  });

  const rush = isHeavyRush(template.key);

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {card.title}
          </h2>
          <p className="text-sm text-muted-foreground">{card.intro}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={disabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
          Enabled
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {card.timingLabel}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step={card.unit === "hours" ? 0.5 : 1}
              min={card.unit === "hours" ? 0.5 : 1}
              className={`${INPUT} max-w-[160px]`}
              value={draft.timing}
              disabled={disabled}
              onChange={(e) => patch({ timing: e.target.value })}
            />
            <Hint>{card.timingHint}</Hint>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Title
            </span>
            <input
              className={INPUT}
              value={draft.title}
              maxLength={80}
              disabled={disabled}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Text
            </span>
            <textarea
              className={`${INPUT} min-h-[72px]`}
              value={draft.body}
              maxLength={300}
              disabled={disabled}
              onChange={(e) => patch({ body: e.target.value })}
            />
            <Hint>
              {draft.body.length}/300. Placeholders are filled from the booking.
            </Hint>
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Image
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {draft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.imageUrl}
                  alt=""
                  className="h-16 w-32 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border px-2 text-center text-xs text-muted-foreground">
                  Service&apos;s own photo
                </div>
              )}
              {canManage ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={upload.isPending}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {upload.isPending
                      ? "Uploading…"
                      : draft.imageUrl
                        ? "Replace"
                        : "Upload"}
                  </button>
                  {draft.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => patch({ imageUrl: "" })}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <Hint>
              PNG, JPG or WebP, under 1 MB, about 2:1. Shown under the text on
              Android; iOS shows text only for now.
            </Hint>
          </div>

          {rush ? (
            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Pop-up when the customer taps
              </legend>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Pop-up title
                </span>
                <input
                  className={INPUT}
                  value={draft.popupTitle}
                  maxLength={120}
                  disabled={disabled}
                  onChange={(e) => patch({ popupTitle: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  Pop-up text
                </span>
                <textarea
                  className={`${INPUT} min-h-[60px]`}
                  value={draft.popupBody}
                  maxLength={400}
                  disabled={disabled}
                  onChange={(e) => patch({ popupBody: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    Wait button
                  </span>
                  <input
                    className={INPUT}
                    value={draft.waitLabel}
                    maxLength={30}
                    disabled={disabled}
                    onChange={(e) => patch({ waitLabel: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    Cancel button
                  </span>
                  <input
                    className={INPUT}
                    value={draft.cancelLabel}
                    maxLength={30}
                    disabled={disabled}
                    onChange={(e) => patch({ cancelLabel: e.target.value })}
                  />
                </label>
              </div>
              <Hint>
                The service details on the pop-up come from the booking. Cancel
                goes through the normal cancellation, with its usual rules.
              </Hint>
            </fieldset>
          ) : null}
        </div>

        <Preview draft={draft} rush={rush} stats={stats} />
      </div>

      {problem ? <p className="text-xs text-danger">{problem}</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {canManage ? (
          <>
            <button
              onClick={() => save.mutate()}
              disabled={!!problem || !dirty || save.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
              Save
            </button>
            {dirty && !save.isPending ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(draftOf(template));
                  setNotice(null);
                  setError(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => test.mutate()}
              disabled={test.isPending || dirty}
              title={
                dirty ? "Save first; the test sends the saved text." : undefined
              }
              className="ml-auto rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              {test.isPending ? "Sending…" : "Send a test to my phone"}
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            Requires the dispatcher.manage permission to edit.
          </span>
        )}
        {notice ? (
          <p className="basis-full text-sm text-success">{notice}</p>
        ) : null}
        {error ? (
          <p className="basis-full text-sm text-danger">{error}</p>
        ) : null}
      </div>
    </section>
  );
}

/** The phone, roughly: the tray notification and, for heavy rush, the pop-up. */
function Preview({
  draft,
  rush,
  stats,
}: {
  draft: Draft;
  rush: boolean;
  stats: { sent: number; skipped: number } | undefined;
}) {
  return (
    <aside className="space-y-3">
      <div className="rounded-2xl bg-zinc-900 p-3 text-white">
        <p className="mb-2 text-[10px] text-zinc-400">
          Notification · as the phone shows it
        </p>
        <div className="rounded-xl bg-zinc-800 p-3">
          <p className="flex items-center gap-1 text-[10px] text-zinc-400">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />{" "}
            RestoCare · now
          </p>
          <p className="mt-1 text-sm font-semibold">
            {render(draft.title) || "Title"}
          </p>
          <p className="text-xs text-zinc-300">
            {render(draft.body) || "Text"}
          </p>
          {draft.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.imageUrl}
              alt=""
              className="mt-2 h-24 w-full rounded-lg object-cover"
            />
          ) : null}
        </div>
        {rush ? (
          <div className="mt-3 rounded-xl bg-white p-3 text-foreground">
            <p className="text-sm font-semibold text-zinc-900">
              {render(draft.popupTitle) || "Pop-up title"}
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {render(draft.popupBody) || "Pop-up text"}
            </p>
            <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
              <span className="block font-semibold text-zinc-900">
                {SAMPLE.serviceName} × 1
              </span>
              {SAMPLE.date} · {SAMPLE.time}
              <br />
              {SAMPLE.address}
            </div>
            <div className="mt-2 flex gap-2 text-xs font-semibold">
              <span className="flex-1 rounded-lg border border-zinc-200 py-2 text-center text-zinc-800">
                {draft.cancelLabel || "Cancel"}
              </span>
              <span className="flex-1 rounded-lg bg-primary py-2 text-center text-primary-foreground">
                {draft.waitLabel || "Wait"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
      {stats ? (
        <p className="text-xs text-muted-foreground">
          Last 7 days: {stats.sent} sent, {stats.skipped} closed without sending
          (partner found in time, disabled, or found too late).
        </p>
      ) : null}
    </aside>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-xs text-muted-foreground">{children}</span>
  );
}
