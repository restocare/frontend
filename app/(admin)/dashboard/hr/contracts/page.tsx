"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hrPlanApi,
  type HrContract,
  type HrContractDetail,
  type HrContractLineBody,
  type HrRoleGroup,
} from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  Modal,
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
  Pager,
  ROLE_GROUP_LABEL,
  Select,
  SkillSelect,
  StatusBadge,
  Toolbar,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { PlusIcon } from "@/src/components/icons";
import {
  formatDayYear,
  formatPaise,
  formatPeriod,
  istDayOf,
  rupeesToPaise,
} from "@/src/lib/hr-format";

const PAGE_SIZE = 20;
const ROLE_GROUPS = Object.keys(ROLE_GROUP_LABEL) as HrRoleGroup[];

export default function ContractsPage() {
  const [orgId, setOrgId] = useState(() => initialParam("org"));
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const refresh = useRefreshHr();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "contracts", { orgId, status, page }],
    queryFn: () =>
      hrPlanApi.contracts({
        orgId: orgId || undefined,
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle="Plan, outlet, dates, monthly fee and staff lines. Activating a contract switches the Staff area on in the restaurant's app."
        action={
          canManage() ? (
            <Btn onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              New contract
            </Btn>
          ) : undefined
        }
      />
      <Card>
        <Toolbar>
          <OrgSelect
            value={orgId}
            allLabel="All organizations"
            className="max-w-xs"
            onChange={(v) => {
              setOrgId(v);
              setPage(1);
            }}
          />
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            className="max-w-[10rem]"
            ariaLabel="Status"
          >
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </Select>
        </Toolbar>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Restaurant", "Plan and term", "Monthly fee", "Staff lines", "Status", ""]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={6} label="No contracts match. Create one with New contract." />
              )}
              {data?.items.map((c) => (
                <ContractRow key={c.contractId} c={c} onOpen={() => setOpenId(c.contractId)} />
              ))}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      {creating && (
        <CreateContractModal
          defaultOrgId={orgId}
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            refresh();
            toast.success("Draft contract created. Check it, then activate it.");
            setOpenId(c.contractId);
          }}
        />
      )}
      {openId && <ContractDetailModal contractId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ContractRow({ c, onOpen }: { c: HrContract; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer hover:bg-accent/50" onClick={onOpen}>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{c.org.name}</div>
        <div className="text-xs text-muted-foreground">{c.outlet.name}</div>
      </td>
      <td className="px-4 py-3">
        <div>{c.plan.name}</div>
        <div className="text-xs text-muted-foreground">
          {formatDayYear(c.startDate)} to {formatDayYear(c.endDate)}
        </div>
      </td>
      <td className="px-4 py-3">{formatPaise(c.monthlyFeePaise)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {c.lines.map((l) => (
          <div key={l.lineId}>
            {ROLE_GROUP_LABEL[l.roleGroup]} · {l.skill.name}: {l.deployed}/{l.headcount}
          </div>
        ))}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={c.status} />
      </td>
      <td className="px-4 py-3 text-right text-xs text-primary">Open</td>
    </tr>
  );
}

interface LineDraft {
  roleGroup: HrRoleGroup;
  skill: string;
  headcount: string;
}

const emptyLine = (): LineDraft => ({ roleGroup: "kitchen", skill: "", headcount: "1" });

function LinesEditor({
  lines,
  onChange,
}: {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
}) {
  const set = (i: number, patch: Partial<LineDraft>) =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[8rem_1fr_5rem_auto] items-center gap-2">
          <Select
            value={l.roleGroup}
            onChange={(v) => set(i, { roleGroup: v as HrRoleGroup })}
            ariaLabel="Role group"
          >
            {ROLE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {ROLE_GROUP_LABEL[g]}
              </option>
            ))}
          </Select>
          <SkillSelect value={l.skill} onChange={(v) => set(i, { skill: v })} />
          <input
            type="number"
            min={1}
            max={200}
            value={l.headcount}
            onChange={(e) => set(i, { headcount: e.target.value })}
            aria-label="Headcount"
            className={inputCls}
          />
          <button
            type="button"
            className="px-2 text-sm text-muted-foreground hover:text-danger"
            onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
            disabled={lines.length === 1}
            aria-label="Remove line"
          >
            ✕
          </button>
        </div>
      ))}
      <Btn tone="ghost" small onClick={() => onChange([...lines, emptyLine()])}>
        <PlusIcon className="h-3.5 w-3.5" />
        Add a line
      </Btn>
    </div>
  );
}

function toLineBodies(lines: LineDraft[]): HrContractLineBody[] {
  return lines.map((l) => {
    if (!l.skill) throw new Error("Choose a skill for every line");
    const headcount = Number(l.headcount);
    if (!Number.isInteger(headcount) || headcount < 1) {
      throw new Error("Headcount must be a whole number, at least 1");
    }
    return { roleGroup: l.roleGroup, skillSubcategoryId: Number(l.skill), headcount };
  });
}

function CreateContractModal({
  defaultOrgId,
  onClose,
  onCreated,
}: {
  defaultOrgId: string;
  onClose: () => void;
  onCreated: (c: HrContractDetail) => void;
}) {
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [outletId, setOutletId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(istDayOf());
  const [endDate, setEndDate] = useState("");
  const [fee, setFee] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const org = useQuery({
    queryKey: ["hr", "org", orgId],
    queryFn: () => hrPlanApi.org(orgId),
    enabled: !!orgId,
  });
  const plans = useQuery({
    queryKey: ["hr", "plans"],
    queryFn: () => hrPlanApi.plans(),
    staleTime: 5 * 60_000,
  });

  return (
    <FormModal
      title="New contract"
      wide
      submitLabel="Create draft"
      onClose={onClose}
      onSubmit={async () => {
        const monthlyFeePaise = rupeesToPaise(fee);
        if (monthlyFeePaise === null || monthlyFeePaise < 100) {
          throw new Error("Enter the monthly fee in rupees, like 1,85,000");
        }
        const created = await hrPlanApi.createContract({
          orgId,
          outletId,
          planId,
          startDate,
          endDate: endDate || undefined,
          monthlyFeePaise,
          lines: toLineBodies(lines),
        });
        onCreated(created);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization">
          <OrgSelect
            value={orgId}
            onChange={(v) => {
              setOrgId(v);
              setOutletId("");
            }}
          />
        </Field>
        <Field label="Outlet" hint="Needs a location to be activated.">
          <Select value={outletId} onChange={setOutletId} disabled={!orgId} ariaLabel="Outlet">
            <option value="" disabled>
              {org.isLoading ? "Loading…" : orgId ? "Choose an outlet" : "Choose an organization first"}
            </option>
            {org.data?.outlets.map((o) => (
              <option key={o.outletId} value={o.outletId}>
                {o.name}
                {o.hasLocation ? "" : " (no location yet)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plan">
          <Select value={planId} onChange={setPlanId} ariaLabel="Plan">
            <option value="" disabled>
              {plans.isLoading ? "Loading…" : "Choose a plan"}
            </option>
            {plans.data?.plans.map((p) => (
              <option key={p.planId} value={p.planId}>
                {p.name} ({p.months} months)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monthly fee (₹, before GST)">
          <input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="1,85,000"
            inputMode="decimal"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="End date" hint="Empty: the plan's months from the start date.">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Staff lines (role group, skill, headcount)">
        <LinesEditor lines={lines} onChange={setLines} />
      </Field>
    </FormModal>
  );
}

function ContractDetailModal({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const refresh = useRefreshHr();
  const manage = canManage();
  const { data: c, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "contract", contractId],
    queryFn: () => hrPlanApi.contract(contractId),
  });
  const [confirm, setConfirm] = useState<"activate" | "end" | null>(null);
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingLine, setAddingLine] = useState(false);

  async function run(label: string, work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      await refresh();
      toast.success(label);
      setConfirm(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Contract" onClose={onClose} wide>
      {isLoading ? (
        <Loading />
      ) : error || !c ? (
        <ErrorBox error={error ?? new Error("Not found")} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-foreground">{c.org.name}</div>
              <div className="text-sm text-muted-foreground">
                {c.outlet.name} · {c.plan.name}
              </div>
              <div className="mt-1 text-sm">
                {formatDayYear(c.startDate)} to {formatDayYear(c.endDate)} · {formatPaise(c.monthlyFeePaise)} a
                month
              </div>
              {!c.outlet.hasLocation && (
                <p className="mt-2 text-sm text-danger">
                  This outlet has no location yet: set it on the Organizations page before activating.
                </p>
              )}
            </div>
            <StatusBadge status={c.status} />
          </div>

          {manage && (
            <div className="flex flex-wrap gap-2">
              {c.status === "draft" && (
                <>
                  <Btn tone="success" onClick={() => setConfirm("activate")}>
                    Activate
                  </Btn>
                  <Btn tone="ghost" onClick={() => setEditing(true)}>
                    Edit plan, dates or fee
                  </Btn>
                </>
              )}
              {c.status === "active" && (
                <Btn
                  tone="danger"
                  onClick={() => {
                    setEndDate("");
                    setConfirm("end");
                  }}
                >
                  End contract
                </Btn>
              )}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Staff lines</h3>
              {manage && c.status !== "ended" && (
                <Btn tone="ghost" small onClick={() => setAddingLine(true)}>
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add a line
                </Btn>
              )}
            </div>
            <div className="rounded-xl border border-border">
              <TableShell head={["Role group", "Skill", "Deployed today", "Headcount", ""]}>
                {c.lines.map((l) => (
                  <tr key={l.lineId}>
                    <td className="px-4 py-2">{ROLE_GROUP_LABEL[l.roleGroup]}</td>
                    <td className="px-4 py-2">{l.skill.name}</td>
                    <td className="px-4 py-2">{l.deployed}</td>
                    <td className="px-4 py-2">{l.headcount}</td>
                    <td className="px-4 py-2 text-right">
                      {manage && c.status !== "ended" && (
                        <span className="inline-flex gap-1">
                          <Btn
                            tone="ghost"
                            small
                            onClick={() => {
                              const next = window.prompt("New headcount", String(l.headcount));
                              if (next === null) return;
                              const n = Number(next);
                              if (!Number.isInteger(n) || n < 1) {
                                toast.error("Headcount must be a whole number, at least 1");
                                return;
                              }
                              run("Headcount changed", () => hrPlanApi.updateLine(c.contractId, l.lineId, n));
                            }}
                          >
                            Change
                          </Btn>
                          <Btn
                            tone="danger"
                            small
                            onClick={() =>
                              run("Line removed", () => hrPlanApi.deleteLine(c.contractId, l.lineId))
                            }
                          >
                            Remove
                          </Btn>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </TableShell>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-foreground">Invoices</h3>
            {c.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. Raise them on the Invoices page with Generate invoices.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {c.invoices.map((i) => (
                  <li key={i.invoiceId} className="flex items-center gap-3">
                    <span className="w-24">{formatPeriod(i.period)}</span>
                    <span className="w-28">{formatPaise(i.totalPaise)}</span>
                    <StatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {c && confirm === "activate" && (
        <ConfirmDialog
          title="Activate this contract?"
          message={`${c.org.name} gets the Staff area in their app, and shifts are planned for anyone already deployed on these lines.`}
          confirmLabel="Activate"
          busy={busy}
          onConfirm={() => run("Contract activated", () => hrPlanApi.activateContract(c.contractId))}
          onCancel={() => setConfirm(null)}
        />
      )}
      {c && confirm === "end" && (
        <ConfirmDialog
          title="End this contract now?"
          danger
          confirmLabel="End contract"
          busy={busy}
          message={
            <div className="space-y-3">
              <p>
                The Staff area goes off in {c.org.name}&apos;s app, the staff leave the rota (unmarked shifts
                from today are removed) and the deployments stop at the end date. Invoices are pro-rated
                to that date.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-foreground">
                  Last day (today, or earlier)
                </span>
                <input
                  type="date"
                  value={endDate}
                  max={istDayOf()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
                <span className="mt-1 block text-xs">Empty: today.</span>
              </label>
            </div>
          }
          onConfirm={() =>
            run("Contract ended", () => hrPlanApi.endContract(c.contractId, endDate || undefined))
          }
          onCancel={() => setConfirm(null)}
        />
      )}
      {c && editing && (
        <EditDraftModal
          c={c}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
            toast.success("Saved");
          }}
        />
      )}
      {c && addingLine && (
        <AddLineModal
          contractId={c.contractId}
          onClose={() => setAddingLine(false)}
          onSaved={() => {
            setAddingLine(false);
            refresh();
            toast.success("Line added");
          }}
        />
      )}
    </Modal>
  );
}

function EditDraftModal({
  c,
  onClose,
  onSaved,
}: {
  c: HrContractDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(c.plan.planId);
  const [startDate, setStartDate] = useState(c.startDate);
  const [endDate, setEndDate] = useState(c.endDate);
  const [fee, setFee] = useState(String(c.monthlyFeePaise / 100));
  const plans = useQuery({ queryKey: ["hr", "plans"], queryFn: () => hrPlanApi.plans() });
  return (
    <FormModal
      title="Edit draft contract"
      onClose={onClose}
      onSubmit={async () => {
        const monthlyFeePaise = rupeesToPaise(fee);
        if (monthlyFeePaise === null || monthlyFeePaise < 100) {
          throw new Error("Enter the monthly fee in rupees, like 1,85,000");
        }
        await hrPlanApi.updateContract(c.contractId, { planId, startDate, endDate, monthlyFeePaise });
        onSaved();
      }}
    >
      <Field label="Plan">
        <Select value={planId} onChange={setPlanId} ariaLabel="Plan">
          {plans.data?.plans.map((p) => (
            <option key={p.planId} value={p.planId}>
              {p.name} ({p.months} months)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Monthly fee (₹, before GST)">
        <input value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End date">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </FormModal>
  );
}

function AddLineModal({
  contractId,
  onClose,
  onSaved,
}: {
  contractId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [line, setLine] = useState<LineDraft>(emptyLine());
  return (
    <FormModal
      title="Add a staff line"
      onClose={onClose}
      onSubmit={async () => {
        const [body] = toLineBodies([line]);
        await hrPlanApi.addLine(contractId, body);
        onSaved();
      }}
    >
      <LinesEditor lines={[line]} onChange={([l]) => setLine(l)} />
    </FormModal>
  );
}
