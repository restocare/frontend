"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, payrollApi, type PayslipRow } from "@/src/api/api";
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
  Tabs,
} from "@/src/components/crm/ui";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 50;

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const istMonth = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

export default function PayrollPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(istMonth());
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PayslipRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission("payroll.manage");

  const params = {
    month: month || undefined,
    status: status === "ALL" ? undefined : status,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.payroll(params),
    queryFn: () => payrollApi.list(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr", "payroll"] });
  const ok = (msg: string) => {
    setActionError(null);
    setNotice(msg);
    invalidate();
  };
  const fail = (e: unknown, fallback: string) =>
    setActionError(e instanceof ApiError ? e.message : fallback);

  const generate = useMutation({
    mutationFn: () => payrollApi.generate(month),
    onSuccess: (r) =>
      ok(`Generated ${r.created} draft payslip${r.created === 1 ? "" : "s"} for ${r.month} (${r.skipped} already existed).`),
    onError: (e) => fail(e, "Could not generate payroll."),
  });

  const publishMonth = useMutation({
    mutationFn: () => payrollApi.publishMonth(month),
    onSuccess: (r) => ok(`Published ${r.published} payslip${r.published === 1 ? "" : "s"} for ${r.month}. Employees can now see them.`),
    onError: (e) => fail(e, "Could not publish the month."),
  });

  const publishOne = useMutation({
    mutationFn: (id: number) => payrollApi.publish(id),
    onSuccess: () => ok("Payslip published."),
    onError: (e) => fail(e, "Could not publish the payslip."),
  });

  const removeOne = useMutation({
    mutationFn: (id: number) => payrollApi.remove(id),
    onSuccess: () => ok("Draft payslip deleted."),
    onError: (e) => fail(e, "Could not delete the payslip."),
  });

  const drafts = data?.payslips.filter((p) => p.status === "DRAFT").length ?? 0;
  const totalNet = data?.payslips.reduce((a, p) => a + p.netPay, 0) ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Generate monthly salary slips from employee salaries, adjust, then publish"
        action={
          canManage ? (
            <div className="flex gap-2">
              <Btn tone="ghost" busy={generate.isPending} onClick={() => generate.mutate()}>
                Generate {month}
              </Btn>
              <Btn
                busy={publishMonth.isPending}
                disabled={drafts === 0}
                onClick={() => publishMonth.mutate()}
              >
                Publish month ({drafts} drafts)
              </Btn>
            </div>
          ) : undefined
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          className={`${inputCls} w-auto`}
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
        />
        <Tabs
          tabs={[
            { key: "ALL", label: "All" },
            { key: "DRAFT", label: "Draft" },
            { key: "PUBLISHED", label: "Published" },
          ]}
          active={status}
          onChange={(k) => {
            setStatus(k);
            setPage(1);
          }}
        />
        <span className="ml-auto text-sm text-muted-foreground">
          {data?.total ?? "…"} slips · net total {inr(totalNet)}
        </span>
      </div>

      <Card>
        <TableShell
          head={["Employee", "Month", "Gross", "PF", "Tax", "Other ded.", "LOP", "Net pay", "Status", "Actions"]}
        >
          {isLoading && <EmptyRow cols={10} label="Loading payroll…" />}
          {!isLoading && !data?.payslips.length && (
            <EmptyRow
              cols={10}
              label={`No payslips for ${month || "this filter"} — hit "Generate" to create drafts from employee salaries.`}
            />
          )}
          {data?.payslips.map((p) => (
            <tr key={p.payslipId} className="text-foreground">
              <td className="px-4 py-3">
                <span className="font-medium">{p.employee?.name}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {p.employee?.employeeCode}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.month}</td>
              <td className="px-4 py-3">{inr(p.grossPay)}</td>
              <td className="px-4 py-3 text-muted-foreground">{inr(p.pf)}</td>
              <td className="px-4 py-3 text-muted-foreground">{inr(p.tax)}</td>
              <td className="px-4 py-3 text-muted-foreground">{inr(p.deductions)}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.lopDays || "—"}</td>
              <td className="px-4 py-3 font-semibold">{inr(p.netPay)}</td>
              <td className="px-4 py-3">
                <Badge tone={p.status === "PUBLISHED" ? "success" : "warning"}>{p.status}</Badge>
              </td>
              <td className="px-4 py-3">
                {canManage && p.status === "DRAFT" && (
                  <div className="flex gap-1.5">
                    <Btn small tone="ghost" onClick={() => setEditing(p)}>
                      Edit
                    </Btn>
                    <Btn
                      small
                      tone="success"
                      busy={publishOne.isPending}
                      onClick={() => publishOne.mutate(p.payslipId)}
                    >
                      Publish
                    </Btn>
                    <Btn
                      small
                      tone="danger"
                      busy={removeOne.isPending}
                      onClick={() => removeOne.mutate(p.payslipId)}
                    >
                      Delete
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Btn>
            <Btn tone="ghost" small disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </Card>

      <Card className="p-4 text-xs text-muted-foreground">
        Drafts are generated from each employee&apos;s monthly salary (basic 50% · HRA 20% ·
        allowances 30%, PF at 12% of basic). Adjust any component or add loss-of-pay days before
        publishing — employees only ever see published slips.
      </Card>

      {editing && (
        <EditPayslipModal
          slip={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            ok("Payslip updated.");
          }}
        />
      )}
    </div>
  );
}

function EditPayslipModal({
  slip,
  onClose,
  onSaved,
}: {
  slip: PayslipRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    basic: String(slip.basic),
    hra: String(slip.hra),
    allowances: String(slip.allowances),
    bonus: String(slip.bonus),
    pf: String(slip.pf),
    tax: String(slip.tax),
    deductions: String(slip.deductions),
    lopDays: String(slip.lopDays),
    notes: slip.notes ?? "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      payrollApi.update(slip.payslipId, {
        basic: Number(form.basic),
        hra: Number(form.hra),
        allowances: Number(form.allowances),
        bonus: Number(form.bonus),
        pf: Number(form.pf),
        tax: Number(form.tax),
        deductions: Number(form.deductions),
        lopDays: Number(form.lopDays),
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setFormError(e instanceof ApiError ? e.message : "Could not update the payslip."),
  });

  const num = (key: keyof typeof form, label: string) => (
    <Field label={label} key={key}>
      <input
        type="number"
        min={0}
        step="0.01"
        className={inputCls}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </Field>
  );

  return (
    <Modal
      title={`Edit payslip — ${slip.employee?.name} (${slip.month})`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {formError && <Notice kind="error">{formError}</Notice>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {num("basic", "Basic")}
          {num("hra", "HRA")}
          {num("allowances", "Allowances")}
          {num("bonus", "Bonus")}
          {num("pf", "PF")}
          {num("tax", "Tax")}
          {num("deductions", "Other deductions")}
          {num("lopDays", "LOP days")}
        </div>
        <Field label="Notes (shown on the slip)">
          <input
            className={inputCls}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Gross and net pay are recalculated server-side (LOP is deducted pro-rata over the
          month&apos;s calendar days).
        </p>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn busy={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
