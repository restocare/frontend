"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hrPlanApi, type HrInvite, type HrMember, type HrMembers } from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  PageHeader,
  TableShell,
} from "@/src/components/crm/ui";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import {
  canManage,
  ErrorBox,
  errorText,
  FormModal,
  initialParam,
  Loading,
  OrgSelect,
  Select,
  StatusBadge,
  Toolbar,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { PlusIcon } from "@/src/components/icons";
import { istDateTime, tenDigitMobile } from "@/src/lib/hr-format";

export default function MembersPage() {
  const [orgId, setOrgId] = useState(() => initialParam("org"));
  const refresh = useRefreshHr();
  const manage = canManage();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<HrMember | null>(null);
  const [removing, setRemoving] = useState<HrMember | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "members", orgId],
    queryFn: () => hrPlanApi.members(orgId),
    enabled: !!orgId,
  });

  async function act(label: string, work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      await refresh();
      toast.success(label);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invites and members"
        subtitle="Who can see a restaurant's Staff area in the app. A manager is invited by phone number and joins the next time that number signs in."
        action={
          manage && orgId ? (
            <Btn onClick={() => setInviting(true)}>
              <PlusIcon className="h-4 w-4" />
              Invite someone
            </Btn>
          ) : undefined
        }
      />
      <Card>
        <Toolbar>
          <OrgSelect value={orgId} onChange={setOrgId} className="max-w-xs" />
        </Toolbar>
        {!orgId ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Choose an organization.</p>
        ) : isLoading ? (
          <Loading />
        ) : error || !data ? (
          <ErrorBox error={error ?? new Error("Not found")} onRetry={() => refetch()} />
        ) : (
          <MembersTables
            data={data}
            manage={manage}
            busy={busy}
            onEdit={setEditing}
            onRemove={setRemoving}
            onResend={(i) => act("Invite sent again", () => hrPlanApi.resendInvite(i.inviteId))}
            onRevoke={(i) => act("Invite withdrawn", () => hrPlanApi.revokeInvite(i.inviteId))}
          />
        )}
      </Card>

      {inviting && data && (
        <InviteModal
          data={data}
          onClose={() => setInviting(false)}
          onSent={() => {
            setInviting(false);
            refresh();
            toast.success("Invite created. They join when that number next signs in.");
          }}
        />
      )}
      {editing && data && (
        <EditMemberModal
          data={data}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            toast.success("Saved");
          }}
        />
      )}
      {removing && data && (
        <ConfirmDialog
          title={`Remove ${removing.name ?? "this member"}?`}
          danger
          busy={busy}
          confirmLabel="Remove"
          message="They lose access to the restaurant's Staff area at once."
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await act("Member removed", () => hrPlanApi.removeMember(data.org.orgId, removing.memberId));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function outletNames(outlets: { name: string }[], role: string, all: number) {
  if (role === "owner") return "All outlets";
  if (outlets.length === 0) return "—";
  return outlets.length === all ? "All outlets" : outlets.map((o) => o.name).join(", ");
}

function MembersTables({
  data,
  manage,
  busy,
  onEdit,
  onRemove,
  onResend,
  onRevoke,
}: {
  data: HrMembers;
  manage: boolean;
  busy: boolean;
  onEdit: (m: HrMember) => void;
  onRemove: (m: HrMember) => void;
  onResend: (i: HrInvite) => void;
  onRevoke: (i: HrInvite) => void;
}) {
  return (
    <>
      <div className="px-4 py-3">
        <h3 className="font-semibold text-foreground">Members</h3>
      </div>
      <TableShell head={["Name", "Mobile", "Role", "Outlets", ""]}>
        {data.members.length === 0 && <EmptyRow cols={5} label="No members yet." />}
        {data.members.map((m) => (
          <tr key={m.memberId}>
            <td className="px-4 py-3 font-medium text-foreground">
              {m.name ?? "—"}
              {m.isPrimaryOwner && <span className="ml-2 text-xs font-normal text-muted-foreground">registered owner</span>}
            </td>
            <td className="px-4 py-3">{m.mobile ?? "—"}</td>
            <td className="px-4 py-3 capitalize">{m.role}</td>
            <td className="px-4 py-3 text-muted-foreground">{outletNames(m.outlets, m.role, data.outlets.length)}</td>
            <td className="px-4 py-3 text-right">
              {manage && (
                <span className="inline-flex gap-2">
                  <Btn tone="ghost" small onClick={() => onEdit(m)}>
                    Change
                  </Btn>
                  {!m.isPrimaryOwner && (
                    <Btn tone="danger" small onClick={() => onRemove(m)}>
                      Remove
                    </Btn>
                  )}
                </span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      <div className="border-t border-border px-4 py-3">
        <h3 className="font-semibold text-foreground">Open invites</h3>
      </div>
      <TableShell head={["Mobile", "Role", "Outlets", "Status", "Last sent", ""]}>
        {data.invites.length === 0 && <EmptyRow cols={6} label="No open invites." />}
        {data.invites.map((i) => (
          <tr key={i.inviteId}>
            <td className="px-4 py-3">{i.phone}</td>
            <td className="px-4 py-3 capitalize">{i.role}</td>
            <td className="px-4 py-3 text-muted-foreground">{outletNames(i.outlets, i.role, data.outlets.length)}</td>
            <td className="px-4 py-3">
              <StatusBadge status={i.status} />
              <div className="mt-1 text-xs text-muted-foreground">
                {i.status === "pending" ? "expires" : "expired"} {istDateTime(i.expiresAt)}
              </div>
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
              {i.lastSentAt ? istDateTime(i.lastSentAt) : "Not sent (WhatsApp is off)"}
            </td>
            <td className="px-4 py-3 text-right">
              {manage && (
                <span className="inline-flex gap-2">
                  <Btn tone="ghost" small disabled={busy} onClick={() => onResend(i)}>
                    Resend
                  </Btn>
                  <Btn tone="danger" small disabled={busy} onClick={() => onRevoke(i)}>
                    Withdraw
                  </Btn>
                </span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>
    </>
  );
}

function OutletPicker({
  outlets,
  value,
  onChange,
}: {
  outlets: { outletId: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {outlets.map((o) => (
        <label key={o.outletId} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(o.outletId)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, o.outletId] : value.filter((id) => id !== o.outletId))
            }
          />
          {o.name}
        </label>
      ))}
      {outlets.length === 0 && <p className="text-sm text-muted-foreground">This organization has no outlets yet.</p>}
    </div>
  );
}

function InviteModal({
  data,
  onClose,
  onSent,
}: {
  data: HrMembers;
  onClose: () => void;
  onSent: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"owner" | "manager">("manager");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  return (
    <FormModal
      title={`Invite to ${data.org.name}`}
      submitLabel="Create invite"
      onClose={onClose}
      onSubmit={async () => {
        const mobile = tenDigitMobile(phone);
        if (!mobile) throw new Error("Enter a valid 10-digit mobile number");
        if (role === "manager" && outletIds.length === 0) throw new Error("Choose at least one outlet");
        await hrPlanApi.invite(data.org.orgId, {
          phone: mobile,
          role,
          outletIds: role === "manager" ? outletIds : undefined,
        });
        onSent();
      }}
    >
      <Field label="Mobile number" hint="10 digits. +91 and a leading 0 are fine.">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required className={inputCls} autoFocus />
      </Field>
      <Field label="Role" hint="A manager sees only the outlets below and not the plan, invoices or access. An owner sees everything.">
        <Select value={role} onChange={(v) => setRole(v as "owner" | "manager")} ariaLabel="Role">
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </Select>
      </Field>
      {role === "manager" && (
        <Field label="Outlets">
          <OutletPicker outlets={data.outlets} value={outletIds} onChange={setOutletIds} />
        </Field>
      )}
    </FormModal>
  );
}

function EditMemberModal({
  data,
  member,
  onClose,
  onSaved,
}: {
  data: HrMembers;
  member: HrMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [outletIds, setOutletIds] = useState(member.outlets.map((o) => o.outletId));
  return (
    <FormModal
      title={`${member.name ?? "Member"}`}
      onClose={onClose}
      onSubmit={async () => {
        if (role === "manager" && outletIds.length === 0) throw new Error("Choose at least one outlet");
        await hrPlanApi.updateMember(data.org.orgId, member.memberId, {
          role,
          outletIds: role === "manager" ? outletIds : undefined,
        });
        onSaved();
      }}
    >
      <Field label="Role" hint={member.isPrimaryOwner ? "The registered owner stays an owner." : undefined}>
        <Select
          value={role}
          disabled={member.isPrimaryOwner}
          onChange={(v) => setRole(v as "owner" | "manager")}
          ariaLabel="Role"
        >
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </Select>
      </Field>
      {role === "manager" && (
        <Field label="Outlets">
          <OutletPicker outlets={data.outlets} value={outletIds} onChange={setOutletIds} />
        </Field>
      )}
    </FormModal>
  );
}
