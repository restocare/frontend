"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmCampaignsApi,
  crmQueryKeys,
  type TemplateButton,
  type WhatsappTemplate,
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
} from "@/src/components/crm/ui";
import { PlusIcon, TrashIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const CATEGORIES = [
  {
    key: "MARKETING",
    hint: "Offers and promotions. Recipients can mute these, and Meta caps how many they receive.",
  },
  {
    key: "UTILITY",
    hint: "About something the customer already did — a booking, an order, a payment.",
  },
  { key: "AUTHENTICATION", hint: "One-time passcodes only." },
];

const statusTone: Record<string, string> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  PAUSED: "danger",
  DISABLED: "danger",
};

/** Meta numbers variables from 1; find how many the body actually uses. */
const variablesIn = (body: string) => {
  const found = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return found.length ? Math.max(...found) : 0;
};

export default function WhatsappTemplatesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WhatsappTemplate | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission("campaigns.templates");

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.whatsappTemplates,
    queryFn: () => crmCampaignsApi.templates(),
    retry: false,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: crmQueryKeys.whatsappTemplates });

  const del = useMutation({
    mutationFn: (name: string) => crmCampaignsApi.deleteTemplate(name),
    onSuccess: () => {
      setConfirmDelete(null);
      setActionError(null);
      setNotice("Template deleted.");
      invalidate();
    },
    onError: (e) => {
      setConfirmDelete(null);
      setActionError(
        e instanceof ApiError ? e.message : "Could not delete the template.",
      );
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="WhatsApp Templates"
        subtitle="Marketing can only be sent as a template Meta has reviewed and approved"
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
              New template
            </Btn>
          ) : undefined
        }
      />

      {error instanceof ApiError && (
        <Notice kind="error">{error.message}</Notice>
      )}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <Card>
        <TableShell
          head={[
            "Name",
            "Category",
            "Language",
            "Status",
            "Message",
            "Vars",
            "",
          ]}
        >
          {isLoading && (
            <EmptyRow cols={7} label="Reading templates from Meta…" />
          )}
          {!isLoading && !data?.length && (
            <EmptyRow
              cols={7}
              label="No templates yet — create one and Meta will review it."
            />
          )}
          {data?.map((t) => (
            <tr
              key={`${t.name}|${t.language}`}
              className="align-top text-foreground"
            >
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3">
                <Badge tone={t.category === "MARKETING" ? "primary" : "muted"}>
                  {t.category}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{t.language}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[t.status] ?? "muted"}>{t.status}</Badge>
              </td>
              <td className="max-w-md px-4 py-3 text-xs text-muted-foreground">
                <span className="whitespace-pre-wrap">{t.body}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {t.variableCount || "—"}
              </td>
              <td className="px-4 py-3">
                {canManage && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-danger transition-colors hover:bg-danger/10"
                    onClick={() => setConfirmDelete(t)}
                    title="Delete template"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {adding && (
        <NewTemplateModal
          onClose={() => setAdding(false)}
          onCreated={(name, status) => {
            setAdding(false);
            setActionError(null);
            setNotice(
              `“${name}” submitted — Meta says ${status}. Approval usually takes a few minutes; it appears in campaign dropdowns once APPROVED.`,
            );
            invalidate();
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete this template?"
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{confirmDelete.name}</strong>{" "}
            will be removed from Meta, in every language. Campaigns that still
            name it will start failing, and the name cannot be reused
            immediately.
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
              onClick={() => del.mutate(confirmDelete.name)}
            >
              Delete template
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------- Create modal ------------------------------ */

function NewTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string, status: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en");
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE">(
    "NONE",
  );
  const [header, setHeader] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  // The uploaded picture: Meta's handle goes on the template, the URL is what
  // the preview shows (and what campaigns send the finished template with).
  const [headerImage, setHeaderImage] = useState<{
    handle: string;
    url: string;
  } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Meta requires one sample per {{n}}. The count follows the body as it is
  // typed, so the example boxes appear and disappear with the placeholders.
  const varCount = useMemo(() => variablesIn(body), [body]);
  const headerHasVar = /\{\{\d+\}\}/.test(header);

  /**
   * Insert the next {{n}} at the cursor, the way Meta's own editor does.
   * Typing placeholders by hand is where numbering goes wrong — skip a number
   * or repeat one and Meta rejects the whole template.
   */
  const setButtonAt = (i: number, patch: Partial<TemplateButton>) =>
    setButtons((prev) =>
      prev.map((b, n) => (n === i ? { ...b, ...patch } : b)),
    );

  const insertBodyVariable = () => {
    const el = bodyRef.current;
    const token = `{{${varCount + 1}}}`;
    if (!el) return setBody((b) => b + token);
    const at = el.selectionStart ?? body.length;
    setBody(body.slice(0, at) + token + body.slice(el.selectionEnd ?? at));
    // Put the caret after what was just inserted.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at + token.length, at + token.length);
    });
  };

  // A header may hold exactly one variable, and it is always {{1}} — its
  // numbering is independent of the body's.
  const insertHeaderVariable = () => {
    if (headerHasVar) return;
    const el = headerRef.current;
    const at = el?.selectionStart ?? header.length;
    setHeader(
      header.slice(0, at) + "{{1}}" + header.slice(el?.selectionEnd ?? at),
    );
    requestAnimationFrame(() => el?.focus());
  };
  const filledExamples = useMemo(
    () => Array.from({ length: varCount }, (_, i) => examples[i] ?? ""),
    [varCount, examples],
  );

  const preview = useMemo(
    () =>
      body.replace(
        /\{\{(\d+)\}\}/g,
        (_, n: string) => filledExamples[Number(n) - 1] || `{{${n}}}`,
      ),
    [body, filledExamples],
  );

  const uploadImage = useMutation({
    mutationFn: (file: File) => crmCampaignsApi.uploadTemplateHeaderImage(file),
    onSuccess: (r) => {
      setHeaderImage(r);
      setImageError(null);
    },
    onError: (e) =>
      setImageError(
        e instanceof ApiError ? e.message : "Could not upload the image.",
      ),
  });

  const create = useMutation({
    mutationFn: () =>
      crmCampaignsApi.createTemplate({
        name: name.trim(),
        category,
        language: language.trim(),
        body: body.trim(),
        bodyExamples: filledExamples,
        headerFormat: headerFormat === "NONE" ? undefined : headerFormat,
        header:
          headerFormat === "TEXT" ? header.trim() || undefined : undefined,
        headerHandle:
          headerFormat === "IMAGE" ? headerImage?.handle : undefined,
        headerImageUrl: headerFormat === "IMAGE" ? headerImage?.url : undefined,
        headerExample:
          headerFormat === "TEXT" && headerHasVar
            ? headerExample.trim() || undefined
            : undefined,
        footer: footer.trim() || undefined,
        buttons: buttons.length ? buttons : undefined,
      }),
    onSuccess: (r) => onCreated(name.trim(), r.status),
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : "Meta rejected the template.",
      ),
  });

  const categoryHint = CATEGORIES.find((c) => c.key === category)?.hint;

  return (
    <Modal title="New WhatsApp template" onClose={onClose} wide>
      <div className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Name *" hint="lowercase, digits and _ only">
            <input
              className={inputCls}
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                )
              }
              placeholder="diwali_offer"
            />
          </Field>
          <Field label="Category *" hint={categoryHint}>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language *" hint="e.g. en, en_US, hi">
            <input
              className={inputCls}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
            />
          </Field>
        </div>

        <Field
          label="Header"
          hint="What sits at the top of the message: nothing, a bold line, or a picture"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["NONE", "None"],
                  ["TEXT", "Text"],
                  ["IMAGE", "Image"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHeaderFormat(key)}
                  className={`rounded-lg border px-3 py-1 text-xs transition ${
                    headerFormat === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {headerFormat === "TEXT" && (
              <>
                <input
                  ref={headerRef}
                  className={inputCls}
                  value={header}
                  maxLength={60}
                  onChange={(e) => setHeader(e.target.value)}
                  placeholder="Diwali offer"
                />
                <div className="flex items-center justify-between">
                  <Btn
                    tone="ghost"
                    small
                    onClick={insertHeaderVariable}
                    disabled={headerHasVar}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add variable
                  </Btn>
                  <span className="text-xs text-muted-foreground">
                    {header.length}/60
                  </span>
                </div>
                {headerHasVar && (
                  <input
                    className={inputCls}
                    value={headerExample}
                    onChange={(e) => setHeaderExample(e.target.value)}
                    placeholder="Sample for the header variable, e.g. Diwali"
                  />
                )}
              </>
            )}

            {headerFormat === "IMAGE" && (
              <div className="space-y-2">
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setImageError("The image must be 5 MB or smaller.");
                      return;
                    }
                    uploadImage.mutate(file);
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  {headerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={headerImage.url}
                      alt="Header"
                      className="h-20 w-36 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                      No image yet
                    </div>
                  )}
                  <div className="space-y-1">
                    <Btn
                      tone="ghost"
                      small
                      busy={uploadImage.isPending}
                      onClick={() => imageRef.current?.click()}
                    >
                      {headerImage ? "Replace image" : "Upload image"}
                    </Btn>
                    <p className="text-xs text-muted-foreground">
                      JPEG or PNG, up to 5 MB. Landscape works best — WhatsApp
                      shows it about 1.9 : 1. This is the sample Meta reviews
                      and the picture campaigns send.
                    </p>
                  </div>
                </div>
                {imageError && <Notice kind="error">{imageError}</Notice>}
              </div>
            )}
          </div>
        </Field>

        <Field
          label="Message *"
          hint="Use {{1}}, {{2}} … for anything that changes per customer, numbered in order"
        >
          <div className="space-y-2">
            <textarea
              ref={bodyRef}
              className={`${inputCls} min-h-32`}
              value={body}
              maxLength={1024}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                "Hi {{1}},\n\nGet {{2}} OFF your next booking. Use code {{3}} before {{4}}."
              }
            />
            <div className="flex items-center justify-between">
              <Btn tone="ghost" small onClick={insertBodyVariable}>
                <PlusIcon className="h-3.5 w-3.5" />
                Add variable
              </Btn>
              <span className="text-xs text-muted-foreground">
                {body.length}/1024
              </span>
            </div>
          </div>
        </Field>

        {varCount > 0 && (
          <Field
            label="Example values *"
            hint="Meta reviews the template with these filled in and rejects it outright if any is blank"
          >
            <div className="space-y-2">
              {filledExamples.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">{`{{${i + 1}}}`}</span>
                  <input
                    className={inputCls}
                    value={v}
                    onChange={(e) =>
                      setExamples((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={i === 0 ? "Prem" : "50%"}
                  />
                </div>
              ))}
            </div>
          </Field>
        )}

        <Field label="Footer" hint="Optional small print under the message">
          <div className="space-y-2">
            <input
              className={inputCls}
              value={footer}
              maxLength={60}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Reply STOP to opt out"
            />
            <div className="text-right text-xs text-muted-foreground">
              {footer.length}/60
            </div>
          </div>
        </Field>

        <Field
          label="Buttons"
          hint="Up to 3. A link opens a page, a call button dials you, a quick reply sends its own text back, a copy button puts the coupon code on the clipboard (the real code is set when you send)."
        >
          <div className="space-y-2">
            {buttons.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  className={`${inputCls} w-auto`}
                  value={b.type}
                  onChange={(e) =>
                    setButtonAt(i, {
                      type: e.target.value as TemplateButton["type"],
                    })
                  }
                >
                  <option value="URL">Visit website</option>
                  <option value="PHONE_NUMBER">Call phone number</option>
                  <option value="QUICK_REPLY">Quick reply</option>
                  <option value="COPY_CODE">Copy offer code</option>
                </select>
                {b.type === "COPY_CODE" ? (
                  <input
                    className={`${inputCls} w-44`}
                    value={b.example ?? ""}
                    maxLength={15}
                    onChange={(e) =>
                      setButtonAt(i, {
                        example: e.target.value.toUpperCase(),
                        text: "Copy offer code",
                      })
                    }
                    placeholder="Sample code, e.g. RESTO200"
                  />
                ) : (
                  <input
                    className={`${inputCls} w-40`}
                    value={b.text}
                    maxLength={25}
                    onChange={(e) => setButtonAt(i, { text: e.target.value })}
                    placeholder="Book now"
                  />
                )}
                {b.type === "URL" && (
                  <input
                    className={`${inputCls} flex-1`}
                    value={b.url ?? ""}
                    onChange={(e) => setButtonAt(i, { url: e.target.value })}
                    placeholder="https://www.restocare.in/"
                  />
                )}
                {b.type === "PHONE_NUMBER" && (
                  <input
                    className={`${inputCls} flex-1`}
                    value={b.phoneNumber ?? ""}
                    onChange={(e) =>
                      setButtonAt(i, { phoneNumber: e.target.value })
                    }
                    placeholder="+919953532995"
                  />
                )}
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-danger transition-colors hover:bg-danger/10"
                  onClick={() =>
                    setButtons((prev) => prev.filter((_, n) => n !== i))
                  }
                  title="Remove button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {buttons.length < 3 && (
              <Btn
                tone="ghost"
                small
                onClick={() =>
                  setButtons((prev) => [
                    ...prev,
                    { type: "URL", text: "", url: "" },
                  ])
                }
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add button
              </Btn>
            )}
          </div>
        </Field>

        <WhatsappPreview
          headerFormat={headerFormat}
          headerText={
            headerHasVar
              ? header.replace(/\{\{1\}\}/g, headerExample || "{{1}}")
              : header
          }
          imageUrl={headerImage?.url ?? null}
          body={preview}
          footer={footer}
          buttons={buttons}
        />

        <p className="text-xs text-muted-foreground">
          Meta reviews every template. It arrives as PENDING and only becomes
          selectable in campaigns once APPROVED — usually a few minutes,
          occasionally a day.
        </p>

        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Btn>
          <Btn
            busy={create.isPending}
            onClick={() => {
              if (!name.trim()) return setError("Give the template a name.");
              if (!body.trim()) return setError("Write the message.");
              if (filledExamples.some((v) => !v.trim()))
                return setError(
                  "Fill every example value — Meta rejects a blank one.",
                );
              if (buttons.some((b) => b.type !== "COPY_CODE" && !b.text.trim()))
                return setError("Every button needs a label.");
              if (buttons.some((b) => b.type === "URL" && !b.url?.trim()))
                return setError("A website button needs a URL.");
              if (
                buttons.some(
                  (b) => b.type === "PHONE_NUMBER" && !b.phoneNumber?.trim(),
                )
              )
                return setError("A call button needs a phone number.");
              if (
                headerFormat === "TEXT" &&
                headerHasVar &&
                !headerExample.trim()
              )
                return setError("The header variable needs an example value.");
              if (headerFormat === "TEXT" && !header.trim())
                return setError("Type the header, or set the header to None.");
              if (headerFormat === "IMAGE" && !headerImage)
                return setError("Upload the header image first.");
              if (
                buttons.some(
                  (b) => b.type === "COPY_CODE" && !b.example?.trim(),
                )
              )
                return setError("A copy-code button needs a sample code.");
              setError(null);
              create.mutate();
            }}
          >
            Submit to Meta
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The message the way WhatsApp will draw it — the same picture Meta shows in
 * its own template editor — so what an admin approves here is what a customer
 * sees: picture or bold line on top, the body with samples filled in, the
 * small-print footer, a time stamp, and each button on its own row with its
 * icon. Empty until there is a body to show.
 */
function WhatsappPreview({
  headerFormat,
  headerText,
  imageUrl,
  body,
  footer,
  buttons,
}: {
  headerFormat: "NONE" | "TEXT" | "IMAGE";
  headerText: string;
  imageUrl: string | null;
  body: string;
  footer: string;
  buttons: TemplateButton[];
}) {
  if (!body.trim() && headerFormat === "NONE") return null;
  const shown = buttons.filter((b) =>
    b.type === "COPY_CODE" ? true : b.text.trim(),
  );
  const label = (b: TemplateButton) =>
    b.type === "COPY_CODE" ? "Copy offer code" : b.text;
  const glyph = (b: TemplateButton) =>
    b.type === "URL"
      ? "↗"
      : b.type === "PHONE_NUMBER"
        ? "📞"
        : b.type === "COPY_CODE"
          ? "⧉"
          : "↩";

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        Preview — as the customer will see it
      </p>
      <div
        className="rounded-xl px-4 py-5"
        style={{
          backgroundColor: "#e5ddd5",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      >
        <div
          className="max-w-sm overflow-hidden rounded-lg bg-white text-[#111b21] shadow"
          style={{ borderTopLeftRadius: 0 }}
        >
          {headerFormat === "IMAGE" && (
            <div className="p-1">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="aspect-[1.91/1] w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-md bg-[#f0f2f5] text-xs text-[#667781]">
                  Header image
                </div>
              )}
            </div>
          )}
          <div className="px-3 pb-2 pt-2">
            {headerFormat === "TEXT" && headerText.trim() && (
              <p className="mb-1 text-[15px] font-semibold">{headerText}</p>
            )}
            <p className="whitespace-pre-wrap text-[15px] leading-snug">
              {body}
            </p>
            {footer.trim() && (
              <p className="mt-1 text-[13px] text-[#667781]">{footer}</p>
            )}
            <p className="mt-1 text-right text-[11px] text-[#667781]">
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </p>
          </div>
          {shown.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 border-t border-[#e9edef] py-2.5 text-[15px] font-medium text-[#027eb5]"
            >
              <span aria-hidden>{glyph(b)}</span>
              {label(b)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
