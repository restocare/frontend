"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  hrApi,
  type EmployeeRow,
  type ShiftRequestRow,
  type ShiftRow,
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
import { PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";
import { DAYS, daysLabel, shiftWindow } from "@/src/components/crm/shift-utils";

export default function CrmShiftsPage() {
  const canView = hasPermission("shifts.view");
  const tabs = [
    { key: "shifts", label: "Shifts", show: canView },
    { key: "requests", label: "Reschedule requests", show: canView },
  ].filter((t) => t.show);
  const [tab, setTab] = useState(tabs[0]?.key ?? "shifts");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Shift management"
        subtitle="Working windows for the organisation, and who is rostered on each."
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "shifts" && <ShiftsTab />}
      {tab === "requests" && <RequestsTab />}
    </div>
  );
}

/* ─────────────────────────────── Shifts ─────────────────────────────── */

function ShiftsTab() {
  const qc = useQueryClient();
  const canManage = hasPermission("shifts.manage");
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [rosterFor, setRosterFor] = useState<ShiftRow | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data: shifts, error } = useQuery({
    queryKey: crmQueryKeys.shifts(true),
    queryFn: () => hrApi.shifts(true),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["hr", "shifts"] });

  const remove = useMutation({
    mutationFn: (id: number) => hrApi.deleteShift(id),
    onSuccess: (res) => {
      setErr("");
      setNotice(res.message);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not delete the shift"),
  });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      {canManage && (
        <div className="flex justify-end">
          <Btn onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> Add shift
          </Btn>
        </div>
      )}

      <Card>
        <TableShell head={["Shift", "Timing", "Hours", "Days", "Employees", "Status", ""]}>
          {(shifts ?? []).map((s) => (
            <tr key={s.shiftId} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{s.name}</div>
                {s.description && (
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                )}
              </td>
              <td className="px-4 py-3 text-foreground">
                {shiftWindow(s)}
                {s.overnight && (
                  <span className="ml-2 text-xs text-muted-foreground">(next day)</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.hours} h{s.breakMinutes > 0 && ` · ${s.breakMinutes}m break`}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{daysLabel(s.workDays)}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => setRosterFor(s)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {s.employeeCount ?? 0}
                </button>
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.isActive ? "success" : "muted"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {canManage && (
                  <div className="flex justify-end gap-2">
                    <Btn tone="ghost" small onClick={() => setEditing(s)}>
                      Edit
                    </Btn>
                    <Btn
                      tone="danger"
                      small
                      busy={remove.isPending}
                      onClick={() => remove.mutate(s.shiftId)}
                    >
                      Delete
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!shifts?.length && (
            <EmptyRow cols={7} label="No shifts yet — add the first working window." />
          )}
        </TableShell>
      </Card>

      {(creating || editing) && (
        <ShiftModal
          shift={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={(msg) => {
            setCreating(false);
            setEditing(null);
            setNotice(msg);
            refresh();
          }}
        />
      )}
      {rosterFor && <RosterModal shift={rosterFor} onClose={() => setRosterFor(null)} />}
    </div>
  );
}

function ShiftModal({
  shift,
  onClose,
  onDone,
}: {
  shift?: ShiftRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isEdit = !!shift;
  const [name, setName] = useState(shift?.name ?? "");
  const [startTime, setStartTime] = useState(shift?.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(shift?.endTime ?? "19:00");
  const [breakMinutes, setBreakMinutes] = useState(String(shift?.breakMinutes ?? 60));
  const [workDays, setWorkDays] = useState<number[]>(shift?.workDays ?? [1, 2, 3, 4, 5, 6]);
  const [description, setDescription] = useState(shift?.description ?? "");
  const [isActive, setIsActive] = useState(shift?.isActive ?? true);
  const [err, setErr] = useState("");

  const toggleDay = (d: number) =>
    setWorkDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        startTime,
        endTime,
        breakMinutes: Number(breakMinutes) || 0,
        workDays,
        description: description.trim() || undefined,
        isActive,
      };
      return isEdit
        ? hrApi.updateShift(shift.shiftId, body).then(() => `${body.name} updated`)
        : hrApi.createShift(body).then(() => `${body.name} created`);
    },
    onSuccess: onDone,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not save the shift"),
  });

  return (
    <Modal title={isEdit ? `Edit ${shift.name}` : "Add shift"} onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Shift name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="General / Morning / Evening"
            />
          </Field>
        </div>
        <Field label="Starts at">
          <input
            type="time"
            className={inputCls}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field
          label="Ends at"
          hint={endTime <= startTime ? "Runs past midnight into the next day" : undefined}
        >
          <input
            type="time"
            className={inputCls}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </Field>
        <Field label="Break (minutes)" hint="Deducted from the paid hours">
          <input
            className={inputCls}
            value={breakMinutes}
            inputMode="numeric"
            onChange={(e) => setBreakMinutes(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={isActive ? "1" : "0"}
            onChange={(e) => setIsActive(e.target.value === "1")}
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Working days</span>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                  workDays.includes(i)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description" hint="optional">
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kitchen team, weekday counter…"
            />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={save.isPending}
          onClick={() => {
            setErr("");
            if (!name.trim()) return setErr("Give the shift a name.");
            if (!workDays.length) return setErr("Pick at least one working day.");
            save.mutate();
          }}
        >
          {isEdit ? "Save changes" : "Create shift"}
        </Btn>
      </div>
    </Modal>
  );
}

/** Who is on the shift, and adding more people to it. */
function RosterModal({ shift, onClose }: { shift: ShiftRow; onClose: () => void }) {
  const qc = useQueryClient();
  const canManage = hasPermission("shifts.manage");
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");

  const { data } = useQuery({
    queryKey: crmQueryKeys.shiftRoster(shift.shiftId),
    queryFn: () => hrApi.shiftRoster(shift.shiftId),
  });
  // Everyone who could be moved onto this shift — the picker below.
  const { data: employees } = useQuery({
    queryKey: crmQueryKeys.employees({ status: "ACTIVE" }),
    queryFn: () => hrApi.employees({ status: "ACTIVE" }),
    enabled: canManage,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["hr", "shifts"] });
    void qc.invalidateQueries({ queryKey: crmQueryKeys.shiftRoster(shift.shiftId) });
  };

  const assign = useMutation({
    mutationFn: () => hrApi.assignShift(shift.shiftId, picked),
    onSuccess: () => {
      setPicked([]);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not assign"),
  });

  const unassign = useMutation({
    mutationFn: (employeeId: number) => hrApi.unassignShift(employeeId),
    onSuccess: refresh,
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not remove"),
  });

  const onShift = new Set((data?.employees ?? []).map((e) => e.employeeId));
  const candidates = (employees ?? []).filter((e: EmployeeRow) => !onShift.has(e.employeeId));

  return (
    <Modal title={`${shift.name} · ${shiftWindow(shift)}`} onClose={onClose} wide>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            On this shift ({data?.employees.length ?? 0})
          </h4>
          <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {(data?.employees ?? []).map((e) => (
              <div key={e.employeeId} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="text-sm text-foreground">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.employeeCode}
                    {e.designation ? ` · ${e.designation}` : ""}
                    {e.department ? ` · ${e.department.name}` : ""}
                  </div>
                </div>
                {canManage && (
                  <Btn tone="ghost" small onClick={() => unassign.mutate(e.employeeId)}>
                    Remove
                  </Btn>
                )}
              </div>
            ))}
            {!data?.employees.length && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nobody is on this shift yet.
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">Add employees</h4>
            <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {candidates.map((e: EmployeeRow) => (
                <label
                  key={e.employeeId}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(e.employeeId)}
                    onChange={() =>
                      setPicked((p) =>
                        p.includes(e.employeeId)
                          ? p.filter((x) => x !== e.employeeId)
                          : [...p, e.employeeId],
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm text-foreground">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{e.employeeCode}</span>
                </label>
              ))}
              {!candidates.length && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Every active employee is already on this shift.
                </p>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <Btn
                busy={assign.isPending}
                disabled={!picked.length}
                onClick={() => assign.mutate()}
              >
                Move {picked.length || ""} to {shift.name}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ────────────────────── Reschedule requests (HR queue) ────────────────── */

function RequestsTab() {
  const qc = useQueryClient();
  const canApprove = hasPermission("shifts.approve");
  const [status, setStatus] = useState("PENDING");
  const [rejecting, setRejecting] = useState<ShiftRequestRow | null>(null);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.shiftRequests(status),
    queryFn: () => hrApi.shiftRequests(status === "ALL" ? undefined : status),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["hr", "shift-requests"] });
    void qc.invalidateQueries({ queryKey: ["hr", "shifts"] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => hrApi.approveShiftRequest(id),
    onSuccess: (r) => {
      setErr("");
      setNotice(`${r.employee?.name ?? "Employee"} moved to ${r.requestedShift.name}`);
      refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not approve"),
  });

  return (
    <div className="space-y-4">
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === s
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s === "PENDING" && data?.pendingCount ? ` (${data.pendingCount})` : ""}
          </button>
        ))}
      </div>

      <Card>
        <TableShell
          head={["Employee", "From → To", "Effective", "Reason", "Raised", "Status", ""]}
        >
          {(data?.requests ?? []).map((r) => (
            <tr key={r.shiftRequestId} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{r.employee?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {r.employee?.employeeCode}
                  {r.employee?.department ? ` · ${r.employee.department.name}` : ""}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-foreground">
                <span className="text-muted-foreground">
                  {r.currentShift ? `${r.currentShift.name} (${shiftWindow(r.currentShift)})` : "No shift"}
                </span>
                <span className="mx-2">→</span>
                {r.requestedShift.name} ({shiftWindow(r.requestedShift)})
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {fmtDate(r.effectiveFrom)}
                {r.effectiveTo ? ` – ${fmtDate(r.effectiveTo)}` : ""}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.reason || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                {r.status === "REJECTED" && r.rejectionReason && (
                  <div className="mt-1 text-xs text-muted-foreground">{r.rejectionReason}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {r.status === "PENDING" && canApprove && (
                  <div className="flex justify-end gap-2">
                    <Btn
                      tone="success"
                      small
                      busy={approve.isPending}
                      onClick={() => approve.mutate(r.shiftRequestId)}
                    >
                      Approve
                    </Btn>
                    <Btn tone="danger" small onClick={() => setRejecting(r)}>
                      Reject
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!data?.requests.length && (
            <EmptyRow cols={7} label="No requests in this bucket." />
          )}
        </TableShell>
      </Card>

      {rejecting && (
        <RejectModal
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(msg) => {
            setRejecting(null);
            setNotice(msg);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RejectModal({
  request,
  onClose,
  onDone,
}: {
  request: ShiftRequestRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const reject = useMutation({
    mutationFn: () => hrApi.rejectShiftRequest(request.shiftRequestId, reason.trim() || undefined),
    onSuccess: () => onDone(`Request from ${request.employee?.name ?? "employee"} rejected`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not reject"),
  });

  return (
    <Modal title="Reject shift request" onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      <p className="mb-3 text-sm text-muted-foreground">
        {request.employee?.name} asked to move to {request.requestedShift.name} (
        {shiftWindow(request.requestedShift)}).
      </p>
      <Field label="Reason" hint="Shown to the employee on their My Shift page">
        <input
          className={inputCls}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Evening shift is already at capacity"
        />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn tone="danger" busy={reject.isPending} onClick={() => reject.mutate()}>
          Reject request
        </Btn>
      </div>
    </Modal>
  );
}
