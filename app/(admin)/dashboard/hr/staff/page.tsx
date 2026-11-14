"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hrPlanApi,
  type HrDeployment,
  type HrKycStatus,
  type HrPartnerOption,
  type HrStaff,
} from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  PageHeader,
  TableShell,
} from "@/src/components/crm/ui";
import {
  canManage,
  ErrorBox,
  FormModal,
  Loading,
  Pager,
  ROLE_GROUP_LABEL,
  Select,
  SkillSelect,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { PlusIcon, SearchIcon } from "@/src/components/icons";
import {
  formatDayYear,
  istDayOf,
  tenDigitMobile,
  WEEKDAYS,
} from "@/src/lib/hr-format";

const PAGE_SIZE = 20;
const KYC: HrKycStatus[] = ["pending", "verified", "rejected"];

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [kyc, setKyc] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<HrStaff | null>(null);
  const [deploying, setDeploying] = useState<HrStaff | null>(null);
  const [changing, setChanging] = useState<{ staff: HrStaff; deployment: HrDeployment } | null>(null);
  const q = useDebounced(search);
  const refresh = useRefreshHr();
  const manage = canManage();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "staff", { q, kyc, page }],
    queryFn: () => hrPlanApi.staffList({ q: q || undefined, kycStatus: kyc || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Restocare's own employees placed in restaurants. A staff member can also be linked to a partner account."
        action={
          manage ? (
            <Btn onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Add staff
            </Btn>
          ) : undefined
        }
      />
      <Card>
        <Toolbar>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or mobile"
              className={`${inputCls} pl-9`}
            />
          </div>
          <Select
            value={kyc}
            onChange={(v) => {
              setKyc(v);
              setPage(1);
            }}
            className="max-w-[10rem]"
            ariaLabel="KYC status"
          >
            <option value="">Any KYC status</option>
            {KYC.map((k) => (
              <option key={k} value={k}>
                KYC {k}
              </option>
            ))}
          </Select>
        </Toolbar>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Staff member", "Skill", "KYC", "Deployment", ""]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={5} label="No staff yet. Add the people you place in restaurants." />
              )}
              {data?.items.map((s) => (
                <StaffRow
                  key={s.staffId}
                  s={s}
                  manage={manage}
                  onEdit={() => setEditing(s)}
                  onDeploy={() => setDeploying(s)}
                  onChange={(deployment) => setChanging({ staff: s, deployment })}
                />
              ))}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      {creating && (
        <StaffModal
          onClose={() => setCreating(false)}
          onSaved={(s) => {
            setCreating(false);
            refresh();
            toast.success(`${s.name} added. Deploy them to an outlet next.`);
            setDeploying(s);
          }}
        />
      )}
      {editing && (
        <StaffModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            toast.success("Saved");
          }}
        />
      )}
      {deploying && (
        <DeployModal
          staff={deploying}
          onClose={() => setDeploying(null)}
          onDeployed={() => {
            setDeploying(null);
            refresh();
            toast.success("Deployed. Shifts for the next two weeks are on the rota.");
          }}
        />
      )}
      {changing && (
        <ChangeDeploymentModal
          staff={changing.staff}
          deployment={changing.deployment}
          onClose={() => setChanging(null)}
          onSaved={() => {
            setChanging(null);
            refresh();
            toast.success("Saved. The rota follows.");
          }}
        />
      )}
    </div>
  );
}

function StaffRow({
  s,
  manage,
  onEdit,
  onDeploy,
  onChange,
}: {
  s: HrStaff;
  manage: boolean;
  onEdit: () => void;
  onDeploy: () => void;
  onChange: (d: HrDeployment) => void;
}) {
  const today = istDayOf();
  // What matters: where they are now, or will be; ended ones are history.
  const live = s.deployments.filter((d) => !d.endDate || d.endDate >= today);
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{s.name}</div>
        <div className="text-xs text-muted-foreground">{s.phone}</div>
        {s.partner && (
          <div className="text-xs text-muted-foreground">Partner account: {s.partner.name ?? s.partner.partnerId}</div>
        )}
      </td>
      <td className="px-4 py-3">{s.skill.name}</td>
      <td className="px-4 py-3">
        <StatusBadge status={s.kycStatus} />
      </td>
      <td className="px-4 py-3 text-xs">
        {live.length === 0 && <span className="text-muted-foreground">Not deployed</span>}
        {live.map((d) => (
          <div key={d.deploymentId} className="mb-1">
            <span className="font-medium text-foreground">
              {d.outlet.name}
            </span>{" "}
            <span className="text-muted-foreground">
              ({d.org.name}) · {ROLE_GROUP_LABEL[d.roleGroup]} · {d.shiftStart} to {d.shiftEnd} · off{" "}
              {WEEKDAYS[d.weeklyOffDay]} · from {formatDayYear(d.startDate)}
              {d.endDate ? ` to ${formatDayYear(d.endDate)}` : ""}
              {d.contractStatus === "draft" ? " · contract not active yet" : ""}
            </span>
            {manage && (
              <button type="button" className="ml-2 text-primary" onClick={() => onChange(d)}>
                Change
              </button>
            )}
          </div>
        ))}
      </td>
      <td className="px-4 py-3 text-right">
        {manage && (
          <span className="inline-flex gap-2">
            <Btn tone="ghost" small onClick={onEdit}>
              Edit
            </Btn>
            <Btn small onClick={onDeploy}>
              Deploy
            </Btn>
          </span>
        )}
      </td>
    </tr>
  );
}

function StaffModal({
  staff,
  onClose,
  onSaved,
}: {
  staff?: HrStaff;
  onClose: () => void;
  onSaved: (s: HrStaff) => void;
}) {
  const [mode, setMode] = useState<"new" | "partner">(staff?.partner ? "partner" : "new");
  const [partner, setPartner] = useState<HrPartnerOption | null>(
    staff?.partner
      ? {
          partnerId: staff.partner.partnerId,
          name: staff.partner.name,
          mobile: staff.partner.mobile,
          city: null,
          isOnline: false,
          service: null,
        }
      : null,
  );
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [skill, setSkill] = useState(staff ? String(staff.skill.skillSubcategoryId) : "");
  const [kyc, setKyc] = useState<HrKycStatus>(staff?.kycStatus ?? "pending");
  const [joinedAt, setJoinedAt] = useState(istDayOf());
  const found = useQuery({
    queryKey: ["hr", "partners", q],
    queryFn: () => hrPlanApi.partners(q),
    enabled: mode === "partner" && !partner && q.trim().length >= 2,
  });

  return (
    <FormModal
      title={staff ? `Edit ${staff.name}` : "Add a staff member"}
      onClose={onClose}
      onSubmit={async () => {
        if (mode === "partner" && !partner) throw new Error("Choose the partner account to link");
        if (mode === "new" && !name.trim()) throw new Error("Enter the staff member's name");
        if (mode === "new" && !tenDigitMobile(phone)) throw new Error("Enter a valid 10-digit mobile number");
        const skillSubcategoryId = Number(skill);
        if (!skillSubcategoryId) throw new Error("Choose a skill");
        if (staff) {
          const updated = await hrPlanApi.updateStaff(staff.staffId, {
            name: name.trim(),
            phone: phone.trim(),
            skillSubcategoryId,
            kycStatus: kyc,
            ...(mode === "partner" && partner
              ? { partnerId: partner.partnerId }
              : { unlinkPartner: Boolean(staff.partner) }),
          });
          onSaved(updated);
        } else {
          const created = await hrPlanApi.createStaff({
            skillSubcategoryId,
            kycStatus: kyc,
            joinedAt,
            ...(mode === "partner" && partner
              ? { partnerId: partner.partnerId }
              : { name: name.trim(), phone: phone.trim() }),
          });
          onSaved(created);
        }
      }}
    >
      <div className="flex gap-2">
        {(["new", "partner"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {m === "new" ? "New person" : "Link to a partner"}
          </button>
        ))}
      </div>

      {mode === "partner" ? (
        <Field label="Partner account" hint="Their name and mobile are used. Search by name or mobile.">
          {partner ? (
            <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
              <span>
                <span className="font-medium">{partner.name ?? `Partner ${partner.partnerId}`}</span>
                <span className="ml-2 text-muted-foreground">{partner.mobile}</span>
              </span>
              <button type="button" className="text-xs text-primary" onClick={() => setPartner(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type at least 2 letters or digits"
                className={inputCls}
              />
              {found.isFetching && <p className="mt-2 text-xs text-muted-foreground">Searching…</p>}
              {found.data && found.data.partners.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">No active partner matches.</p>
              )}
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border empty:hidden">
                {found.data?.partners.map((p) => (
                  <li key={p.partnerId}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setPartner(p);
                        setName(p.name ?? "");
                        setPhone(p.mobile ?? "");
                      }}
                    >
                      <span>
                        {p.name ?? `Partner ${p.partnerId}`}
                        {p.service ? ` · ${p.service}` : ""}
                      </span>
                      <span className="text-muted-foreground">{p.mobile}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Field>
      ) : (
        <>
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Mobile (10 digits)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              required
              className={inputCls}
            />
          </Field>
        </>
      )}

      <Field label="Skill" hint="The kind of work. A replacement is booked for this skill.">
        <SkillSelect value={skill} onChange={setSkill} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="KYC status">
          <Select value={kyc} onChange={(v) => setKyc(v as HrKycStatus)} ariaLabel="KYC status">
            {KYC.map((k) => (
              <option key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        {!staff && (
          <Field label="Joined on">
            <input
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}
      </div>
    </FormModal>
  );
}

function DeployModal({
  staff,
  onClose,
  onDeployed,
}: {
  staff: HrStaff;
  onClose: () => void;
  onDeployed: () => void;
}) {
  const [lineId, setLineId] = useState("");
  const [startDate, setStartDate] = useState(istDayOf());
  const [endDate, setEndDate] = useState("");
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("20:00");
  const [off, setOff] = useState("1");

  // Lines the staff member can fill: their skill, on a draft or active contract.
  const contracts = useQuery({
    queryKey: ["hr", "contracts", "deployable"],
    queryFn: async () => {
      const [draft, active] = await Promise.all([
        hrPlanApi.contracts({ status: "draft", limit: 100 }),
        hrPlanApi.contracts({ status: "active", limit: 100 }),
      ]);
      return [...active.items, ...draft.items];
    },
  });
  const options = (contracts.data ?? []).flatMap((c) =>
    c.lines
      .filter((l) => l.skill.skillSubcategoryId === staff.skill.skillSubcategoryId)
      .map((l) => ({ c, l })),
  );
  const chosen = options.find((o) => o.l.lineId === lineId);

  return (
    <FormModal
      title={`Deploy ${staff.name}`}
      onClose={onClose}
      submitLabel="Deploy"
      onSubmit={async () => {
        if (!chosen) throw new Error("Choose the contract line to fill");
        await hrPlanApi.deploy(staff.staffId, {
          outletId: chosen.c.outlet.outletId,
          contractLineId: chosen.l.lineId,
          startDate,
          endDate: endDate || undefined,
          shiftStart,
          shiftEnd,
          weeklyOffDay: Number(off),
        });
        onDeployed();
      }}
    >
      <Field
        label="Contract line"
        hint={`Lines for ${staff.skill.name}, on draft and active contracts. Over the headcount is allowed.`}
      >
        <Select value={lineId} onChange={setLineId} ariaLabel="Contract line">
          <option value="" disabled>
            {contracts.isLoading ? "Loading…" : options.length ? "Choose a line" : "No matching line"}
          </option>
          {options.map(({ c, l }) => (
            <option key={l.lineId} value={l.lineId}>
              {c.org.name} · {c.outlet.name} · {ROLE_GROUP_LABEL[l.roleGroup]} ({l.deployed}/{l.headcount}) ·{" "}
              {c.status}
            </option>
          ))}
        </Select>
      </Field>
      {contracts.data && options.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No contract has a line for {staff.skill.name}. Add a line on the Contracts page, or change the
          staff member&apos;s skill.
        </p>
      )}
      {chosen && (
        <p className="text-xs text-muted-foreground">
          The contract runs {formatDayYear(chosen.c.startDate)} to {formatDayYear(chosen.c.endDate)}; a
          deployment must fall inside it.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Ends" hint="Empty: until the contract ends.">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Shift starts (India time)">
          <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Shift ends" hint="Earlier than the start runs past midnight.">
          <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} required className={inputCls} />
        </Field>
      </div>
      <Field label="Weekly off">
        <Select value={off} onChange={setOff} ariaLabel="Weekly off">
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
    </FormModal>
  );
}

function ChangeDeploymentModal({
  staff,
  deployment,
  onClose,
  onSaved,
}: {
  staff: HrStaff;
  deployment: HrDeployment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shiftStart, setShiftStart] = useState(deployment.shiftStart);
  const [shiftEnd, setShiftEnd] = useState(deployment.shiftEnd);
  const [off, setOff] = useState(String(deployment.weeklyOffDay));
  const [endDate, setEndDate] = useState(deployment.endDate ?? "");
  return (
    <FormModal
      title={`${staff.name} at ${deployment.outlet.name}`}
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.updateDeployment(deployment.deploymentId, {
          shiftStart,
          shiftEnd,
          weeklyOffDay: Number(off),
          endDate: endDate || null,
        });
        onSaved();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shift starts (India time)">
          <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Shift ends">
          <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Weekly off">
        <Select value={off} onChange={setOff} ariaLabel="Weekly off">
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Last day" hint="Set a date to end this deployment. Empty keeps it open-ended. Unmarked shifts after it are removed.">
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
      </Field>
    </FormModal>
  );
}
