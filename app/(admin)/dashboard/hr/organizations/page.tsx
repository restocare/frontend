"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  hrPlanApi,
  type HrCustomerOption,
  type HrOrgDetail,
  type HrOutlet,
  type HrOutletBody,
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
import {
  canManage,
  ErrorBox,
  FormModal,
  initialParam,
  Loading,
  Pager,
  StatusBadge,
  Toolbar,
  useDebounced,
  useRefreshHr,
} from "@/src/components/hr-plan/shared";
import { PlusIcon, SearchIcon } from "@/src/components/icons";
import { formatDayYear, formatPaise, parseLatLng } from "@/src/lib/hr-format";

const PAGE_SIZE = 20;

export default function OrganizationsPage() {
  const [selected, setSelected] = useState(() => initialParam("org"));
  const [creating, setCreating] = useState(false);
  const refresh = useRefreshHr();

  function open(orgId: string) {
    setSelected(orgId);
    window.history.replaceState(null, "", orgId ? `?org=${orgId}` : window.location.pathname);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        subtitle="Restaurant brands on the staff plan, and their outlets."
        action={
          canManage() && !selected ? (
            <Btn onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" />
              New organization
            </Btn>
          ) : undefined
        }
      />
      {selected ? (
        <OrgDetail orgId={selected} onBack={() => open("")} />
      ) : (
        <OrgList onOpen={open} />
      )}
      {creating && (
        <CreateOrgModal
          onClose={() => setCreating(false)}
          onCreated={(org) => {
            setCreating(false);
            refresh();
            toast.success(`${org.name} created. Add its first outlet next.`);
            open(org.orgId);
          }}
        />
      )}
    </div>
  );
}

function OrgList({ onOpen }: { onOpen: (orgId: string) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "orgs", { q, page }],
    queryFn: () => hrPlanApi.orgs({ q: q || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  return (
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
            placeholder="Search name, owner or mobile"
            className={`${inputCls} pl-9`}
          />
        </div>
      </Toolbar>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <TableShell head={["Organization", "Owner", "Outlets", "Staff area", "Created"]}>
            {data?.items.length === 0 && (
              <EmptyRow cols={5} label="No organizations yet. Create one from an existing customer account." />
            )}
            {data?.items.map((o) => (
              <tr
                key={o.orgId}
                onClick={() => onOpen(o.orgId)}
                className="cursor-pointer hover:bg-accent/50"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{o.name}</div>
                  {o.legalName && <div className="text-xs text-muted-foreground">{o.legalName}</div>}
                </td>
                <td className="px-4 py-3">
                  <div>{o.owner.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{o.owner.mobile ?? ""}</div>
                </td>
                <td className="px-4 py-3">{o.outletCount}</td>
                <td className="px-4 py-3">
                  {o.activeContracts > 0 ? (
                    <StatusBadge status="active" label="On" />
                  ) : (
                    <StatusBadge status="off" label="Off (no active contract)" />
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDayYear(o.createdAt.slice(0, 10))}</td>
              </tr>
            ))}
          </TableShell>
          <Pager page={page} limit={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

function CreateOrgModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: HrOrgDetail) => void;
}) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [owner, setOwner] = useState<HrCustomerOption | null>(null);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const found = useQuery({
    queryKey: ["hr", "customers", q],
    queryFn: () => hrPlanApi.customers(q),
    enabled: q.trim().length >= 2 && !owner,
  });

  return (
    <FormModal
      title="New organization"
      submitLabel="Create organization"
      onClose={onClose}
      onSubmit={async () => {
        if (!owner) throw new Error("Choose the owner's customer account first");
        const org = await hrPlanApi.createOrg({
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          gstin: gstin.trim() || undefined,
          ownerCustomerId: owner.customerId,
        });
        onCreated(org);
      }}
    >
      <Field label="Owner (an existing customer account)" hint="Search by name, restaurant or mobile number.">
        {owner ? (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <span>
              <span className="font-medium">{owner.name ?? "Customer"}</span>
              <span className="ml-2 text-muted-foreground">{owner.mobile}</span>
            </span>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => {
                setOwner(null);
                setSearch("");
              }}
            >
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
            {found.error && <p className="mt-2 text-xs text-danger">Could not search customers.</p>}
            {found.data && found.data.customers.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No customer matches. The owner needs a customer account first (they sign up in the app).
              </p>
            )}
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border empty:hidden">
              {found.data?.customers.map((c) => (
                <li key={c.customerId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setOwner(c);
                      if (!name) setName(c.restaurantName ?? "");
                    }}
                  >
                    <span>
                      {c.name ?? "Customer"}
                      {c.restaurantName ? ` · ${c.restaurantName}` : ""}
                    </span>
                    <span className="text-muted-foreground">{c.mobile}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Field>
      <Field label="Restaurant brand name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
      </Field>
      <Field label="Legal name (for invoices)">
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="GSTIN" hint="15 characters, for the invoice. Leave empty if they have none.">
        <input
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          maxLength={15}
          className={inputCls}
        />
      </Field>
    </FormModal>
  );
}

function OrgDetail({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const refresh = useRefreshHr();
  const { data: org, isLoading, error, refetch } = useQuery({
    queryKey: ["hr", "org", orgId],
    queryFn: () => hrPlanApi.org(orgId),
  });
  const [editing, setEditing] = useState(false);
  const [outletForm, setOutletForm] = useState<{ outlet?: HrOutlet } | null>(null);

  if (isLoading) return <Loading />;
  if (error || !org) return <ErrorBox error={error ?? new Error("Not found")} onRetry={() => refetch()} />;
  const manage = canManage();

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-primary">
        ← All organizations
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
            {org.legalName && <p className="text-sm text-muted-foreground">{org.legalName}</p>}
            <p className="mt-2 text-sm">
              Owner: <span className="font-medium">{org.owner.name ?? "—"}</span>{" "}
              <span className="text-muted-foreground">{org.owner.mobile}</span>
            </p>
            <p className="text-sm text-muted-foreground">GSTIN: {org.gstin ?? "not set"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {org.hrEnabled ? (
              <StatusBadge status="active" label="Staff area on in the app" />
            ) : (
              <StatusBadge status="off" label="Staff area off: no active contract" />
            )}
            <div className="flex flex-wrap gap-2">
              {manage && (
                <Btn tone="ghost" small onClick={() => setEditing(true)}>
                  Edit details
                </Btn>
              )}
              <Link
                href={`/dashboard/hr/contracts?org=${org.orgId}`}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Contracts
              </Link>
              <Link
                href={`/dashboard/hr/members?org=${org.orgId}`}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Invites and members
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-foreground">Outlets</h3>
          {manage && (
            <Btn small onClick={() => setOutletForm({})}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add outlet
            </Btn>
          )}
        </div>
        <TableShell head={["Outlet", "Address", "Location", "Nudge managers after", "Ops task after", ""]}>
          {org.outlets.length === 0 && (
            <EmptyRow cols={6} label="No outlets yet. A contract needs an outlet with a location." />
          )}
          {org.outlets.map((o) => (
            <tr key={o.outletId}>
              <td className="px-4 py-3 font-medium text-foreground">{o.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {[o.address, o.city].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3">
                {o.hasLocation ? (
                  <span className="text-xs text-muted-foreground">
                    {o.lat?.toFixed(4)}, {o.lng?.toFixed(4)}
                  </span>
                ) : (
                  <Badge tone="danger">Missing</Badge>
                )}
              </td>
              <td className="px-4 py-3">{o.graceMinutes} min</td>
              <td className="px-4 py-3">{o.escalateMinutes} min</td>
              <td className="px-4 py-3 text-right">
                {manage && (
                  <Btn tone="ghost" small onClick={() => setOutletForm({ outlet: o })}>
                    Edit
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      <Card>
        <div className="px-4 py-3">
          <h3 className="font-semibold text-foreground">Contracts</h3>
        </div>
        <TableShell head={["Outlet", "Plan", "Term", "Monthly fee", "Status"]}>
          {org.contracts.length === 0 && (
            <EmptyRow cols={5} label="No contracts yet. Create one on the Contracts page." />
          )}
          {org.contracts.map((c) => (
            <tr key={c.contractId}>
              <td className="px-4 py-3">{c.outletName}</td>
              <td className="px-4 py-3">{c.planName}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDayYear(c.startDate)} to {formatDayYear(c.endDate)}
              </td>
              <td className="px-4 py-3">{formatPaise(c.monthlyFeePaise)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {editing && (
        <EditOrgModal
          org={org}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
            toast.success("Saved");
          }}
        />
      )}
      {outletForm && (
        <OutletModal
          orgId={org.orgId}
          outlet={outletForm.outlet}
          onClose={() => setOutletForm(null)}
          onSaved={(name) => {
            setOutletForm(null);
            refresh();
            toast.success(`${name} saved`);
          }}
        />
      )}
    </div>
  );
}

function EditOrgModal({
  org,
  onClose,
  onSaved,
}: {
  org: HrOrgDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [legalName, setLegalName] = useState(org.legalName ?? "");
  const [gstin, setGstin] = useState(org.gstin ?? "");
  return (
    <FormModal
      title="Edit organization"
      onClose={onClose}
      onSubmit={async () => {
        await hrPlanApi.updateOrg(org.orgId, {
          name: name.trim(),
          legalName: legalName.trim(),
          gstin: gstin.trim(),
        });
        onSaved();
      }}
    >
      <Field label="Brand name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
      </Field>
      <Field label="Legal name">
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="GSTIN" hint="Empty clears it.">
        <input
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          maxLength={15}
          className={inputCls}
        />
      </Field>
    </FormModal>
  );
}

function OutletModal({
  orgId,
  outlet,
  onClose,
  onSaved,
}: {
  orgId: string;
  outlet?: HrOutlet;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(outlet?.name ?? "");
  const [address, setAddress] = useState(outlet?.address ?? "");
  const [city, setCity] = useState(outlet?.city ?? "");
  const [location, setLocation] = useState(
    outlet?.hasLocation ? `${outlet.lat}, ${outlet.lng}` : "",
  );
  const [grace, setGrace] = useState(String(outlet?.graceMinutes ?? 15));
  const [escalate, setEscalate] = useState(String(outlet?.escalateMinutes ?? 30));

  return (
    <FormModal
      title={outlet ? `Edit ${outlet.name}` : "Add an outlet"}
      onClose={onClose}
      onSubmit={async () => {
        const point = parseLatLng(location);
        if (!point) {
          throw new Error("The location must be two numbers like 28.6469, 77.1167");
        }
        const body: HrOutletBody = {
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          lat: point.lat,
          lng: point.lng,
          graceMinutes: Number(grace),
          escalateMinutes: Number(escalate),
        };
        if (outlet) await hrPlanApi.updateOutlet(outlet.outletId, body);
        else await hrPlanApi.createOutlet(orgId, body);
        onSaved(body.name);
      }}
    >
      <Field label="Outlet name">
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
      </Field>
      <Field label="Address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} required className={inputCls} />
      </Field>
      <Field label="City" hint="Shown to partners on a replacement job.">
        <input value={city} onChange={(e) => setCity(e.target.value)} required className={inputCls} />
      </Field>
      <Field
        label="Location (latitude, longitude)"
        hint="In Google Maps, right-click the outlet and click the numbers to copy them, then paste here. A replacement cannot be booked without it."
      >
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="28.6469, 77.1167"
          required
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nudge managers after (min)" hint="Past shift start with no attendance.">
          <input
            type="number"
            min={0}
            max={240}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Open an ops task after (min)" hint="Not earlier than the nudge.">
          <input
            type="number"
            min={1}
            max={480}
            value={escalate}
            onChange={(e) => setEscalate(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
      </div>
    </FormModal>
  );
}
