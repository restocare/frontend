"use client";

import { useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowDownRight, BriefcaseBusiness, Check, MapPin, Navigation } from "lucide-react";
import type { BookingRecord } from "@/src/api/api";
import { bookingActivity, customerBookingArea, partnerBookingArea } from "@/src/lib/booking-activity";
import { usePrefersReducedMotion } from "@/src/lib/use-prefers-reduced-motion";

// Three.js is only downloaded for an accepted booking that is on screen.
const ConnectionScene = dynamic(() => import("./connection-scene"), { ssr: false });
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-yellow focus-visible:ring-offset-2";

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function useAmbientAnimation(ref: RefObject<HTMLDivElement | null>) {
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref, { amount: 0.1 });
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
  return inView && visible && reducedMotion === false;
}

/** Compact waiting state, deliberately contained in its own booking card. */
export function WaitingForPartner() {
  const ref = useRef<HTMLDivElement>(null);
  const animate = useAmbientAnimation(ref);
  return (
    <div ref={ref} data-booking-waiting className="mt-5 flex items-center gap-3 overflow-hidden rounded-2xl border border-rc-yellow/25 bg-rc-yellow-tint/45 px-3 py-3 sm:gap-4 sm:px-4">
      <div aria-hidden="true" className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full fill-none">
          <circle cx="32" cy="32" r="29" stroke="#F4B400" strokeOpacity=".16" />
          {[0, 1].map((i) => (
            <motion.circle key={i} cx="32" cy="32" stroke="#F4B400" strokeWidth="1.5"
              initial={false}
              animate={animate ? { r: [17, 29], opacity: [0.65, 0] } : { r: 21 + i * 7, opacity: 0.25 }}
              transition={animate ? { duration: 2.8, repeat: Infinity, delay: i * 1.4, ease: "easeOut" } : { duration: 0 }}
            />
          ))}
          <motion.g animate={{ rotate: animate ? 360 : 0 }} transition={animate ? { duration: 12, repeat: Infinity, ease: "linear" } : { duration: 0 }} style={{ transformOrigin: "32px 32px" }}>
            <circle cx="32" cy="4" r="3" fill="#F4B400" />
            <circle cx="32" cy="60" r="2.5" fill="#1C1A17" />
          </motion.g>
        </svg>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-rc-ink shadow-sm"><BriefcaseBusiness className="h-4 w-4" /></span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rc-ink">
          Waiting for a partner
          <span aria-hidden="true" className="inline-flex gap-1">
            {[0, 1, 2].map((i) => <motion.span key={i} className="h-1 w-1 rounded-full bg-rc-yellow-deep" animate={animate ? { opacity: [0.3, 1, 0.3], y: [0, -2, 0] } : { opacity: 0.65, y: 0 }} transition={animate ? { duration: 1.5, delay: i * 0.2, repeat: Infinity } : { duration: 0 }} />)}
          </span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-rc-ink-2">We&apos;ll update you here as soon as a partner accepts.</p>
      </div>
    </div>
  );
}

/** A decorative neighbourhood, never a geographic map or an ETA prediction. */
function IllustratedConnection({ booking, animate, restaurantName }: { booking: BookingRecord; animate: boolean; restaurantName?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, "");
  const partnerArea = partnerBookingArea(booking);
  const customerArea = customerBookingArea(booking);
  const partnerName = booking.professional?.user?.name?.trim() || "Your service partner";
  const restaurant = restaurantName?.trim() || "Your restaurant";
  const initials = booking.professional?.user?.name?.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase() || "P";
  const inProgress = bookingActivity(booking) === "in-progress";
  return (
    <div className="relative isolate h-[320px] overflow-hidden bg-[#FAF8F1] sm:h-[340px]" data-booking-connection>
      <svg aria-hidden="true" viewBox="0 0 820 290" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id={`${uid}-blocks`} width="150" height="120" patternTransform="rotate(-12)" patternUnits="userSpaceOnUse">
            <rect x="10" y="10" width="58" height="38" rx="8" fill="#EEECE3" />
            <rect x="78" y="10" width="58" height="64" rx="8" fill="#F0EEE7" />
            <rect x="10" y="58" width="58" height="48" rx="8" fill="#F1EFE8" />
            <rect x="78" y="84" width="58" height="22" rx="6" fill="#ECEAE1" />
          </pattern>
          <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FAF8F1" stopOpacity=".35" /><stop offset="1" stopColor="#FAF8F1" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id={`${uid}-route`} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#F4B400" /><stop offset=".55" stopColor="#FFCC47" /><stop offset="1" stopColor="#C59115" />
          </linearGradient>
          <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#FFFDF5" stopOpacity=".65" /><stop offset=".4" stopColor="#FFFDF5" stopOpacity="0" /><stop offset="1" stopColor="#FFFDF5" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <rect width="820" height="290" fill={`url(#${uid}-blocks)`} />
        <path d="M-30 62 Q150 5 260 55 T500 55 T850 4 M-40 266 Q130 205 260 244 T535 262 T860 210 M290 -20 Q250 65 295 145 T340 320 M550 -20 Q515 90 570 170 T595 310" fill="none" stroke="#FFFFFF" strokeWidth="18" />
        <path d="M-30 62 Q150 5 260 55 T500 55 T850 4 M-40 266 Q130 205 260 244 T535 262 T860 210 M290 -20 Q250 65 295 145 T340 320 M550 -20 Q515 90 570 170 T595 310" fill="none" stroke="#E9E6DC" strokeWidth="1" strokeDasharray="5 8" />
        <path d="M350 18 Q370 4 406 15 L457 40 Q470 66 445 74 L377 62 Q342 48 350 18" fill="#E1E8D6" />
        <path d="M655 240 Q680 208 725 225 T800 266 L791 298 H670 Z" fill="#E1E8D6" />
        <g fill="#C5D3B5"><circle cx="385" cy="33" r="7" /><circle cx="409" cy="43" r="9" /><circle cx="432" cy="49" r="6" /><circle cx="720" cy="253" r="8" /><circle cx="741" cy="262" r="6" /></g>
        <rect width="820" height="290" fill={`url(#${uid}-fade)`} />
        <rect width="820" height="290" fill={`url(#${uid}-paper)`} />
        <path d="M148 180 C250 180 240 88 337 88 S380 218 478 198 S548 113 648 113" fill="none" stroke="#FFF" strokeWidth="17" strokeLinecap="round" />
        <path d="M148 180 C250 180 240 88 337 88 S380 218 478 198 S548 113 648 113" fill="none" stroke="#E6BD4B" strokeOpacity=".25" strokeWidth="12" strokeLinecap="round" />
        <motion.path d="M148 180 C250 180 240 88 337 88 S380 218 478 198 S548 113 648 113" fill="none" stroke={`url(#${uid}-route)`} strokeWidth="5" strokeLinecap="round" initial={false} animate={{ pathLength: 1 }} />
        <motion.path d="M148 180 C250 180 240 88 337 88 S380 218 478 198 S548 113 648 113" fill="none" stroke="#8C6510" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 15" animate={{ strokeDashoffset: animate ? [0, -64] : 0 }} transition={animate ? { duration: 5, repeat: Infinity, ease: "linear" } : { duration: 0 }} />
        <g transform={animate ? undefined : "translate(337 88)"}>
          <circle r="10" fill="#F4B400" fillOpacity=".2" />
          <circle r="5" fill="#1C1A17" stroke="#FFF" strokeWidth="2" />
          {animate && <animateMotion dur="9s" repeatCount="indefinite" path="M148 180 C250 180 240 88 337 88 S380 218 478 198 S548 113 648 113" />}
        </g>
      </svg>

      {reducedMotion === false && <ConnectionScene animate={animate} />}

      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/85 px-2.5 py-1.5 text-[10px] font-medium text-rc-ink-2 backdrop-blur-sm sm:left-5">
        <MapPin className="h-3 w-3" aria-hidden="true" />Illustrated connection
      </div>

      <div className="absolute left-[18%] top-[62%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <motion.span aria-hidden="true" className="absolute -inset-2 rounded-full border border-rc-yellow/35" animate={animate ? { scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] } : { scale: 1, opacity: 0.5 }} transition={animate ? { duration: 3.5, repeat: Infinity } : { duration: 0 }} />
        <motion.div animate={animate ? { y: [0, -4, 0], rotate: [-4, 0, -4] } : { y: 0, rotate: -4 }} transition={animate ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} className="relative flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white bg-rc-ink text-base font-bold text-rc-yellow shadow-[0_5px_16px_#1c1a1726]" aria-hidden="true">
          {initials}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-rc-yellow text-rc-ink"><BriefcaseBusiness className="h-2.5 w-2.5" /></span>
        </motion.div>
        <div data-partner-map-label className="absolute bottom-14 w-[100px] rounded-2xl border border-white bg-white/95 px-2 py-2.5 text-center shadow-[0_4px_16px_#1c1a1710] backdrop-blur-sm sm:w-[190px] sm:px-3">
          <p className="text-[9px] font-medium uppercase tracking-wider text-rc-ink-2">Your partner</p>
          <p title={partnerName} className="mt-1 line-clamp-2 break-words text-xs font-bold leading-snug text-rc-ink sm:text-sm">{partnerName}</p>
          <p title={partnerArea} className="mt-1 flex items-center justify-center gap-1 text-[10px] text-rc-ink-2 sm:text-xs"><MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" /><span className="truncate">{partnerArea}</span></p>
          <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white bg-white" />
        </div>
      </div>

      <div className="absolute left-[79%] top-[39%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="absolute -inset-2 rounded-full border border-rc-yellow/30" aria-hidden="true" />
        <motion.div animate={animate ? { y: [0, -3, 0], rotate: [3, -1, 3] } : { y: 0, rotate: 3 }} transition={animate ? { duration: 3.5, delay: 0.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} className="relative flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white bg-rc-yellow text-rc-ink shadow-[0_5px_16px_#b57f0026]">
          <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 fill-none stroke-rc-ink" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M6 14v13h20V14" fill="#FFF3CC" />
            <path d="M4 13 7 6h18l3 7H4Z" fill="#1C1A17" />
            <path d="M4 13v2a3 3 0 0 0 6 0v-2m0 0v2a3 3 0 0 0 6 0v-2m0 0v2a3 3 0 0 0 6 0v-2m0 0v2a3 3 0 0 0 6 0v-2" fill="#F4B400" />
            <path d="M10 27v-7h6v7m4-7h3v3h-3zM11 9h10" />
          </svg>
        </motion.div>
        <div data-restaurant-map-label className="absolute top-14 w-[100px] rounded-2xl border border-white bg-white/95 px-2 py-2.5 text-center shadow-[0_4px_16px_#1c1a1710] backdrop-blur-sm sm:w-[190px] sm:px-3">
          <span aria-hidden="true" className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-white bg-white" />
          <p className="text-[9px] font-medium uppercase tracking-wider text-rc-ink-2">Your restaurant</p>
          <p title={restaurant} className="mt-1 line-clamp-2 break-words text-xs font-bold leading-snug text-rc-ink sm:text-sm">{restaurant}</p>
          <p title={customerArea} className="mt-1 flex items-center justify-center gap-1 text-[10px] text-rc-ink-2 sm:text-xs"><MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" /><span className="truncate">{customerArea}</span></p>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-rc-ink sm:bottom-5 sm:right-5">
        <span className="h-1.5 w-1.5 rounded-full bg-rc-green" aria-hidden="true" />{inProgress ? "Service in progress" : "Partner connected"}
      </div>
    </div>
  );
}

/** One top panel, with an explicit order selector when multiple partners have
 * accepted. Deriving the selected record from each poll removes finished work
 * immediately and avoids mixing up partners or destinations. */
export function BookingActivityPanel({ bookings, restaurantName }: { bookings: BookingRecord[]; restaurantName?: string }) {
  const accepted = bookings.filter((b) => {
    const activity = bookingActivity(b);
    return activity != null && activity !== "waiting" && Number(b.bookingId ?? b.id) > 0;
  });
  return accepted.length ? <ConnectedBookings accepted={accepted} restaurantName={restaurantName} /> : null;
}

// Mount the visibility observer with an actual panel, including when the first
// acceptance arrives through polling after an initially waiting-only list.
function ConnectedBookings({ accepted, restaurantName }: { accepted: BookingRecord[]; restaurantName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const animate = useAmbientAnimation(ref);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = accepted.find((b) => Number(b.bookingId ?? b.id) === selectedId) ?? accepted[0];
  if (!selected) return null;

  const id = Number(selected.bookingId ?? selected.id);
  const activity = bookingActivity(selected);
  const title = activity === "in-progress" ? "Your service is in progress" : activity === "travelling" ? "Your partner is on the way" : "You’re connected to a partner";
  const partnerName = selected.professional?.user?.name?.trim() || "Your service partner";
  const serviceName = selected.service?.name || selected.serviceName || "Your booking";

  return (
    <motion.div ref={ref} data-booking-activity-panel initial={false} whileHover={animate ? { y: -2 } : undefined} className="mb-6 overflow-hidden rounded-3xl border border-rc-line bg-white shadow-[0_8px_30px_#1c1a1706]">
      <div className="bg-rc-ink px-4 py-4 text-white sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rc-yellow text-rc-ink"><Navigation className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rc-yellow">Your active booking</p>
              <h2 className="text-base font-bold leading-snug sm:text-lg">{title}</h2>
            </div>
          </div>
          <span className="mt-0.5 shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80">#{id}</span>
        </div>
        {accepted.length > 1 && (
          <div role="group" aria-label="Choose booking connection" className="mt-4 flex flex-wrap gap-2">
            {accepted.map((b) => {
              const bookingId = Number(b.bookingId ?? b.id);
              return <button key={bookingId} type="button" aria-pressed={id === bookingId} onClick={() => setSelectedId(bookingId)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${focusRing} ${id === bookingId ? "border-rc-yellow bg-rc-yellow text-rc-ink" : "border-white/20 text-white/80 hover:bg-white/10"}`}>Booking #{bookingId}</button>;
            })}
          </div>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.div key={id} initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: animate ? 0.18 : 0 }}>
          <IllustratedConnection booking={selected} animate={animate} restaurantName={restaurantName} />
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rc-line px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rc-green/10 text-rc-green"><Check className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-rc-ink">{partnerName}</p><p className="mt-0.5 truncate text-xs text-rc-ink-2">{serviceName}</p></div>
        </div>
        <a href={`#booking-${id}`} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-rc-line px-3 text-xs font-semibold text-rc-ink transition hover:border-rc-yellow hover:bg-rc-yellow-tint ${focusRing}`}>View booking<ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
        <p className="w-full text-[10px] leading-relaxed text-rc-ink-2">Area overview · Partner area is from their profile. The illustrated path does not represent a live route.</p>
      </div>
    </motion.div>
  );
}
