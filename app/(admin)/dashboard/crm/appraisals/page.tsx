"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi, type AppraisalRow } from "@/src/api/api";
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
  fmtDate,
  inputCls,
  statusTone,
} from "@/src/components/crm/ui";
import { PlusIcon, StarIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

export default function CrmAppraisalsPage() {
  const canView = hasPermission("appraisals.view");
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Appraisals" subtitle="Performance review cycles and sign-offs." />
      {canView ? <AllAppraisals /> : <MyAppraisals />}
    </div>
  );
}

function MyAppraisals() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState("");
  const { data, error } = useQuery({
    queryKey: crmQueryKeys.myAppraisals,
    queryFn: hrApi.myAppraisals,
    retry: false,
  });

  const ack = useMutation({
    mutationFn: (id: number) => hrApi.acknowledgeAppraisal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "appraisals"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Failed"),
  });

  if (error instanceof ApiError && error.status === 404) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No employee profile is linked to your account.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      <Card>
        <TableShell head={["Cycle", "Period", "Rating", "Recommendation", "Status", ""]}>
          {!data?.length && <EmptyRow cols={6} label="No appraisals shared with you yet" />}
          {data?.map((a) => (
            <tr key={a.appraisalId}>
              <td className="px-4 py-3 font-medium text-foreground">{a.cycle}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {fmtDate(a.periodStart)} → {fmtDate(a.periodEnd)}
              </td>
              <td className="px-4 py-3 text-foreground">
                {a.overallRating != null ? `★ ${a.overallRating}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.recommendation ?? "—"}
                {a.incrementPct != null ? ` (+${a.incrementPct}%)` : ""}
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {a.status === "SUBMITTED" && (
                  <Btn small busy={ack.isPending} onClick={() => ack.mutate(a.appraisalId)}>
                    Acknowledge
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
    </div>
  );
}

function AllAppraisals() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ row?: AppraisalRow } | null>(null);
  const [notice, setNotice] = useState("");
  const params = {};

  const { data, isLoading } = useQuery({
    queryKey: crmQueryKeys.appraisals(params),
    queryFn: () => hrApi.appraisals(params),
  });

  const act = useMutation({
    mutationFn: async (vars: { id: number; action: "submit" | "delete" }): Promise<unknown> =>
      vars.action === "submit" ? hrApi.submitAppraisal(vars.id) : hrApi.deleteAppraisal(vars.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "appraisals"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed"),
  });

  const canManage = hasPermission("appraisals.manage");

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      {canManage && (
        <div className="flex justify-end">
          <Btn small onClick={() => setModal({})}>
            <PlusIcon className="h-4 w-4" /> New appraisal
          </Btn>
        </div>
      )}
      <Card>
        <TableShell head={["Employee", "Cycle", "Rating", "Recommendation", "Status", "Actions"]}>
          {isLoading && <EmptyRow cols={6} label="Loading…" />}
          {!isLoading && !data?.length && <EmptyRow cols={6} label="No appraisals yet" />}
          {data?.map((a) => (
            <tr key={a.appraisalId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{a.employee?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.employee?.designation ?? "—"} · {a.employee?.department?.name ?? "—"}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.cycle}
                <div className="text-xs">
                  {fmtDate(a.periodStart)} → {fmtDate(a.periodEnd)}
                </div>
              </td>
              <td className="px-4 py-3 text-foreground">
                {a.overallRating != null ? (
                  <span className="inline-flex items-center gap-1">
                    <StarIcon className="h-4 w-4 text-warning" /> {a.overallRating}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.recommendation ?? "—"}
                {a.incrementPct != null ? ` (+${a.incrementPct}%)` : ""}
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </td>
              <td className="px-4 py-3">
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    {a.status === "DRAFT" && (
                      <>
                        <Btn small tone="ghost" onClick={() => setModal({ row: a })}>
                          Edit
                        </Btn>
                        <Btn
                          small
                          onClick={() => act.mutate({ id: a.appraisalId, action: "submit" })}
                        >
                          Submit
                        </Btn>
                      </>
                    )}
                    <Btn
                      small
                      tone="danger"
                      onClick={() => act.mutate({ id: a.appraisalId, action: "delete" })}
                    >
                      Delete
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
      {modal && <AppraisalForm row={modal.row} onClose={() => setModal(null)} />}
    </div>
  );
}

function AppraisalForm({ row, onClose }: { row?: AppraisalRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const year = new Date().getFullYear();
  const [f, setF] = useState({
    employeeId: row?.employeeId?.toString() ?? "",
    cycle: row?.cycle ?? `${year}-H${new Date().getMonth() < 6 ? 1 : 2}`,
    periodStart: row?.periodStart ?? `${year}-01-01`,
    periodEnd: row?.periodEnd ?? `${year}-06-30`,
    overallRating: row?.overallRating?.toString() ?? "",
    goals: row?.goals ?? "",
    strengths: row?.strengths ?? "",
    improvements: row?.improvements ?? "",
    comments: row?.comments ?? "",
    recommendation: row?.recommendation ?? "",
    incrementPct: row?.incrementPct?.toString() ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const { data: employees } = useQuery({
    queryKey: crmQueryKeys.employees({}),
    queryFn: () => hrApi.employees({}),
    enabled: !row,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        overallRating: f.overallRating ? Number(f.overallRating) : undefined,
        goals: f.goals || undefined,
        strengths: f.strengths || undefined,
        improvements: f.improvements || undefined,
        comments: f.comments || undefined,
        recommendation: f.recommendation || undefined,
        incrementPct: f.incrementPct ? Number(f.incrementPct) : undefined,
      };
      if (row) return hrApi.updateAppraisal(row.appraisalId, body);
      return hrApi.createAppraisal({
        ...body,
        employeeId: Number(f.employeeId),
        cycle: f.cycle,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "appraisals"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit appraisal · ${row.cycle}` : "New appraisal"} onClose={onClose} wide>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {err && (
          <div className="sm:col-span-2">
            <Notice kind="error">{err}</Notice>
          </div>
        )}
        {!row && (
          <>
            <Field label="Employee">
              <select
                className={inputCls}
                required
                value={f.employeeId}
                onChange={(e) => set("employeeId", e.target.value)}
              >
                <option value="">Select…</option>
                {employees?.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cycle">
              <input
                className={inputCls}
                required
                value={f.cycle}
                onChange={(e) => set("cycle", e.target.value)}
              />
            </Field>
            <Field label="Period start">
              <input
                type="date"
                className={inputCls}
                required
                value={f.periodStart}
                onChange={(e) => set("periodStart", e.target.value)}
              />
            </Field>
            <Field label="Period end">
              <input
                type="date"
                className={inputCls}
                required
                value={f.periodEnd}
                onChange={(e) => set("periodEnd", e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Overall rating (1–5)">
          <input
            className={inputCls}
            type="number"
            min="1"
            max="5"
            step="0.1"
            value={f.overallRating}
            onChange={(e) => set("overallRating", e.target.value)}
          />
        </Field>
        <Field label="Recommendation">
          <select
            className={inputCls}
            value={f.recommendation}
            onChange={(e) => set("recommendation", e.target.value)}
          >
            <option value="">— None —</option>
            {["PROMOTE", "INCREMENT", "HOLD", "PIP"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Increment %">
          <input
            className={inputCls}
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={f.incrementPct}
            onChange={(e) => set("incrementPct", e.target.value)}
          />
        </Field>
        <Field label="Goals">
          <input className={inputCls} value={f.goals} onChange={(e) => set("goals", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Strengths">
            <textarea
              className={inputCls}
              rows={2}
              value={f.strengths}
              onChange={(e) => set("strengths", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Areas to improve">
            <textarea
              className={inputCls}
              rows={2}
              value={f.improvements}
              onChange={(e) => set("improvements", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Comments">
            <textarea
              className={inputCls}
              rows={2}
              value={f.comments}
              onChange={(e) => set("comments", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {row ? "Save" : "Create draft"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
