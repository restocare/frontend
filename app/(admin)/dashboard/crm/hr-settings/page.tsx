"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  essApi,
  holidayApi,
  hrApi,
  type DepartmentRow,
  type HolidayRow,
  type OfficeRow,
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
  inputCls,
} from "@/src/components/crm/ui";
import { MapPinIcon, PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

export default function HrSettingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="HR Settings"
        subtitle="Departments, office locations (attendance geofence anchors) and the holiday calendar."
      />
      <Departments />
      <Offices />
      <Holidays />
    </div>
  );
}

/* ───────────────────────────── Holidays ─────────────────────────────── */

function Holidays() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [modal, setModal] = useState<{ row?: HolidayRow } | null>(null);
  const [notice, setNotice] = useState("");

  const { data } = useQuery({
    queryKey: crmQueryKeys.holidays(year),
    queryFn: () => essApi.holidays(year),
  });

  const del = useMutation({
    mutationFn: (id: number) => holidayApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ess", "holidays"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  const canManage = hasPermission("holidays.manage");
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Holiday calendar</h2>
        <div className="flex items-center gap-2">
          <select
            className={`${inputCls} w-auto`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[year - 1, year, year + 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
          {canManage && (
            <Btn small onClick={() => setModal({})}>
              <PlusIcon className="h-4 w-4" /> Add
            </Btn>
          )}
        </div>
      </div>
      {notice && (
        <div className="px-5 pt-4">
          <Notice kind="error">{notice}</Notice>
        </div>
      )}
      <TableShell head={["Holiday", "Date", "Kind", ""]}>
        {!data?.length && (
          <EmptyRow cols={4} label={`No holidays for ${year} — employees see these on their portal.`} />
        )}
        {data?.map((h) => (
          <tr key={h.holidayId}>
            <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{fmt(h.date)}</td>
            <td className="px-4 py-3">
              <Badge tone={h.isOptional ? "muted" : "primary"}>
                {h.isOptional ? "Optional" : "Company"}
              </Badge>
            </td>
            <td className="px-4 py-3 text-right">
              {canManage && (
                <div className="flex justify-end gap-2">
                  <Btn small tone="ghost" onClick={() => setModal({ row: h })}>
                    Edit
                  </Btn>
                  <Btn small tone="danger" onClick={() => del.mutate(h.holidayId)}>
                    Delete
                  </Btn>
                </div>
              )}
            </td>
          </tr>
        ))}
      </TableShell>
      {modal && <HolidayModal row={modal.row} onClose={() => setModal(null)} />}
    </Card>
  );
}

function HolidayModal({ row, onClose }: { row?: HolidayRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(row?.name ?? "");
  const [date, setDate] = useState(row?.date ?? "");
  const [isOptional, setIsOptional] = useState(row?.isOptional ?? false);
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: () =>
      row
        ? holidayApi.update(row.holidayId, { name: name.trim(), date, isOptional })
        : holidayApi.create({ name: name.trim(), date, isOptional }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ess", "holidays"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  const submit = () => {
    if (!name.trim()) return setErr("Name the holiday.");
    if (!date) return setErr("Pick the date.");
    setErr("");
    save.mutate();
  };

  return (
    <Modal title={row ? "Edit holiday" : "Add holiday"} onClose={onClose}>
      <div className="space-y-4">
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Name *">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali"
          />
        </Field>
        <Field label="Date *">
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(e) => setIsOptional(e.target.checked)}
          />
          Optional / restricted holiday
        </label>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn busy={save.isPending} onClick={submit}>
            {row ? "Save" : "Add holiday"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────── Departments ───────────────────────────── */

function Departments() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ row?: DepartmentRow } | null>(null);
  const [notice, setNotice] = useState("");

  const { data } = useQuery({ queryKey: crmQueryKeys.departments, queryFn: hrApi.departments });

  const del = useMutation({
    mutationFn: (id: number) => hrApi.deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "departments"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Departments</h2>
        {hasPermission("departments.create") && (
          <Btn small onClick={() => setModal({})}>
            <PlusIcon className="h-4 w-4" /> Add
          </Btn>
        )}
      </div>
      {notice && (
        <div className="px-5 pt-4">
          <Notice kind="error">{notice}</Notice>
        </div>
      )}
      <TableShell head={["Name", "Description", "Employees", ""]}>
        {!data?.length && <EmptyRow cols={4} label="No departments yet" />}
        {data?.map((d) => (
          <tr key={d.departmentId}>
            <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{d.description ?? "—"}</td>
            <td className="px-4 py-3 text-muted-foreground">{d._count?.employees ?? 0}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-2">
                {hasPermission("departments.update") && (
                  <Btn small tone="ghost" onClick={() => setModal({ row: d })}>
                    Edit
                  </Btn>
                )}
                {hasPermission("departments.delete") && (
                  <Btn small tone="danger" onClick={() => del.mutate(d.departmentId)}>
                    Delete
                  </Btn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {modal && <DepartmentModal row={modal.row} onClose={() => setModal(null)} />}
    </Card>
  );
}

function DepartmentModal({ row, onClose }: { row?: DepartmentRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");

  const save = useMutation({
    mutationFn: () =>
      row
        ? hrApi.updateDepartment(row.departmentId, { name, description: description || undefined })
        : hrApi.createDepartment({ name, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "departments"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit ${row.name}` : "Add department"} onClose={onClose}>
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
        <Field label="Description">
          <input
            className={inputCls}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
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

/* ────────────────────────────── Offices ─────────────────────────────── */

function Offices() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ row?: OfficeRow } | null>(null);
  const [notice, setNotice] = useState("");

  const { data } = useQuery({ queryKey: crmQueryKeys.offices, queryFn: hrApi.offices });

  const del = useMutation({
    mutationFn: (id: number) => hrApi.deleteOffice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "offices"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Office locations</h2>
          <p className="text-xs text-muted-foreground">
            Employees can mark attendance only within the radius of their assigned office.
          </p>
        </div>
        {hasPermission("offices.create") && (
          <Btn small onClick={() => setModal({})}>
            <PlusIcon className="h-4 w-4" /> Add
          </Btn>
        )}
      </div>
      {notice && (
        <div className="px-5 pt-4">
          <Notice kind="error">{notice}</Notice>
        </div>
      )}
      <TableShell head={["Office", "Coordinates", "Radius", "Status", "Employees", ""]}>
        {!data?.length && <EmptyRow cols={6} label="No offices yet — add one to enable attendance" />}
        {data?.map((o) => (
          <tr key={o.officeId}>
            <td className="px-4 py-3">
              <div className="font-medium text-foreground">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.address}</div>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {o.latitude.toFixed(6)}, {o.longitude.toFixed(6)}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{o.radiusMeters} m</td>
            <td className="px-4 py-3">
              <Badge tone={o.isActive ? "success" : "muted"}>
                {o.isActive ? "ACTIVE" : "INACTIVE"}
              </Badge>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{o._count?.employees ?? 0}</td>
            <td className="px-4 py-3 text-right">
              <div className="flex justify-end gap-2">
                {hasPermission("offices.update") && (
                  <Btn small tone="ghost" onClick={() => setModal({ row: o })}>
                    Edit
                  </Btn>
                )}
                {hasPermission("offices.delete") && (
                  <Btn small tone="danger" onClick={() => del.mutate(o.officeId)}>
                    Delete
                  </Btn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {modal && <OfficeModal row={modal.row} onClose={() => setModal(null)} />}
    </Card>
  );
}

function OfficeModal({ row, onClose }: { row?: OfficeRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    name: row?.name ?? "",
    address: row?.address ?? "",
    latitude: row?.latitude?.toString() ?? "",
    longitude: row?.longitude?.toString() ?? "",
    radiusMeters: row?.radiusMeters?.toString() ?? "100",
    isActive: row?.isActive ?? true,
  });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return setErr("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("latitude", pos.coords.latitude.toFixed(7));
        set("longitude", pos.coords.longitude.toFixed(7));
        setErr("");
      },
      () => setErr("Could not read your location"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        address: f.address,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        radiusMeters: Number(f.radiusMeters),
        isActive: f.isActive,
      };
      return row ? hrApi.updateOffice(row.officeId, body) : hrApi.createOffice(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "offices"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit ${row.name}` : "Add office"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Office name">
          <input className={inputCls} required value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Address">
          <input
            className={inputCls}
            required
            value={f.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude">
            <input
              className={inputCls}
              type="number"
              step="any"
              required
              value={f.latitude}
              onChange={(e) => set("latitude", e.target.value)}
            />
          </Field>
          <Field label="Longitude">
            <input
              className={inputCls}
              type="number"
              step="any"
              required
              value={f.longitude}
              onChange={(e) => set("longitude", e.target.value)}
            />
          </Field>
        </div>
        <Btn tone="ghost" small onClick={useMyLocation}>
          <MapPinIcon className="h-4 w-4" /> Use my current location
        </Btn>
        <Field label="Check-in radius (meters)" hint="Employees beyond this distance cannot mark attendance">
          <input
            className={inputCls}
            type="number"
            min="10"
            max="5000"
            required
            value={f.radiusMeters}
            onChange={(e) => set("radiusMeters", e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
          />
          Active (check-ins allowed)
        </label>
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
