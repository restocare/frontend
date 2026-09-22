"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/src/lib/cart";
import { saveBookingSchedule } from "@/src/lib/booking-schedules";
import {
  buildShiftSlots,
  getNextDays,
  istNow,
  parseVariantShift,
} from "@/src/lib/booking-shifts";
import { SpinnerIcon } from "@/src/components/icons";
import { useBookingFlow } from "@/src/lib/booking-flow";
import { BookingWizard } from "@/src/components/booking-v2/wizard";

export default function BookingSchedulePage() {
  // Flow 2 (see src/lib/booking-flow.ts) replaces the shift picker with the
  // three-step hourly wizard at the same address.
  const flow = useBookingFlow();
  return (
    <Suspense fallback={null}>
      {flow === 2 ? <BookingWizard /> : <BookingScheduleContent />}
    </Suspense>
  );
}

function BookingScheduleContent() {
  const params = useParams<{ serviceId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItemAsync } = useCart();

  const serviceId = Number(params?.serviceId);
  const variantIdParam = searchParams.get("variantId");
  const variantId = variantIdParam ? Number(variantIdParam) : null;
  const variantName = searchParams.get("variantName");
  const serviceName = searchParams.get("name") ?? "Service";
  const serviceImage = searchParams.get("image");

  // Derive the shift duration + timing from the variant name, e.g.
  // "5 Hour Shift (11 AM – 4 PM)". Falls back to a generated grid when absent.
  const { durationHours: parsedDuration, timing } = useMemo(
    () => parseVariantShift(variantName),
    [variantName],
  );
  const durationHours = parsedDuration ?? 5;
  const shiftTimings = useMemo(() => (timing ? [timing] : undefined), [timing]);

  // Snapshot "now" once per mount so day/slot filtering stays stable.
  const now = useMemo(() => istNow(), []);
  const days = useMemo(() => getNextDays(7), []);
  const slots = useMemo(
    () => buildShiftSlots(shiftTimings, durationHours),
    [shiftTimings, durationHours],
  );

  const slotsForDate = useCallback(
    (dateValue: string) =>
      slots.filter((s) => dateValue !== now.dateISO || s.startHour * 60 > now.minutes),
    [slots, now],
  );

  const initialDate = useMemo(
    () => days.find((d) => slotsForDate(d.value).length > 0)?.value ?? days[0]?.value ?? "",
    [days, slotsForDate],
  );

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [pickedSlotId, setPickedSlotId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSlots = useMemo(
    () => slotsForDate(selectedDate),
    [slotsForDate, selectedDate],
  );

  // Effective selection (derived, no effect): keep the user's pick when it's
  // still visible, auto-pick when the day offers a single shift, else nothing.
  const selectedSlotId = useMemo(() => {
    if (pickedSlotId && visibleSlots.some((s) => s.id === pickedSlotId)) return pickedSlotId;
    return visibleSlots.length === 1 ? visibleSlots[0].id : null;
  }, [pickedSlotId, visibleSlots]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;
  const selectedDay = days.find((d) => d.value === selectedDate) ?? null;

  const handleContinue = async () => {
    if (!selectedSlot) {
      setError("Please select a shift slot.");
      return;
    }
    setError(null);

    const schedule = {
      date: selectedDate,
      dateLabel: selectedDay?.fullLabel ?? selectedDate,
      startTime: selectedSlot.startTime,
      label: selectedSlot.label,
      durationHours,
      variantName,
    };

    // Persist this item's schedule so checkout can show each item's own date/shift.
    saveBookingSchedule(serviceId, variantId, schedule);

    setIsBooking(true);
    try {
      await addItemAsync(serviceId, variantId ?? undefined);
      router.push("/checkout");
    } catch {
      setIsBooking(false);
      setError("Could not start your booking. Please try again.");
    }
  };

  return (
    <div data-theme="light" className="min-h-dvh bg-[#111111]">
      {/* Hero image */}
      <div className="relative h-[38vh] w-full sm:h-[44vh]">
        {serviceImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external service image
          <img
            src={serviceImage}
            alt={serviceName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#2a2a2a] text-6xl">
            🧰
          </div>
        )}
        <div className="absolute left-4 right-4 top-4 flex justify-between">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-lg text-white"
          >
            ←
          </button>
        </div>
      </div>

      {/* Sheet */}
      <div className="relative -mt-7 rounded-t-[28px] bg-white pb-8 pt-4">
        <div className="mx-auto max-w-2xl px-5">
          {/* Progress */}
          <div className="mt-2 flex gap-2">
            <span className="h-[5px] flex-1 rounded-full bg-[#F6B500]" />
            <span className="h-[5px] flex-1 rounded-full bg-[#111111]" />
            <span className="h-[5px] flex-1 rounded-full bg-gray-200" />
            <span className="h-[5px] flex-1 rounded-full bg-gray-200" />
          </div>

          {/* Title */}
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-3xl leading-none text-gray-900"
              aria-label="Back"
            >
              ‹
            </button>
            <div className="text-center">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
                Date &amp; Time
              </h1>
              <p className="mt-0.5 text-xs font-bold tracking-widest text-gray-400">
                STEP 2 OF 4
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="mt-4 truncate text-sm font-semibold text-gray-900">
            {serviceName}
          </p>

          {/* Date pills */}
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {days.map((d) => {
              const active = d.value === selectedDate;
              const disabled = slotsForDate(d.value).length === 0;
              return (
                <button
                  key={d.value}
                  disabled={disabled}
                  onClick={() => setSelectedDate(d.value)}
                  className={`flex h-[86px] w-[66px] shrink-0 flex-col items-center justify-center rounded-2xl transition ${
                    active
                      ? "bg-[#F6B500]"
                      : disabled
                        ? "bg-gray-100 opacity-45"
                        : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <span
                    className={`mb-1.5 text-xs font-semibold ${
                      active ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {d.weekday}
                  </span>
                  <span
                    className={`text-2xl font-extrabold ${
                      active ? "text-gray-900" : "text-gray-900"
                    }`}
                  >
                    {d.day}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shift slots */}
          <h2 className="mt-4 text-lg font-extrabold tracking-tight text-gray-900">
            Select a Shift Slot
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {variantName ? `${variantName} · ` : ""}each slot is a continuous{" "}
            {durationHours}-hour shift
          </p>

          {visibleSlots.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {visibleSlots.map((s) => {
                const active = s.id === selectedSlotId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setPickedSlotId(s.id)}
                    className={`min-w-[45%] grow rounded-2xl py-4 text-sm font-bold transition ${
                      active
                        ? "bg-[#F6B500] text-gray-900"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm font-semibold text-gray-400">
              No more shifts available for this day. Please pick another date.
            </div>
          )}

          {/* Selection summary */}
          {selectedSlot ? (
            <div className="mt-5 rounded-xl bg-[#fff8e6] px-4 py-3.5 text-sm font-semibold text-[#6b5400]">
              ✨ You&apos;ve selected a {durationHours}-hour shift · {selectedSlot.label}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {/* Continue */}
          <button
            onClick={handleContinue}
            disabled={!selectedSlot || isBooking}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#F6B500] text-base font-extrabold text-gray-900 transition hover:brightness-95 disabled:opacity-50"
          >
            {isBooking ? <SpinnerIcon className="h-5 w-5" /> : "Continue ›"}
          </button>
        </div>
      </div>
    </div>
  );
}
