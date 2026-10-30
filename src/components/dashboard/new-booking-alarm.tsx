"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getToken } from "@/src/api/apiClient";
import { crmQueryKeys } from "@/src/api/api";
import { getStoredUser } from "@/src/lib/auth";

/**
 * Rings the panel when a booking arrives.
 *
 * The bell polls once a minute, which is fine for a feed but far too slow for a
 * booking somebody has to allocate. This is the instant path: the backend also
 * writes a Notification row, so the bell still shows it after a refresh — the
 * socket only decides how quickly you hear about it.
 */

interface NewBooking {
  bookingId: number;
  customerName?: string | null;
  serviceName?: string | null;
  serviceCity?: string | null;
  bookingDate?: string | null;
  totalAmount?: number | null;
}

/** A short two-tone chime, synthesised so the panel ships no audio asset. */
function playChime() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Fade each note in and out — a bare square start clicks audibly.
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.4);
    });
    // Let the context go once the sound has finished.
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1200);
  } catch {
    /* no audio in this browser — the popup still appears */
  }
}

export function NewBookingAlarm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [booking, setBooking] = useState<NewBooking | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const dismiss = useCallback(() => setBooking(null), []);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    // Panel staff only. A partner or customer token would join the admin room
    // and hear about every booking in the system.
    if (!token || !user || user.role === "USER" || user.role === "SERVICE_PROFESSIONAL") return;

    const origin = new URL(API_BASE_URL, window.location.origin).origin;
    // `auth` is a function so every (re)connect sends the token that is stored NOW.
    // The access token lasts 15 minutes and the API client swaps it in storage when
    // it refreshes; the backend only lets a valid token into the admin room, so a
    // token captured once at mount would stop the bell after the first reconnect.
    const socket = io(origin, {
      transports: ["websocket", "polling"],
      auth: (cb) => cb({ token: getToken() }),
    });
    socketRef.current = socket;

    // The room is joined on every (re)connect, not just the first: after a
    // dropped connection the server has no memory of who was in it.
    const join = () => socket.emit("join", { admin: true });
    socket.on("connect", join);

    socket.on("admin_booking", (payload: { type?: string } & NewBooking) => {
      if (payload?.type !== "NEW_BOOKING") return;
      setBooking(payload);
      playChime();
      // Keep the bell honest without waiting for its next poll.
      qc.invalidateQueries({ queryKey: crmQueryKeys.notifications });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [qc]);

  // Escape closes it, like every other dialog in the panel.
  useEffect(() => {
    if (!booking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booking, dismiss]);

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success/10 text-xl">
            🔔
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">New booking received</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Booking #{booking.bookingId}
              {booking.serviceCity ? ` · ${booking.serviceCity}` : ""}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 rounded-xl bg-accent/40 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-right font-medium text-foreground">
              {booking.customerName ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Service</dt>
            <dd className="text-right font-medium text-foreground">
              {booking.serviceName ?? "—"}
            </dd>
          </div>
          {booking.bookingDate && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-right font-medium text-foreground">{booking.bookingDate}</dd>
            </div>
          )}
          {booking.totalAmount != null && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right font-medium text-foreground">
                ₹{Number(booking.totalAmount).toLocaleString("en-IN")}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={dismiss}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              dismiss();
              router.push("/dashboard/bookings");
            }}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            View booking
          </button>
        </div>
      </div>
    </div>
  );
}
