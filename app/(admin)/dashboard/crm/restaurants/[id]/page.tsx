"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  crmRestaurantsApi,
  type CrmBookingRow,
  type RestaurantDetail,
} from "@/src/api/api";
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
  statusTone,
} from "@/src/components/crm/ui";
import { RestaurantFormModal } from "@/src/components/crm/restaurant-form";
import { PencilIcon, SpinnerIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const DETAIL_TABS = [
  { key: "profile", label: "Profile" },
  { key: "contract", label: "Contract & Documents" },
  { key: "orders", label: "Order history" },
  { key: "tickets", label: "Tickets" },
];

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const restaurantId = Number(params.id);
  const qc = useQueryClient();

  const [tab, setTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.restaurant(restaurantId),
    queryFn: () => crmRestaurantsApi.get(restaurantId),
    enabled: Number.isFinite(restaurantId),
  });

  const canUpdate = hasPermission("restaurants.update");

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Link
          href="/dashboard/crm/restaurants"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to restaurants
        </Link>
        <Notice kind="error">
          {error instanceof ApiError ? error.message : "Restaurant not found."}
        </Notice>
      </div>
    );
  }

  const r = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/crm/restaurants"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to restaurants
        </Link>
        <PageHeader
          title={r.name}
          subtitle={[r.restaurantType, r.city].filter(Boolean).join(" · ") || undefined}
          action={
            <div className="flex items-center gap-3">
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
              {canUpdate && (
                <Btn
                  tone="ghost"
                  onClick={() => {
                    setNotice(null);
                    setEditing(true);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </Btn>
              )}
            </div>
          }
        />
      </div>
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total bookings"
          value={r.orderStats ? String(r.orderStats.totalBookings) : "—"}
          hint={r.orderStats ? undefined : "Not linked to a customer login"}
        />
        <StatCard
          label="Revenue"
          value={r.orderStats ? `₹${r.orderStats.revenue.toLocaleString("en-IN")}` : "—"}
          hint={r.orderStats ? undefined : "Not linked to a customer login"}
        />
        <StatCard label="Outlets" value={String(r.outlets)} />
        <StatCard label="Agreement ends" value={fmtDate(r.agreementEnd)} />
      </div>

      <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />

      {tab === "profile" && <ProfileTab r={r} />}
      {tab === "contract" && <ContractTab r={r} />}
      {tab === "orders" && (
        <OrdersTab restaurantId={r.restaurantId} linked={r.linkedUserId != null} />
      )}
      {tab === "tickets" && <TicketsTab r={r} />}

      {editing && (
        <RestaurantFormModal
          restaurant={r}
          onClose={() => setEditing(false)}
          onSaved={(name) => {
            setEditing(false);
            setNotice(`Restaurant “${name}” updated.`);
            qc.invalidateQueries({ queryKey: crmQueryKeys.restaurant(restaurantId) });
            qc.invalidateQueries({ queryKey: ["crm", "restaurants"] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ProfileTab({ r }: { r: RestaurantDetail }) {
  return (
    <Card className="p-6">
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Item label="Owner">{r.ownerName ?? "—"}</Item>
        <Item label="Contact number">{r.contactNumber ?? "—"}</Item>
        <Item label="Email">{r.email ?? "—"}</Item>
        <Item label="GST number">{r.gstNumber ?? "—"}</Item>
        <Item label="Address">{r.address ?? "—"}</Item>
        <Item label="City">{r.city ?? "—"}</Item>
        <Item label="Restaurant type">{r.restaurantType ?? "—"}</Item>
        <Item label="Notes">{r.notes ?? "—"}</Item>
        <Item label="Linked customer">
          {r.linkedUser
            ? `${r.linkedUser.name ?? "Unnamed"} (#${r.linkedUser.userId})`
            : r.linkedUserId != null
              ? `#${r.linkedUserId}`
              : "—"}
        </Item>
        <Item label="Created">{fmtDate(r.createdAt)}</Item>
      </dl>

      {/* What the sales executive captured on the visit. */}
      <h3 className="mt-8 border-t border-border pt-6 text-sm font-semibold text-foreground">
        Visit & requirement
      </h3>
      <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Item label="Operational pain points">
          {r.painPoints.length ? r.painPoints.join(", ") : "—"}
        </Item>
        <Item label="Required staff roles">
          {r.requiredStaffRoles.length ? r.requiredStaffRoles.join(", ") : "—"}
        </Item>
        <Item label="Number of staff required">{r.staffRequired ?? "—"}</Item>
        <Item label="Required date">{fmtDate(r.requiredDate)}</Item>
        <Item label="Decision & follow-up">
          {r.decisionStatus ? <Badge tone={statusTone(r.decisionStatus)}>{r.decisionStatus}</Badge> : "—"}
        </Item>
        <Item label="App install">{r.appInstalled ? "Yes" : "No"}</Item>
        <Item label="Sales executive">{r.salesExecutive ?? "—"}</Item>
        <Item label="Visit date">{fmtDate(r.visitDate)}</Item>
        <Item label="Sales executive feedback">{r.salesFeedback ?? "—"}</Item>
        <Item label="Visit documentation">
          {r.restaurantPhotoUrl || r.meetingPhotoUrl ? (
            <span className="flex gap-3">
              {r.restaurantPhotoUrl && (
                <a
                  href={r.restaurantPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Restaurant photo
                </a>
              )}
              {r.meetingPhotoUrl && (
                <a
                  href={r.meetingPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Meeting photo
                </a>
              )}
            </span>
          ) : (
            "—"
          )}
        </Item>
      </dl>
    </Card>
  );
}

function DocLink({ url }: { url: string | null }) {
  if (!url) return <>—</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Open
    </a>
  );
}

function ContractTab({ r }: { r: RestaurantDetail }) {
  return (
    <Card className="p-6">
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Item label="Agreement start">{fmtDate(r.agreementStart)}</Item>
        <Item label="Agreement end">{fmtDate(r.agreementEnd)}</Item>
        <Item label="Service package">{r.servicePackage ?? "—"}</Item>
        <Item label="Pricing plan">{r.pricingPlan ?? "—"}</Item>
        <Item label="FSSAI number">{r.fssaiNumber ?? "—"}</Item>
        <Item label="Agreement copy">
          <DocLink url={r.agreementCopyUrl} />
        </Item>
        <Item label="GST certificate">
          <DocLink url={r.gstCertificateUrl} />
        </Item>
        <Item label="FSSAI license">
          <DocLink url={r.fssaiLicenseUrl} />
        </Item>
      </dl>
    </Card>
  );
}

type BookingWithRating = CrmBookingRow & { rating?: { rating: number } | null };

function OrdersTab({ restaurantId, linked }: { restaurantId: number; linked: boolean }) {
  const [page, setPage] = useState(1);
  const params = { page, limit: PAGE_SIZE };

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.restaurantBookings(restaurantId, params),
    queryFn: () => crmRestaurantsApi.bookings(restaurantId, params),
    placeholderData: keepPreviousData,
    enabled: linked,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const bookings = (data?.bookings ?? []) as BookingWithRating[];

  return (
    <div className="space-y-4">
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      <Card>
        <TableShell head={["Booking #", "Service", "Date", "Amount", "Status", "Rating"]}>
          {!linked && (
            <EmptyRow
              cols={6}
              label="Not linked to a customer login — no order history to show"
            />
          )}
          {linked && isLoading && <EmptyRow cols={6} label="Loading…" />}
          {linked && !isLoading && !bookings.length && (
            <EmptyRow cols={6} label="No bookings yet" />
          )}
          {linked &&
            bookings.map((b) => (
              <tr key={b.bookingId} className="transition-colors hover:bg-accent/50">
                <td className="px-4 py-3 font-medium text-foreground">#{b.bookingId}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{b.service?.name ?? "—"}</div>
                  {b.variant?.name && <div className="text-xs">{b.variant.name}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.bookingDate)}</td>
                <td className="px-4 py-3 text-foreground">
                  ₹{b.totalAmount.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.rating?.rating ?? "—"}</td>
              </tr>
            ))}
        </TableShell>
        {linked && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Btn tone="ghost" small disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Btn>
              <Btn
                tone="ghost"
                small
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TicketsTab({ r }: { r: RestaurantDetail }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href="/dashboard/crm/tickets"
          className="text-sm font-medium text-primary hover:underline"
        >
          Open support desk →
        </Link>
      </div>
      <Card>
        <TableShell head={["Subject", "Category", "Status", "Priority", "Created"]}>
          {!r.tickets.length && <EmptyRow cols={5} label="No tickets for this restaurant" />}
          {r.tickets.map((t) => (
            <tr key={t.ticketId} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{t.subject}</div>
                <div className="text-xs text-muted-foreground">#{t.ticketId}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{t.category}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{t.priority}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.createdAt)}</td>
            </tr>
          ))}
        </TableShell>
      </Card>
    </div>
  );
}
