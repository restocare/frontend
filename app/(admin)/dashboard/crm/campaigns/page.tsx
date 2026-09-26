"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmCampaignsApi,
  crmQueryKeys,
  type CampaignChannel,
  type CampaignRecipientRow,
  type CampaignRow,
  type CampaignSegment,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  fmtTime,
} from "@/src/components/crm/ui";
import { PencilIcon, PlusIcon, TrashIcon } from "@/src/components/icons";
import {
  TemplateComposer,
  type TemplateChoice,
} from "@/src/components/crm/template-composer";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const CHANNELS: CampaignChannel[] = ["EMAIL", "WHATSAPP", "SMS"];

const SEGMENTS: { key: CampaignSegment; label: string; hint: string }[] = [
  {
    key: "ALL_CLIENTS",
    label: "All clients",
    hint: "Every active customer account",
  },
  {
    key: "ACTIVE_CLIENTS",
    label: "Active clients",
    hint: "Booked in the last 90 days",
  },
  {
    key: "INACTIVE_CLIENTS",
    label: "Inactive clients",
    hint: "Have booked before, but not in the last 90 days",
  },
  {
    key: "HIGH_REVENUE_CLIENTS",
    label: "High revenue clients",
    hint: "Top 20% by completed-booking revenue",
  },
  {
    key: "POTENTIAL_CLIENTS",
    label: "Potential clients",
    hint: "Signed up but never booked",
  },
];

// SELECTED_CUSTOMERS is deliberately absent from SEGMENTS: it is not a rule an
// admin can pick here, it comes from ticking people on the Customers page. It
// still needs a readable label when such a campaign is listed.
const segmentLabel = (key: string) =>
  key === "SELECTED_CUSTOMERS"
    ? "Selected customers"
    : (SEGMENTS.find((s) => s.key === key)?.label ?? key);

const statusToneMap: Record<string, string> = {
  DRAFT: "warning",
  SENDING: "primary",
  SENT: "success",
  FAILED: "danger",
};

export default function CrmCampaignsPage() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [confirmSend, setConfirmSend] = useState<CampaignRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CampaignRow | null>(null);
  const [testing, setTesting] = useState<CampaignRow | null>(null);
  const [viewing, setViewing] = useState<CampaignRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission("campaigns.manage");

  // Deep link: /dashboard/crm/campaigns?new=1 opens the create modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1")
      setAdding(true);
  }, []);

  const params = {
    channel: channel === "ALL" ? undefined : channel,
    status: status === "ALL" ? undefined : status,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.campaigns(params),
    queryFn: () => crmCampaignsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["crm", "campaigns"] });

  const send = useMutation({
    mutationFn: (id: number) => crmCampaignsApi.send(id),
    onSuccess: (c) => {
      setConfirmSend(null);
      setActionError(null);
      setNotice(
        c.status === "SENT"
          ? `Campaign “${c.name}” sent to ${c.sentCount} of ${c.recipientCount} recipients${c.failedCount ? ` (${c.failedCount} failed)` : ""}.`
          : `Campaign “${c.name}” failed — ${c.failedCount} of ${c.recipientCount} sends errored. Check the channel credentials.`,
      );
      invalidate();
    },
    onError: (e) => {
      setConfirmSend(null);
      setActionError(
        e instanceof ApiError ? e.message : "Could not send campaign.",
      );
    },
  });

  /**
   * A template blast is paced over minutes, so the endpoint returns the moment
   * the run starts and the row is polled for progress. The plain /send above
   * returns a finished campaign instead — different shapes, so they cannot
   * share a mutation.
   */
  const sendTemplate = useMutation({
    mutationFn: (id: number) => crmCampaignsApi.sendTemplate(id),
    onSuccess: (r) => {
      setConfirmSend(null);
      setActionError(null);
      setNotice(
        `Sending started — ${r.pending} message${r.pending === 1 ? "" : "s"} queued. Progress updates below as they go out.`,
      );
      invalidate();
    },
    onError: (e) => {
      setConfirmSend(null);
      setActionError(
        e instanceof ApiError ? e.message : "Could not start the campaign.",
      );
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => crmCampaignsApi.remove(id),
    onSuccess: () => {
      setConfirmDelete(null);
      setActionError(null);
      setNotice("Campaign deleted.");
      invalidate();
    },
    onError: (e) => {
      setConfirmDelete(null);
      setActionError(
        e instanceof ApiError ? e.message : "Could not delete campaign.",
      );
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Marketing Campaigns"
        subtitle="Email, WhatsApp and SMS blasts over live customer segments"
        action={
          canManage ? (
            <Btn
              onClick={() => {
                setNotice(null);
                setActionError(null);
                setAdding(true);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              New campaign
            </Btn>
          ) : undefined
        }
      />
      {error instanceof ApiError && (
        <Notice kind="error">{error.message}</Notice>
      )}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="flex flex-wrap gap-3">
        <select
          className={`${inputCls} w-auto`}
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} w-auto`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All statuses</option>
          {["DRAFT", "SENDING", "SENT", "FAILED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <TableShell
          head={[
            "Name",
            "Channel",
            "Segment",
            "Status",
            "Recipients",
            "Sent / Failed",
            "Sent at",
            "By",
            "Actions",
          ]}
        >
          {isLoading && <EmptyRow cols={9} label="Loading campaigns…" />}
          {!isLoading && !data?.campaigns.length && (
            <EmptyRow
              cols={9}
              label="No campaigns yet — create one to reach your clients."
            />
          )}
          {data?.campaigns.map((c) => (
            <tr
              key={c.campaignId}
              className="cursor-pointer text-foreground transition-colors hover:bg-accent/40"
              onClick={() => setViewing(c)}
            >
              <td className="px-4 py-3 font-medium">
                {c.name}
                {c.templateName && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {c.templateName}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone="primary">{c.channel}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone="muted">{segmentLabel(c.segment)}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusToneMap[c.status] ?? "muted"}>
                  {c.status}
                </Badge>
              </td>
              <td className="px-4 py-3">{c.recipientCount || "—"}</td>
              <td className="px-4 py-3">
                {c.status === "SENT" || c.status === "FAILED"
                  ? `${c.sentCount} / ${c.failedCount}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.sentAt ? `${fmtDate(c.sentAt)} ${fmtTime(c.sentAt)}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.createdBy?.name ?? "—"}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    {(c.status === "DRAFT" || c.status === "FAILED") && (
                      <Btn
                        small
                        tone="success"
                        onClick={() => setConfirmSend(c)}
                      >
                        Send
                      </Btn>
                    )}
                    {c.templateName && c.status !== "SENDING" && (
                      <Btn small tone="ghost" onClick={() => setTesting(c)}>
                        Test
                      </Btn>
                    )}
                    {c.status === "DRAFT" && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() => setEditing(c)}
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    {c.status !== "SENDING" && (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-danger transition-colors hover:bg-danger/10"
                        onClick={() => setConfirmDelete(c)}
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {data?.campaigns
            .filter((c) => c.status === "SENDING")
            .map((c) => (
              <tr key={`progress-${c.campaignId}`} className="bg-accent/30">
                <td colSpan={9} className="px-4 py-2">
                  <CampaignProgressBar
                    campaignId={c.campaignId}
                    name={c.name}
                    onDone={invalidate}
                  />
                </td>
              </tr>
            ))}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Btn
              tone="ghost"
              small
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Btn>
            <Btn
              tone="ghost"
              small
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {(adding || editing) && (
        <CampaignFormModal
          campaign={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(name, created) => {
            setAdding(false);
            setEditing(null);
            setActionError(null);
            setNotice(
              `Campaign “${name}” ${created ? "created" : "updated"}. Send it when ready.`,
            );
            invalidate();
          }}
        />
      )}

      {confirmSend && (
        <Modal title="Send campaign now?" onClose={() => setConfirmSend(null)}>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{confirmSend.name}</strong> will
            go out via{" "}
            <strong className="text-foreground">{confirmSend.channel}</strong>{" "}
            to the{" "}
            <strong className="text-foreground">
              {segmentLabel(confirmSend.segment)}
            </strong>{" "}
            segment. The audience is resolved live at send time and messages go
            out immediately.
          </p>
          {confirmSend.channel === "WHATSAPP" && confirmSend.templateName && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sends the approved template{" "}
              <strong className="text-foreground">
                {confirmSend.templateName}
              </strong>
              , paced in the background
              {confirmSend.dailyCap
                ? `, stopping after ${confirmSend.dailyCap} messages`
                : ""}
              . Anyone already messaged by this campaign is skipped, so it is
              safe to run again.
            </p>
          )}
          {confirmSend.channel === "WHATSAPP" && !confirmSend.templateName && (
            <p className="mt-2 text-xs text-muted-foreground">
              This campaign has no template set, so it goes out as free-form
              text — which only reaches customers who messaged you in the last
              24 hours. Add a template to reach everyone.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Btn
              tone="ghost"
              onClick={() => setConfirmSend(null)}
              disabled={send.isPending || sendTemplate.isPending}
            >
              Cancel
            </Btn>
            <Btn
              busy={send.isPending || sendTemplate.isPending}
              onClick={() =>
                confirmSend.channel === "WHATSAPP" && confirmSend.templateName
                  ? sendTemplate.mutate(confirmSend.campaignId)
                  : send.mutate(confirmSend.campaignId)
              }
            >
              {send.isPending || sendTemplate.isPending
                ? "Sending…"
                : "Send now"}
            </Btn>
          </div>
        </Modal>
      )}

      {viewing && (
        <CampaignDetailModal
          campaign={viewing}
          onClose={() => setViewing(null)}
          onTest={(c) => {
            setViewing(null);
            setTesting(c);
          }}
        />
      )}

      {testing && (
        <TestSendModal
          campaign={testing}
          onClose={() => setTesting(null)}
          onSent={(to) => {
            setTesting(null);
            setActionError(null);
            setNotice(
              `Test message sent to ${to}. Check the handset before sending the blast.`,
            );
          }}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete campaign?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <strong className="text-foreground">{confirmDelete.name}</strong>{" "}
            and its send stats.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn
              tone="ghost"
              onClick={() => setConfirmDelete(null)}
              disabled={del.isPending}
            >
              Cancel
            </Btn>
            <Btn
              tone="danger"
              busy={del.isPending}
              onClick={() => del.mutate(confirmDelete.campaignId)}
            >
              Delete campaign
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------- Create / edit modal -------------------------- */

function CampaignFormModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: CampaignRow | null;
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [channel, setChannel] = useState<string>(campaign?.channel ?? "EMAIL");
  const [segment, setSegment] = useState<string>(
    campaign?.segment ?? "ALL_CLIENTS",
  );
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [message, setMessage] = useState(campaign?.message ?? "");
  const [choice, setChoice] = useState<TemplateChoice>({
    name: campaign?.templateName ?? "",
    language: campaign?.templateLanguage ?? "",
    params: campaign?.templateParams ?? [],
  });
  const [dailyCap, setDailyCap] = useState(
    campaign?.dailyCap ? String(campaign.dailyCap) : "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const isWhatsapp = channel === "WHATSAPP";

  // Live audience preview for the picked segment + channel.
  const preview = useQuery({
    queryKey: crmQueryKeys.segmentPreview(segment, channel),
    queryFn: () => crmCampaignsApi.previewSegment(segment, channel),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const cap = Number(dailyCap);
      const body = {
        name: name.trim(),
        channel,
        segment,
        subject: channel === "EMAIL" ? subject.trim() : undefined,
        message: message.trim(),
        // Template settings only mean anything on WhatsApp; sending them on an
        // email campaign would leave stale values behind if the channel changes.
        templateName: isWhatsapp ? choice.name || undefined : undefined,
        templateLanguage: isWhatsapp ? choice.language || undefined : undefined,
        templateParams: isWhatsapp && choice.name ? choice.params : undefined,
        headerMediaUrl: isWhatsapp ? choice.headerMediaUrl : undefined,
        couponCode: isWhatsapp ? choice.couponCode : undefined,
        dailyCap: isWhatsapp && cap > 0 ? cap : undefined,
      };
      return campaign
        ? crmCampaignsApi.update(campaign.campaignId, body)
        : crmCampaignsApi.create(
            body as typeof body & {
              name: string;
              channel: string;
              segment: string;
              message: string;
            },
          );
    },
    onSuccess: (c) => onSaved(c.name, !campaign),
    onError: (e) =>
      setFormError(
        e instanceof ApiError ? e.message : "Could not save the campaign.",
      ),
  });

  const submit = () => {
    if (!name.trim()) return setFormError("Give the campaign a name.");
    if (channel === "EMAIL" && !subject.trim())
      return setFormError("Email campaigns need a subject.");
    if (!message.trim()) return setFormError("Write the campaign message.");
    if (isWhatsapp && choice.name && choice.params.some((p) => !p.trim()))
      return setFormError(
        "Fill every template variable — a blank one sends an empty line.",
      );

    setFormError(null);
    save.mutate();
  };

  const segmentHint = SEGMENTS.find((s) => s.key === segment)?.hint;

  return (
    <Modal
      title={campaign ? "Edit campaign" : "New campaign"}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {formError && <Notice kind="error">{formError}</Notice>}
        <Field label="Campaign name *">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali staffing offer"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Channel">
            <select
              className={inputCls}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segment" hint={segmentHint}>
            <select
              className={inputCls}
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
            >
              {SEGMENTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-accent/40 px-4 py-3 text-sm">
          {preview.isLoading && (
            <span className="text-muted-foreground">Counting audience…</span>
          )}
          {preview.isError && (
            <span className="text-muted-foreground">
              Audience preview unavailable.
            </span>
          )}
          {preview.data && (
            <>
              <span className="font-medium text-foreground">
                ≈ {preview.data.count} reachable recipient
                {preview.data.count === 1 ? "" : "s"}
              </span>
              {preview.data.sample.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  e.g.{" "}
                  {preview.data.sample
                    .map((r) => r.name || r.email || r.mobile)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(", ")}
                </span>
              )}
            </>
          )}
        </div>

        {channel === "EMAIL" && (
          <Field label="Subject *">
            <input
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Trained kitchen staff, on demand"
            />
          </Field>
        )}
        {isWhatsapp && (
          <div className="space-y-4 rounded-xl border border-border bg-accent/20 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Approved template
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Marketing can only go out as a template Meta has approved. Pick
                “no template” to send the free-form message below instead — that
                reaches only customers who messaged you in the last 24 hours.
              </p>
            </div>

            <TemplateComposer
              value={choice}
              onChange={setChoice}
              previewName={preview.data?.sample?.[0]?.name ?? null}
              previewTo={
                preview.data ? `${preview.data.count} recipients` : undefined
              }
              allowNone
            />

            <Field
              label="Daily cap"
              hint="Your WABA tier limit — leave blank for no cap"
            >
              <input
                className={inputCls}
                value={dailyCap}
                onChange={(e) =>
                  setDailyCap(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="2000"
                inputMode="numeric"
              />
            </Field>
          </div>
        )}

        <Field
          label={isWhatsapp && choice.name ? "Internal note *" : "Message *"}
          hint={
            isWhatsapp
              ? choice.name
                ? "Not sent — the approved template above is what customers receive. Kept as a record of the campaign's intent."
                : "WhatsApp free-form texts only reach users active in the last 24h window."
              : undefined
          }
        >
          <textarea
            className={`${inputCls} min-h-32`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi! Restocare can staff your kitchen this festive season…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn busy={save.isPending} onClick={submit}>
            {campaign ? "Save changes" : "Create draft"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------- Live progress ------------------------------- */

/**
 * Polls a running blast. The send loop is paced and outlives the request that
 * started it, so the only honest way to show what is happening is to ask the
 * server. Polling stops once the campaign leaves SENDING.
 */
function CampaignProgressBar({
  campaignId,
  name,
  onDone,
}: {
  campaignId: number;
  name: string;
  onDone: () => void;
}) {
  const { data } = useQuery({
    queryKey: crmQueryKeys.campaignProgress(campaignId),
    queryFn: () => crmCampaignsApi.progress(campaignId),
    refetchInterval: (q) => (q.state.data?.status === "SENDING" ? 3000 : false),
  });

  // Refresh the table once the run finishes so the row shows its final counts.
  useEffect(() => {
    if (data && data.status !== "SENDING") onDone();
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data)
    return (
      <span className="text-xs text-muted-foreground">Starting {name}…</span>
    );

  const { total, sent, delivered, read, failed, skipped, pending } =
    data.counts;
  const done = total - pending;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {name} — {done} of {total} processed
        </span>
        <span className="text-muted-foreground">
          {sent} sent · {delivered} delivered · {read} read
          {failed ? ` · ${failed} failed` : ""}
          {skipped ? ` · ${skipped} skipped` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {data.sampleFailures.length > 0 && (
        <p className="text-xs text-muted-foreground">
          e.g. {data.sampleFailures[0].mobile}: {data.sampleFailures[0].error}
        </p>
      )}
    </div>
  );
}

/* --------------------------- Test send --------------------------------- */

function TestSendModal({
  campaign,
  onClose,
  onSent,
}: {
  campaign: CampaignRow;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const test = useMutation({
    mutationFn: () =>
      crmCampaignsApi.test(
        campaign.campaignId,
        mobile.trim(),
        name.trim() || undefined,
      ),
    onSuccess: (r) => onSent(r.to),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not send the test."),
  });

  return (
    <Modal title="Send a test message" onClose={onClose}>
      <div className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <p className="text-sm text-muted-foreground">
          Sends{" "}
          <strong className="text-foreground">{campaign.templateName}</strong>{" "}
          once, to one number, with this campaign&rsquo;s variables. Do this
          before every blast — a wrong coupon code or a stale expiry date cannot
          be recalled once it has gone to hundreds of people.
        </p>
        <Field label="Mobile number *" hint="With or without the 91 prefix">
          <input
            className={inputCls}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="9953429462"
            inputMode="numeric"
          />
        </Field>
        <Field label="Name" hint="Stands in for {{name}}; defaults to “there”">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prem"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={test.isPending}>
            Cancel
          </Btn>
          <Btn
            busy={test.isPending}
            onClick={() => {
              if (!mobile.trim())
                return setError("Enter a number to test with.");
              setError(null);
              test.mutate();
            }}
          >
            Send test
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- Full details ------------------------------ */

const RECIPIENT_PAGE = 50;

const recipientTone: Record<string, string> = {
  READ: "success",
  DELIVERED: "success",
  SENT: "primary",
  PENDING: "warning",
  FAILED: "danger",
  SKIPPED: "muted",
};

/** A labelled value in the summary grid. */
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

const stamp = (v: string | null) => (v ? `${fmtDate(v)} ${fmtTime(v)}` : "—");

function CampaignDetailModal({
  campaign,
  onClose,
  onTest,
}: {
  campaign: CampaignRow;
  onClose: () => void;
  onTest: (c: CampaignRow) => void;
}) {
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const params = {
    status: status === "ALL" ? undefined : status,
    page,
    limit: RECIPIENT_PAGE,
  };

  // Counts come from progress() rather than the campaign row: the row's
  // sentCount is written once at the end of a run, while delivered/read arrive
  // later over the webhook and only ever show up in the ledger.
  const progress = useQuery({
    queryKey: crmQueryKeys.campaignProgress(campaign.campaignId),
    queryFn: () => crmCampaignsApi.progress(campaign.campaignId),
    refetchInterval: (q) => (q.state.data?.status === "SENDING" ? 3000 : false),
  });

  const list = useQuery({
    queryKey: crmQueryKeys.campaignRecipients(campaign.campaignId, params),
    queryFn: () => crmCampaignsApi.recipients(campaign.campaignId, params),
    placeholderData: keepPreviousData,
  });

  const counts = progress.data?.counts;
  // Campaigns sent before the ledger existed (and every free-form send) have
  // totals on the campaign row but no per-recipient rows. Reading the ledger
  // for those reports six zeros beside a recipient count of 3, so fall back to
  // what was actually recorded and say where the numbers came from.
  const hasLedger = (counts?.total ?? 0) > 0;
  const totalPages = list.data
    ? Math.max(1, Math.ceil(list.data.total / RECIPIENT_PAGE))
    : 1;

  return (
    <Modal title={campaign.name} onClose={onClose} wide>
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail label="Channel">
            <Badge tone="primary">{campaign.channel}</Badge>
          </Detail>
          <Detail label="Segment">{segmentLabel(campaign.segment)}</Detail>
          <Detail label="Status">
            <Badge tone={statusToneMap[campaign.status] ?? "muted"}>
              {campaign.status}
            </Badge>
          </Detail>
          <Detail label="Created by">{campaign.createdBy?.name ?? "—"}</Detail>
          <Detail label="Created">{stamp(campaign.createdAt)}</Detail>
          <Detail label="Sent at">{stamp(campaign.sentAt)}</Detail>
          <Detail label="Daily cap">{campaign.dailyCap ?? "None"}</Detail>
          <Detail label="Recipients">{campaign.recipientCount || "—"}</Detail>
        </dl>

        {campaign.templateName ? (
          <div className="rounded-xl border border-border bg-accent/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Template {campaign.templateName}{" "}
                <span className="font-normal text-muted-foreground">
                  ({campaign.templateLanguage})
                </span>
              </p>
              <Btn small tone="ghost" onClick={() => onTest(campaign)}>
                Send test
              </Btn>
            </div>
            {campaign.templateParams?.length ? (
              <ul className="mt-2 space-y-1">
                {campaign.templateParams.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="w-10 shrink-0 text-muted-foreground">{`{{${i + 1}}}`}</span>
                    <span className="text-foreground">{p}</span>
                    {p === "{{name}}" && (
                      <span className="text-muted-foreground">
                        — the customer&rsquo;s own name
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No variables.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-accent/20 px-4 py-3 text-sm text-muted-foreground">
            No approved template — this campaign sends the free-form message
            below, which only reaches customers who messaged you in the last 24
            hours.
            <p className="mt-2 whitespace-pre-wrap text-foreground">
              {campaign.message}
            </p>
          </div>
        )}

        {counts && hasLedger && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              [
                ["Sent", counts.sent],
                ["Delivered", counts.delivered],
                ["Read", counts.read],
                ["Pending", counts.pending],
                ["Failed", counts.failed],
                ["Skipped", counts.skipped],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg border border-border px-3 py-2 text-center"
              >
                <p className="text-lg font-semibold text-foreground">{n}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {counts && !hasLedger && campaign.status !== "DRAFT" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Recipients", campaign.recipientCount],
                  ["Sent", campaign.sentCount],
                  ["Failed", campaign.failedCount],
                ] as const
              ).map(([label, n]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border px-3 py-2 text-center"
                >
                  <p className="text-lg font-semibold text-foreground">{n}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Totals recorded on the campaign itself. Delivered and read are
              unknown for this send — those arrive over the webhook against a
              per-recipient ledger, which this campaign never had.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Recipients</p>
            <select
              className={`${inputCls} w-auto`}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All</option>
              {[
                "SENT",
                "DELIVERED",
                "READ",
                "PENDING",
                "FAILED",
                "SKIPPED",
              ].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
            <TableShell
              head={[
                "Name",
                "Mobile",
                "Status",
                "Sent",
                "Delivered",
                "Read",
                "Error",
              ]}
            >
              {list.isLoading && (
                <EmptyRow cols={7} label="Loading recipients…" />
              )}
              {!list.isLoading && !list.data?.recipients.length && (
                <EmptyRow
                  cols={7}
                  label={
                    campaign.status === "DRAFT"
                      ? "Nobody yet — the audience is resolved when the campaign is sent."
                      : status !== "ALL"
                        ? "No recipients match this filter."
                        : // Only template blasts write a per-recipient ledger; the
                          // free-form path sends and records totals only.
                          "No per-recipient ledger — this campaign was sent as free-form text, which records totals only."
                  }
                />
              )}
              {list.data?.recipients.map((r: CampaignRecipientRow) => (
                <tr key={r.recipientId} className="text-foreground">
                  <td className="px-4 py-2">{r.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.mobile}</td>
                  <td className="px-4 py-2">
                    <Badge tone={recipientTone[r.status] ?? "muted"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {stamp(r.sentAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {stamp(r.deliveredAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {stamp(r.readAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-danger">
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>

          {list.data && list.data.total > RECIPIENT_PAGE && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {list.data.total} recipients · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Btn
                  tone="ghost"
                  small
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Btn>
                <Btn
                  tone="ghost"
                  small
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
