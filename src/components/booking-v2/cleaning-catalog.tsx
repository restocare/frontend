"use client";

/**
 * Pieces of the Deep Cleaning page on flow 2, in the Urban Company manner: a
 * service row with its image and an Add button that turns into a quantity
 * stepper, an options sheet for services with variants, a details sheet,
 * and the cart panel. All data comes from the catalog API; every optional
 * field may be missing and the row still renders.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { CategoryTreeService, CategoryTreeVariant } from "@/src/api/api";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { MAX_LINE_QTY, type CartLine } from "@/src/lib/booking-v2/cleaning-cart";
import { CheckGlyph } from "./shell";

/* -------------------------------- icons -------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type SubIconKind = "washroom" | "kitchen" | "sitting" | "full" | "other";

/** Pick a drawn icon from a sub-category's name, for ones without an image. */
export function subIconFor(name: string): SubIconKind {
  const n = name.toLowerCase();
  if (/wash|toilet|bath/.test(n)) return "washroom";
  if (/kitchen|chimney|hood|duct/.test(n)) return "kitchen";
  if (/sit|dining|service area|seating/.test(n)) return "sitting";
  if (/restaurant|full|outlet|whole|banquet|cafe/.test(n)) return "full";
  return "other";
}

export function SubIcon({ kind, className }: { kind: SubIconKind; className?: string }) {
  switch (kind) {
    case "washroom":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M7 3h7v8H7Z" />
          <path d="M5 11h15a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4Z" />
          <path d="M8 16v5h8v-5" />
        </svg>
      );
    case "kitchen":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M4 10 8 4h8l4 6Z" />
          <path d="M3 10h18" />
          <path d="M6 14h12M6 18h12" />
        </svg>
      );
    case "sitting":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M3 9h18" />
          <path d="M12 9v11" />
          <path d="M8 20h8" />
          <path d="M4 21v-8M4 17h3" />
        </svg>
      );
    case "full":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M3 9 5 4h14l2 5" />
          <path d="M3 9h18" />
          <path d="M4 9v11h16V9" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
        </svg>
      );
  }
}

/** An external image that falls back to `fallback` if it is missing or fails to load. */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external catalog images (Cloudinary or URLs from Excel)
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(src)} />
  );
}

/* -------------------------------- price -------------------------------- */

export function fmtMinutes(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} mins`;
  return m ? `${h} hr ${m} mins` : `${h} hr${h === 1 ? "" : "s"}`;
}

/** "from ₹2,499  ₹2,999 • 3 hrs" — every part optional. */
export function PriceLine({
  price,
  originalPrice,
  from,
  minutes,
  size = "md",
}: {
  price: number | null;
  originalPrice?: number | null;
  from?: boolean;
  minutes?: number | null;
  size?: "md" | "sm";
}) {
  const duration = fmtMinutes(minutes);
  return (
    <p className={`m-0 flex flex-wrap items-baseline gap-x-1.5 ${size === "md" ? "text-sm" : "text-xs"}`}>
      {price != null ? (
        <>
          {from ? <span className="text-gray-500">from</span> : null}
          <span className="font-semibold tabular-nums text-gray-900">{formatInr(price)}</span>
          {originalPrice != null && originalPrice > price ? (
            <span className="tabular-nums text-gray-400 line-through">{formatInr(originalPrice)}</span>
          ) : null}
        </>
      ) : (
        <span className="text-gray-500">Price on request</span>
      )}
      {duration ? (
        <>
          <span aria-hidden className="text-gray-300">
            •
          </span>
          <span className="text-gray-500">{duration}</span>
        </>
      ) : null}
    </p>
  );
}

/* ------------------------------ add / stepper --------------------------- */

/** "Add", then − n + once in the cart. Mirrors the UC control. */
export function AddControl({
  quantity,
  onAdd,
  onChange,
  label,
  disabled,
  compact,
}: {
  quantity: number;
  onAdd: () => void;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const box = compact ? "h-8 min-w-[78px] text-sm" : "h-9 min-w-[86px] text-sm";
  if (quantity <= 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`Add ${label}`}
        className={`${box} rounded-lg border border-rc-yellow-deep/40 bg-white px-4 font-bold text-rc-yellow-deep shadow-sm transition hover:bg-rc-yellow-tint disabled:cursor-not-allowed disabled:opacity-40`}
      >
        Add
      </button>
    );
  }
  return (
    <div
      className={`${box} inline-flex items-center justify-between overflow-hidden rounded-lg border border-rc-yellow-deep/40 bg-rc-yellow-tint font-bold text-gray-900 shadow-sm`}
      role="group"
      aria-label={`${label} quantity`}
    >
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        aria-label={`One ${label} fewer`}
        className="h-full w-8 text-lg leading-none text-rc-yellow-deep hover:bg-rc-yellow/30"
      >
        −
      </button>
      <output className="min-w-5 text-center tabular-nums" aria-live="polite">
        {quantity}
      </output>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= MAX_LINE_QTY}
        aria-label={`One ${label} more`}
        className="h-full w-8 text-lg leading-none text-rc-yellow-deep hover:bg-rc-yellow/30 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------ service row ----------------------------- */

export interface RowActions {
  /** Units of this service (all options) in the cart. */
  count: number;
  /** Quantity of the no-variant line. */
  quantity: number;
  onAdd: () => void;
  onChange: (next: number) => void;
  onOptions: () => void;
  onDetails: () => void;
  iconKind: SubIconKind;
  /** Card only: book this package straight away (date and start time next). */
  onBook?: () => void;
}

/**
 * One service as a grid card (used on an area's own page): image on top,
 * then name and price, and "Book now" (or the row's Add / options control
 * when no `onBook` is given).
 */
export function ServiceCard({ service, actions }: { service: CategoryTreeService; actions: RowActions }) {
  const options = service.variants.length;
  const cheapest = options ? Math.min(...service.variants.map((v) => v.price)) : null;
  const price = service.price ?? cheapest;
  const from = (service.isStartingPrice ?? false) || (service.price == null && options > 1);
  const hasDetails =
    !!service.description ||
    (service.highlights?.length ?? 0) > 0 ||
    (service.inclusions?.length ?? 0) > 0 ||
    (service.exclusions?.length ?? 0) > 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-rc-yellow hover:shadow-lg hover:shadow-gray-900/5">
      <div className="aspect-4/3 w-full overflow-hidden bg-rc-yellow-tint">
        <SafeImage
          src={service.profileImage}
          alt={service.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={
            <span className="grid h-full w-full place-items-center text-rc-yellow-deep">
              <SubIcon kind={actions.iconKind} className="h-12 w-12" />
            </span>
          }
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h4 className="m-0 text-base font-semibold leading-snug text-gray-900">{service.name}</h4>
        {service.subtitle ? (
          <p className="m-0 mt-1 line-clamp-2 text-sm text-gray-500">{service.subtitle}</p>
        ) : null}
        {hasDetails ? (
          <button
            type="button"
            onClick={actions.onDetails}
            className="mt-2 self-start text-sm font-semibold text-rc-yellow-deep hover:underline"
          >
            View details
          </button>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            <PriceLine
              price={price}
              originalPrice={service.originalPrice}
              from={from}
              minutes={service.durationMinutes}
            />
            {options ? (
              <p className="m-0 mt-0.5 text-xs text-gray-500">
                {options} option{options === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          {actions.onBook ? (
            <button
              type="button"
              disabled={price == null || price <= 0}
              onClick={actions.onBook}
              className="inline-flex h-10 shrink-0 items-center rounded-full bg-rc-yellow px-5 text-sm font-bold text-gray-900 transition hover:brightness-95 disabled:opacity-50"
            >
              Book now
            </button>
          ) : options ? (
            <button
              type="button"
              onClick={actions.onOptions}
              aria-label={`Choose options for ${service.name}`}
              className={`h-9 min-w-21.5 shrink-0 rounded-lg border border-rc-yellow-deep/40 px-4 text-sm font-bold transition ${
                actions.count
                  ? "bg-rc-yellow-tint text-gray-900"
                  : "bg-white text-rc-yellow-deep hover:bg-rc-yellow-tint"
              }`}
            >
              {actions.count ? `${actions.count} added` : "Add"}
            </button>
          ) : (
            <div className="shrink-0">
              <AddControl
                quantity={actions.quantity}
                onAdd={actions.onAdd}
                onChange={actions.onChange}
                label={service.name}
                disabled={price == null}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** One service, Urban Company style: text on the left, image and Add on the right. */
export function ServiceRow({ service, actions }: { service: CategoryTreeService; actions: RowActions }) {
  const options = service.variants.length;
  const cheapest = options ? Math.min(...service.variants.map((v) => v.price)) : null;
  const price = service.price ?? cheapest;
  const from = (service.isStartingPrice ?? false) || (service.price == null && options > 1);
  const highlights = (service.highlights ?? []).slice(0, 3);
  const hasDetails =
    !!service.description ||
    (service.highlights?.length ?? 0) > 0 ||
    (service.inclusions?.length ?? 0) > 0 ||
    (service.exclusions?.length ?? 0) > 0;

  return (
    <article className="flex gap-4 py-6 sm:gap-6">
      <div className="min-w-0 flex-1">
        <h4 className="m-0 text-base font-semibold leading-snug text-gray-900">{service.name}</h4>
        {service.subtitle ? <p className="m-0 mt-1 text-sm text-gray-500">{service.subtitle}</p> : null}
        <div className="mt-2">
          <PriceLine
            price={price}
            originalPrice={service.originalPrice}
            from={from}
            minutes={service.durationMinutes}
          />
        </div>
        {highlights.length ? (
          <ul className="m-0 mt-3 list-none space-y-1 border-t border-dashed border-gray-200 p-0 pt-3">
            {highlights.map((h) => (
              <li key={h} className="flex gap-2 text-sm text-gray-600">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {hasDetails ? (
          <button
            type="button"
            onClick={actions.onDetails}
            className="mt-3 text-sm font-semibold text-rc-yellow-deep hover:underline"
          >
            View details
          </button>
        ) : null}
      </div>

      <div className="flex w-28 shrink-0 flex-col items-center sm:w-32">
        <div className="relative w-full">
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-rc-yellow-tint">
            <SafeImage
              src={service.profileImage}
              alt={service.name}
              className="h-full w-full object-cover"
              fallback={
                <span className="grid h-full w-full place-items-center text-rc-yellow-deep">
                  <SubIcon kind={actions.iconKind} className="h-10 w-10" />
                </span>
              }
            />
          </div>
          <div className="absolute inset-x-0 -bottom-3 flex justify-center">
            {options ? (
              <button
                type="button"
                onClick={actions.onOptions}
                aria-label={`Choose options for ${service.name}`}
                className={`h-9 min-w-[86px] rounded-lg border border-rc-yellow-deep/40 px-4 text-sm font-bold shadow-sm transition ${
                  actions.count
                    ? "bg-rc-yellow-tint text-gray-900"
                    : "bg-white text-rc-yellow-deep hover:bg-rc-yellow-tint"
                }`}
              >
                {actions.count ? `${actions.count} added` : "Add"}
              </button>
            ) : (
              <AddControl
                quantity={actions.quantity}
                onAdd={actions.onAdd}
                onChange={actions.onChange}
                label={service.name}
                disabled={price == null}
              />
            )}
          </div>
        </div>
        {options ? (
          <p className="m-0 mt-5 text-xs text-gray-500">
            {options} option{options === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/* -------------------------------- sheets -------------------------------- */

/** A bottom sheet on phones, a centered dialog from sm up. Escape closes it. */
export function Sheet({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    // Above the site's floating WhatsApp / scroll-to-top buttons (z-50).
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" data-theme="light">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-gray-900 shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h3 className="m-0 truncate text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-gray-100 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Pick between a service's variants; each one adds as its own cart line. */
export function OptionsSheet({
  service,
  quantityOf,
  onAdd,
  onChange,
  onClose,
  footer,
}: {
  service: CategoryTreeService;
  quantityOf: (variant: CategoryTreeVariant) => number;
  onAdd: (variant: CategoryTreeVariant) => void;
  onChange: (variant: CategoryTreeVariant, next: number) => void;
  onClose: () => void;
  footer: ReactNode;
}) {
  return (
    <Sheet title={service.name} onClose={onClose} footer={footer}>
      {service.subtitle ? <p className="m-0 mb-2 text-sm text-gray-500">{service.subtitle}</p> : null}
      <ul className="m-0 list-none divide-y divide-gray-100 p-0">
        {service.variants.map((v) => (
          <li key={v.variantId} className="flex items-center gap-3 py-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-rc-yellow-tint">
              <SafeImage
                src={v.profileImage}
                alt=""
                className="h-full w-full object-cover"
                fallback={<span className="block h-full w-full" />}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-semibold">{v.name}</p>
              {v.subtitle ? <p className="m-0 text-xs text-gray-500">{v.subtitle}</p> : null}
              <div className="mt-1">
                <PriceLine
                  price={v.price}
                  originalPrice={v.originalPrice}
                  minutes={v.durationMinutes}
                  from={service.isStartingPrice}
                  size="sm"
                />
              </div>
            </div>
            <AddControl
              quantity={quantityOf(v)}
              onAdd={() => onAdd(v)}
              onChange={(n) => onChange(v, n)}
              label={`${service.name}, ${v.name}`}
              compact
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: "yes" | "no" | "dot" }) {
  if (!items.length) return null;
  return (
    <section className="mt-5">
      <h4 className="m-0 text-sm font-bold">{title}</h4>
      <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-gray-700">
            {tone === "yes" ? (
              <CheckGlyph className="mt-0.5 h-4 w-4 shrink-0 text-rc-green" />
            ) : tone === "no" ? (
              <span aria-hidden className="w-4 shrink-0 text-center font-bold text-rc-red">
                ✕
              </span>
            ) : (
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Everything known about one service. */
export function DetailsSheet({
  service,
  iconKind,
  onClose,
  action,
}: {
  service: CategoryTreeService;
  iconKind: SubIconKind;
  onClose: () => void;
  action: ReactNode;
}) {
  return (
    <Sheet title={service.name} onClose={onClose} footer={action}>
      <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-rc-yellow-tint">
        <SafeImage
          src={service.profileImage}
          alt={service.name}
          className="h-full w-full object-cover"
          fallback={
            <span className="grid h-full w-full place-items-center text-rc-yellow-deep">
              <SubIcon kind={iconKind} className="h-14 w-14" />
            </span>
          }
        />
      </div>
      {service.subtitle ? <p className="m-0 mt-4 text-sm text-gray-500">{service.subtitle}</p> : null}
      <div className="mt-1.5">
        <PriceLine
          price={service.price ?? (service.variants.length ? Math.min(...service.variants.map((v) => v.price)) : null)}
          originalPrice={service.originalPrice}
          from={service.isStartingPrice || (service.price == null && service.variants.length > 1)}
          minutes={service.durationMinutes}
        />
      </div>
      {service.description ? (
        <p className="m-0 mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-700">{service.description}</p>
      ) : null}
      <ListBlock title="Highlights" items={service.highlights ?? []} tone="dot" />
      <ListBlock title="What's included" items={service.inclusions ?? []} tone="yes" />
      <ListBlock title="Not included" items={service.exclusions ?? []} tone="no" />
      <p className="m-0 mt-5 text-xs text-gray-500">Prices are before 18% GST.</p>
    </Sheet>
  );
}

/* --------------------------------- cart --------------------------------- */

/** The cart on the right of the page (and inside the options sheet footer). */
export function CartSummary({
  lines,
  subtotal,
  onChange,
  action,
}: {
  lines: CartLine[];
  subtotal: number;
  onChange: (line: CartLine, next: number) => void;
  action: ReactNode;
}) {
  if (!lines.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-rc-yellow-tint text-2xl" aria-hidden>
          🛒
        </span>
        <p className="m-0 text-sm font-semibold">No items in your cart</p>
        <p className="m-0 text-xs text-gray-500">Add a package to see it here.</p>
      </div>
    );
  }
  return (
    <div>
      <ul className="m-0 list-none space-y-3 p-0">
        {lines.map((l) => (
          <li key={l.key} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-medium leading-snug">{l.name}</p>
              {l.variantName ? <p className="m-0 text-xs text-gray-500">{l.variantName}</p> : null}
            </div>
            <AddControl
              quantity={l.quantity}
              onAdd={() => onChange(l, 1)}
              onChange={(n) => onChange(l, n)}
              label={l.variantName ? `${l.name}, ${l.variantName}` : l.name}
              compact
            />
            <p className="m-0 w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
              {formatInr(l.unitPrice * l.quantity)}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-sm text-gray-500">Item total (before tax)</span>
        <span className="text-base font-bold tabular-nums">{formatInr(subtotal)}</span>
      </div>
      <div className="mt-4">{action}</div>
    </div>
  );
}
