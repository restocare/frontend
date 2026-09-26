"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi, type ShiftRow } from "@/src/api/api";
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
import { DAYS, shiftWindow } from "@/src/components/crm/shift-utils";

/**
 * The employee's own shift: what they're rostered on, and the request they can
 * raise to move. HR decides — approving reassigns them.
 */
export default function MyShiftPage() {
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.myShift,
    queryFn: () => hrApi.myShift(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: crmQueryKeys.myShift });

  const cancel = useMutation({
    mutationFn: (id: number) => hrApi.cancelShiftRequest(id),
    onSuccess: () => {
      setErr("");
      setNotice("Request withdrawn");
      void refresh();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not cancel"),
  });

  const current = data?.currentShift;
  const pending = (data?.requests ?? []).find((r) => r.status === "PENDING");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My shift"
        subtitle="Your working window, and requests to change it."
        action={
          <Btn onClick={() => setAsking(true)} disabled={!!pending}>
            Request reschedule
          </Btn>
        }
      />

      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      {pending && (
        <Notice kind="success">
          Your request to move to {pending.requestedShift.name} is with HR — you&apos;ll see the
          decision here.
        </Notice>
      )}

      <Card className="p-5">
        {current ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Currently rostered on
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">{current.name}</h2>
              <p className="mt-1 text-lg text-foreground">{shiftWindow(current)}</p>
              {current.description && (
                <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
              )}
            </div>
            <div className="grid gap-1 text-sm text-muted-foreground">
              <span>
                <span className="text-foreground">{current.hours} h</span> per day
                {current.breakMinutes > 0 && ` · ${current.breakMinutes} min break`}
              </span>
              <span>
                Working days:{" "}
                <span className="text-foreground">
                  {current.workDays.map((d) => DAYS[d]).join(", ")}
                </span>
              </span>
              {current.overnight && <span>Runs past midnight into the next day</span>}
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You are not on a shift yet. Raise a request below and HR will roster you.
          </p>
        )}
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">My requests</h3>
        <Card>
          <TableShell head={["Requested shift", "Effective", "Reason", "Raised", "Status", ""]}>
            {(data?.requests ?? []).map((r) => (
              <tr key={r.shiftRequestId} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.requestedShift.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {shiftWindow(r.requestedShift)}
                  </div>
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
                  {r.status === "PENDING" && (
                    <Btn
                      tone="ghost"
                      small
                      busy={cancel.isPending}
                      onClick={() => cancel.mutate(r.shiftRequestId)}
                    >
                      Withdraw
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
            {!data?.requests.length && (
              <EmptyRow cols={6} label="You haven't raised any shift requests." />
            )}
          </TableShell>
        </Card>
      </div>

      {asking && (
        <RequestModal
          shifts={(data?.shifts ?? []).filter((s) => s.shiftId !== current?.shiftId)}
          onClose={() => setAsking(false)}
          onDone={(msg) => {
            setAsking(false);
            setNotice(msg);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function RequestModal({
  shifts,
  onClose,
  onDone,
}: {
  shifts: ShiftRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [requestedShiftId, setRequestedShiftId] = useState(String(shifts[0]?.shiftId ?? ""));
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      hrApi.requestShiftChange({
        requestedShiftId: Number(requestedShiftId),
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (r) => onDone(`Request to move to ${r.requestedShift.name} sent to HR`),
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not send the request"),
  });

  return (
    <Modal title="Request a shift change" onClose={onClose}>
      {err && <Notice kind="error">{err}</Notice>}
      {!shifts.length ? (
        <p className="text-sm text-muted-foreground">
          There is no other active shift to move to right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Move me to">
              <select
                className={inputCls}
                value={requestedShiftId}
                onChange={(e) => setRequestedShiftId(e.target.value)}
              >
                {shifts.map((s) => (
                  <option key={s.shiftId} value={s.shiftId}>
                    {s.name} · {shiftWindow(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="From">
            <input
              type="date"
              className={inputCls}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
          <Field label="Until" hint="leave blank for a permanent move">
            <input
              type="date"
              className={inputCls}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reason" hint="HR sees this when deciding">
              <input
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Evening classes until 12:30"
              />
            </Field>
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          busy={submit.isPending}
          disabled={!shifts.length}
          onClick={() => {
            setErr("");
            if (!requestedShiftId) return setErr("Pick the shift you want to move to.");
            if (!effectiveFrom) return setErr("Choose the date you want the change from.");
            if (effectiveTo && effectiveTo < effectiveFrom)
              return setErr("The end date cannot be before the start date.");
            submit.mutate();
          }}
        >
          Send to HR
        </Btn>
      </div>
    </Modal>
  );
}
