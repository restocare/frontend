"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  RESTAURANT_DECISIONS,
  crmQueryKeys,
  crmRestaurantsApi,
  type RestaurantRow,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  inputCls,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
  statusTone,
} from "@/src/components/crm/ui";
import { RestaurantFormModal } from "@/src/components/crm/restaurant-form";
import { SearchIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const TABS = [
  { key: "onboarded", label: "Onboarded" },
  { key: "customers", label: "From customers" },
];

/** Decision tone — "Interested" reads as won, "Not Interested" as lost. */
const decisionTone = (d: string | null): string => {
  if (!d) return "muted";
  if (d === "Interested") return "success";
  if (d === "Not Interested") return "danger";
  return "warning";
};

/** Comma list, trimmed to `max` with a "+N" tail so rows stay one line tall. */
function Chips({ values, max = 2 }: { values: string[]; max?: number }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1" title={values.join(", ")}>
      {shown.map((v) => (
        <span
          key={v}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {v}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  );
}

/**
 * CRM → Restaurants.
 *
 * "Onboarded" is the restaurant registry the sales team fills in from a visit —
 * profile, pain points, staffing requirement and the follow-up decision, the
 * same questionnaire the executives used to submit on a form. "From customers"
 * stays alongside it: the restaurant details customers enter themselves at
 * their first booking, which nobody in the office types in.
 */
export default function CrmRestaurantsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("onboarded");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canCreate = hasPermission("restaurants.create");
  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const listParams = { search: search || undefined, page, limit: PAGE_SIZE };

  const onboarded = useQuery({
    queryKey: crmQueryKeys.restaurants(listParams),
    queryFn: () => crmRestaurantsApi.list(listParams),
    placeholderData: keepPreviousData,
    enabled: tab === "onboarded",
  });

  const fromCustomers = useQuery({
    queryKey: crmQueryKeys.restaurants({ ...listParams, source: "customers" }),
    queryFn: () => crmRestaurantsApi.fromCustomers(listParams),
    placeholderData: keepPreviousData,
    enabled: tab === "customers",
  });

  const active = tab === "onboarded" ? onboarded : fromCustomers;
  const total = active.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The decision filter is applied client-side on the current page: it narrows
  // what the admin is already looking at without a round trip.
  const rows: RestaurantRow[] = (onboarded.data?.restaurants ?? []).filter(
    (r) => !decision || r.decisionStatus === decision,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Restaurants"
        subtitle={active.data ? `${total} restaurant${total === 1 ? "" : "s"}` : "…"}
        action={
          canCreate && tab === "onboarded" ? (
            <Btn onClick={() => setCreating(true)}>＋ Onboard restaurant</Btn>
          ) : undefined
        }
      />
      {active.error instanceof ApiError && <Notice kind="error">{active.error.message}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-10`}
            placeholder="Search restaurant, owner, GST or mobile…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        {tab === "onboarded" && (
          <select
            className={`${inputCls} max-w-[15rem]`}
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          >
            <option value="">All decisions</option>
            {RESTAURANT_DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "onboarded" ? (
        <Card>
          <TableShell
            head={[
              "Restaurant",
              "Owner / contact",
              "City",
              "Pain points",
              "Staff needed",
              "Decision",
              "Sales exec",
              "App",
              "Status",
              "Onboarded",
            ]}
          >
            {onboarded.isLoading && <EmptyRow cols={10} label="Loading…" />}
            {!onboarded.isLoading && !rows.length && (
              <EmptyRow
                cols={10}
                label={
                  search || decision
                    ? "No restaurants match your filters"
                    : "No restaurant onboarded yet — add the first visit"
                }
              />
            )}
            {rows.map((r) => (
              <tr key={r.restaurantId} className="transition-colors hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/crm/restaurants/${r.restaurantId}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.restaurantType ?? "—"}
                    {r.outlets > 1 ? ` · ${r.outlets} outlets` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{r.ownerName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.contactNumber ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{r.city ?? "—"}</div>
                  {r.address && (
                    <div className="max-w-[14rem] truncate text-xs" title={r.address}>
                      {r.address}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Chips values={r.painPoints} />
                </td>
                <td className="px-4 py-3">
                  <Chips values={r.requiredStaffRoles} />
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.staffRequired != null ? `${r.staffRequired} staff` : "—"}
                    {r.requiredDate ? ` · by ${fmtDate(r.requiredDate)}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.decisionStatus ? (
                    <Badge tone={decisionTone(r.decisionStatus)}>{r.decisionStatus}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{r.salesExecutive ?? "—"}</div>
                  {r.visitDate && (
                    <div className="text-xs">visited {fmtDate(r.visitDate)}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.appInstalled ? "success" : "muted"}>
                    {r.appInstalled ? "Installed" : "No"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
              </tr>
            ))}
          </TableShell>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Details entered by the customer when they place their first booking.
          </p>
          <Card>
            <TableShell
              head={["Restaurant", "Owner", "GST number", "Mobile", "Bookings", "Customer since"]}
            >
              {fromCustomers.isLoading && <EmptyRow cols={6} label="Loading…" />}
              {!fromCustomers.isLoading && !fromCustomers.data?.restaurants.length && (
                <EmptyRow
                  cols={6}
                  label={
                    search
                      ? "No restaurants match your search"
                      : "No customer has entered restaurant details yet"
                  }
                />
              )}
              {fromCustomers.data?.restaurants.map((r) => (
                <tr key={r.userId} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{r.restaurantName ?? "—"}</span>
                      {r.isAlsoPartner && (
                        <span
                          title="This login also works as a service partner"
                          className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-600"
                        >
                          Also partner
                        </span>
                      )}
                    </div>
                    {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.ownerName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.gstNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.mobile ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${r.userId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {r.bookingsCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.joinedAt)}</td>
                </tr>
              ))}
            </TableShell>
            <Pager page={page} totalPages={totalPages} onPage={setPage} />
          </Card>
        </>
      )}

      {creating && (
        <RestaurantFormModal
          restaurant={null}
          onClose={() => setCreating(false)}
          onSaved={(name) => {
            setCreating(false);
            setNotice(`${name} onboarded.`);
            qc.invalidateQueries({ queryKey: ["crm", "restaurants"] });
          }}
        />
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Btn tone="ghost" small disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Btn>
        <Btn tone="ghost" small disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Btn>
      </div>
    </div>
  );
}
