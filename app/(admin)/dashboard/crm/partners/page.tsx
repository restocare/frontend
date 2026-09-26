"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmApi, crmQueryKeys, type CrmPartnerRow } from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
  inputCls,
  statusTone,
} from "@/src/components/crm/ui";
import { ClockIcon, SearchIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";
import { PartnerActivityModal } from "@/src/components/dashboard/partner-activity-modal";

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "ACTIVE", label: "Active" },
  { key: "REJECTED", label: "Rejected" },
];

export default function CrmPartnersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  // Online/offline session log — same modal the dispatcher partners list opens.
  const [activityTarget, setActivityTarget] = useState<CrmPartnerRow | null>(null);
  const params = {
    search: search || undefined,
    status: tab === "ALL" ? undefined : tab,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.crmPartners(params),
    queryFn: () => crmApi.partners(params),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; body: { isBlocked?: boolean; onboardingStatus?: string } }) =>
      crmApi.updatePartner(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "partners"] }),
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Update failed"),
  });

  const canUpdate = hasPermission("partners.update");
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Partners" subtitle={`${data?.total ?? "…"} service partners`} />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {notice && <Notice kind="error">{notice}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={STATUS_TABS}
          active={tab}
          onChange={(k) => {
            setTab(k);
            setPage(1);
          }}
        />
        <div className="relative ml-auto w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search name, mobile, city…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Card>
        <TableShell head={["Partner", "Service", "Jobs / Rating", "Status", "Joined", "Actions"]}>
          {isLoading && <EmptyRow cols={6} label="Loading…" />}
          {!isLoading && !data?.partners.length && <EmptyRow cols={6} label="No partners found" />}
          {data?.partners.map((p) => (
            <tr key={p.professionalId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{p.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {p.mobile ?? ""} {p.city ? `· ${p.city}` : ""}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.service ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.totalJobs} jobs · ★ {p.rating?.toFixed(1)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={statusTone(p.onboardingStatus)}>{p.onboardingStatus}</Badge>
                  {p.isBlocked && <Badge tone="danger">BLOCKED</Badge>}
                  {p.isOnline && <Badge tone="success">ONLINE</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActivityTarget(p)}
                    aria-label="Active hours & login logs"
                    title="When this partner went online and offline, with durations"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                  >
                    <ClockIcon className="h-4 w-4" />
                  </button>
                  {canUpdate && (
                    <>
                      <select
                        className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
                        value={p.onboardingStatus}
                        onChange={(e) =>
                          update.mutate({
                            id: p.professionalId,
                            body: { onboardingStatus: e.target.value },
                          })
                        }
                      >
                        {["PENDING", "VERIFIED", "ACTIVE", "REJECTED"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Btn
                        small
                        tone={p.isBlocked ? "success" : "danger"}
                        onClick={() =>
                          update.mutate({ id: p.professionalId, body: { isBlocked: !p.isBlocked } })
                        }
                      >
                        {p.isBlocked ? "Unblock" : "Block"}
                      </Btn>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Btn>
            <Btn tone="ghost" small disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Btn>
          </div>
        </div>
      </Card>

      {activityTarget && (
        <PartnerActivityModal
          professionalId={activityTarget.professionalId}
          partnerName={activityTarget.name}
          onClose={() => setActivityTarget(null)}
        />
      )}
    </div>
  );
}
