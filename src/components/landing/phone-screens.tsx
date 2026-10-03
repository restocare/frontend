"use client";

import { useEffect, useState } from "react";

const ACCENT = "#e2563b";
const FRAME_COUNT = 4;

/**
 * The animated UI rendered "inside" the 3D phone. Cycles through the RestoCare
 * customer booking flow and the partner lead-allocation (map) flow.
 * Self-contained, fixed 290×600 so it maps cleanly onto the phone face.
 */
export function PhoneScreens() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAME_COUNT), 2800);
    return () => clearInterval(id);
  }, []);

  const isPartner = frame >= 2;

  return (
    <div
      className="pointer-events-none flex select-none flex-col overflow-hidden rounded-[34px] bg-white font-sans text-gray-900 shadow-2xl"
      style={{ width: 290, height: 600 }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold text-gray-700">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-gray-700" />
          <span className="inline-block h-2 w-2 rounded-full bg-gray-700" />
        </span>
      </div>

      {/* App header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-2">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png"
            alt="RestoCare"
            className="h-6 w-auto object-contain"
          />
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isPartner ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
          }`}
        >
          {isPartner ? "Partner" : "Customer"}
        </span>
      </div>

      {/* Frame body (re-keyed so the entrance animation replays) */}
      <div key={frame} className="animate-fade-up flex-1 px-4">
        {frame === 0 && <CustomerSelect />}
        {frame === 1 && <CustomerConfirmed />}
        {frame === 2 && <PartnerLead />}
        {frame === 3 && <PartnerEnRoute />}
      </div>

      {/* Progress dots (demo frame indicator) */}
      <div className="flex justify-center gap-1.5 pb-2 pt-3">
        {Array.from({ length: FRAME_COUNT }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === frame ? 18 : 6,
              backgroundColor: i === frame ? ACCENT : "#d1d5db",
            }}
          />
        ))}
      </div>

      {/* App tab bar pins the bottom like a real app */}
      <TabBar active={frame === 1 ? "bookings" : "home"} />
    </div>
  );
}

/* ------------------------------ tab bar --------------------------------- */

function HomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

function BookingsGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function AccountGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}

function TabBar({ active }: { active: "home" | "bookings" | "account" }) {
  const items = [
    { key: "home", label: "Home", glyph: <HomeGlyph /> },
    { key: "bookings", label: "Bookings", glyph: <BookingsGlyph /> },
    { key: "account", label: "Account", glyph: <AccountGlyph /> },
  ] as const;

  return (
    <div className="flex items-start justify-around border-t border-gray-100 px-2 pb-5 pt-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col items-center gap-0.5"
          style={{ color: item.key === active ? ACCENT : "#9ca3af" }}
        >
          {item.glyph}
          <span className="text-[9px] font-semibold">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Customer flow ---------------------------- */

function StepPills({ active }: { active: number }) {
  const steps = ["Select", "Slot", "Confirm"];
  return (
    <div className="mb-3 flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: i <= active ? ACCENT : "#d1d5db" }}
          >
            {i + 1}
          </span>
          <span className="text-[9px] font-medium text-gray-500">{s}</span>
        </div>
      ))}
    </div>
  );
}

function CustomerSelect() {
  return (
    <div>
      <p className="mb-3 text-base font-bold">Book a service</p>
      <StepPills active={0} />
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
            🧹
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Deep Home Cleaning</p>
            <p className="text-[11px] text-gray-500">120 mins · Top rated</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: ACCENT }}>
            ₹2,499
          </span>
          <span className="flex items-center gap-1 rounded-md bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            ★ 4.8
          </span>
        </div>
      </div>
      <div className="mt-2.5 rounded-2xl border border-gray-100 bg-gray-50 p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
            👨‍🍳
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Restaurant Chef</p>
            <p className="text-[11px] text-gray-500">5 hr shift · From ₹149/hr</p>
          </div>
          <span className="flex items-center gap-1 rounded-md bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            ★ 4.9
          </span>
        </div>
      </div>
      <button
        className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        Book Now
      </button>
      <p className="mt-3 text-center text-[10px] text-gray-400">
        Verified & background-checked professionals
      </p>
    </div>
  );
}

function CustomerConfirmed() {
  return (
    <div className="pt-2 text-center">
      <StepPills active={2} />
      <div className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <p className="mt-3 text-base font-bold">Booking Confirmed!</p>
      <p className="text-[11px] text-gray-500">Deep Home Cleaning · Today, 4:00 PM</p>
      <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left">
        <p className="text-[11px] font-semibold text-gray-500">Finding your professional…</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: ACCENT }} />
        </div>
      </div>
      <div className="mt-2.5 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-600">Booking ID</span>
          <span className="text-[11px] font-bold text-gray-800">#RC-1384</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-600">Payment</span>
          <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
            Paid online
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Partner flow ----------------------------- */

function MiniMap() {
  return (
    <div className="relative h-[230px] w-full overflow-hidden rounded-2xl" style={{ background: "#e7edf2" }}>
      <svg viewBox="0 0 260 230" className="absolute inset-0 h-full w-full">
        {/* Park */}
        <rect x="160" y="20" width="90" height="70" rx="8" fill="#cfe8cf" />
        {/* Water */}
        <rect x="0" y="150" width="120" height="90" fill="#bfe0ef" />
        {/* Roads */}
        <g stroke="#ffffff" strokeWidth="7" strokeLinecap="round">
          <line x1="0" y1="70" x2="260" y2="70" />
          <line x1="0" y1="150" x2="260" y2="150" />
          <line x1="70" y1="0" x2="70" y2="230" />
          <line x1="180" y1="0" x2="180" y2="230" />
        </g>
        {/* Route */}
        <path
          id="route"
          d="M40 200 L70 200 L70 150 L180 150 L180 70 L210 50"
          fill="none"
          stroke={ACCENT}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 7"
        >
          <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.9s" repeatCount="indefinite" />
        </path>
        {/* Destination pin */}
        <g transform="translate(210 50)">
          <path d="M0 -16 C9 -16 14 -9 14 -2 C14 8 0 18 0 18 C0 18 -14 8 -14 -2 C-14 -9 -9 -16 0 -16 Z" fill={ACCENT} />
          <circle cx="0" cy="-2" r="5" fill="#fff" />
        </g>
        {/* Moving partner marker */}
        <g>
          <circle r="7" fill="#2563eb" stroke="#fff" strokeWidth="3">
            <animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto"
              path="M40 200 L70 200 L70 150 L180 150 L180 70 L210 50" />
          </circle>
        </g>
      </svg>
      <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[9px] font-semibold text-gray-600 shadow-sm">
        Live tracking
      </span>
    </div>
  );
}

function PartnerLead() {
  return (
    <div>
      <MiniMap />
      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            New lead allocated
          </span>
          <span className="text-[10px] font-semibold text-gray-400">just now</span>
        </div>
        <p className="mt-2 text-sm font-semibold">Deep Home Cleaning</p>
        <p className="text-[11px] text-gray-500">2.3 km away · Earn ₹1,800</p>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-lg border border-gray-200 py-2 text-[11px] font-semibold text-gray-500">
            Decline
          </button>
          <button
            className="flex-[2] rounded-lg py-2 text-[11px] font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Accept lead
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerEnRoute() {
  return (
    <div>
      <MiniMap />
      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg">
            🚗
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">On the way to customer</p>
            <p className="text-[11px] text-gray-500">Arriving in 8 mins · 2.3 km</p>
          </div>
          <span className="text-sm font-bold text-blue-600">ETA</span>
        </div>
      </div>
    </div>
  );
}
