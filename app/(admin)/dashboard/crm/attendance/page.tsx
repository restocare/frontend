"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi } from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  fmtTime,
  inputCls,
  statusTone,
} from "@/src/components/crm/ui";
import { MapPinIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";
import { CheckInControls, WorkModeBadge, WORK_MODES, type WorkMode } from "@/src/components/crm/portal";

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation is not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — allow location access to mark attendance"
              : "Could not read your location; try again",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export default function CrmAttendancePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Attendance"
        subtitle="Office check-in is geofenced (within your office radius); Work-from-home and Field check-ins are allowed from anywhere with a reason."
      />
      <MyAttendanceCard />
      {hasPermission("attendance.view") && <TeamAttendance />}
    </div>
  );
}

function MyAttendanceCard() {
  const qc = useQueryClient();
  const month = istToday().slice(0, 7);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [mode, setMode] = useState<WorkMode>("OFFICE");
  const [note, setNote] = useState("");

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.myAttendance(month),
    queryFn: () => hrApi.myAttendance(month),
    retry: false,
  });

  const punch = useMutation({
    mutationFn: async (kind: "in" | "out") => {
      const pos = await getPosition();
      return kind === "in"
        ? hrApi.checkIn({ ...pos, mode, note: note.trim() || undefined })
        : hrApi.checkOut(pos);
    },
    onSuccess: (row, kind) => {
      setMsg({
        kind: "success",
        text:
          kind === "in"
            ? row.checkInDistanceM != null
              ? `Checked in ✓ — ${row.checkInDistanceM} m from the office`
              : `Checked in ✓ — ${WORK_MODES.find((m) => m.key === row.workMode)?.label ?? row.workMode}`
            : `Checked out ✓ — worked ${row.workedMinutes} min`,
      });
      qc.invalidateQueries({ queryKey: ["hr", "attendance"] });
    },
    onError: (e) => setMsg({ kind: "error", text: e instanceof ApiError ? e.message : String((e as Error).message) }),
  });

  const doCheckIn = () => {
    if (mode !== "OFFICE" && !note.trim()) {
      setMsg({ kind: "error", text: "Add a short reason for remote / field attendance." });
      return;
    }
    setMsg(null);
    punch.mutate("in");
  };

  // Users without an employee profile (plain admins) just see the team view.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No employee profile is linked to your account — you can supervise attendance below, but
        check-in is for employees.
      </Card>
    );
  }

  const today = data?.today ?? null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="h-4 w-4" />
            {data?.employee?.office
              ? `${data.employee.office.name} · office within ${data.employee.office.radiusMeters} m — or WFH / Field from anywhere`
              : "No base office — check in as Work from home or Field"}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {today?.checkOutAt
              ? `Done for today · ${today.workedMinutes} min`
              : today
                ? `Checked in at ${fmtTime(today.checkInAt)}`
                : "Not checked in yet"}
          </div>
          {today && (
            <div className="mt-1.5 flex items-center gap-2">
              <WorkModeBadge mode={today.workMode} />
              {today.note && <span className="text-xs text-muted-foreground">{today.note}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {!today && (
            <CheckInControls
              mode={mode}
              setMode={setMode}
              note={note}
              setNote={setNote}
              disabled={punch.isPending}
            />
          )}
          <div className="flex gap-2 sm:justify-end">
            {!today && (
              <Btn busy={punch.isPending} onClick={doCheckIn}>
                <MapPinIcon className="h-4 w-4" /> Check in
              </Btn>
            )}
            {today && !today.checkOutAt && (
              <Btn tone="ghost" busy={punch.isPending} onClick={() => punch.mutate("out")}>
                Check out
              </Btn>
            )}
          </div>
        </div>
      </div>
      {msg && (
        <div className="mt-4">
          <Notice kind={msg.kind}>{msg.text}</Notice>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">This month</h3>
        <TableShell head={["Date", "Mode", "Check-in", "Distance", "Check-out", "Worked", "Status"]}>
          {!data?.records.length && <EmptyRow cols={7} label="No attendance yet this month" />}
          {data?.records.map((r) => (
            <tr key={r.attendanceId}>
              <td className="px-4 py-2.5 text-foreground">{fmtDate(r.date)}</td>
              <td className="px-4 py-2.5">
                <WorkModeBadge mode={r.workMode} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(r.checkInAt)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.checkInDistanceM != null ? `${r.checkInDistanceM} m` : "—"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{fmtTime(r.checkOutAt)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.workedMinutes != null ? `${r.workedMinutes} min` : "—"}
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>
    </Card>
  );
}

function TeamAttendance() {
  const [date, setDate] = useState(istToday());
  const params = { date };
  const { data, isLoading } = useQuery({
    queryKey: crmQueryKeys.attendance(params),
    queryFn: () => hrApi.attendance(params),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Team attendance</h2>
        <input
          type="date"
          className={`${inputCls} w-auto`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <TableShell
        head={["Employee", "Mode", "Office", "Check-in", "Distance", "Check-out", "Worked", "Status"]}
      >
        {isLoading && <EmptyRow cols={8} label="Loading…" />}
        {!isLoading && !data?.length && <EmptyRow cols={8} label="No attendance for this date" />}
        {data?.map((r) => (
          <tr key={r.attendanceId} className="transition-colors hover:bg-accent/50">
            <td className="px-4 py-3">
              <div className="font-medium text-foreground">{r.employee?.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.employee?.employeeCode} · {r.employee?.department?.name ?? "—"}
              </div>
            </td>
            <td className="px-4 py-3">
              <WorkModeBadge mode={r.workMode} />
              {r.note && <div className="mt-1 text-xs text-muted-foreground">{r.note}</div>}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{r.office?.name ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{fmtTime(r.checkInAt)}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {r.checkInDistanceM != null ? `${r.checkInDistanceM} m` : "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{fmtTime(r.checkOutAt)}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {r.workedMinutes != null ? `${r.workedMinutes} min` : "—"}
            </td>
            <td className="px-4 py-3">
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
