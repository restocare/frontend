"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { hrPlanApi, type HrLeave, type HrStaff } from "@/src/api/hr-plan";
import {
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  PageHeader,
  Tabs,
  TableShell,
} from "@/src/components/crm/ui";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import {
  canManage,
  ErrorBox,
  errorText,
  FormModal,
  Loading,
  OrgSelect,
  Pager,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { PlusIcon } from "@/src/components/icons";
import { formatDay, istDayOf, pretty } from "@/src/lib/hr-format";

const PAGE_SIZE = 20;
const TABS = [
  { key: "pending", label: "Waiting for a decision" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/** What the restaurant answered in its app, in the words it used there. */
const RESPONSE_LABEL = { none: "Not answered yet", fine: "Fine with me", busy: "Busy week" } as const;

export default function LeavePage() {
  const [tab, setTab] = useState("pending");
  const [orgId, setOrgId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{ leave: HrLeave; decision: "approve" | "reject" } | null>(null);
  const refresh = useRefreshHr();
  const manage = canManage();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "leave", { tab, orgId, page }],
    queryFn: () =>
      hrPlanApi.leave({
        status: tab === "all" ? undefined : tab,
        orgId: orgId || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        subtitle="Leave is created here for now. The restaurant answers in its app (fine, or a busy week); ops approves or rejects."
        action={
          manage ? (
            <Btn onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              Add leave
            </Btn>
          ) : undefined
        }
      />
      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
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
        </Toolbar>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <TableShell head={["Staff member", "Days", "Reason", "Restaurant said", "Status", ""]}>
              {data?.items.length === 0 && (
                <EmptyRow cols={6} label={tab === "pending" ? "No leave is waiting for a decision." : "No leave here."} />
              )}
              {data?.items.map((l) => (
                <tr key={l.leaveId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{l.staff.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.outlet.name} · {l.org.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatDay(l.fromDate)}
                    {l.toDate !== l.fromDate ? ` to ${formatDay(l.toDate)}` : ""}
                    <div className="text-xs text-muted-foreground">
                      {l.days} day{l.days === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={l.restaurantResponse} label={RESPONSE_LABEL[l.restaurantResponse]} />
                    {l.responseNote && (
                      <div className="mt-1 max-w-[16rem] text-xs text-muted-foreground">&ldquo;{l.responseNote}&rdquo;</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {manage && l.status === "pending" && (
                      <span className="inline-flex gap-2">
                        <Btn tone="success" small onClick={() => setDeciding({ leave: l, decision: "approve" })}>
                          Approve
                        </Btn>
                        <Btn tone="danger" small onClick={() => setDeciding({ leave: l, decision: "reject" })}>
                          Reject
                        </Btn>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
            <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Card>

      {creating && (
        <CreateLeaveModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setTab("pending");
            refresh();
            toast.success("Leave added. The restaurant is asked in its app; approve it when ready.");
          }}
        />
      )}
      {deciding && (
        <DecideDialog
          leave={deciding.leave}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(message) => {
            setDeciding(null);
            refresh();
            toast.success(message);
          }}
        />
      )}
    </div>
  );
}

function DecideDialog({
  leave,
  decision,
  onClose,
  onDone,
}: {
  leave: HrLeave;
  decision: "approve" | "reject";
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const approving = decision === "approve";
  return (
    <ConfirmDialog
      title={`${approving ? "Approve" : "Reject"} ${leave.staff.name}'s leave?`}
      danger={!approving}
      busy={busy}
      confirmLabel={approving ? "Approve" : "Reject"}
      message={
        approving
          ? `${formatDay(leave.fromDate)}${leave.toDate !== leave.fromDate ? ` to ${formatDay(leave.toDate)}` : ""} becomes leave on the rota, and a replacement is requested for each day still to come. The restaurant is told.`
          : "The rota stays as it is and no replacement is requested."
      }
      onCancel={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          const res = approving ? await hrPlanApi.approveLeave(leave.leaveId) : await hrPlanApi.rejectLeave(leave.leaveId);
          onDone(
            !res.changed
              ? `Already ${res.status}`
              : approving
                ? `Approved. ${res.replacements} replacement${res.replacements === 1 ? "" : "s"} requested.`
                : "Rejected",
          );
        } catch (err) {
          toast.error(errorText(err));
          setBusy(false);
        }
      }}
    />
  );
}

function CreateLeaveModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [fromDate, setFromDate] = useState(istDayOf());
  const [toDate, setToDate] = useState(istDayOf());
  const [reason, setReason] = useState("");
  const found = useQuery({
    queryKey: ["hr", "staff", "pick", q],
    queryFn: () => hrPlanApi.staffList({ q, limit: 8 }),
    enabled: !staff && q.trim().length >= 2,
  });
  return (
    <FormModal
      title="Add leave"
      submitLabel="Add leave"
      onClose={onClose}
      onSubmit={async () => {
        if (!staff) throw new Error("Choose the staff member");
        await hrPlanApi.createLeave({
          staffId: staff.staffId,
          fromDate,
          toDate,
          reason: reason.trim() || undefined,
        });
        onCreated();
      }}
    >
      <Field label="Staff member" hint="Search by name or mobile. They must be deployed at an outlet on those days.">
        {staff ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <span>
              <span className="font-medium">{staff.name}</span>
              <span className="ml-2 text-muted-foreground">{staff.skill.name}</span>
            </span>
            <button type="button" className="text-xs text-primary" onClick={() => setStaff(null)}>
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
              autoFocus
            />
            {found.isFetching && <p className="mt-2 text-xs text-muted-foreground">Searching…</p>}
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border empty:hidden">
              {found.data?.items.map((s) => (
                <li key={s.staffId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => setStaff(s)}
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {pretty(s.skill.name)} · {s.deployments.find((d) => d.current)?.outlet.name ?? "not deployed"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First day">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (e.target.value > toDate) setToDate(e.target.value);
            }}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Last day">
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} required className={inputCls} />
        </Field>
      </div>
      <Field label="Reason (optional)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Family wedding" />
      </Field>
    </FormModal>
  );
}
