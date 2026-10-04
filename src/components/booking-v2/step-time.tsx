"use client";

/** Step 1 of the hourly wizard: pick a date, a start and an end time. */

import { useEffect, useMemo, useRef } from "react";
import { computeBill, formatInr } from "@/src/lib/booking-v2/pricing";
import {
  DAY_END,
  DAY_START,
  MAX_MINUTES,
  clockNow,
  dayIsBookable,
  earliestStart,
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  getDays,
  latestStart,
  monthLabel,
  monthShort,
  snapToStep,
  timeOptions,
  validateRange,
} from "@/src/lib/booking-v2/schedule";
import type { StepProps } from "./wizard";
import { emojiForCategory } from "./category-page-v2";
import { categoryHref } from "@/lib/category-slugs";
import {
  BillRow,
  Card,
  ChevronGlyph,
  ClockGlyph,
  Hint,
  PrimaryButton,
  SectionTitle,
  SummaryCard,
  WizardLayout,
} from "./shell";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * A time tile: clock badge, caption and the chosen time in large type. The
 * native select sits invisibly over the whole tile, so tapping anywhere
 * opens the picker and the focus ring lands on the tile.
 */
function TimeField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string; disabled?: boolean }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? fmtTime(value);
  return (
    <div className="relative flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 transition hover:border-gray-300 focus-within:border-rc-yellow focus-within:ring-2 focus-within:ring-rc-yellow-tint">
      <span
        className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-rc-yellow-tint text-rc-yellow-deep sm:grid"
        aria-hidden
      >
        <ClockGlyph className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1" aria-hidden>
        <span className="block text-xs font-medium text-gray-500">{label}</span>
        <span className="block truncate text-base font-bold text-gray-900 sm:text-lg">{current}</span>
      </span>
      <ChevronGlyph className="h-4 w-4 shrink-0 text-gray-400" />
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StepTime({ draft, update, goTo, leave }: StepProps) {
  // Snapshot "now" once so the day and slot filtering stays stable.
  const clock = useMemo(() => clockNow(), []);
  const days = useMemo(() => getDays(), []);
  const { minMinutes, rate } = draft;

  // Derived, never stored: the stored pick may have slipped into the past.
  const date = useMemo(() => {
    const ok = days.some((d) => d.value === draft.date) && dayIsBookable(draft.date, minMinutes, clock);
    if (ok) return draft.date;
    return days.find((d) => dayIsBookable(d.value, minMinutes, clock))?.value ?? draft.date;
  }, [days, draft.date, minMinutes, clock]);

  const earliest = earliestStart(date, clock);
  const latest = latestStart(minMinutes);
  const start = clamp(snapToStep(draft.start), earliest, latest);
  const minEnd = start + minMinutes;
  const maxEnd = Math.min(start + MAX_MINUTES, DAY_END);
  const end = clamp(snapToStep(draft.end), minEnd, maxEnd);

  const startOptions = timeOptions(DAY_START, latest).map((t) => ({
    value: t,
    label: fmtTime(t),
    disabled: t < earliest,
  }));
  const endOptions = timeOptions(minEnd, maxEnd).map((t) => ({ value: t, label: fmtTime(t) }));

  const minutes = end - start;
  const problem = validateRange(start, end, minMinutes, date, clock);
  const valid = problem === "ok";
  const bill = computeBill({ hours: minutes / 60, rate, quantity: draft.quantity, coupon: null });
  const minHrs = minMinutes / 60;

  // On phones the days scroll sideways: bring a day chosen earlier into view.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !chip) return;
    const x = chip.getBoundingClientRect().left - row.getBoundingClientRect().left;
    if (x + chip.offsetWidth > row.clientWidth) row.scrollLeft = x - 20;
  }, []);

  const next = () => {
    if (!valid) return;
    update({ date, start, end });
    goTo("address");
  };

  const action = (
    <PrimaryButton onClick={next} disabled={!valid} wide>
      Next: address
    </PrimaryButton>
  );

  return (
    <WizardLayout
      current={0}
      title={`Book a ${draft.serviceName}`}
      crumbs={[
        { label: "Home", href: "/" },
        { label: draft.categoryName, href: categoryHref(draft.categoryId) },
        { label: "Date & time" },
      ]}
      sidebar={
        <SummaryCard
          image={draft.serviceImage}
          fallback={emojiForCategory(draft.categoryName)}
          name={draft.serviceName}
          sub={`${formatInr(rate)}/hour, minimum ${minHrs} hrs`}
          onChange={leave}
          details={[
            { label: "Date", value: fmtDateLong(date) },
            { label: "Time", value: `${fmtTime(start)} to ${fmtTime(end)}` },
            { label: "Duration", value: fmtDuration(minutes) },
          ]}
          rows={
            <>
              <BillRow
                label={`${fmtDuration(minutes)} × ${formatInr(rate)}${
                  draft.quantity > 1 ? ` × ${draft.quantity}` : ""
                }`}
                value={formatInr(bill.subtotal)}
              />
              <BillRow label="Taxes (18%)" value={formatInr(bill.tax)} />
            </>
          }
          total={formatInr(bill.total)}
          action={action}
          note="Taxes included. You choose how to pay at the last step."
        />
      }
      bar={{ total: formatInr(bill.total), note: `for ${fmtDuration(minutes)}, taxes included`, action }}
    >
      <Card className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle note="Bookings open up to a week ahead.">Choose a date</SectionTitle>
          <p className="m-0 whitespace-nowrap text-sm text-gray-500">{monthLabel(date)}</p>
        </div>
        <div
          ref={rowRef}
          className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto scroll-pl-5 px-5 pb-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0"
          role="radiogroup"
          aria-label="Booking date"
        >
          {days.map((d, i) => {
            const selected = d.value === date;
            const bookable = dayIsBookable(d.value, minMinutes, clock);
            const showMonth = i === 0 || d.day === "1";
            return (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={fmtDateLong(d.value)}
                disabled={!bookable}
                onClick={() => update({ date: d.value })}
                className={`flex h-19.5 w-17 shrink-0 snap-start flex-col items-center justify-center gap-0.75 rounded-2xl border text-gray-900 transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${
                  selected
                    ? "border-rc-yellow bg-rc-yellow"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span
                  className={`text-[11px] uppercase tracking-wide ${
                    selected ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {d.weekday}
                </span>
                <span className="text-[22px] font-bold leading-none tabular-nums">{d.day}</span>
                <span
                  className={`min-h-3.25 text-[10.5px] ${
                    selected ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {showMonth ? monthShort(d.value) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle note={`Minimum ${minHrs} hours, maximum ${MAX_MINUTES / 60} hours. Extend by the hour.`}>
          Set your hours
        </SectionTitle>
        {/* Start and end side by side at every width, joined into one control. */}
        {/* Two tiles side by side at every width; the connector shows from sm up. */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
          <TimeField
            id="start-time"
            label="Start time"
            value={start}
            onChange={(v) => update({ start: v })}
            options={startOptions}
          />
          <div className="hidden place-items-center sm:grid" aria-hidden>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500">
              <ChevronGlyph className="h-4 w-4 -rotate-90" />
            </span>
          </div>
          <TimeField
            id="end-time"
            label="End time"
            value={end}
            onChange={(v) => update({ end: v })}
            options={endOptions}
          />
        </div>
        {!valid ? (
          <Hint error>
            {problem === "too-short"
              ? `Minimum booking is ${minHrs} hours. Pick a later end time.`
              : problem === "too-long"
                ? `Maximum booking is ${MAX_MINUTES / 60} hours. Pick an earlier end time.`
                : "That start time has passed. Pick a later time."}
          </Hint>
        ) : (
          <p className="m-0 mt-3.5 text-sm text-gray-500" aria-live="polite">
            {fmtDateShort(date)}, {fmtTime(start)} to {fmtTime(end)}.{" "}
            <span className="font-semibold text-gray-900">{fmtDuration(minutes)}</span> at{" "}
            {formatInr(rate)} an hour.
          </p>
        )}
      </Card>
    </WizardLayout>
  );
}
