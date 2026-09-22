"use client";

/**
 * Building blocks shared by the flow-2 storefront pages. They sit inside the
 * site's normal header and footer and are laid out for a desktop browser
 * first: the wizard is two columns on large screens (the step on the left, a
 * sticky booking summary with the action on the right) and stacks on phones,
 * where the summary's action moves into a fixed bottom bar.
 *
 * Colours: the site's grey scale for text and borders, and the `rc-*` yellow
 * tokens from app/globals.css for the primary actions and the current step.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";

/* ------------------------------- icons -------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={2.6} aria-hidden>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}
export function ClockGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.8} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
export function PinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.8} aria-hidden>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}
export function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={1.8} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ------------------------------- frame -------------------------------- */

/** The storefront page frame: site header, light theme, site footer. */
export function StorefrontShell({
  search = "",
  onSearchChange = () => {},
  children,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50 text-gray-900">
      <LandingHeader search={search} onSearchChange={onSearchChange} />
      {children}
      <Footer />
    </div>
  );
}

export const STEP_LABELS = ["Date & time", "Address", "Review"] as const;

type StepState = "done" | "current" | "todo";

function stepState(i: number, current: number): StepState {
  return i < current ? "done" : i === current ? "current" : "todo";
}

const stepLabelClass: Record<StepState, string> = {
  current: "font-semibold text-gray-900",
  done: "font-medium text-gray-700",
  todo: "text-gray-400",
};

function StepDot({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
        state === "done"
          ? "bg-gray-900 text-white"
          : state === "current"
            ? "bg-rc-yellow text-gray-900"
            : "border border-gray-300 bg-white text-gray-400"
      }`}
    >
      {state === "done" ? <CheckGlyph className="h-4 w-4" /> : index + 1}
    </span>
  );
}

/**
 * Numbered steps: done, current, upcoming. `inline` sits beside the page
 * title on wide screens. `columns` spreads the three steps across the full
 * width with the labels underneath and a line joining the numbers, for the
 * strip under the site header on phones.
 */
export function Stepper({
  current,
  layout = "inline",
}: {
  current: 0 | 1 | 2;
  layout?: "inline" | "columns";
}) {
  if (layout === "columns") {
    return (
      <ol className="grid grid-cols-3" aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => {
          const state = stepState(i, current);
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex flex-col items-center gap-1.5 text-center"
            >
              {i > 0 ? (
                <span
                  aria-hidden
                  className={`absolute -left-1/2 right-1/2 top-3.75 h-0.5 ${
                    i <= current ? "bg-gray-900" : "bg-gray-200"
                  }`}
                />
              ) : null}
              <span className="relative z-10 rounded-full ring-4 ring-white">
                <StepDot state={state} index={i} />
              </span>
              <span className={`text-xs leading-tight ${stepLabelClass[state]}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="flex items-center gap-3" aria-label="Booking steps">
      {STEP_LABELS.map((label, i) => {
        const state = stepState(i, current);
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <StepDot state={state} index={i} />
              <span className={`text-sm ${stepLabelClass[state]}`}>{label}</span>
            </span>
            {i < STEP_LABELS.length - 1 ? (
              <span
                aria-hidden
                className={`h-px w-10 ${i < current ? "bg-gray-900" : "bg-gray-300"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type CrumbItem = { label: string; href?: string; onClick?: () => void };

/** A breadcrumb entry that is a page link or an in-wizard step change. */
function CrumbLink({
  crumb,
  className,
  children,
}: {
  crumb: CrumbItem;
  className: string;
  children: ReactNode;
}) {
  if (crumb.href) {
    return (
      <Link href={crumb.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={crumb.onClick} className={className}>
      {children}
    </button>
  );
}

/**
 * The wizard page. Wide screens: breadcrumb, title row with the inline
 * stepper, then the step's content on the left and the booking summary on
 * the right. Phones: a step strip under the site header, a back link in
 * place of the breadcrumb, the content and summary stacked, and `action`
 * repeated in a fixed bottom bar.
 */
export function WizardLayout({
  current,
  title,
  crumbs,
  sidebar,
  bar,
  children,
}: {
  current: 0 | 1 | 2;
  title: string;
  crumbs: CrumbItem[];
  sidebar: ReactNode;
  /** Total, note and action for the phone bottom bar. */
  bar?: { total: string; note: string; action: ReactNode };
  children: ReactNode;
}) {
  const back = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;

  return (
    <>
      <div className="border-b border-gray-200 bg-white md:hidden">
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-3.5 sm:px-6">
          <Stepper current={current} layout="columns" />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pt-8 lg:pb-16">
        {back ? (
          <div className="mb-2 md:hidden">
            <CrumbLink
              crumb={back}
              className="inline-flex items-center gap-0.5 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              <ChevronGlyph className="h-4 w-4 rotate-90" />
              {back.label}
            </CrumbLink>
          </div>
        ) : null}

        <nav
          className="mb-3 hidden flex-wrap items-center gap-1.5 text-sm text-gray-500 md:flex"
          aria-label="Breadcrumb"
        >
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {c.href || c.onClick ? (
                <CrumbLink crumb={c} className="hover:text-gray-900">
                  {c.label}
                </CrumbLink>
              ) : (
                <span className="font-medium text-gray-900">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <h1 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          <div className="hidden md:block">
            <Stepper current={current} />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
          <aside className="min-w-0 lg:sticky lg:top-24">{sidebar}</aside>
        </div>

        {bar ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div className="min-w-0 flex-1 leading-tight">
                <p className="m-0 text-lg font-bold tabular-nums">{bar.total}</p>
                <p className="m-0 truncate text-xs text-gray-500">{bar.note}</p>
              </div>
              {/* The step's button is `wide`; box it so the total keeps its half. */}
              <div className="w-[54%] max-w-xs shrink-0">{bar.action}</div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

/* --------------------------- small pieces ----------------------------- */

export function Thumb({
  src,
  alt = "",
  size = "md",
  children,
}: {
  src?: string | null;
  alt?: string;
  size?: "md" | "sm";
  children?: ReactNode;
}) {
  const box = size === "md" ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl";
  return (
    <div
      className={`${box} grid shrink-0 place-items-center overflow-hidden bg-rc-yellow-tint text-gray-900`}
      aria-hidden={alt === ""}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external service image
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className={size === "md" ? "text-3xl" : "text-2xl"}>{children}</span>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div>
      <h2 className="m-0 text-lg font-bold tracking-tight">{children}</h2>
      {note ? <p className="m-0 mt-1 text-sm text-gray-500">{note}</p> : null}
    </div>
  );
}

export function Hint({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p
      className={`m-0 mt-2.5 text-sm ${error ? "font-medium text-rc-red" : "text-gray-500"}`}
      aria-live="polite"
    >
      {children}
    </p>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-rc-yellow focus:ring-2 focus:ring-rc-yellow-tint";

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  inputMode,
  maxLength,
  autoComplete,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inputMode?: "text" | "numeric" | "tel";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete={autoComplete}
      aria-invalid={invalid || undefined}
      className={`${inputClass} ${invalid ? "border-rc-red" : ""}`}
    />
  );
}

export function SelectInput({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string; disabled?: boolean }[];
}) {
  return (
    <span className="relative block">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass} cursor-pointer appearance-none pr-9 font-medium`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronGlyph className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </span>
  );
}

export function ChipButton({
  selected,
  onClick,
  children,
  role = "radio",
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  role?: "radio" | "checkbox";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? "border-rc-yellow bg-rc-yellow font-semibold text-gray-900"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

/** A selectable card with a radio dot: addresses, payment methods. */
export function ChoiceCard({
  selected,
  onSelect,
  disabled,
  tag,
  title,
  lines,
  meta,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  tag?: string;
  title: ReactNode;
  lines?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-2xl border bg-white p-4 text-left text-gray-900 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-rc-yellow ring-2 ring-rc-yellow-tint"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <span
        aria-hidden
        className={`relative mt-px h-5 w-5 rounded-full border-2 ${
          selected
            ? "border-rc-yellow-deep after:absolute after:inset-0.75 after:rounded-full after:bg-rc-yellow-deep after:content-['']"
            : "border-gray-300"
        }`}
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-snug">
          {tag ? (
            <span className="rounded-full bg-rc-yellow-tint px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {tag}
            </span>
          ) : null}
          {title}
        </span>
        {lines ? <span className="text-sm leading-relaxed text-gray-600">{lines}</span> : null}
        {meta ? <span className="text-xs text-gray-500">{meta}</span> : null}
      </span>
    </button>
  );
}

/** A bordered list of `ChoiceRow`s with dividers: saved addresses. */
export function ChoiceList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      {children}
    </div>
  );
}

/** A full-width selectable row inside a `ChoiceList`: radio dot, then text. */
export function ChoiceRow({
  selected,
  onSelect,
  disabled,
  tag,
  title,
  lines,
  meta,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  tag?: string;
  title: ReactNode;
  lines?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-3 border-l-4 px-4 py-3.5 text-left text-gray-900 transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 ${
        selected ? "border-rc-yellow bg-rc-yellow-tint/50" : "border-transparent hover:bg-gray-50"
      }`}
    >
      <span
        aria-hidden
        className={`relative mt-px h-5 w-5 rounded-full border-2 ${
          selected
            ? "border-rc-yellow-deep after:absolute after:inset-0.75 after:rounded-full after:bg-rc-yellow-deep after:content-['']"
            : "border-gray-300"
        }`}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold leading-snug">
          {tag ? (
            <span className="rounded-full bg-rc-yellow-tint px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {tag}
            </span>
          ) : null}
          {title}
        </span>
        {lines ? <span className="text-sm leading-snug text-gray-600">{lines}</span> : null}
        {meta ? <span className="text-xs text-gray-500">{meta}</span> : null}
      </span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  wide,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  wide?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-rc-yellow px-7 text-sm font-bold text-gray-900 shadow-[0_6px_16px_rgba(244,180,0,0.3)] transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
        wide ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap text-sm font-semibold text-rc-yellow-deep hover:underline"
    >
      {children}
    </button>
  );
}

/** Rows of a bill: label left, amount right. */
export function BillRow({
  label,
  value,
  tone = "normal",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "normal" | "discount" | "total";
}) {
  if (tone === "total") {
    return (
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <dt className="text-base font-bold text-gray-900">{label}</dt>
        <dd className="m-0 text-lg font-bold tabular-nums text-gray-900">{value}</dd>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`m-0 font-medium tabular-nums ${tone === "discount" ? "text-rc-green" : "text-gray-900"}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * The sticky booking summary on the right of the wizard: the service, the
 * chosen date and hours, the bill so far, and the step's action.
 */
export function SummaryCard({
  image,
  fallback,
  name,
  sub,
  onChange,
  details,
  rows,
  total,
  totalLabel = "Total",
  action,
  note,
}: {
  image: string | null;
  fallback: ReactNode;
  name: string;
  sub: string;
  onChange?: () => void;
  details?: { label: string; value: ReactNode }[];
  rows: ReactNode;
  total: string;
  totalLabel?: string;
  action: ReactNode;
  note?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Thumb src={image} size="sm">
          {fallback}
        </Thumb>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-base font-bold">{name}</h2>
          <p className="m-0 mt-0.5 text-sm text-gray-500">{sub}</p>
        </div>
        {onChange ? <LinkButton onClick={onChange}>Change</LinkButton> : null}
      </div>

      {details && details.length ? (
        <dl className="m-0 mt-4 grid gap-1.5 border-t border-gray-100 pt-4">
          {details.map((d) => (
            <div key={d.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-gray-500">{d.label}</dt>
              <dd className="m-0 text-right font-medium text-gray-900">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <dl className="m-0 mt-4 grid gap-2 border-t border-gray-100 pt-4">
        {rows}
        <BillRow label={totalLabel} value={total} tone="total" />
      </dl>

      {/* On phones the same action lives in the fixed bottom bar instead. */}
      <div className="mt-5 hidden lg:block">{action}</div>
      {note ? <p className="m-0 mt-3 text-center text-xs text-gray-500">{note}</p> : null}
    </Card>
  );
}
