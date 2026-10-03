"use client";

/**
 * Supporting content shared by every category page: a help card that fills
 * a grid's empty slots, the booking steps, and an FAQ. Each page passes its
 * own copy; the hourly copy is built here from the booking rules themselves,
 * so the page and the booking flow never disagree.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TAX_RATE } from "@/src/lib/booking-v2/pricing";
import { DAYS_AHEAD, MAX_MINUTES, SAME_DAY_LEAD } from "@/src/lib/booking-v2/schedule";
import { ChevronDownIcon } from "@/src/components/icons";

export const WHATSAPP_URL = "https://wa.me/919953532995";
export const GST_PERCENT = Math.round(TAX_RATE * 100);

/* ------------------------------ help card ------------------------------ */

const SM_SPAN: Record<number, string> = { 1: "sm:col-span-1", 2: "sm:col-span-2" };
const LG_SPAN: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};
const XL_SPAN: Record<number, string> = {
  1: "xl:col-span-1",
  2: "xl:col-span-2",
  3: "xl:col-span-3",
  4: "xl:col-span-4",
};

/** Slots left empty in the last row; a full row when the grid is already even. */
const slotsLeft = (count: number, cols: number) => (cols - (count % cols)) % cols || cols;

/**
 * Sits after the last card and spans exactly the slots left empty in the
 * last row at each breakpoint, so the grid never ends in a hole.
 */
export function HelpCard({
  cardCount,
  columns,
  title,
  text,
  whatsappText,
  gapsOnly = false,
}: {
  cardCount: number;
  /** The grid's column count per breakpoint (1 column below sm). */
  columns: { sm: number; lg: number; xl?: number };
  title: string;
  text: string;
  /** Pre-filled WhatsApp message. */
  whatsappText: string;
  /**
   * Show only where the last row has a gap; hide where the grid is already
   * even. For pages that repeat the grid several times.
   */
  gapsOnly?: boolean;
}) {
  const sm = slotsLeft(cardCount, columns.sm);
  const lg = slotsLeft(cardCount, columns.lg);
  const xl = columns.xl ? slotsLeft(cardCount, columns.xl) : null;

  const spans = [SM_SPAN[sm], LG_SPAN[lg], xl ? XL_SPAN[xl] : ""];
  if (gapsOnly) {
    // Full-row = no gap at that breakpoint. Phones (1 column) never have one.
    spans.push(
      "hidden",
      sm === columns.sm ? "sm:hidden" : "sm:flex",
      lg === columns.lg ? "lg:hidden" : "lg:flex",
      xl == null ? "" : xl === columns.xl ? "xl:hidden" : "xl:flex",
    );
  } else {
    spans.push("flex");
  }

  return (
    <div
      className={`flex-col items-center justify-center rounded-2xl border border-dashed border-rc-yellow/60 bg-rc-yellow-tint/40 px-6 py-8 text-center ${spans.join(" ")}`}
    >
      <p className="text-lg font-bold tracking-tight text-rc-ink">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-rc-ink-2">{text}</p>
      <motion.a
        href={`${WHATSAPP_URL}?text=${encodeURIComponent(whatsappText)}`}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className="mt-5 inline-flex h-10 items-center rounded-full bg-rc-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
      >
        Chat on WhatsApp
      </motion.a>
    </div>
  );
}

/* ---------------------------- booking steps ---------------------------- */

export interface Step {
  title: string;
  text: string;
}

export function BookingSteps({ steps }: { steps: Step[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How booking works</h2>
      <ol className="mt-5 grid list-none grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
            className="flex items-start gap-3 rounded-2xl border border-rc-line bg-white p-4 sm:p-5"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rc-yellow text-sm font-bold text-rc-ink">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-rc-ink">{s.title}</span>
              <span className="mt-0.5 block text-sm text-rc-muted">{s.text}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------- FAQ --------------------------------- */

export interface Faq {
  q: string;
  a: ReactNode;
}

const linkClass = "font-semibold text-rc-yellow-deep hover:underline";

/** Shared answer: cancelling from My Orders, with the policy link. */
export const CANCEL_FAQ: Faq = {
  q: "Can I cancel a booking?",
  a: (
    <>
      Yes, from{" "}
      <Link href="/account/orders" className={linkClass}>
        My Orders
      </Link>{" "}
      in your account. Any charges are set out in our{" "}
      <Link href="/refund-cancellation-policy" className={linkClass}>
        Refund &amp; Cancellation Policy
      </Link>
      .
    </>
  ),
};

export const VERIFIED_FAQ: Faq = {
  q: "Are the professionals verified?",
  a: "Yes. Every professional is background-checked before they take a booking.",
};

export function FaqSection({ intro, faqs }: { intro: string; faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Questions, answered</h2>
          <p className="mt-2 max-w-sm text-sm text-rc-muted sm:text-base">
            {intro} Still unsure?{" "}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Ask us on WhatsApp
            </a>
            .
          </p>
        </div>

        <ul className="divide-y divide-rc-line border-y border-rc-line">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="font-semibold text-rc-ink">{f.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex shrink-0 text-rc-muted"
                  >
                    <ChevronDownIcon className="h-5 w-5" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <p className="pb-4 pr-8 text-sm leading-relaxed text-rc-muted">{f.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------- hourly copy kit --------------------------- */

/** Steps for the hourly categories (Chef, Helpers & Waiter). */
export function hourlySteps(noun: string): Step[] {
  return [
    { title: `Pick a ${noun}`, text: "Choose who you need from the list above." },
    {
      title: "Choose date and hours",
      text: `Any day in the next ${DAYS_AHEAD} days, for the hours you need.`,
    },
    { title: "Confirm and pay", text: "Add your address, then pay online or COD." },
  ];
}

/** FAQ for the hourly categories, built from the booking rules. */
export function hourlyFaqs(noun: string, minHours: number): Faq[] {
  return [
    {
      q: "How many hours can I book?",
      a: `Between ${minHours} and ${MAX_MINUTES / 60} hours in one booking, in one-hour steps. You pick the start and end time.`,
    },
    {
      q: "How far ahead can I book?",
      a: `Any day in the next ${DAYS_AHEAD} days. For a booking today, the start time needs at least ${SAME_DAY_LEAD} minutes' notice.`,
    },
    {
      q: "How is the price worked out?",
      a: `Hourly rate × hours × number of people, plus ${GST_PERCENT}% GST. You see the full total before you confirm.`,
    },
    {
      q: "How do I pay?",
      a: `Online by UPI, card or net banking, or COD — cash or UPI to the ${noun} after the service.`,
    },
    VERIFIED_FAQ,
    CANCEL_FAQ,
  ];
}
