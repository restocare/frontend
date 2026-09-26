"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi, type EmployeeRow } from "@/src/api/api";
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
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";
import { shiftWindow } from "@/src/components/crm/shift-utils";

export default function CrmEmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; row: EmployeeRow } | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<EmployeeRow | null>(null);
  const [notice, setNotice] = useState("");
  const params = { search: search || undefined };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.employees(params),
    queryFn: () => hrApi.employees(params),
  });

  const del = useMutation({
    mutationFn: (id: number) => hrApi.deleteEmployee(id),
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`${data?.length ?? "…"} employees`}
        action={
          hasPermission("employees.create") ? (
            <Btn onClick={() => setModal({ mode: "create" })}>
              <PlusIcon className="h-4 w-4" /> Add employee
            </Btn>
          ) : undefined
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {notice && <Notice kind="error">{notice}</Notice>}

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${inputCls} pl-10`}
          placeholder="Search name, code, designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <TableShell head={["Employee", "Department", "Shift", "Office", "Type", "Status", "Joined", ""]}>
          {isLoading && <EmptyRow cols={8} label="Loading…" />}
          {!isLoading && !data?.length && <EmptyRow cols={8} label="No employees yet" />}
          {data?.map((e) => (
            <tr key={e.employeeId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {e.employeeCode} · {e.designation ?? "—"}
                  {e.user ? " · has login" : ""}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.department?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {e.shift ? (
                  <>
                    <div className="text-foreground">{e.shift.name}</div>
                    <div className="text-xs">{shiftWindow(e.shift)}</div>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.office?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {e.employmentType.replaceAll("_", " ")}
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(e.status)}>{e.status.replaceAll("_", " ")}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(e.joinDate)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {hasPermission("employees.update") && (
                    <button
                      type="button"
                      onClick={() => setModal({ mode: "edit", row: e })}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                  {hasPermission("employees.delete") && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(e)}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {modal && (
        <EmployeeForm
          row={modal.mode === "edit" ? modal.row : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete employee" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{confirmDelete.name}</span> (
            {confirmDelete.employeeCode})? Attendance, leave and appraisal history will be removed.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Btn>
            <Btn tone="danger" busy={del.isPending} onClick={() => del.mutate(confirmDelete.employeeId)}>
              Delete
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmployeeForm({ row, onClose }: { row?: EmployeeRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    name: row?.name ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    designation: row?.designation ?? "",
    departmentId: row?.department?.departmentId?.toString() ?? "",
    officeId: row?.office?.officeId?.toString() ?? "",
    employmentType: row?.employmentType ?? "FULL_TIME",
    status: row?.status ?? "ACTIVE",
    joinDate: row?.joinDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dob: row?.dob?.slice(0, 10) ?? "",
    salary: row?.salary?.toString() ?? "",
    address: row?.address ?? "",
    emergencyContact: row?.emergencyContact ?? "",
    shiftId: row?.shift?.shiftId?.toString() ?? "",
    // The panel login this employee record belongs to. Picking one prefills the
    // details HR already typed on the Staff screen, instead of asking twice.
    userId: "",
    loginPassword: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const { data: departments } = useQuery({
    queryKey: crmQueryKeys.departments,
    queryFn: hrApi.departments,
  });
  const { data: offices } = useQuery({ queryKey: crmQueryKeys.offices, queryFn: hrApi.offices });
  const { data: shifts } = useQuery({
    queryKey: crmQueryKeys.shifts(false),
    queryFn: () => hrApi.shifts(),
  });
  // Panel logins with no employee record yet — only offered when creating.
  const { data: staffLogins } = useQuery({
    queryKey: crmQueryKeys.linkableUsers,
    queryFn: hrApi.linkableUsers,
    enabled: !row,
  });

  /** Copy across what the Staff screen already captured. */
  const prefillFromLogin = (userId: string) => {
    const login = staffLogins?.find((u) => String(u.userId) === userId);
    setF((p) => ({
      ...p,
      userId,
      ...(login
        ? {
            name: login.name || p.name,
            email: login.email || p.email,
            phone: login.mobile || p.phone,
            // The login already exists, so there's no password to set here.
            loginPassword: "",
          }
        : {}),
    }));
  };

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: f.name,
        phone: f.phone || undefined,
        designation: f.designation || undefined,
        departmentId: f.departmentId ? Number(f.departmentId) : null,
        officeId: f.officeId ? Number(f.officeId) : null,
        employmentType: f.employmentType,
        dob: f.dob || undefined,
        salary: f.salary ? Number(f.salary) : undefined,
        address: f.address || undefined,
        emergencyContact: f.emergencyContact || undefined,
        shiftId: f.shiftId ? Number(f.shiftId) : null,
      };
      if (row) {
        body.status = f.status;
        return hrApi.updateEmployee(row.employeeId, body);
      }
      body.email = f.email;
      body.joinDate = f.joinDate;
      if (f.userId) body.userId = Number(f.userId);
      else if (f.loginPassword) body.loginPassword = f.loginPassword;
      return hrApi.createEmployee(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit ${row.name}` : "Add employee"} onClose={onClose} wide>
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
        {!row && !!staffLogins?.length && (
          <div className="sm:col-span-2">
            <Field
              label="Start from a staff login"
              hint="Pulls in the name, email and phone already entered on the Staff screen — and links that login to this employee"
            >
              <select
                className={inputCls}
                value={f.userId}
                onChange={(e) => prefillFromLogin(e.target.value)}
              >
                <option value="">— Enter the details manually —</option>
                {staffLogins.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name || u.email} · {u.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Full name">
          <input className={inputCls} required value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email" hint={row ? "Email cannot be changed" : undefined}>
          <input
            className={inputCls}
            type="email"
            required
            disabled={!!row}
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Birthday" hint="Shown on the portal celebrations wall">
          <input
            className={inputCls}
            type="date"
            value={f.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
        </Field>
        <Field label="Designation">
          <input
            className={inputCls}
            value={f.designation}
            onChange={(e) => set("designation", e.target.value)}
          />
        </Field>
        <Field label="Department">
          <select
            className={inputCls}
            value={f.departmentId}
            onChange={(e) => set("departmentId", e.target.value)}
          >
            <option value="">— None —</option>
            {departments?.map((d) => (
              <option key={d.departmentId} value={d.departmentId}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shift" hint="Their working window; they see it under My Shift">
          <select className={inputCls} value={f.shiftId} onChange={(e) => set("shiftId", e.target.value)}>
            <option value="">— Not assigned —</option>
            {shifts?.map((s) => (
              <option key={s.shiftId} value={s.shiftId}>
                {s.name} · {s.startTime}–{s.endTime}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Office (attendance geofence)">
          <select className={inputCls} value={f.officeId} onChange={(e) => set("officeId", e.target.value)}>
            <option value="">— None —</option>
            {offices?.map((o) => (
              <option key={o.officeId} value={o.officeId}>
                {o.name} ({o.radiusMeters} m)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type">
          <select
            className={inputCls}
            value={f.employmentType}
            onChange={(e) => set("employmentType", e.target.value)}
          >
            {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        {row ? (
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
              {["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Join date">
            <input
              className={inputCls}
              type="date"
              required
              value={f.joinDate}
              onChange={(e) => set("joinDate", e.target.value)}
            />
          </Field>
        )}
        <Field label="Monthly salary (₹)">
          <input
            className={inputCls}
            type="number"
            min="0"
            value={f.salary}
            onChange={(e) => set("salary", e.target.value)}
          />
        </Field>
        <Field label="Emergency contact">
          <input
            className={inputCls}
            value={f.emergencyContact}
            onChange={(e) => set("emergencyContact", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <input className={inputCls} value={f.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
        {row ? (
          <div className="sm:col-span-2">
            <LinkLoginSection employee={row} />
          </div>
        ) : f.userId ? (
          // A login was picked at the top, so there is nothing to create here.
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
            This employee signs in with the staff login selected above — no new password needed.
          </div>
        ) : (
          <div className="sm:col-span-2">
            <Field
              label="Panel login password (optional)"
              hint="If set, a STAFF login is created so the employee can sign in, mark geofenced attendance and apply for leaves."
            >
              <input
                className={inputCls}
                type="password"
                minLength={6}
                value={f.loginPassword}
                onChange={(e) => set("loginPassword", e.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {row ? "Save changes" : "Create employee"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

// Link (or unlink) a login to an existing employee so they can sign in and
// mark geofenced attendance. Either attach an existing unlinked panel user, or
// mint a new STAFF login on the employee's email.
function LinkLoginSection({ employee }: { employee: EmployeeRow }) {
  const qc = useQueryClient();
  const [linked, setLinked] = useState(employee.user);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selUser, setSelUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const { data: users } = useQuery({
    queryKey: ["hr", "linkable-users"],
    queryFn: hrApi.linkableUsers,
    enabled: !linked,
  });

  const link = useMutation({
    mutationFn: () =>
      hrApi.linkEmployeeUser(
        employee.employeeId,
        mode === "existing" ? { userId: Number(selUser) } : { password: pwd },
      ),
    onSuccess: (emp) => {
      setLinked(emp.user);
      setErr("");
      setPwd("");
      setSelUser("");
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      qc.invalidateQueries({ queryKey: ["hr", "linkable-users"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not link login"),
  });

  const unlink = useMutation({
    mutationFn: () => hrApi.unlinkEmployeeUser(employee.employeeId),
    onSuccess: () => {
      setLinked(null);
      setErr("");
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      qc.invalidateQueries({ queryKey: ["hr", "linkable-users"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not unlink login"),
  });

  const canLink = mode === "existing" ? !!selUser : pwd.length >= 6;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-1 text-sm font-medium text-foreground">Panel login</div>
      {err && (
        <div className="mb-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}

      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Linked to <span className="font-medium text-foreground">{linked.email}</span> — signs in
            with email &amp; password to mark attendance.
          </p>
          <Btn tone="danger" busy={unlink.isPending} onClick={() => unlink.mutate()}>
            Unlink
          </Btn>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            No login yet — this employee can’t check in. Link an existing staff login, or create a
            new one so they can sign in with email &amp; password.
          </p>
          <div className="mb-3 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                mode === "existing"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              Link existing login
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                mode === "new"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              Create new login
            </button>
          </div>

          {mode === "existing" ? (
            <Field label="Staff login" hint="Panel users not yet linked to an employee">
              <select
                className={inputCls}
                value={selUser}
                onChange={(e) => setSelUser(e.target.value)}
              >
                <option value="">— Select a login —</option>
                {users?.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} · {u.email} ({u.role.toLowerCase()})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label={`New password for ${employee.email}`}
              hint="Creates a STAFF login on this employee’s email (min 6 chars). If a panel login already uses this email, it’s linked and its password is kept."
            >
              <input
                className={inputCls}
                type="password"
                minLength={6}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </Field>
          )}

          <div className="mt-3 flex justify-end">
            <Btn busy={link.isPending} disabled={!canLink} onClick={() => link.mutate()}>
              {mode === "existing" ? "Link login" : "Create & link"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
