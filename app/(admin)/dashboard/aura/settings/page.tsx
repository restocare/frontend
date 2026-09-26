"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auraApi, queryKeys, type AuraSettings } from "@/src/api/api";
import { SpinnerIcon } from "@/src/components/icons";
import { Btn, Field, inputCls } from "@/src/components/crm/ui";
import { Section } from "@/src/components/aura/ui";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const hourLabel = (hour: number) => {
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${suffix}`;
};

export default function AuraSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auraSettings,
    queryFn: auraApi.settings,
  });

  const [form, setForm] = useState<AuraSettings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: auraApi.saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auraSettings });
      toast.success("Settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const broadcastMutation = useMutation({
    mutationFn: auraApi.broadcast,
    onSuccess: (result) => toast.success(`Sent to ${result.sent} of ${result.targeted} users`),
    onError: (error: Error) => toast.error(error.message),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  if (isLoading || !form) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const patch = (changes: Partial<AuraSettings>) => setForm({ ...form, ...changes });

  return (
    <div className="space-y-6">
      <Section
        title="Assistant"
        description="The conversational layer. With this off — or with no GEMINI_API_KEY on the server — Aura falls back to rule-based intent parsing, so reminders still work from plain speech."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle
            label="AI assistant enabled"
            checked={form.aiEnabled}
            onChange={(aiEnabled) => patch({ aiEnabled })}
          />
          <Field label="Chat model" hint="Gemini model id used for chat, reports and summaries.">
            <input
              value={form.chatModel}
              onChange={(event) => patch({ chatModel: event.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Schedulers"
        description="Hours are in each user's own timezone — one cron serves every zone."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Morning brief">
            <select
              value={form.morningBriefHour}
              onChange={(event) => patch({ morningBriefHour: Number(event.target.value) })}
              className={inputCls}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nightly report">
            <select
              value={form.dailyReportHour}
              onChange={(event) => patch({ dailyReportHour: Number(event.target.value) })}
              className={inputCls}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Weekly report day" hint="Sent at the nightly report hour.">
            <select
              value={form.weeklyReportWeekday}
              onChange={(event) => patch({ weeklyReportWeekday: Number(event.target.value) })}
              className={inputCls}
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section
        title="Advance warnings"
        description="Every reminder also alerts this many minutes beforehand, so nothing arrives without notice. Applies to all users; changes take effect as reminders are next scheduled."
      >
        <LeadAlerts
          value={form.leadAlertMinutes ?? []}
          onChange={(leadAlertMinutes) => patch({ leadAlertMinutes })}
        />
      </Section>

      <Section title="Limits and access">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Max active reminders per user"
            hint="Guards against a runaway automation filling the scheduler."
          >
            <input
              type="number"
              min={10}
              max={5000}
              value={form.maxRemindersPerUser}
              onChange={(event) => patch({ maxRemindersPerUser: Number(event.target.value) })}
              className={inputCls}
            />
          </Field>

          <Field label="Default timezone" hint="Applied to profiles created from now on.">
            <input
              value={form.defaultTimezone}
              onChange={(event) => patch({ defaultTimezone: event.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Toggle
            label="Open to new users"
            hint="Off means existing users keep working, but nobody new can set up a profile."
            checked={form.registrationOpen}
            onChange={(registrationOpen) => patch({ registrationOpen })}
          />
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {form.updatedBy
            ? `Last changed by ${form.updatedBy.name ?? form.updatedBy.email ?? "an admin"}.`
            : "Not changed yet."}
        </p>
        <Btn
          busy={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate({
              aiEnabled: form.aiEnabled,
              chatModel: form.chatModel,
              morningBriefHour: form.morningBriefHour,
              dailyReportHour: form.dailyReportHour,
              weeklyReportWeekday: form.weeklyReportWeekday,
              maxRemindersPerUser: form.maxRemindersPerUser,
              defaultTimezone: form.defaultTimezone,
              registrationOpen: form.registrationOpen,
              leadAlertMinutes: form.leadAlertMinutes,
            })
          }
        >
          Save settings
        </Btn>
      </div>

      <Section
        title="Broadcast"
        description="Sends a push and an inbox item to every active Aura user. Suspended users and anyone inside their quiet hours are skipped."
      >
        <div className="space-y-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="New in Aura"
              className={inputCls}
            />
          </Field>
          <Field label="Message">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="Weekly reports now include your best focus window."
              className={inputCls}
            />
          </Field>
          <div className="flex justify-end">
            <Btn
              busy={broadcastMutation.isPending}
              disabled={title.trim().length < 2 || body.trim().length < 2}
              onClick={() =>
                broadcastMutation.mutate(
                  { title: title.trim(), body: body.trim() },
                  {
                    onSuccess: () => {
                      setTitle("");
                      setBody("");
                    },
                  },
                )
              }
            >
              Send to all users
            </Btn>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Preset offsets an admin can toggle, plus a free-form field for anything else. */
const LEAD_PRESETS = [
  { minutes: 1440, label: "1 day" },
  { minutes: 240, label: "4 hours" },
  { minutes: 120, label: "2 hours" },
  { minutes: 60, label: "1 hour" },
  { minutes: 30, label: "30 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 10, label: "10 min" },
  { minutes: 5, label: "5 min" },
];

function LeadAlerts({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [custom, setCustom] = useState("");
  // Always furthest-out first: that is the order the warnings actually fire.
  const sorted = [...value].sort((a, b) => b - a);

  const toggle = (minutes: number) =>
    onChange(
      value.includes(minutes)
        ? value.filter((v) => v !== minutes)
        : [...value, minutes].sort((a, b) => b - a),
    );

  const addCustom = () => {
    const parsed = Number(custom);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10080) {
      toast.error("Enter a whole number of minutes between 1 and 10080");
      return;
    }
    if (value.includes(parsed)) return;
    onChange([...value, parsed].sort((a, b) => b - a));
    setCustom("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {LEAD_PRESETS.map((preset) => {
          const active = value.includes(preset.minutes);
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => toggle(preset.minutes)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustom();
            }
          }}
          inputMode="numeric"
          placeholder="Other (minutes)"
          className="w-40 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <Btn tone="ghost" small onClick={addCustom}>
          Add
        </Btn>
      </div>

      <p className="text-sm text-muted-foreground">
        {sorted.length === 0 ? (
          <>No advance warnings — reminders fire only at the moment itself.</>
        ) : (
          <>
            A 10:00 AM reminder will also alert at{" "}
            <span className="font-medium text-foreground">
              {sorted.map((m) => previewTime(m)).join(", ")}
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}

/** Renders what a 10:00 reminder's warning times would look like. */
function previewTime(minutesBefore: number): string {
  const base = new Date(2000, 0, 1, 10, 0);
  base.setMinutes(base.getMinutes() - minutesBefore);
  return base.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
