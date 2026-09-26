"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  hrApi,
  offerLetterApi,
  type EmployeeRow,
  type OfferLetterRow,
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
  statusTone,
} from "@/src/components/crm/ui";
import { OfferLetterPreview } from "@/src/components/crm/offer-letter-preview";
import { downloadOfferLetter } from "@/src/lib/offer-letter";
import {
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "DECLINED", label: "Declined" },
  { key: "WITHDRAWN", label: "Withdrawn" },
];

export default function OfferLettersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("ALL");
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; row: OfferLetterRow } | null
  >(null);
  const [preview, setPreview] = useState<OfferLetterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OfferLetterRow | null>(null);
  const [notice, setNotice] = useState("");

  const params = { search: search || undefined };
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.offerLetters(params),
    queryFn: () => offerLetterApi.list(params),
  });

  const rows = useMemo(
    () => (data ?? []).filter((r) => (tab === "ALL" ? true : r.status === tab)),
    [data, tab],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (data ?? []).forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hr", "offer-letters"] });

  const issue = useMutation({
    mutationFn: (id: number) => offerLetterApi.issue(id),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Issue failed"),
  });
  const withdraw = useMutation({
    mutationFn: (id: number) => offerLetterApi.withdraw(id),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Withdraw failed"),
  });
  const del = useMutation({
    mutationFn: (id: number) => offerLetterApi.remove(id),
    onSuccess: () => {
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const canCreate = hasPermission("offer-letters.create");
  const canUpdate = hasPermission("offer-letters.update");
  const canIssue = hasPermission("offer-letters.issue");
  const canDelete = hasPermission("offer-letters.delete");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Offer Letters"
        subtitle="Create from a fixed template, issue to the employee, and let them download the PDF."
        action={
          canCreate ? (
            <Btn onClick={() => setModal({ mode: "create" })}>
              <PlusIcon className="h-4 w-4" /> New offer letter
            </Btn>
          ) : undefined
        }
      />

      {notice && <Notice kind="error">{notice}</Notice>}
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={STATUS_TABS.map((t) => ({
            ...t,
            count: t.key === "ALL" ? data?.length : counts[t.key],
          }))}
          active={tab}
          onChange={setTab}
        />
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Search name, role, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <TableShell head={["Reference", "Candidate", "Position", "Annual CTC", "Status", "Issued", ""]}>
          {isLoading && <EmptyRow cols={7} label="Loading…" />}
          {!isLoading && rows.length === 0 && (
            <EmptyRow cols={7} label="No offer letters yet." />
          )}
          {rows.map((r) => (
            <tr key={r.offerLetterId} className="hover:bg-accent/40">
              <td className="px-4 py-3 font-medium text-foreground">{r.referenceNo ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="text-foreground">{r.candidateName}</div>
                <div className="text-xs text-muted-foreground">{r.candidateEmail ?? ""}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.designation}</td>
              <td className="px-4 py-3 text-foreground">{inr(r.annualCtc)}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issuedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Btn small tone="ghost" onClick={() => setPreview(r)}>
                    <FileTextIcon className="h-3.5 w-3.5" /> View
                  </Btn>
                  {r.status === "DRAFT" && canUpdate && (
                    <Btn small tone="ghost" onClick={() => setModal({ mode: "edit", row: r })}>
                      <PencilIcon className="h-3.5 w-3.5" /> Edit
                    </Btn>
                  )}
                  {r.status === "DRAFT" && canIssue && (
                    <Btn
                      small
                      tone="success"
                      busy={issue.isPending && issue.variables === r.offerLetterId}
                      onClick={() => issue.mutate(r.offerLetterId)}
                    >
                      Issue
                    </Btn>
                  )}
                  {(r.status === "ISSUED" || r.status === "ACCEPTED" || r.status === "DECLINED") &&
                    canIssue && (
                      <Btn
                        small
                        tone="ghost"
                        busy={withdraw.isPending && withdraw.variables === r.offerLetterId}
                        onClick={() => withdraw.mutate(r.offerLetterId)}
                      >
                        Withdraw
                      </Btn>
                    )}
                  {r.status === "DRAFT" && canDelete && (
                    <Btn small tone="danger" onClick={() => setConfirmDelete(r)}>
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {modal && (
        <OfferLetterForm
          row={modal.mode === "edit" ? modal.row : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {preview && (
        <Modal title={`Offer letter — ${preview.candidateName}`} onClose={() => setPreview(null)} wide>
          <OfferLetterPreview offer={preview} />
          <div className="mt-4 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setPreview(null)}>
              Close
            </Btn>
            <Btn onClick={() => downloadOfferLetter(preview)}>
              <FileTextIcon className="h-4 w-4" /> Download PDF
            </Btn>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete draft offer letter" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted-foreground">
            Delete the draft offer letter for{" "}
            <span className="font-medium text-foreground">{confirmDelete.candidateName}</span>? This
            cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Btn>
            <Btn
              tone="danger"
              busy={del.isPending}
              onClick={() => del.mutate(confirmDelete.offerLetterId)}
            >
              Delete
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OfferLetterForm({ row, onClose }: { row?: OfferLetterRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");

  const { data: employees } = useQuery({
    queryKey: crmQueryKeys.employees({}),
    queryFn: () => hrApi.employees({}),
  });

  const [f, setF] = useState({
    employeeId: row?.employeeId?.toString() ?? "",
    templateKey: row?.templateKey ?? "standard",
    candidateName: row?.candidateName ?? "",
    candidateEmail: row?.candidateEmail ?? "",
    designation: row?.designation ?? "",
    departmentName: row?.departmentName ?? "",
    employmentType: row?.employmentType ?? "FULL_TIME",
    annualCtc: row?.annualCtc?.toString() ?? "",
    joiningDate: row?.joiningDate ?? "",
    workLocation: row?.workLocation ?? "",
    probationMonths: (row?.probationMonths ?? 3).toString(),
    reportingTo: row?.reportingTo ?? "",
    offerDate: row?.offerDate ?? new Date().toISOString().slice(0, 10),
    responseByDate: row?.responseByDate ?? "",
    companyName: row?.companyName ?? "Restocare",
    companyAddress: row?.companyAddress ?? "",
    signatoryName: row?.signatoryName ?? "",
    signatoryTitle: row?.signatoryTitle ?? "HR Manager",
    customNote: row?.customNote ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Picking an employee prefills the variable fields — HR then just tweaks the
  // salary/dates. Only fires on create (employee is fixed once a draft exists).
  const onPickEmployee = (id: string) => {
    const emp = (employees ?? []).find((e) => e.employeeId.toString() === id) as
      | EmployeeRow
      | undefined;
    setF((p) => ({
      ...p,
      employeeId: id,
      candidateName: emp?.name ?? p.candidateName,
      candidateEmail: emp?.email ?? p.candidateEmail,
      designation: emp?.designation ?? p.designation,
      departmentName: emp?.department?.name ?? p.departmentName,
      reportingTo: emp?.manager?.name ?? p.reportingTo,
      annualCtc: emp?.salary ? String(emp.salary * 12) : p.annualCtc,
    }));
  };

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        templateKey: f.templateKey,
        candidateName: f.candidateName,
        candidateEmail: f.candidateEmail || undefined,
        designation: f.designation,
        departmentName: f.departmentName || undefined,
        employmentType: f.employmentType,
        annualCtc: Number(f.annualCtc),
        joiningDate: f.joiningDate,
        workLocation: f.workLocation || undefined,
        probationMonths: f.probationMonths ? Number(f.probationMonths) : undefined,
        reportingTo: f.reportingTo || undefined,
        offerDate: f.offerDate || undefined,
        responseByDate: f.responseByDate || undefined,
        companyName: f.companyName || undefined,
        companyAddress: f.companyAddress || undefined,
        signatoryName: f.signatoryName || undefined,
        signatoryTitle: f.signatoryTitle || undefined,
        customNote: f.customNote || undefined,
      };
      if (row) return offerLetterApi.update(row.offerLetterId, body);
      body.employeeId = Number(f.employeeId);
      return offerLetterApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "offer-letters"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? "Edit offer letter" : "New offer letter"} onClose={onClose} wide>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!row && !f.employeeId) return setErr("Select an employee");
          save.mutate();
        }}
      >
        {err && (
          <div className="sm:col-span-2">
            <Notice kind="error">{err}</Notice>
          </div>
        )}

        {!row && (
          <div className="sm:col-span-2">
            <Field label="Employee" hint="Picks the recipient and prefills the fields below">
              <select
                className={inputCls}
                required
                value={f.employeeId}
                onChange={(e) => onPickEmployee(e.target.value)}
              >
                <option value="">Select an employee…</option>
                {(employees ?? []).map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.name} · {e.employeeCode}
                    {e.user ? "" : " (no login yet)"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="Template">
          <select
            className={inputCls}
            value={f.templateKey}
            onChange={(e) => set("templateKey", e.target.value)}
          >
            <option value="standard">Standard</option>
            <option value="detailed">Detailed (with salary break-up)</option>
          </select>
        </Field>
        <Field label="Employment type">
          <select
            className={inputCls}
            value={f.employmentType}
            onChange={(e) => set("employmentType", e.target.value)}
          >
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Internship</option>
          </select>
        </Field>

        <Field label="Candidate name">
          <input
            className={inputCls}
            required
            value={f.candidateName}
            onChange={(e) => set("candidateName", e.target.value)}
          />
        </Field>
        <Field label="Candidate email">
          <input
            className={inputCls}
            type="email"
            value={f.candidateEmail}
            onChange={(e) => set("candidateEmail", e.target.value)}
          />
        </Field>

        <Field label="Designation">
          <input
            className={inputCls}
            required
            value={f.designation}
            onChange={(e) => set("designation", e.target.value)}
          />
        </Field>
        <Field label="Department">
          <input
            className={inputCls}
            value={f.departmentName}
            onChange={(e) => set("departmentName", e.target.value)}
          />
        </Field>

        <Field label="Annual CTC (₹)">
          <input
            className={inputCls}
            type="number"
            min={0}
            required
            value={f.annualCtc}
            onChange={(e) => set("annualCtc", e.target.value)}
          />
        </Field>
        <Field label="Reporting to">
          <input
            className={inputCls}
            value={f.reportingTo}
            onChange={(e) => set("reportingTo", e.target.value)}
          />
        </Field>

        <Field label="Date of joining">
          <input
            className={inputCls}
            type="date"
            required
            value={f.joiningDate}
            onChange={(e) => set("joiningDate", e.target.value)}
          />
        </Field>
        <Field label="Work location">
          <input
            className={inputCls}
            value={f.workLocation}
            onChange={(e) => set("workLocation", e.target.value)}
          />
        </Field>

        <Field label="Probation (months)">
          <input
            className={inputCls}
            type="number"
            min={0}
            max={24}
            value={f.probationMonths}
            onChange={(e) => set("probationMonths", e.target.value)}
          />
        </Field>
        <Field label="Respond by">
          <input
            className={inputCls}
            type="date"
            value={f.responseByDate}
            onChange={(e) => set("responseByDate", e.target.value)}
          />
        </Field>

        <Field label="Letter date">
          <input
            className={inputCls}
            type="date"
            value={f.offerDate}
            onChange={(e) => set("offerDate", e.target.value)}
          />
        </Field>
        <Field label="Company name">
          <input
            className={inputCls}
            value={f.companyName}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </Field>

        <Field label="Signatory name">
          <input
            className={inputCls}
            value={f.signatoryName}
            onChange={(e) => set("signatoryName", e.target.value)}
          />
        </Field>
        <Field label="Signatory title">
          <input
            className={inputCls}
            value={f.signatoryTitle}
            onChange={(e) => set("signatoryTitle", e.target.value)}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Company address">
            <input
              className={inputCls}
              value={f.companyAddress}
              onChange={(e) => set("companyAddress", e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Custom note" hint="Optional clause added below the standard text">
            <textarea
              className={inputCls}
              rows={2}
              value={f.customNote}
              onChange={(e) => set("customNote", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {row ? "Save changes" : "Create draft"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
