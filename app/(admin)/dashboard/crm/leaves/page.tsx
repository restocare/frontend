"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi, type LeaveRequestRow, type LeaveTypeRow } from "@/src/api/api";
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
import { PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

export default function CrmLeavesPage() {
  const tabs = [
    { key: "mine", label: "My leaves", show: true },
    { key: "requests", label: "Requests", show: hasPermission("leaves.view") },
    { key: "types", label: "Leave types", show: hasPermission("leaves.manage-types") },
  ].filter((t) => t.show);
  const [tab, setTab] = useState(tabs[0]?.key ?? "mine");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Leave management"
        subtitle="Yearly allowances, applications and approvals."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "mine" && <MyLeaves />}
      {tab === "requests" && <LeaveRequests />}
      {tab === "types" && <LeaveTypes />}
    </div>
  );
}

/* ────────────────────────────── My leaves ────────────────────────────── */

function MyLeaves() {
  const qc = useQueryClient();
  const [apply, setApply] = useState(false);
  const [notice, setNotice] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.myLeaves,
    queryFn: hrApi.myLeaves,
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => hrApi.cancelLeave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "leaves"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Cancel failed"),
  });

  if (error instanceof ApiError && error.status === 404) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No employee profile is linked to your account — leave application is for employees.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data?.balances.map((b) => (
          <Card key={b.balanceId} className="p-4">
            <div className="text-sm text-muted-foreground">{b.leaveType.name}</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {b.allocated - b.used}
              <span className="text-sm font-normal text-muted-foreground"> / {b.allocated} left</span>
            </div>
            <div className="text-xs text-muted-foreground">used {b.used} · {b.year}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">My requests</h2>
          <Btn small onClick={() => setApply(true)}>
            <PlusIcon className="h-4 w-4" /> Apply for leave
          </Btn>
        </div>
        <TableShell head={["Type", "Dates", "Days", "Reason", "Status", ""]}>
          {!data?.requests.length && <EmptyRow cols={6} label="No leave requests yet" />}
          {data?.requests.map((r) => (
            <tr key={r.leaveRequestId}>
              <td className="px-4 py-3 text-foreground">{r.leaveType.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.days}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                {r.status === "REJECTED" && r.rejectionReason && (
                  <div className="mt-1 text-xs text-muted-foreground">{r.rejectionReason}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {r.status === "PENDING" && (
                  <Btn small tone="ghost" onClick={() => cancel.mutate(r.leaveRequestId)}>
                    Cancel
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {apply && <ApplyModal onClose={() => setApply(false)} />}
    </div>
  );
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: types } = useQuery({ queryKey: crmQueryKeys.leaveTypes, queryFn: hrApi.leaveTypes });

  const apply = useMutation({
    mutationFn: () =>
      hrApi.applyLeave({
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate: endDate || startDate,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "leaves"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not apply"),
  });

  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply.mutate();
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Leave type">
          <select
            className={inputCls}
            required
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
          >
            <option value="">Select…</option>
            {types?.map((t) => (
              <option key={t.leaveTypeId} value={t.leaveTypeId}>
                {t.name} ({t.annualAllowance}/yr)
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From">
            <input
              type="date"
              required
              className={inputCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              className={inputCls}
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Reason">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={apply.isPending}>
            Submit request
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────────── Approvals queue ─────────────────────────── */

function LeaveRequests() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING");
  const [rejecting, setRejecting] = useState<LeaveRequestRow | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const params = { status: status === "ALL" ? undefined : status };

  const { data, isLoading } = useQuery({
    queryKey: crmQueryKeys.leaves(params),
    queryFn: () => hrApi.leaves(params),
  });

  const decide = useMutation({
    mutationFn: (vars: { id: number; action: "approve" | "reject"; reason?: string }) =>
      vars.action === "approve" ? hrApi.approveLeave(vars.id) : hrApi.rejectLeave(vars.id, vars.reason),
    onSuccess: () => {
      setRejecting(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["hr", "leaves"] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed"),
  });

  const canApprove = hasPermission("leaves.approve");

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      <Tabs
        tabs={["PENDING", "APPROVED", "REJECTED", "ALL"].map((k) => ({ key: k, label: k }))}
        active={status}
        onChange={setStatus}
      />
      <Card>
        <TableShell head={["Employee", "Type", "Dates", "Days", "Status", "Actions"]}>
          {isLoading && <EmptyRow cols={6} label="Loading…" />}
          {!isLoading && !data?.length && <EmptyRow cols={6} label="No requests" />}
          {data?.map((r) => (
            <tr key={r.leaveRequestId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{r.employee?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.employee?.employeeCode} · {r.employee?.department?.name ?? "—"}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.leaveType.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                {r.reason && <div className="text-xs">{r.reason}</div>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.days}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                {r.approver && (
                  <div className="mt-1 text-xs text-muted-foreground">by {r.approver.name}</div>
                )}
              </td>
              <td className="px-4 py-3">
                {canApprove && r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Btn
                      small
                      tone="success"
                      busy={decide.isPending}
                      onClick={() => decide.mutate({ id: r.leaveRequestId, action: "approve" })}
                    >
                      Approve
                    </Btn>
                    <Btn small tone="danger" onClick={() => setRejecting(r)}>
                      Reject
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {rejecting && (
        <Modal title={`Reject ${rejecting.employee?.name}'s leave`} onClose={() => setRejecting(null)}>
          <Field label="Reason (shown to the employee)">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Btn>
            <Btn
              tone="danger"
              busy={decide.isPending}
              onClick={() => decide.mutate({ id: rejecting.leaveRequestId, action: "reject", reason })}
            >
              Reject request
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────── Types ──────────────────────────────── */

function LeaveTypes() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LeaveTypeRow | "new" | null>(null);
  const [notice, setNotice] = useState("");

  const { data } = useQuery({ queryKey: crmQueryKeys.leaveTypes, queryFn: hrApi.leaveTypes });

  const del = useMutation({
    mutationFn: (id: number) => hrApi.deleteLeaveType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "leave-types"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      <div className="flex justify-end">
        <Btn small onClick={() => setEditing("new")}>
          <PlusIcon className="h-4 w-4" /> New leave type
        </Btn>
      </div>
      <Card>
        <TableShell head={["Name", "Allowance / year", "Paid", "Carry forward", ""]}>
          {!data?.length && <EmptyRow cols={5} label="No leave types — create one to enable leave allowances" />}
          {data?.map((t) => (
            <tr key={t.leaveTypeId}>
              <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{t.annualAllowance} days</td>
              <td className="px-4 py-3 text-muted-foreground">{t.isPaid ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-muted-foreground">{t.carryForward ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Btn small tone="ghost" onClick={() => setEditing(t)}>
                    Edit
                  </Btn>
                  <Btn small tone="danger" onClick={() => del.mutate(t.leaveTypeId)}>
                    Delete
                  </Btn>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>
      {editing && (
        <LeaveTypeModal row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function LeaveTypeModal({ row, onClose }: { row?: LeaveTypeRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [name, setName] = useState(row?.name ?? "");
  const [allowance, setAllowance] = useState(row?.annualAllowance?.toString() ?? "12");
  const [isPaid, setIsPaid] = useState(row?.isPaid ?? true);
  const [carryForward, setCarryForward] = useState(row?.carryForward ?? false);

  const save = useMutation({
    mutationFn: () => {
      const body = { name, annualAllowance: Number(allowance), isPaid, carryForward };
      return row ? hrApi.updateLeaveType(row.leaveTypeId, body) : hrApi.createLeaveType(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "leave-types"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit ${row.name}` : "New leave type"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Name">
          <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Annual allowance (days per employee per year)">
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.5"
            required
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
          />
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
            Paid leave
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={carryForward}
              onChange={(e) => setCarryForward(e.target.checked)}
            />
            Carry forward
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            Save
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
