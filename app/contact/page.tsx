"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { contactApi, normalizeMobileNumber } from "@/src/api/api";
import {
  ArrowRightIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SpinnerIcon,
} from "@/src/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const SUPPORT_EMAIL = "support@restocare.in";
const SUPPORT_PHONE = "+91 99535 32995";
const SUPPORT_PHONE_TEL = "+919953532995";
const OFFICE_ADDRESS = "KD-180 Kohat Enclave, Pitampura, Delhi - 110034";

/**
 * Our Google Business listing (from https://share.google/kRnqQSgNksY26Zi2t):
 * "RESTO CARE (RESTRO EDGE PRIVATE LIMITED)", 180 KD, Kohat Enclave,
 * Pitampura, Delhi 110034. The embed searches the listing name centred on its
 * coordinates; directions use the place id so they land on the exact listing.
 */
const PLACE_NAME = "RESTO CARE (RESTRO EDGE PRIVATE LIMITED)";
const PLACE_ID = "ChIJGdlqO_G8aYYRPK7qaTo_z3Q";
const PLACE_LAT_LNG = "28.6964299,77.1386751";
const MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(
  `${PLACE_NAME}, 180 KD, Kohat Enclave, Pitampura, Delhi 110034`,
)}&ll=${PLACE_LAT_LNG}&z=16&output=embed`;
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(PLACE_NAME)}&destination_place_id=${PLACE_ID}`;

/** Mon–Sat 10 AM – 6 PM IST, Sunday closed. */
const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const OPEN_FROM = 10;
const OPEN_UNTIL = 18;
const HOURS_SHORT = "Mon–Sat, 10 AM – 6 PM";

const TOPICS = ["Booking help", "Partner with us", "Careers", "Something else"] as const;
type Topic = (typeof TOPICS)[number];

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" {...props} aria-hidden>
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

const ACTIONS: { Icon: Icon; title: string; value: string; note: string; href: string; external?: boolean }[] = [
  {
    Icon: PhoneIcon,
    title: "Call us",
    value: SUPPORT_PHONE,
    note: HOURS_SHORT,
    href: `tel:${SUPPORT_PHONE_TEL}`,
  },
  {
    Icon: WhatsAppIcon,
    title: "WhatsApp",
    value: SUPPORT_PHONE,
    note: "Usually replies in minutes",
    href: `https://wa.me/${SUPPORT_PHONE_TEL.replace("+", "")}`,
    external: true,
  },
  {
    Icon: MailIcon,
    title: "Email",
    value: SUPPORT_EMAIL,
    note: "We reply within 24 hours",
    href: `mailto:${SUPPORT_EMAIL}`,
  },
];

const QUICK_LINKS = [
  { label: "Track or cancel a booking", href: "/account/orders" },
  { label: "Refund & cancellation policy", href: "/refund-cancellation-policy" },
  { label: "Work with us", href: "/careers" },
];

/* ------------------------------ animation ------------------------------ */

const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const RISE: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const WORDS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const WORD: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const ICON_WIGGLE: Variants = {
  rest: { rotate: 0, scale: 1 },
  show: { rotate: 0, scale: 1 },
  hover: { rotate: [0, -10, 10, -5, 0], scale: 1.1, transition: { duration: 0.5 } },
};
const inView = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

const HEADLINE = "We’re here to help";

/** Whether the office is open right now, in IST. Null until mounted. */
function useOpenNow(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      const ist = new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60_000);
      const h = ist.getHours();
      setOpen(OPEN_DAYS.includes(ist.getDay()) && h >= OPEN_FROM && h < OPEN_UNTIL);
    };
    queueMicrotask(check);
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

const inputClass =
  "w-full rounded-xl border border-rc-line bg-white px-3.5 py-3 text-sm text-rc-ink outline-none transition placeholder:text-gray-400 focus:border-rc-yellow focus:ring-4 focus:ring-rc-yellow/20 disabled:opacity-50";

function Label({ htmlFor, children, optional }: { htmlFor: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-rc-ink">
      {children}
      {optional ? (
        <span className="ml-1 font-normal text-rc-muted">(optional)</span>
      ) : (
        <span className="ml-0.5 text-rc-red" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export default function ContactPage() {
  // LandingHeader expects a controlled search box; this page has no listing to filter.
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("Booking help");
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const openNow = useOpenNow();

  const mutation = useMutation({
    // The contact API has no phone field, so the number rides in the message.
    mutationFn: () =>
      contactApi.submit({
        name,
        email,
        subject: topic,
        message: `${message.trim()}\n\nPhone: +91 ${normalizeMobileNumber(phone)}`,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(normalizeMobileNumber(phone))) {
      setPhoneError("Enter a 10-digit mobile number.");
      return;
    }
    setPhoneError("");
    mutation.mutate();
  };

  return (
    <div data-theme="light" className="min-h-screen bg-white text-rc-ink">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <MotionConfig reducedMotion="user">
        <main>
          {/* ===== Hero: heading + the three fastest ways to reach us ===== */}
          <section className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(circle, #d6d8e0 1px, transparent 1.3px)",
                backgroundSize: "20px 20px",
                maskImage:
                  "radial-gradient(ellipse 85% 75% at 65% 35%, #000 25%, transparent 80%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 85% 75% at 65% 35%, #000 25%, transparent 80%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-rc-yellow-tint blur-3xl"
            />

            <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 lg:pt-16">
              <motion.div variants={STAGGER} initial="hidden" animate="show" className="max-w-2xl">
                <motion.p
                  variants={RISE}
                  className="inline-flex items-center gap-2 rounded-full bg-rc-yellow-tint px-3 py-1 text-xs font-semibold text-rc-yellow-deep"
                >
                  {/* Live open/closed status, IST */}
                  <span className="relative flex h-2 w-2" aria-hidden>
                    {openNow ? (
                      <motion.span
                        className="absolute inline-flex h-full w-full rounded-full bg-rc-green"
                        animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                    ) : null}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        openNow ? "bg-rc-green" : "bg-rc-yellow-deep"
                      }`}
                    />
                  </span>
                  {openNow === null
                    ? "Contact us"
                    : openNow
                      ? `We’re open now · ${HOURS_SHORT}`
                      : `We’re closed now · ${HOURS_SHORT}`}
                </motion.p>
                <motion.h1
                  variants={WORDS}
                  aria-label={HEADLINE}
                  className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl xl:text-6xl"
                >
                  {HEADLINE.split(" ").map((word, i) => (
                    <span key={i} aria-hidden>
                      <span className="mb-[-0.12em] inline-block overflow-hidden pb-[0.12em] align-top">
                        <motion.span variants={WORD} className="inline-block">
                          {word}
                        </motion.span>
                      </span>{" "}
                    </span>
                  ))}
                </motion.h1>
                <motion.p
                  variants={RISE}
                  className="mt-4 text-[15px] leading-relaxed text-rc-muted sm:text-lg"
                >
                  Questions about a booking, a partnership or anything else? Call, WhatsApp or
                  email us, or send a message below.
                </motion.p>
              </motion.div>

              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
                className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
              >
                {ACTIONS.map(({ Icon, title, value, note, href, external }) => (
                  <motion.a
                    key={title}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                      rest: { y: 0 },
                      hover: { y: -5 },
                    }}
                    whileHover="hover"
                    whileTap={{ scale: 0.98 }}
                    className="group flex items-center gap-4 rounded-2xl border border-rc-line bg-white p-4 shadow-sm transition-shadow hover:shadow-lg sm:flex-col sm:items-start sm:p-5"
                  >
                    <motion.span
                      variants={ICON_WIGGLE}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rc-yellow-tint text-rc-yellow-deep transition-colors group-hover:bg-rc-yellow group-hover:text-rc-ink"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-rc-muted">{title}</span>
                      <span className="mt-0.5 block truncate font-bold text-rc-ink">{value}</span>
                      <span className="mt-0.5 block text-xs text-rc-muted">{note}</span>
                    </span>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-rc-muted transition-transform group-hover:translate-x-1 sm:hidden" />
                  </motion.a>
                ))}
              </motion.div>
            </div>
          </section>

          {/* ===== Form + office ===== */}
          <section className="mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6 sm:pb-20">
            <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
              {/* Form first on phones */}
              <motion.div
                {...inView}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="flex flex-col rounded-3xl border border-rc-line bg-white p-5 shadow-sm sm:p-8 lg:col-span-3"
              >
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Send us a message</h2>
                <p className="mt-1 text-sm text-rc-muted">
                  We&apos;ll get back to you within 24 hours.
                </p>

                <AnimatePresence mode="wait" initial={false}>
                  {submitted ? (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.3 }}
                      className="mt-6 flex flex-col items-center rounded-2xl bg-rc-ground/70 px-6 py-12 text-center"
                    >
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="grid h-16 w-16 place-items-center rounded-full bg-rc-green/10 text-rc-green"
                      >
                        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <motion.path
                            d="M5 12.5 10 17 19 7"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                          />
                        </svg>
                      </motion.span>
                      <p className="mt-4 text-lg font-bold">Message sent</p>
                      <p className="mt-1 max-w-sm text-sm text-rc-muted">
                        Thanks for writing to us. We&apos;ll reply within 24 hours. For anything
                        urgent, call or WhatsApp us.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          mutation.reset();
                        }}
                        className="mt-5 text-sm font-semibold text-rc-yellow-deep hover:underline"
                      >
                        Send another message
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      onSubmit={handleSubmit}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-6 flex flex-1 flex-col"
                    >
                      {/* Topic — the sliding highlight follows the chosen pill */}
                      <p className="mb-2 text-xs font-semibold text-rc-ink">What&apos;s it about?</p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
                        {TOPICS.map((t) => {
                          const active = topic === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setTopic(t)}
                              className={`relative rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                active
                                  ? "border-transparent text-rc-ink"
                                  : "border-rc-line text-rc-ink-2 hover:border-gray-300"
                              }`}
                            >
                              {active ? (
                                <motion.span
                                  layoutId="topic-pill"
                                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                                  className="absolute inset-0 rounded-full bg-rc-yellow"
                                />
                              ) : null}
                              <span className="relative">{t}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="contact-name">Your name</Label>
                          <input
                            id="contact-name"
                            type="text"
                            required
                            autoComplete="name"
                            disabled={mutation.isPending}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <Label htmlFor="contact-phone">Mobile number</Label>
                          <div className="flex">
                            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-rc-line bg-rc-ground px-3 text-sm text-rc-ink-2">
                              +91
                            </span>
                            <input
                              id="contact-phone"
                              type="tel"
                              inputMode="numeric"
                              required
                              autoComplete="tel-national"
                              maxLength={11}
                              disabled={mutation.isPending}
                              value={phone}
                              onChange={(e) => {
                                setPhone(e.target.value.replace(/[^\d ]/g, ""));
                                if (phoneError) setPhoneError("");
                              }}
                              placeholder="98765 43210"
                              aria-invalid={phoneError ? true : undefined}
                              aria-describedby={phoneError ? "contact-phone-error" : undefined}
                              className={`${inputClass} rounded-l-none ${phoneError ? "border-rc-red" : ""}`}
                            />
                          </div>
                          {phoneError ? (
                            <p id="contact-phone-error" className="mt-1 text-xs text-rc-red">
                              {phoneError}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label htmlFor="contact-email">Email address</Label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          autoComplete="email"
                          disabled={mutation.isPending}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@restaurant.com"
                          className={inputClass}
                        />
                      </div>

                      {/* Grows to fill the card next to the taller office panel */}
                      <div className="mt-4 flex flex-1 flex-col">
                        <Label htmlFor="contact-message">Message</Label>
                        <textarea
                          id="contact-message"
                          required
                          rows={5}
                          disabled={mutation.isPending}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Tell us a little more…"
                          className={`${inputClass} min-h-32 flex-1 resize-y`}
                        />
                      </div>

                      <AnimatePresence>
                        {mutation.isError ? (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            role="alert"
                            className="mt-4 overflow-hidden rounded-xl border border-rc-red/30 bg-rc-red/5 px-4 py-3 text-sm text-rc-red"
                          >
                            Your message didn&apos;t go through.{" "}
                            {(mutation.error as Error)?.message ?? "Try again, or email us directly."}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-rc-muted">
                          <span className="text-rc-red">*</span> Required
                        </p>
                        <motion.button
                          type="submit"
                          disabled={mutation.isPending}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 400, damping: 24 }}
                          className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rc-yellow px-8 text-sm font-bold text-rc-ink transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                          {mutation.isPending ? (
                            <SpinnerIcon className="h-4 w-4 animate-spin" />
                          ) : null}
                          {mutation.isPending ? "Sending…" : "Send message"}
                          {mutation.isPending ? null : (
                            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          )}
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Office: map, address, hours, quick links */}
              <motion.aside
                {...inView}
                transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
                className="flex flex-col overflow-hidden rounded-3xl border border-rc-line bg-white lg:col-span-2"
              >
                <div className="relative aspect-video w-full bg-rc-ground">
                  <iframe
                    title="RestoCare office on Google Maps"
                    src={MAP_EMBED_URL}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="flex items-start gap-2.5 text-sm">
                    <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-rc-yellow-deep" />
                    <span>
                      <span className="block text-xs text-rc-muted">Head office</span>
                      <span className="font-medium">{OFFICE_ADDRESS}</span>
                    </span>
                  </p>
                  <a
                    href={DIRECTIONS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-rc-yellow-deep hover:underline"
                  >
                    Get directions
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>

                  <div className="mt-5 border-t border-rc-line pt-5">
                    <p className="flex items-center gap-2.5 text-xs text-rc-muted">
                      <ClockIcon className="h-4 w-4 text-rc-yellow-deep" /> Business hours
                    </p>
                    <dl className="mt-2.5 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-rc-ink-2">Monday – Saturday</dt>
                        <dd className="font-medium">10:00 AM – 6:00 PM</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-rc-ink-2">Sunday</dt>
                        <dd className="font-medium">Closed</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-5 border-t border-rc-line pt-5">
                    <p className="text-xs text-rc-muted">Looking for something else?</p>
                    <ul className="mt-2 space-y-1">
                      {QUICK_LINKS.map((l) => (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            className="group flex items-center justify-between rounded-lg py-1.5 text-sm font-medium text-rc-ink transition-colors hover:text-rc-yellow-deep"
                          >
                            {l.label}
                            <ArrowRightIcon className="h-4 w-4 text-rc-muted transition-transform group-hover:translate-x-1 group-hover:text-rc-yellow-deep" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="mt-auto pt-5 text-xs text-rc-muted">
                    RestoCare is a brand operated by Restroedge Private Limited.
                  </p>
                </div>
              </motion.aside>
            </div>
          </section>
        </main>
      </MotionConfig>

      <Footer />
    </div>
  );
}
