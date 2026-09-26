"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  hrApi,
  type AttendancePolicy,
  type HrPolicyRow,
} from "@/src/api/api";
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

export default function HrPoliciesPage() {
  const tabs = [
    { key: "rules", label: "Attendance rules" },
    { key: "documents", label: "Policy documents" },
  ];
  const [tab, setTab] = useState("rules");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="HR policy"
        subtitle="The rules that apply to everyone — enforced automatically on every check-in."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "rules" && <AttendanceRules />}
      {tab === "documents" && <PolicyDocuments />}
    </div>
  );
}

/* ─────────────────────────── Attendance rules ─────────────────────────── */

function AttendanceRules() {
  const qc = useQueryClient();
  const canManage = hasPermission("hr-policies.manage");
  const [form, setForm] = useState<AttendancePolicy | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.attendancePolicy,
    queryFn: () => hrApi.attendancePolicy(),
  });
  useEffect(() => {
    // Deferred so no setState runs synchronously inside the effect body.
    if (data) queueMicrotask(() => setForm(data));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      hrApi.updateAttendancePolicy({
        graceMinutes: form!.graceMinutes,
        halfDayAfterMinutes: form!.halfDayAfterMinutes,
        lateMarksForHalfDay: form!.lateMarksForHalfDay,
        absentAfterMinutes: form!.absentAfterMinutes,
        minHoursFullDay: form!.minHoursFullDay,
        minHoursHalfDay: form!.minHoursHalfDay,
        autoApply: form!.autoApply,
        notifyEmployee: form!.notifyEmployee,
      }),
    onSuccess: () => {
      setErr("");
      setNotice("Rules saved — every employee has been notified.");
      void qc.invalidateQueries({ queryKey: crmQueryKeys.attendancePolicy });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save the rules"),
  });

  const num = (k: keyof AttendancePolicy) => (v: string) =>
    setForm((p) => (p ? { ...p, [k]: Number(v.replace(/[^\d.]/g, "")) || 0 } : p));

  if (error) return <Notice kind="error">{(error as ApiError).message}</Notice>;
  if (!form) return <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>;

  return (
    <div className="space-y-4">
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {/* Plain-English restatement of the numbers below — this is what people
          actually argue about, so it should be readable at a glance. */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">In force right now</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Everyone gets <span className="font-medium text-foreground">{form.graceMinutes} minutes</span>{" "}
          after their shift starts. Arriving more than{" "}
          <span className="font-medium text-foreground">{form.halfDayAfterMinutes} minutes</span> late is
          a half day straight away. Otherwise it&apos;s a late mark — and every{" "}
          <span className="font-medium text-foreground">{form.lateMarksForHalfDay} late marks</span> in a
          calendar month cost a half day too. Past{" "}
          <span className="font-medium text-foreground">{form.absentAfterMinutes} minutes</span> the day
          counts as absent. Lateness is measured against each employee&apos;s own shift.
        </p>
        {!form.autoApply && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            Auto-apply is off — attendance is recorded but nothing is marked.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grace period (minutes)" hint="the “leverage” before a day counts as late">
            <input
              className={inputCls}
              value={form.graceMinutes}
              disabled={!canManage}
              onChange={(e) => num("graceMinutes")(e.target.value)}
            />
          </Field>
          <Field label="Half day after (minutes late)" hint="counted from the shift start">
            <input
              className={inputCls}
              value={form.halfDayAfterMinutes}
              disabled={!canManage}
              onChange={(e) => num("halfDayAfterMinutes")(e.target.value)}
            />
          </Field>
          <Field label="Late marks per month = half day" hint="0 turns this rule off">
            <input
              className={inputCls}
              value={form.lateMarksForHalfDay}
              disabled={!canManage}
              onChange={(e) => num("lateMarksForHalfDay")(e.target.value)}
            />
          </Field>
          <Field label="Absent after (minutes late)">
            <input
              className={inputCls}
              value={form.absentAfterMinutes}
              disabled={!canManage}
              onChange={(e) => num("absentAfterMinutes")(e.target.value)}
            />
          </Field>
          <Field label="Minimum hours — full day">
            <input
              className={inputCls}
              value={form.minHoursFullDay}
              disabled={!canManage}
              onChange={(e) => num("minHoursFullDay")(e.target.value)}
            />
          </Field>
          <Field label="Minimum hours — half day">
            <input
              className={inputCls}
              value={form.minHoursHalfDay}
              disabled={!canManage}
              onChange={(e) => num("minHoursHalfDay")(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <input
              type="checkbox"
              checked={form.autoApply}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, autoApply: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm text-foreground">Apply these rules automatically</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <input
              type="checkbox"
              checked={form.notifyEmployee}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, notifyEmployee: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm text-foreground">Notify the employee when a rule marks their day</span>
          </label>
        </div>
        {canManage && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Saving notifies every employee that the policy changed.
            </span>
            <Btn busy={save.isPending} onClick={() => save.mutate()}>
              Save rules
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────── Policy documents ─────────────────────────── */

function PolicyDocuments() {
  const qc = useQueryClient();
  const canManage = hasPermission("hr-policies.manage");
  const [editing, setEditing] = useState<HrPolicyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reading, setReading] = useState<HrPolicyRow | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.policies({}),
    queryFn: () => hrApi.policies(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["hr", "policies"] });

  const publish = useMutation({
    mutationFn: (p: HrPolicyRow) => hrApi.updatePolicy(p.hrPolicyId, { isPublished: !p.isPublished }),
    onSuccess: (p) => {
      setErr("");
      setNotice(p.isPublished ? `"${p.title}" published — everyone notified` : `"${p.title}" unpublished`);
      void refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not update"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => hrApi.deletePolicy(id),
    onSuccess: (r) => {
      setNotice(r.message);
      void refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete"),
  });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {canManage && (
        <div className="flex justify-end">
          <Btn onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> Write a policy
          </Btn>
        </div>
      )}

      <Card>
        <TableShell head={["Policy", "Category", "Effective", "Status", ""]}>
          {(data ?? []).map((p) => (
            <tr key={p.hrPolicyId} className="border-t border-border">
              <td className="px-4 py-3">
                <button
                  onClick={() => setReading(p)}
                  className="text-left font-medium text-foreground hover:text-primary"
                >
                  {p.title}
                </button>
                <div className="line-clamp-1 text-xs text-muted-foreground">{p.body}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.effectiveFrom ? fmtDate(p.effectiveFrom) : "—"}
              </td>
              <td className="px-4 py-3">
                <Badge tone={p.isPublished ? "success" : "muted"}>
                  {p.isPublished ? "Published" : "Draft"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {canManage && (
                  <div className="flex justify-end gap-2">
                    <Btn tone="ghost" small onClick={() => setEditing(p)}>
                      Edit
                    </Btn>
                    <Btn
                      tone={p.isPublished ? "ghost" : "success"}
                      small
                      busy={publish.isPending}
                      onClick={() => publish.mutate(p)}
                    >
                      {p.isPublished ? "Unpublish" : "Publish"}
                    </Btn>
                    <Btn tone="danger" small onClick={() => remove.mutate(p.hrPolicyId)}>
                      Delete
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!data?.length && (
            <EmptyRow cols={5} label="No policies written yet — publish the first one." />
          )}
        </TableShell>
      </Card>

      {(creating || editing) && (
        <PolicyModal
          policy={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={(msg) => {
            setCreating(false);
            setEditing(null);
            setNotice(msg);
            void refresh();
          }}
        />
      )}
      {reading && (
        <Modal title={reading.title} onClose={() => setReading(null)} wide>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            {reading.category}
            {reading.effectiveFrom ? ` · effective ${fmtDate(reading.effectiveFrom)}` : ""}
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {reading.body}
          </div>
        </Modal>
      )}
    </div>
  );
}

function PolicyModal({
  policy,
  onClose,
  onDone,
}: {
  policy?: HrPolicyRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isEdit = !!policy;
  const [title, setTitle] = useState(policy?.title ?? "");
  const [category, setCategory] = useState(policy?.category ?? "Attendance");
  const [body, setBody] = useState(policy?.body ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(policy?.effectiveFrom ?? "");
  const [isPublished, setIsPublished] = useState(policy?.isPublished ?? false);
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        category: category.trim() || "General",
        body,
        effectiveFrom: effectiveFrom || undefined,
        isPublished,
      };
      return isEdit
        ? hrApi.updatePolicy(policy.hrPolicyId, payload).then(() => `"${payload.title}" saved`)
        : hrApi
            .createPolicy(payload)
            .then(() =>
              isPublished
                ? `"${payload.title}" published — everyone notified`
                : `"${payload.title}" saved as a draft`,
            );
    },
    onSuccess: onDone,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save the policy"),
  });

  return (
    <Modal title={isEdit ? `Edit ${policy.title}` : "Write a policy"} onClose={onClose} wide>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title">
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Late coming & attendance"
            />
          </Field>
        </div>
        <Field label="Category">
          <input
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Attendance / Leave / Conduct"
          />
        </Field>
        <Field label="Effective from" hint="optional">
          <input
            type="date"
            className={inputCls}
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Policy text" hint="Shown to every employee under My Space → Policies">
            <textarea
              className={`${inputCls} min-h-40`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="A grace period of 15 minutes applies to every shift…"
            />
          </Field>
        </div>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          <span className="text-sm text-foreground">
            Publish now — every employee gets a notification
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={save.isPending}
          onClick={() => {
            setErr("");
            if (!title.trim()) return setErr("Give the policy a title.");
            if (!body.trim()) return setErr("Write the policy text.");
            save.mutate();
          }}
        >
          {isEdit ? "Save changes" : isPublished ? "Publish" : "Save draft"}
        </Btn>
      </div>
    </Modal>
  );
}
