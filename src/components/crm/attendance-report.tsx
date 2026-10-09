"use client";

/**
 * Attendance detail and Excel export for the admin Attendance page.
 *
 *   - EmployeeAttendanceModal: one person, one month (Oct, Sep, …), every day
 *     with in time, out time, total time and status, plus month totals.
 *   - ExportAttendanceModal: every employee (or one) over a date range, as an
 *     .xlsx with a day-by-day sheet and a summary sheet.
 *
 * Days without a check-in: Sunday = week off, a company holiday = holiday,
 * a past working day = absent, today = not marked yet, future = blank.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crmQueryKeys, essApi, hrApi, type AttendanceRow, type HolidayRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { Badge, Btn, EmptyRow, Field, Modal, Notice, TableShell, fmtTime, inputCls } from "@/src/components/crm/ui";

/* --------------------------------- dates -------------------------------- */

const IST = "Asia/Kolkata";

/** "2026-10-08" in IST. */
export const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });

/** The IST calendar day of an API timestamp or date. */
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });

const utc = (d: string) => new Date(`${d}T00:00:00Z`);

/** Every date from `from` to `to`, inclusive. */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = utc(from).getTime(), end = utc(to).getTime(); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const dayName = (d: string) => utc(d).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "01 Oct 2026" (fixed names: some browsers write "Sept"). */
const dateText = (d: string) => `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const isSunday = (d: string) => utc(d).getUTCDay() === 0;

/** "2026-10" → first and last day. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** This month and the 11 before it, newest first. */
function lastMonths(today: string, n = 12): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

export const fmtWorked = (min: number | null | undefined) =>
  min == null ? "—" : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

/* --------------------------------- days --------------------------------- */

type DayKind = "FULL" | "HALF" | "ABSENT" | "WEEK_OFF" | "HOLIDAY" | "TODAY" | "FUTURE" | "BEFORE_JOIN";

export interface DayRow {
  date: string;
  kind: DayKind;
  label: string;
  late: boolean;
  record: AttendanceRow | null;
  holiday?: string;
}

const KIND_LABEL: Record<DayKind, string> = {
  FULL: "Full day",
  HALF: "Half day",
  ABSENT: "Absent",
  WEEK_OFF: "Week off",
  HOLIDAY: "Holiday",
  TODAY: "Not marked yet",
  FUTURE: "",
  BEFORE_JOIN: "Not joined",
};

const KIND_TONE: Record<DayKind, string> = {
  FULL: "success",
  HALF: "warning",
  ABSENT: "danger",
  WEEK_OFF: "muted",
  HOLIDAY: "primary",
  TODAY: "muted",
  FUTURE: "muted",
  BEFORE_JOIN: "muted",
};

function buildDays(
  dates: string[],
  records: AttendanceRow[],
  holidays: Map<string, string>,
  today: string,
  joinDate?: string | null,
): DayRow[] {
  const byDate = new Map(records.map((r) => [istDay(r.date), r]));
  const joined = joinDate ? istDay(joinDate) : null;
  return dates.map((date) => {
    const record = byDate.get(date) ?? null;
    let kind: DayKind;
    if (record) kind = record.status === "HALF_DAY" ? "HALF" : "FULL";
    else if (date > today) kind = "FUTURE";
    else if (joined && date < joined) kind = "BEFORE_JOIN";
    else if (holidays.has(date)) kind = "HOLIDAY";
    else if (isSunday(date)) kind = "WEEK_OFF";
    else if (date === today) kind = "TODAY";
    else kind = "ABSENT";
    const late = record?.status === "LATE";
    return {
      date,
      kind,
      late,
      record,
      holiday: holidays.get(date),
      label: kind === "HOLIDAY" ? `Holiday · ${holidays.get(date)}` : KIND_LABEL[kind] + (late ? " (late)" : ""),
    };
  });
}

function totals(days: DayRow[]) {
  const t = { full: 0, half: 0, absent: 0, late: 0, weekOff: 0, holiday: 0, minutes: 0 };
  for (const d of days) {
    if (d.kind === "FULL") t.full++;
    if (d.kind === "HALF") t.half++;
    if (d.kind === "ABSENT") t.absent++;
    if (d.kind === "WEEK_OFF") t.weekOff++;
    if (d.kind === "HOLIDAY") t.holiday++;
    if (d.late) t.late++;
    t.minutes += d.record?.workedMinutes ?? 0;
  }
  return t;
}

/** Company holidays for the years a range touches; empty if HR has none or access is refused. */
function useHolidays(from: string, to: string) {
  const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
  const q = useQuery({
    queryKey: ["hr", "holidays", years],
    queryFn: async () => (await Promise.all(years.map((y) => essApi.holidays(y).catch(() => [] as HolidayRow[])))).flat(),
    retry: false,
    staleTime: 10 * 60_000,
  });
  return useMemo(
    () => new Map((q.data ?? []).filter((h) => !h.isOptional).map((h) => [istDay(h.date), h.name])),
    [q.data],
  );
}

/* --------------------------------- excel -------------------------------- */

export interface ExportPerson {
  employeeId: number;
  name: string;
  employeeCode: string;
  joinDate?: string | null;
}

async function downloadXlsx(
  people: ExportPerson[],
  records: AttendanceRow[],
  from: string,
  to: string,
  holidays: Map<string, string>,
  today: string,
  fileName: string,
) {
  const XLSX = await import("xlsx");
  const dates = datesBetween(from, to);
  const range = `${dateText(from)} to ${dateText(to)}`;
  const byPerson = new Map<number, AttendanceRow[]>();
  for (const r of records) byPerson.set(r.employeeId, [...(byPerson.get(r.employeeId) ?? []), r]);

  const daily: Record<string, string | number>[] = [];
  const summary: Record<string, string | number>[] = [];
  for (const p of people) {
    const days = buildDays(dates, byPerson.get(p.employeeId) ?? [], holidays, today, p.joinDate);
    for (const d of days) {
      if (d.kind === "FUTURE") continue;
      daily.push({
        "Employee Name": p.name,
        "Employee ID": p.employeeCode,
        "Date Range": range,
        Date: dateText(d.date),
        Day: dayName(d.date),
        "In Time": d.record ? fmtTime(d.record.checkInAt) : "",
        "Out Time": d.record?.checkOutAt ? fmtTime(d.record.checkOutAt) : "",
        "Total Time": d.record ? fmtWorked(d.record.workedMinutes) : "",
        Status: d.label,
        "Full Day": d.kind === "FULL" ? 1 : 0,
        "Half Day": d.kind === "HALF" ? 1 : 0,
        Absent: d.kind === "ABSENT" ? 1 : 0,
        Late: d.late ? 1 : 0,
      });
    }
    const t = totals(days);
    summary.push({
      "Employee Name": p.name,
      "Employee ID": p.employeeCode,
      "Date Range": range,
      "Full Days": t.full,
      "Half Days": t.half,
      Absent: t.absent,
      Late: t.late,
      "Week Offs": t.weekOff,
      Holidays: t.holiday,
      "Total Hours": fmtWorked(t.minutes),
    });
  }

  const wb = XLSX.utils.book_new();
  const sheet = (rows: Record<string, string | number>[], widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = widths.map((wch) => ({ wch }));
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, sheet(daily, [24, 12, 30, 13, 6, 10, 10, 10, 20, 9, 9, 8, 6]), "Attendance");
  XLSX.utils.book_append_sheet(wb, sheet(summary, [24, 12, 30, 10, 10, 8, 6, 10, 9, 12]), "Summary");
  XLSX.writeFile(wb, fileName);
}

/* ------------------------------ one person ------------------------------ */

export function EmployeeAttendanceModal({ person, onClose }: { person: ExportPerson & { subtitle?: string }; onClose: () => void }) {
  const [today] = useState(istToday);
  const months = useMemo(() => lastMonths(today), [today]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const { from, to } = monthRange(month);
  const params = { employeeId: person.employeeId, from, to };
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.attendance(params),
    queryFn: () => hrApi.attendance(params),
  });
  const holidays = useHolidays(from, to);
  const days = useMemo(
    () => buildDays(datesBetween(from, to), data ?? [], holidays, today, person.joinDate),
    [from, to, data, holidays, today, person.joinDate],
  );
  const t = totals(days);
  const [busy, setBusy] = useState(false);

  const exportMonth = async () => {
    setBusy(true);
    try {
      await downloadXlsx([person], data ?? [], from, to, holidays, today, `Attendance_${person.employeeCode}_${month}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  const tiles: [string, string | number, string][] = [
    ["Full days", t.full, "text-success"],
    ["Half days", t.half, "text-warning"],
    ["Absent", t.absent, "text-danger"],
    ["Late", t.late, "text-warning"],
    ["Total time", fmtWorked(t.minutes), "text-foreground"],
  ];

  return (
    <Modal title={person.name} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {person.employeeCode}
            {person.subtitle ? ` · ${person.subtitle}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="rounded-lg border border-border px-2.5 py-2 text-sm text-foreground hover:bg-accent"
              >
                ‹
              </button>
              <select
                aria-label="Month"
                className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {(months.includes(month) ? months : [month, ...months]).map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next month"
                disabled={month >= today.slice(0, 7)}
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="rounded-lg border border-border px-2.5 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-40"
              >
                ›
              </button>
            </div>
            <Btn small tone="ghost" busy={busy} disabled={isLoading} onClick={exportMonth}>
              Export Excel
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-border px-3 py-2.5">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        {error ? <Notice kind="error">{error instanceof ApiError ? error.message : "Could not load attendance."}</Notice> : null}

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border">
          <TableShell head={["Date", "Day", "In time", "Out time", "Total time", "Status"]}>
            {isLoading && <EmptyRow cols={6} label="Loading…" />}
            {!isLoading &&
              days
                .filter((d) => d.kind !== "FUTURE")
                .reverse()
                .map((d) => (
                  <tr key={d.date} className={d.kind === "WEEK_OFF" || d.kind === "HOLIDAY" ? "bg-accent/30" : ""}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-foreground">{dateText(d.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{dayName(d.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{d.record ? fmtTime(d.record.checkInAt) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {d.record?.checkOutAt ? fmtTime(d.record.checkOutAt) : d.record ? "No check-out" : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{d.record ? fmtWorked(d.record.workedMinutes) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge tone={KIND_TONE[d.kind]}>{d.label}</Badge>
                    </td>
                  </tr>
                ))}
          </TableShell>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- export all ------------------------------ */

export function ExportAttendanceModal({ onClose }: { onClose: () => void }) {
  const [today] = useState(istToday);
  const months = useMemo(() => lastMonths(today), [today]);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const holidays = useHolidays(from, to);

  const pickMonth = (m: string) => {
    if (!m) return;
    const r = monthRange(m);
    setFrom(r.from);
    setTo(r.to > today ? today : r.to);
  };
  const monthValue = months.find((m) => {
    const r = monthRange(m);
    return from === r.from && (to === r.to || to === today);
  });

  const run = async () => {
    if (!from || !to || from > to) return setMsg("Pick a start date on or before the end date.");
    setBusy(true);
    setMsg(null);
    try {
      const [records, employees] = await Promise.all([
        hrApi.attendance({ from, to }),
        hrApi.employees({ status: "ACTIVE" }).catch(() => []),
      ]);
      // Active employees, plus anyone who checked in but is no longer active.
      const people = new Map<number, ExportPerson>();
      for (const e of employees) {
        people.set(e.employeeId, { employeeId: e.employeeId, name: e.name, employeeCode: e.employeeCode, joinDate: e.joinDate });
      }
      for (const r of records) {
        if (!people.has(r.employeeId) && r.employee) {
          people.set(r.employeeId, { employeeId: r.employeeId, name: r.employee.name, employeeCode: r.employee.employeeCode });
        }
      }
      const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) return setMsg("No employees or attendance in this range.");
      await downloadXlsx(list, records, from, to, holidays, today, `Attendance_${from}_to_${to}.xlsx`);
      onClose();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not export attendance.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Export attendance to Excel" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Month">
          <select className={inputCls} value={monthValue ?? ""} onChange={(e) => pickMonth(e.target.value)}>
            <option value="">Custom range</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          One row per employee per day: name, employee ID, date range, date, day, in time, out time, total time, and
          full day / half day / absent. A second sheet totals each employee. Sundays count as week off.
        </p>
        {msg ? <Notice kind="error">{msg}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn busy={busy} onClick={run}>
            Download Excel
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
