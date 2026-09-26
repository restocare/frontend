"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import {
  configureApi,
  queryKeys,
  type ConfigureField,
  type ConfigureGroup,
  type OtpProvider,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

interface ConfigCardProps {
  title: string;
  description: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}

function ConfigCard({
  title,
  description,
  saving,
  onSave,
  children,
}: ConfigCardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-neutral-300 bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-neutral-700">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-label={`Save ${title} configuration`}
          className="shrink-0 cursor-pointer rounded-full border border-blue-600/30 px-4 py-1 text-xs font-semibold text-blue-700 outline-none transition-colors hover:border-blue-600 hover:bg-blue-600/5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-400 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-background"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface CredentialInputProps {
  field: ConfigureField;
  value: string;
  onChange: (val: string) => void;
}

function CredentialInput({ field, value, onChange }: CredentialInputProps) {
  const [show, setShow] = useState(false);
  const inputId = React.useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
      >
        {field.label}
        {field.source === "database" && (
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-medium normal-case tracking-normal text-emerald-600 dark:text-emerald-400">
            saved
          </span>
        )}
      </label>
      <div className="relative">
        {field.options ? (
          <select
            id={inputId}
            value={value || field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-card dark:focus:border-blue-400 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-background"
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={inputId}
            type={field.isSecret && !show ? "password" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 pr-10 text-sm text-foreground outline-none transition-colors focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:focus:border-blue-400 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-background"
          />
        )}
        {field.isSecret && !field.options && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={
              show
                ? `Hide value for ${field.label}`
                : `Show value for ${field.label}`
            }
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded p-0.5 text-neutral-400 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
          >
            {show ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {field.hint && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          {field.hint}
        </p>
      )}
    </div>
  );
}

/**
 * Under the OTP delivery card: which service is live, whether each is ready,
 * the WhatsApp template's state (with a button to create it), and a way to
 * send a real test code to a number — so a switch is proven before customers
 * depend on it. `draftProvider` is the dropdown's current (maybe unsaved)
 * choice, so the test goes through what the admin is about to pick.
 */
function OtpDeliveryTools({ draftProvider }: { draftProvider: string }) {
  const queryClient = useQueryClient();
  const [mobile, setMobile] = useState("");
  const { data: status } = useQuery({
    queryKey: ["configure", "otp-status"],
    queryFn: configureApi.otpStatus,
    refetchInterval: 20_000,
  });

  const test = useMutation({
    mutationFn: () =>
      configureApi.otpTest(mobile, draftProvider as OtpProvider),
    onSuccess: (r) =>
      toast.success(
        `Sent via ${LABEL[r.provider]} to ${r.mobile} — the code is ${r.otp}.`,
      ),
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : "The test OTP was not sent.",
      ),
  });
  const createTemplate = useMutation({
    mutationFn: configureApi.createWhatsappOtpTemplate,
    onSuccess: (r) => {
      toast.success(`WhatsApp template ${r.name}/${r.language}: ${r.status}`);
      queryClient.invalidateQueries({ queryKey: ["configure", "otp-status"] });
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError ? e.message : "Could not create the template.",
      ),
  });

  const provider = (draftProvider ||
    status?.provider ||
    "FABMEDIA") as OtpProvider;
  const missing = status?.missing?.[provider] ?? [];
  const waStatus = status?.whatsappTemplateStatus;

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground">Live now:</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          {status ? LABEL[status.provider] : "…"}
        </span>
        {status && draftProvider && draftProvider !== status.provider && (
          <span className="text-neutral-500">
            → {LABEL[provider]} after Save
          </span>
        )}
      </div>

      {missing.length > 0 ? (
        <p className="text-amber-600 dark:text-amber-400">
          {LABEL[provider]} still needs: {missing.join(", ")}.
        </p>
      ) : (
        <p className="text-neutral-600 dark:text-neutral-400">
          {LABEL[provider]} is configured.
        </p>
      )}

      {provider === "WHATSAPP" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-600 dark:text-neutral-400">
            Template {status?.whatsappTemplate.name}/
            {status?.whatsappTemplate.language}:
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              waStatus === "APPROVED"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : waStatus === "PENDING"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {waStatus ?? "unknown"}
          </span>
          {waStatus !== "APPROVED" && (
            <button
              type="button"
              onClick={() => createTemplate.mutate()}
              disabled={createTemplate.isPending}
              className="rounded-full border border-blue-600/30 px-3 py-0.5 font-semibold text-blue-700 hover:bg-blue-600/5 disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-400"
            >
              {createTemplate.isPending
                ? "Submitting…"
                : waStatus === "PENDING"
                  ? "Check again"
                  : "Create template at Meta"}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={mobile}
          onChange={(e) =>
            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
          placeholder="10-digit mobile for a test OTP"
          inputMode="numeric"
          className="w-56 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm text-foreground outline-none focus:border-blue-500 dark:border-neutral-700"
        />
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={mobile.length !== 10 || test.isPending}
          className="rounded-full border border-blue-600/30 px-3 py-1 font-semibold text-blue-700 hover:bg-blue-600/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:text-blue-400"
        >
          {test.isPending ? "Sending…" : `Send test OTP via ${LABEL[provider]}`}
        </button>
      </div>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        A test uses the settings saved so far — save this card first if you
        changed keys. The code is shown here so you can confirm the one that
        arrives matches.
      </p>
    </div>
  );
}

const LABEL: Record<OtpProvider, string> = {
  FABMEDIA: "SMS gateway (fabmediatech)",
  MSG91: "MSG91",
  WHATSAPP: "WhatsApp",
};

export default function ConfigurePage() {
  const queryClient = useQueryClient();
  // Unsaved edits keyed by field key; a field falls back to the server value.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.configure,
    queryFn: configureApi.get,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      values,
    }: {
      group: ConfigureGroup;
      values: { key: string; value: string }[];
    }) => configureApi.update(values),
    onSuccess: (_res, { group, values }) => {
      setDrafts((prev) => {
        const next = { ...prev };
        for (const { key } of values) delete next[key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.configure });
      toast.success(`${group.title} configuration updated successfully!`);
    },
    onError: (e, { group }) => {
      toast.error(
        e instanceof ApiError ? e.message : `Could not save ${group.title}.`,
      );
    },
  });

  const valueOf = (field: ConfigureField) => drafts[field.key] ?? field.value;

  const saveGroup = (group: ConfigureGroup) => {
    saveMutation.mutate({
      group,
      values: group.fields.map((field) => ({
        key: field.key,
        value: valueOf(field),
      })),
    });
  };

  const savingGroup = saveMutation.isPending
    ? saveMutation.variables?.group.key
    : null;

  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {forbidden ? "Access required" : "Could not load configuration"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {forbidden
            ? "Your role has not been granted the Configure permission. Ask a super admin to enable it under Roles & Permissions."
            : error instanceof ApiError
              ? error.message
              : "Something went wrong while loading the configuration."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configure
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform credentials — values load from the backend environment until
          overridden here.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : (
        // One continuous grid (no per-section rows): every card the same width,
        // three per row, stretched to equal height so no holes open up.
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.sections
            .flatMap((section) => section.groups)
            .map((group) => (
              <ConfigCard
                key={group.key}
                title={group.title}
                description={group.description}
                saving={savingGroup === group.key}
                onSave={() => saveGroup(group)}
              >
                {group.fields
                  // A field tied to a choice (the OTP service's own settings)
                  // appears only while that choice is selected, so the card
                  // shows one service's settings at a time.
                  .filter((field) => {
                    if (!field.showWhen) return true;
                    const controller = group.fields.find(
                      (f) => f.key === field.showWhen!.key,
                    );
                    const current = controller
                      ? valueOf(controller) || controller.placeholder
                      : "";
                    return current === field.showWhen.value;
                  })
                  .map((field) => (
                    <CredentialInput
                      key={field.key}
                      field={field}
                      value={valueOf(field)}
                      onChange={(val) =>
                        setDrafts((prev) => ({ ...prev, [field.key]: val }))
                      }
                    />
                  ))}
                {group.key === "otp" && (
                  <OtpDeliveryTools
                    draftProvider={
                      group.fields.find((f) => f.key === "OTP_PROVIDER")
                        ? valueOf(
                            group.fields.find((f) => f.key === "OTP_PROVIDER")!,
                          )
                        : ""
                    }
                  />
                )}
              </ConfigCard>
            ))}
        </div>
      )}
    </div>
  );
}
