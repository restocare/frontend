"use client";

/**
 * The body under the banner on the new category flow:
 *
 *   sub-categories (left) | services (centre) | cart (right)
 *
 * A category without sub-categories shows a short "how it works" rail in
 * that column instead, so the page keeps its shape and the terms are clear.
 * Everything comes from the catalogue API; the cart is the per-category
 * cart kept in localStorage (the same one the cleaning page uses).
 *
 * Hourly categories (Chef, Helpers & Waiter) list each service at its rate
 * per hour; Add puts one person for the minimum booking in the cart, with no
 * shift options to pick.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CategoryTreeGroup,
  CategoryTreeNode,
  CategoryTreeService,
  CategoryTreeVariant,
} from "@/src/api/api";
import { categoryHref } from "@/lib/category-slugs";
import { subSlugOf } from "@/src/lib/booking-v2/cleaning";
import { formatInr, round2 } from "@/src/lib/booking-v2/pricing";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { hourlyRate } from "@/src/lib/booking-v2/draft";
import { minShiftMinutes } from "@/src/lib/booking-v2/schedule";
import {
  lineKey,
  reconcileLines,
  useCleaningCart,
  type CartLine,
} from "@/src/lib/booking-v2/cleaning-cart";
import {
  DetailsSheet,
  OptionsSheet,
  SafeImage,
  AddControl,
  SubIcon,
  subIconFor,
  type SubIconKind,
} from "@/src/components/booking-v2/cleaning-catalog";
import { ArrowRightIcon, CartIcon, GridIcon, TrashIcon } from "@/src/components/icons";
import { CheckGlyph } from "@/src/components/booking-v2/shell";
import { emojiForCategory } from "@/src/components/booking-v2/category-page-v2";

interface Section {
  id: string;
  title: string;
  subtitle: string | null;
  note: string | null;
  icon: SubIconKind;
  services: CategoryTreeService[];
}

/** A service's listed price: its own, else its cheapest option; none sorts last. */
function listPrice(s: CategoryTreeService): number {
  if (s.price != null && s.price > 0) return s.price;
  const options = s.variants.map((v) => v.price).filter((p) => p > 0);
  return options.length ? Math.min(...options) : Number.POSITIVE_INFINITY;
}

/** Hourly service: rate per hour, minimum hours, and that minimum's price. */
function hourlyTerms(s: CategoryTreeService) {
  const rate = hourlyRate(s);
  const minHours = minShiftMinutes(s.variants) / 60;
  return { rate, minHours, minPrice: round2(rate * minHours) };
}

function hasDetails(s: CategoryTreeService): boolean {
  return (
    !!s.description ||
    (s.highlights?.length ?? 0) > 0 ||
    (s.inclusions?.length ?? 0) > 0 ||
    (s.exclusions?.length ?? 0) > 0
  );
}

function live(services: CategoryTreeService[]): CategoryTreeService[] {
  return services
    .filter((s) => s.isActive !== false)
    .sort((a, b) => listPrice(a) - listPrice(b));
}

function sectionOf(g: CategoryTreeGroup): Section {
  return {
    id: String(g.groupId),
    title: g.title || g.name,
    subtitle: g.subtitle ?? null,
    note: g.note ?? null,
    icon: subIconFor(g.name),
    services: live(g.services),
  };
}

/** What the centre column lists: one area, every area, or the flat list. */
function sectionsFor(category: CategoryTreeNode, group: CategoryTreeGroup | undefined): Section[] {
  if (group) return [sectionOf(group)];
  const published = category.groups.filter((g) => g.isPublished !== false).map(sectionOf);
  const direct = live(category.services);
  if (!category.groups.length) {
    return [{ id: "all", title: "", subtitle: null, note: null, icon: "other", services: direct }];
  }
  return [
    ...published,
    ...(direct.length
      ? [{ id: "more", title: "More services", subtitle: null, note: null, icon: "other" as const, services: direct }]
      : []),
  ].filter((s) => s.services.length > 0);
}

export function CategoryLayout({
  category,
  group,
}: {
  category: CategoryTreeNode;
  /** The selected sub-category, on /category/[slug]/[sub]. */
  group?: CategoryTreeGroup;
}) {
  const router = useRouter();
  const hasGroups = category.groups.length > 0;
  const hourly = categoryUsesSlots(category.name);
  const sections = useMemo(() => sectionsFor(category, group), [category, group]);
  const allServices = useMemo(
    () => [...category.services, ...category.groups.flatMap((g) => g.services)],
    [category],
  );

  const { cart, itemCount, add, setQuantity, update, quantityOf, serviceCount, hydrated } = useCleaningCart(
    category.categoryId,
    category.name,
  );
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const [detailsFor, setDetailsFor] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The cart follows the live catalogue: removed services drop out and
  // changed prices update, with a note saying so.
  useEffect(() => {
    if (category.comingSoon || !hydrated || !cart.lines.length) return;
    const index = new Map(allServices.map((s) => [s.serviceId, s]));
    const { lines, removed, repriced } = reconcileLines(cart.lines, (serviceId, variantId) => {
      const service = index.get(serviceId);
      if (!service) return null;
      if (hourly) return { service: { ...service, price: hourlyTerms(service).minPrice }, variant: null };
      return {
        service,
        variant: variantId != null ? (service.variants.find((v) => v.variantId === variantId) ?? null) : null,
      };
    });
    if (!removed.length && !repriced.length) return;
    update({ lines });
    const parts = [
      removed.length ? `${removed.join(", ")} left your cart (no longer available)` : "",
      repriced.length ? `the price of ${repriced.join(", ")} changed` : "",
    ].filter(Boolean);
    queueMicrotask(() => setNotice(`Heads up: ${parts.join("; ")}.`));
  }, [category, allServices, hydrated, cart.lines, update, hourly]);

  const toHourlyLine = (s: CategoryTreeService): Omit<CartLine, "key" | "quantity"> => {
    const t = hourlyTerms(s);
    return {
      serviceId: s.serviceId,
      variantId: null,
      name: s.name,
      variantName: `Minimum ${t.minHours} hrs at ${formatInr(t.rate)}/hour`,
      subtitle: s.subtitle ?? null,
      image: s.profileImage || null,
      unitPrice: t.minPrice,
      originalPrice: null,
      isStartingPrice: true,
    };
  };
  const toLine = (s: CategoryTreeService, v?: CategoryTreeVariant): Omit<CartLine, "key" | "quantity"> => ({
    serviceId: s.serviceId,
    variantId: v?.variantId ?? null,
    name: s.name,
    variantName: v?.name ?? null,
    subtitle: s.subtitle ?? null,
    image: v?.profileImage || s.profileImage || null,
    unitPrice: v ? v.price : (s.price ?? 0),
    originalPrice: v ? (v.originalPrice ?? null) : (s.originalPrice ?? null),
    isStartingPrice: s.isStartingPrice ?? false,
  });
  const saved = (ok: boolean) => {
    if (!ok) setNotice("Your browser blocked saving the cart, so it will be lost if you leave this page.");
  };
  const addLine = (s: CategoryTreeService, v?: CategoryTreeVariant) =>
    saved(add(hourly ? toHourlyLine(s) : toLine(s, v)));
  const changeLine = (key: string, next: number) => saved(setQuantity(key, next));
  const goNext = () => router.push(`/booking/checkout?category=${category.categoryId}`);
  // Price shown per line: the rate per hour for hourly services, else the item price.
  const servicesById = useMemo(() => new Map(allServices.map((x) => [x.serviceId, x])), [allServices]);
  const linePrice = (l: CartLine) => {
    const svc = servicesById.get(l.serviceId);
    return hourly && svc ? `${formatInr(hourlyTerms(svc).rate)}/hour` : formatInr(l.unitPrice);
  };

  const subtotal = cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const find = (id: number | null) => (id == null ? undefined : allServices.find((s) => s.serviceId === id));
  const optionsService = find(optionsFor);
  const detailsService = find(detailsFor);
  const iconOf = (serviceId: number): SubIconKind =>
    sections.find((s) => s.services.some((svc) => svc.serviceId === serviceId))?.icon ?? "other";

  const base = categoryHref(category.categoryId);

  return (
    <div id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-28 pt-8 sm:px-6 lg:pb-12 lg:pt-10">
      {notice ? (
        <div
          role="status"
          className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-rc-yellow-deep/30 bg-rc-yellow-tint/50 px-4 py-3 text-sm text-gray-800"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-gray-500">
            ✕
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:gap-8 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left: sub-categories (first on phones, as a row of chips) */}
        {hasGroups ? (
          <aside className="min-w-0 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Sub-categories" className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="m-0 text-sm font-bold text-gray-900">Sub-categories</p>
              <p className="m-0 mb-3 text-xs text-gray-500">Pick an area to see its packages.</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
              <SubLink href={base} active={!group} label="All" />
              {category.groups.map((g) => (
                <SubLink
                  key={g.groupId}
                  href={`${base}/${subSlugOf(g.name)}`}
                  active={group?.groupId === g.groupId}
                  label={g.name}
                  image={g.profileImage}
                  icon={subIconFor(g.name)}
                  soon={g.isPublished === false}
                />
              ))}
              </div>
            </nav>
          </aside>
        ) : (
          <aside className="order-last min-w-0 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <InfoRail category={category} hourly={hourly} services={allServices} />
          </aside>
        )}

        {/* Centre: services */}
        <div className="min-w-0 lg:order-2">
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
              <p className="m-0 font-semibold">No services here yet</p>
              <p className="m-0 mt-1 text-sm text-gray-500">Check back soon, or pick another sub-category.</p>
            </div>
          ) : (
            sections.map((s) => (
              <section
                key={s.id}
                aria-label={s.title || category.name}
                className="border-b-8 border-gray-50 pb-4 pt-6 first:pt-0 last:border-b-0"
              >
                {s.title ? <h2 className="m-0 text-xl font-bold tracking-tight sm:text-2xl">{s.title}</h2> : null}
                {s.subtitle ? <p className="m-0 mt-1 text-sm text-gray-500">{s.subtitle}</p> : null}
                {!s.title && s.services.length ? (
                  <p className="m-0 mb-3 text-xs font-medium text-gray-500">
                    {s.services.length} {s.services.length === 1 ? "service" : "services"} · lowest price first
                  </p>
                ) : null}
                {s.services.length === 0 ? (
                  <p className="m-0 mt-4 text-sm text-gray-500">No services here yet.</p>
                ) : (
                  <div className={`space-y-3 ${s.title || s.subtitle ? "mt-4" : ""}`}>
                    {s.services.map((svc) => (
                      <ServiceListCard
                        key={svc.serviceId}
                        service={svc}
                        hourly={hourly}
                        fallback={
                          hourly ? (
                            <span className="text-4xl">{emojiForCategory(category.name)}</span>
                          ) : (
                            <SubIcon kind={s.icon} className="h-10 w-10 text-rc-yellow-deep" />
                          )
                        }
                        quantity={quantityOf(svc.serviceId)}
                        count={serviceCount(svc.serviceId)}
                        onAdd={() => addLine(svc)}
                        onChange={(n) => changeLine(lineKey(svc.serviceId, null), n)}
                        onOptions={() => setOptionsFor(svc.serviceId)}
                        onDetails={hasDetails(svc) ? () => setDetailsFor(svc.serviceId) : undefined}
                      />
                    ))}
                  </div>
                )}
                {s.note ? <p className="m-0 mt-2 text-xs text-gray-500">{s.note}</p> : null}
              </section>
            ))
          )}
        </div>

        {/* Right: cart (after the list on phones) */}
        <aside id="cart" className="min-w-0 scroll-mt-24 lg:order-3 lg:sticky lg:top-24 lg:self-start">
          <CartPanel
            lines={cart.lines}
            itemCount={itemCount}
            priceOf={linePrice}
            fallback={emojiForCategory(category.name)}
            hourly={hourly}
            onRemove={(l) => changeLine(l.key, 0)}
            onNext={goNext}
          />
        </aside>
      </div>

      {/* Phones: cart total at the bottom, jumping to the cart */}
      {itemCount > 0 ? (
        <div
          data-bottom-bar
          className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <a href="#cart" className="leading-tight">
              <p className="m-0 text-base font-bold">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </p>
              <p className="m-0 text-xs font-semibold text-rc-yellow-deep">View cart</p>
            </a>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rc-yellow px-6 text-sm font-bold text-gray-900 transition hover:brightness-95"
            >
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {optionsService ? (
        <OptionsSheet
          service={optionsService}
          quantityOf={(v) => quantityOf(optionsService.serviceId, v.variantId)}
          onAdd={(v) => addLine(optionsService, v)}
          onChange={(v, n) => changeLine(lineKey(optionsService.serviceId, v.variantId), n)}
          onClose={() => setOptionsFor(null)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm">
                <span className="font-bold tabular-nums">{formatInr(subtotal)}</span>{" "}
                <span className="text-gray-500">
                  · {itemCount} item{itemCount === 1 ? "" : "s"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setOptionsFor(null)}
                className="h-10 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          }
        />
      ) : null}

      {detailsService ? (
        <DetailsSheet
          service={detailsService}
          iconKind={iconOf(detailsService.serviceId)}
          onClose={() => setDetailsFor(null)}
          action={
            detailsService.variants.length && !hourly ? (
              <button
                type="button"
                onClick={() => {
                  setDetailsFor(null);
                  setOptionsFor(detailsService.serviceId);
                }}
                className="h-11 w-full rounded-xl bg-rc-yellow text-sm font-bold text-gray-900"
              >
                Choose an option
              </button>
            ) : quantityOf(detailsService.serviceId) > 0 ? (
              <button
                type="button"
                onClick={() => setDetailsFor(null)}
                className="h-11 w-full rounded-xl bg-gray-900 text-sm font-semibold text-white"
              >
                In your cart · Done
              </button>
            ) : (
              <button
                type="button"
                disabled={detailsService.price == null}
                onClick={() => {
                  addLine(detailsService);
                  setDetailsFor(null);
                }}
                className="h-11 w-full rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 disabled:opacity-50"
              >
                Add to cart
              </button>
            )
          }
        />
      ) : null}
    </div>
  );
}

/**
 * One service in the list, the same card for every category:
 * image | name, subtitle, details | price + chip | Add.
 *
 * - Hourly (Chef, Helpers & Waiter): "₹149/hour", the minimum booking chip,
 *   and Add puts one person straight in the cart.
 * - With sizes or options: "from" price, an options chip, Add opens the sheet.
 * - Otherwise: the price, and Add / − + right on the card.
 */
function ServiceListCard({
  service,
  hourly,
  fallback,
  quantity,
  count,
  onAdd,
  onChange,
  onOptions,
  onDetails,
}: {
  service: CategoryTreeService;
  hourly: boolean;
  fallback: ReactNode;
  /** In the cart: this service with no option chosen. */
  quantity: number;
  /** In the cart: every option of this service together. */
  count: number;
  onAdd: () => void;
  onChange: (next: number) => void;
  onOptions: () => void;
  onDetails?: () => void;
}) {
  const options = hourly ? 0 : service.variants.length;
  const terms = hourlyTerms(service);
  const listed = listPrice(service);
  const price = hourly ? terms.rate : Number.isFinite(listed) ? listed : 0;
  const from = !hourly && ((service.isStartingPrice ?? false) || (service.price == null && options > 1));
  const inCart = options ? count > 0 : quantity > 0;
  const mrp = !hourly && !options ? service.originalPrice : null;
  const duration = service.durationMinutes ? `${service.durationMinutes} mins` : null;

  const chip = hourly
    ? `Minimum ${terms.minHours} hrs · ${formatInr(terms.minPrice)} + taxes`
    : options
      ? `${options} option${options === 1 ? "" : "s"} · Taxes extra`
      : duration
        ? `${duration} · Taxes extra`
        : "Taxes extra";

  return (
    <article
      className={`relative flex gap-3.5 rounded-2xl border bg-white p-3 transition sm:gap-4 sm:p-3.5 ${
        inCart
          ? "border-rc-yellow bg-rc-yellow-tint/20 shadow-[0_4px_14px_rgba(244,180,0,0.14)]"
          : "border-gray-200 hover:border-gray-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
      }`}
    >
      <div className="h-22 w-22 shrink-0 overflow-hidden rounded-xl bg-rc-yellow-tint sm:h-26 sm:w-26">
        <SafeImage
          src={service.profileImage}
          alt={service.name}
          className="h-full w-full object-cover"
          fallback={<span className="grid h-full w-full place-items-center">{fallback}</span>}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="m-0 text-[15px] font-semibold leading-snug text-gray-900">{service.name}</h3>
        {service.subtitle ? <p className="m-0 mt-0.5 line-clamp-2 text-[13px] text-gray-500">{service.subtitle}</p> : null}
        {onDetails ? (
          <button
            type="button"
            onClick={onDetails}
            className="mt-1 inline-flex items-center gap-0.5 self-start text-[13px] font-semibold text-rc-yellow-deep hover:underline"
          >
            View details
            <span aria-hidden className="text-base leading-none">›</span>
          </button>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
          <div className="min-w-0 flex-1">
            {price > 0 ? (
              <>
                <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 leading-none text-gray-900">
                  {from ? <span className="text-sm text-gray-500">from</span> : null}
                  <span className="text-[19px] font-bold tabular-nums">{formatInr(price)}</span>
                  {hourly ? <span className="-ml-1 text-sm font-medium text-gray-500">/hour</span> : null}
                  {mrp != null && mrp > price ? (
                    <span className="text-sm tabular-nums text-gray-400 line-through">{formatInr(mrp)}</span>
                  ) : null}
                </p>
                <p className="m-0 mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                  {hourly || duration ? <ClockDot className="h-3 w-3 shrink-0 text-rc-yellow-deep" /> : null}
                  {chip}
                </p>
              </>
            ) : (
              <p className="m-0 text-sm font-semibold text-gray-500">Price on request</p>
            )}
          </div>
          {options ? (
            <button
              type="button"
              onClick={onOptions}
              aria-label={`Choose options for ${service.name}`}
              className={`h-9 min-w-21.5 shrink-0 rounded-lg border border-rc-yellow-deep/40 px-4 text-sm font-bold transition ${
                count ? "bg-rc-yellow-tint text-gray-900" : "bg-white text-rc-yellow-deep hover:bg-rc-yellow-tint"
              }`}
            >
              {count ? `${count} added` : "Add"}
            </button>
          ) : (
            <AddControl
              quantity={quantity}
              onAdd={onAdd}
              onChange={onChange}
              label={service.name}
              disabled={price <= 0}
            />
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * The cart column: a small picture, the name, the price and a remove button
 * per item, then Next. Quantities are changed on the list, so not here, and
 * no totals are worked out yet (that comes with the date, time and hours).
 */
function CartPanel({
  lines,
  itemCount,
  priceOf,
  hourly,
  fallback,
  onRemove,
  onNext,
}: {
  lines: CartLine[];
  itemCount: number;
  priceOf: (line: CartLine) => string;
  fallback: string;
  hourly: boolean;
  onRemove: (line: CartLine) => void;
  onNext: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between border-b border-gray-100 bg-rc-yellow-tint/50 px-5 py-3.5">
        <h2 className="m-0 text-base font-bold text-gray-900">Cart</h2>
        {itemCount ? (
          <span className="rounded-full bg-rc-yellow-tint px-2.5 py-0.5 text-xs font-bold text-rc-yellow-deep">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gray-50 text-gray-400">
            <CartIcon className="h-6 w-6" />
          </span>
          <p className="m-0 mt-3 text-sm font-semibold text-gray-900">Your cart is empty</p>
          <p className="m-0 mt-1 text-xs text-gray-500">
            {hourly ? "Tap Add on a service to book one person." : "Tap Add on a service to begin."}
          </p>
        </div>
      ) : (
        <>
          <ul className="m-0 max-h-[50vh] list-none divide-y divide-gray-100 overflow-y-auto p-0 px-5">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 py-2.5">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-rc-yellow-tint">
                  <SafeImage
                    src={l.image}
                    alt=""
                    className="h-full w-full object-cover"
                    fallback={<span className="grid h-full w-full place-items-center text-lg">{fallback}</span>}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">{l.name}</p>
                  <p className="m-0 mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{priceOf(l)}</span>
                    {l.quantity > 1 ? (
                      <span className="rounded-md bg-gray-100 px-1.5 py-px text-[11px] font-semibold text-gray-700">
                        × {l.quantity}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(l)}
                  aria-label={`Remove ${l.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-rc-red"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={onNext}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 shadow-[0_6px_16px_rgba(244,180,0,0.28)] transition hover:brightness-95"
            >
              Next
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <p className="m-0 mt-2 text-center text-xs text-gray-500">
              {hourly && lines.length > 1
                ? "Same date and hours for everyone. Next: pick them."
                : "Next: pick a date and time."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** A small clock, for the terms line under a price. */
function ClockDot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.8V8l2.2 1.4" />
    </svg>
  );
}

/**
 * Takes the sub-category column when a category has none: how a booking
 * works, in three steps, and the terms the price line only hints at.
 */
function InfoRail({
  category,
  hourly,
  services,
}: {
  category: CategoryTreeNode;
  hourly: boolean;
  services: CategoryTreeService[];
}) {
  const first = live(services)[0];
  const terms = first && hourly ? hourlyTerms(first) : null;
  const noun = /chef/i.test(category.name) ? "chef" : "person";
  const steps: [string, string][] = hourly
    ? [
        [`Add the ${noun}s you need`, `One Add per ${noun}. Mix cuisines if you like.`],
        ["Pick the date and hours", "Today, or any day this week. Everyone comes for the same hours."],
        ["Confirm and pay", "Pay online, or after the service."],
      ]
    : [
        ["Add the services you need", "Add as many as you want in one booking."],
        ["Pick a day and start time", "Instant for today, or schedule a day this week."],
        ["Confirm and pay", "Pay online, or after the service."],
      ];
  const facts: string[] = hourly
    ? [
        terms ? `${formatInr(terms.rate)} per hour per ${noun}` : "Priced per hour",
        terms ? `Minimum ${terms.minHours} hours, ${formatInr(terms.minPrice)} per ${noun}` : "Minimum hours apply",
        "18% GST is added at checkout",
        "Change the hours any time before you confirm",
      ]
    : ["Prices are per job, as listed", "Taxes are added at checkout", "Pick different services for the same visit"];
  const blurb = category.description?.trim();
  // Only a real description: not the name, not "chef category", not a stub.
  const nameLower = category.name.trim().toLowerCase();
  const blurbLower = (blurb ?? "").toLowerCase();
  const ownBlurb =
    blurb && blurb.length >= 40 && blurbLower !== nameLower && blurbLower !== `${nameLower} category` ? blurb : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-rc-yellow-tint/50 px-4 py-3">
        <p className="m-0 text-sm font-bold text-gray-900">How it works</p>
        <p className="m-0 mt-0.5 text-xs text-gray-600">Booked online in about a minute.</p>
      </div>
      <ol className="m-0 list-none space-y-3 p-4">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rc-yellow text-xs font-bold text-rc-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-semibold leading-snug text-gray-900">{title}</p>
              <p className="m-0 mt-0.5 text-xs leading-snug text-gray-500">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-gray-100 px-4 py-3">
        <p className="m-0 text-[13px] font-semibold text-gray-900">Good to know</p>
        <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
          {facts.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs leading-snug text-gray-600">
              <CheckGlyph className="mt-0.5 h-3 w-3 shrink-0 text-rc-green" />
              {f}
            </li>
          ))}
        </ul>
      </div>
      {ownBlurb ? (
        <p className="m-0 border-t border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-500">{ownBlurb}</p>
      ) : null}
    </div>
  );
}

function SubLink({
  href,
  active,
  label,
  image,
  icon = "other",
  soon,
}: {
  href: string;
  active: boolean;
  label: string;
  image?: string | null;
  icon?: SubIconKind;
  soon?: boolean;
}) {
  const body = (
    <>
      <span
        className={`relative grid h-12 w-12 place-items-center overflow-hidden rounded-xl text-rc-yellow-deep transition-colors ${
          active ? "bg-rc-yellow text-rc-ink" : "bg-rc-yellow-tint"
        }`}
      >
        {label === "All" ? (
          <GridIcon className="h-6 w-6" />
        ) : (
          <SafeImage
            src={image ?? null}
            alt=""
            className="h-full w-full object-cover"
            fallback={<SubIcon kind={icon} className="h-6 w-6" />}
          />
        )}
        {soon ? (
          <span className="absolute inset-x-0 bottom-0 bg-gray-900/75 py-px text-center text-[8px] font-semibold uppercase text-white">
            Soon
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 text-center text-xs font-semibold leading-tight">{label}</span>
    </>
  );
  const cls = `flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition ${
    active
      ? "border-rc-yellow bg-rc-yellow-tint/60 text-gray-900"
      : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
  }`;
  return soon ? (
    <span aria-disabled className={`${cls} cursor-not-allowed opacity-50`}>
      {body}
    </span>
  ) : (
    <Link href={href} aria-current={active ? "page" : undefined} scroll={false} className={cls}>
      {body}
    </Link>
  );
}
