"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, rbacApi, type StaffRow } from "@/src/api/api";
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
} from "@/src/components/crm/ui";
import { PlusIcon } from "@/src/components/icons";
import { hasPermission, isSuperAdmin } from "@/src/lib/auth";

export default function CrmStaffPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Staff logins and the roles assigned to each member."
      />
      <StaffTab />
    </div>
  );
}

/* ─────────────────────────────── Staff ──────────────────────────────── */

function StaffTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ row?: StaffRow } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffRow | null>(null);
  const [notice, setNotice] = useState("");

  const { data, isLoading } = useQuery({ queryKey: crmQueryKeys.rbacStaff, queryFn: rbacApi.staff });

  const del = useMutation({
    mutationFn: (userId: number) => rbacApi.deleteStaff(userId),
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["rbac", "staff"] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-4">
      {notice && <Notice kind="error">{notice}</Notice>}
      {hasPermission("staff.create") && (
        <div className="flex justify-end">
          <Btn small onClick={() => setModal({})}>
            <PlusIcon className="h-4 w-4" /> Add staff member
          </Btn>
        </div>
      )}
      <Card>
        <TableShell head={["Staff member", "Roles", "Employee record", "Added", "Actions"]}>
          {isLoading && <EmptyRow cols={5} label="Loading…" />}
          {!isLoading && !data?.length && (
            <EmptyRow cols={5} label="No staff yet — add one and assign roles" />
          )}
          {data?.map((s) => (
            <tr key={s.userId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{s.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {s.email} {s.mobile ? `· ${s.mobile}` : ""}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {s.roles.length ? (
                    s.roles.map((r) => (
                      <Badge key={r.roleId} tone="primary">
                        {r.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No roles (no access)</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {s.employee ? `${s.employee.employeeCode} · ${s.employee.designation ?? ""}` : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {hasPermission("staff.update") && (
                    <Btn small tone="ghost" onClick={() => setModal({ row: s })}>
                      Edit
                    </Btn>
                  )}
                  {hasPermission("staff.delete") && (
                    <Btn small tone="danger" onClick={() => setConfirmDelete(s)}>
                      Delete
                    </Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {modal && <StaffForm row={modal.row} onClose={() => setModal(null)} />}
      {confirmDelete && (
        <Modal title="Delete staff member" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{confirmDelete.name}</span>? Their
            login is removed; a linked employee record is kept.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Btn tone="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Btn>
            <Btn tone="danger" busy={del.isPending} onClick={() => del.mutate(confirmDelete.userId)}>
              Delete
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StaffForm({ row, onClose }: { row?: StaffRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [name, setName] = useState(row?.name ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [mobile, setMobile] = useState(row?.mobile ?? "");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>(row?.roles.map((r) => r.roleId) ?? []);

  const { data: allRoles } = useQuery({ queryKey: crmQueryKeys.rbacRoles, queryFn: rbacApi.roles });
  // super_admin is only assignable (or even visible) to the super admin; the
  // backend filters it too — this guards cached query data.
  const roles = allRoles?.filter((r) => r.name !== "super_admin" || isSuperAdmin());

  const toggleRole = (id: number) =>
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const save = useMutation({
    mutationFn: () =>
      row
        ? rbacApi.updateStaff(row.userId, {
            name,
            mobile: mobile || undefined,
            password: password || undefined,
            roleIds,
          })
        : rbacApi.createStaff({ name, email, mobile: mobile || undefined, password, roleIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac", "staff"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Save failed"),
  });

  return (
    <Modal title={row ? `Edit ${row.name ?? row.email}` : "Add staff member"} onClose={onClose}>
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
        <Field label="Email" hint={row ? "Email cannot be changed" : undefined}>
          <input
            className={inputCls}
            type="email"
            required
            disabled={!!row}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Mobile">
          <input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </Field>
        <Field label={row ? "New password (leave blank to keep)" : "Password"}>
          <input
            className={inputCls}
            type="password"
            minLength={6}
            required={!row}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Roles" hint="What this staff member can see and do in the panel">
          <div className="space-y-2 rounded-xl border border-border p-3">
            {roles?.map((r) => (
              <label key={r.roleId} className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={roleIds.includes(r.roleId)}
                  onChange={() => toggleRole(r.roleId)}
                />
                <span>
                  <span className="font-medium">{r.name}</span>
                  {r.description && (
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  )}
                </span>
              </label>
            ))}
            {!roles?.length && (
              <span className="text-xs text-muted-foreground">No roles yet — create one first.</span>
            )}
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {row ? "Save" : "Create staff"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
