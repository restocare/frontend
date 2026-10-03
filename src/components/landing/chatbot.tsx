"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Lightweight support assistant.
 *
 * There's no conversational backend, so this is a guided FAQ bot: the user taps
 * a question and gets an instant answer, with a one-tap handoff to WhatsApp /
 * the right page for anything it can't resolve.
 */

const WHATSAPP_URL = "https://wa.me/919953532995";
const SUPPORT_EMAIL = "support@restocare.in";

interface Faq {
  q: string;
  /** Answer text. Optional CTA renders a button below it. */
  a: string;
  cta?: { label: string; href: string; external?: boolean };
}

const FAQS: Faq[] = [
  {
    q: "How do I book a service?",
    a: "Browse a category, pick the service you need, choose a slot and check out. You'll get a confirmation right away.",
    cta: { label: "Browse categories", href: "/#categories" },
  },
  {
    q: "Where are my orders?",
    a: "All your bookings — active and past — live in your account. You can also download invoices there.",
    cta: { label: "View my orders", href: "/account/orders" },
  },
  {
    q: "How do I get an invoice?",
    a: "Open My Orders, find the booking and tap “Download Invoice”. You can print it or save it as a PDF.",
    cta: { label: "Go to orders", href: "/account/orders" },
  },
  {
    q: "Are your staff verified?",
    a: "Yes — every professional is background-checked and certified before they take a booking.",
  },
  {
    q: "Talk to a human",
    a: "Our team is happy to help on WhatsApp or email. We usually reply within a few minutes.",
    cta: { label: "Chat on WhatsApp", href: WHATSAPP_URL, external: true },
  },
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeFaq = active != null ? FAQS[active] : null;

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-xl transition-transform hover:scale-110"
      >
        {open ? (
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83L3 20l1.17-3.5A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 flex max-h-[70vh] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          role="dialog"
          aria-label="RestoCare support"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-linear-to-r from-orange-500 to-orange-600 px-4 py-3.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
              💬
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">RestoCare Support</p>
              <p className="text-[11px] text-orange-50">Typically replies in minutes</p>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
              Hi 👋 How can we help? Pick a question below.
            </div>

            {activeFaq && (
              <>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-orange-600 px-3.5 py-2.5 text-sm font-medium text-white">
                  {activeFaq.q}
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
                  {activeFaq.a}
                  {activeFaq.cta && (
                    <div className="mt-2.5">
                      {activeFaq.cta.external ? (
                        <a
                          href={activeFaq.cta.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-full bg-orange-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                        >
                          {activeFaq.cta.label}
                        </a>
                      ) : (
                        <Link
                          href={activeFaq.cta.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex rounded-full bg-orange-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-700"
                        >
                          {activeFaq.cta.label}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quick replies */}
          <div className="border-t border-gray-100 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {FAQS.map((f, i) => (
                <button
                  key={f.q}
                  onClick={() => setActive(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active === i
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {f.q}
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-gray-400">
              Still stuck? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-orange-600">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
