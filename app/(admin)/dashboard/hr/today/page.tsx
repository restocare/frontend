"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hrPlanApi,
  type HrBoardShift,
  type HrPartnerOption,
  type HrReplacement,
} from "@/src/api/hr-plan";
import {
  Badge,
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
  ROLE_GROUP_LABEL,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { formatDay, istDateTime, istDayOf, istTime, pretty } from "@/src/lib/hr-format";

/** How the status column reads on the board. */
const CHIP_LABEL: Record<string, string> = {
  not_marked: "Not marked",
  on_time: "On time",
  late: "Late",
  absent: "Absent, no replacement",
  covered: "Covered",
  on_leave: "On leave",
  off: "Weekly off",
  scheduled: "Not started",
};

const BOOKING_OUTCOME: Record<string, string> = {
  booked: "A partner job was created and offered to partners.",
  disabled: "Partner booking is switched off (HR_JOBS_ENABLED), so nobody is being sent yet.",
  deferred: "The shift is more than a day away: a partner is booked closer to the time.",
  not_needed: "Too little of the shift is left to be worth sending a partner.",
  failed: "Booking a partner failed; see the replacement.",
};

export default function TodayBoardPage() {
  const [date, setDate] = useState(() => initialParam("date") || istDayOf());
  const [orgId, setOrgId] = useState("");
  const refresh = useRefreshHr();

  const board = useQuery({
    queryKey: ["hr", "board", { date, orgId }],
    queryFn: () => hrPlanApi.board({ date, orgId: orgId || undefined }),
    // The board is a live view: unmarked shifts and replacements change while ops watch.
    refetchInterval: 30_000,
  });
  const inFlight = useQuery({
    queryKey: ["hr", "replacements", "active", { orgId }],
    queryFn: () => hrPlanApi.replacements({ orgId: orgId || undefined, limit: 100 }),
    refetchInterval: 30_000,
  });

  const s = board.data?.summary;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Today board"
        subtitle="Every outlet's shifts. Unmarked and absent come first. Marks made here are Restocare's: managers cannot undo them."
        action={
          <Btn tone="ghost" onClick={() => refresh()}>
            Refresh
          </Btn>
        }
      />
      <Card>
        <Toolbar>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${inputCls} max-w-[11rem]`}
            aria-label="Day"
          />
          <Btn tone="ghost" small onClick={() => setDate(istDayOf())}>
            Today
          </Btn>
          <OrgSelect value={orgId} onChange={setOrgId} allLabel="All organizations" className="max-w-xs" />
          <span className="text-sm text-muted-foreground">{formatDay(date)}</span>
        </Toolbar>
        {s && (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Badge tone={s.notMarked ? "warning" : "muted"}>{s.notMarked} not marked</Badge>
            <Badge tone={s.absent ? "danger" : "muted"}>{s.absent} absent, no replacement</Badge>
            <Badge tone="primary">{s.covered} covered</Badge>
            <Badge tone="success">
              {s.present} present{s.late ? ` (${s.late} late)` : ""}
            </Badge>
            <Badge>{s.leave} on leave</Badge>
            <Badge>{s.off} weekly off</Badge>
            <Badge>{s.total} shifts</Badge>
          </div>
        )}
      </Card>

      {board.isLoading ? (
        <Loading />
      ) : board.error ? (
        <ErrorBox error={board.error} onRetry={() => board.refetch()} />
      ) : board.data && board.data.outlets.length === 0 ? (
        <Card>
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No shifts on {formatDay(date)}. Shifts exist for staff deployed on an active contract, for
            today and the next two weeks.
          </p>
        </Card>
      ) : (
        board.data?.outlets.map((o) => (
          <Card key={o.outletId}>
            <div className="px-4 py-3">
              <h3 className="font-semibold text-foreground">
                {o.name} <span className="font-normal text-muted-foreground">· {o.orgName}</span>
              </h3>
            </div>
            <TableShell head={["Staff", "Shift", "Status", "Marked", "Replacement", ""]}>
              {o.shifts.map((sh) => (
                <ShiftRow key={sh.shiftId} sh={sh} />
              ))}
            </TableShell>
          </Card>
        ))
      )}

      <Card>
        <div className="px-4 py-3">
          <h3 className="font-semibold text-foreground">Replacements in flight</h3>
          <p className="text-xs text-muted-foreground">
            Every replacement still being sent, on any day (leave days included), oldest first.
          </p>
        </div>
        {inFlight.isLoading ? (
          <Loading />
        ) : inFlight.error ? (
          <ErrorBox error={inFlight.error} onRetry={() => inFlight.refetch()} />
        ) : (
          <TableShell head={["Covering", "Day and shift", "Status", "Partner", ""]}>
            {inFlight.data?.items.length === 0 && (
              <EmptyRow cols={5} label="Nothing in flight." />
            )}
            {inFlight.data?.items.map((r) => (
              <tr key={r.replacementId}>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.shift.staff.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.outlet.name} · {r.org.name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {formatDay(r.shift.date)}
                  <div className="text-xs text-muted-foreground">
                    {istTime(r.shift.startAt)} to {istTime(r.shift.endAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ReplacementStatus r={r} />
                </td>
                <td className="px-4 py-3 text-xs">
                  <PartnerCell r={r} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReplacementActions r={r} />
                </td>
              </tr>
            ))}
          </TableShell>
        )}
      </Card>
    </div>
  );
}

function ReplacementStatus({ r }: { r: HrReplacement }) {
  return (
    <div className="space-y-1">
      <StatusBadge status={r.status} />
      {r.waitingMinutes !== null && r.bookingId !== null && (
        <div className="text-xs text-muted-foreground">waiting {r.waitingMinutes} min</div>
      )}
      {r.bookingId === null && r.status === "requested" && (
        <div className="text-xs text-muted-foreground">no partner booked yet</div>
      )}
      {r.bookingError && <div className="max-w-[16rem] text-xs text-danger">{r.bookingError}</div>}
    </div>
  );
}

function PartnerCell({ r }: { r: HrReplacement }) {
  if (!r.partner) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <div className="font-medium text-foreground">{r.partner.name ?? `Partner ${r.partner.partnerId}`}</div>
      {r.partner.mobile && (
        <a href={`tel:${r.partner.mobile}`} className="text-primary">
          {r.partner.mobile}
        </a>
      )}
      {r.eta && <div className="text-muted-foreground">arrives about {istTime(r.eta)}</div>}
    </>
  );
}

function ShiftRow({ sh }: { sh: HrBoardShift }) {
  const manage = canManage();
  const refresh = useRefreshHr();
  const [absent, setAbsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function mark(status: "present" | "scheduled") {
    setBusy(true);
    try {
      const res = await hrPlanApi.mark(sh.shiftId, { status });
      await refresh();
      res.warnings.forEach((w) => toast.warning(w));
      toast.success(status === "present" ? `${sh.staff.name} marked present` : "Mark cleared");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const working = sh.status !== "off" && sh.status !== "leave";
  return (
    <tr className={sh.needsAction ? "bg-warning/5" : undefined}>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{sh.staff.name}</div>
        <div className="text-xs text-muted-foreground">
          {sh.staff.skill}
          {sh.staff.roleGroup ? ` · ${ROLE_GROUP_LABEL[sh.staff.roleGroup]}` : ""}
        </div>
      </td>
      <td className="px-4 py-3 text-xs">
        {istTime(sh.startAt)} to {istTime(sh.endAt)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={sh.chip} label={CHIP_LABEL[sh.chip] ?? pretty(sh.chip)} />
        {sh.lateMinutes ? (
          <div className="mt-1 text-xs text-muted-foreground">{sh.lateMinutes} min late</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {sh.markedBy ? (
          <>
            {sh.markedBy === "ops" ? "Restocare" : pretty(sh.markedBy)}
            <div>{istDateTime(sh.markedAt)}</div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {sh.replacement ? (
          <div className="space-y-1">
            <ReplacementStatus r={sh.replacement} />
            <PartnerCell r={sh.replacement} />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1.5">
          {manage && working && (
            <span className="inline-flex flex-wrap justify-end gap-1.5">
              {sh.status !== "present" && (
                <Btn tone="success" small busy={busy} onClick={() => mark("present")}>
                  Present
                </Btn>
              )}
              {sh.status !== "absent" && (
                <Btn tone="danger" small disabled={busy} onClick={() => setAbsent(true)}>
                  Absent
                </Btn>
              )}
              {sh.status !== "scheduled" && (
                <Btn tone="ghost" small disabled={busy} onClick={() => mark("scheduled")}>
                  Clear
                </Btn>
              )}
            </span>
          )}
          {sh.replacement && <ReplacementActions r={sh.replacement} />}
        </div>
        {absent && (
          <AbsentModal
            sh={sh}
            onClose={() => setAbsent(false)}
            onDone={() => {
              setAbsent(false);
              refresh();
            }}
          />
        )}
      </td>
    </tr>
  );
}

function AbsentModal({
  sh,
  onClose,
  onDone,
}: {
  sh: HrBoardShift;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <FormModal
      title={`Mark ${sh.staff.name} absent`}
      submitLabel="Mark absent and ask for a replacement"
      tone="danger"
      onClose={onClose}
      onSubmit={async () => {
        if (!reason.trim()) throw new Error("Say why they are absent");
        const res = await hrPlanApi.mark(sh.shiftId, { status: "absent", reason: reason.trim() });
        res.warnings.forEach((w) => toast.warning(w));
        toast.success(
          res.bookingOutcome
            ? `${sh.staff.name} marked absent. ${BOOKING_OUTCOME[res.bookingOutcome] ?? ""}`
            : `${sh.staff.name} marked absent`,
        );
        onDone();
      }}
    >
      <p className="text-sm text-muted-foreground">
        A replacement is requested for {formatDay(sh.date)}, {istTime(sh.startAt)} to {istTime(sh.endAt)}, exactly
        as when the restaurant&apos;s manager marks an absence.
      </p>
      <Field label="Reason">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Called in sick"
          className={inputCls}
          autoFocus
        />
      </Field>
    </FormModal>
  );
}

function ReplacementActions({ r }: { r: HrReplacement }) {
  const manage = canManage();
  const refresh = useRefreshHr();
  const [reassign, setReassign] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!manage || (!r.canReassign && !r.canCancel)) return null;
  return (
    <>
      <span className="inline-flex gap-1.5">
        {r.canReassign && (
          <Btn tone="ghost" small onClick={() => setReassign(true)}>
            Reassign
          </Btn>
        )}
        {r.canCancel && (
          <Btn tone="danger" small onClick={() => setCancel(true)}>
            Cancel replacement
          </Btn>
        )}
      </span>
      {reassign && (
        <ReassignModal
          r={r}
          onClose={() => setReassign(false)}
          onDone={() => {
            setReassign(false);
            refresh();
          }}
        />
      )}
      {cancel && (
        <ConfirmDialog
          title="Cancel this replacement?"
          danger
          busy={busy}
          confirmLabel="Cancel replacement"
          message={`${r.partner ? `${r.partner.name ?? "The partner"} is told and their lead fee is refunded. ` : ""}The partner job is cancelled and ${r.shift.staff.name}'s shift stays marked absent.`}
          onCancel={() => setCancel(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await hrPlanApi.cancelReplacement(r.replacementId);
              await refresh();
              toast.success("Replacement cancelled");
              setCancel(false);
            } catch (err) {
              toast.error(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

function ReassignModal({
  r,
  onClose,
  onDone,
}: {
  r: HrReplacement;
  onClose: () => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [partner, setPartner] = useState<HrPartnerOption | null>(null);
  const found = useQuery({
    queryKey: ["hr", "partners", q],
    queryFn: () => hrPlanApi.partners(q),
    enabled: !partner && q.trim().length >= 2,
  });
  return (
    <FormModal
      title={`Reassign the replacement for ${r.shift.staff.name}`}
      submitLabel={partner ? `Send ${partner.name ?? "this partner"}` : "Offer to partners again"}
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.reassignReplacement(r.replacementId, partner?.partnerId);
        toast.success(partner ? `${partner.name ?? "Partner"} assigned` : "Offered to partners again");
        onDone();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {r.partner
          ? `${r.partner.name ?? "The current partner"} is taken off the job (their lead fee is refunded). `
          : ""}
        Pick a partner to send, or leave it empty to offer the job to partners again.
      </p>
      <Field label="Partner to send (optional)" hint="Search active partners by name or mobile.">
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
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border empty:hidden">
              {found.data?.partners.map((p) => (
                <li key={p.partnerId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => setPartner(p)}
                  >
                    <span>
                      {p.name ?? `Partner ${p.partnerId}`}
                      {p.isOnline ? " · online" : ""}
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
    </FormModal>
  );
}
