"use client";

import { useRef, useState, type ComponentType, type SVGProps } from "react";
import Image from "next/image";
import {
  MotionConfig,
  motion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import {
  ArrowRightIcon,
  ClockIcon,
  GraduationCapIcon,
  MailIcon,
  MapPinIcon,
  TrendUp,
  UsersIcon,
  WalletIcon,
} from "@/src/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Opening {
  id: string;
  title: string;
  team: string;
  type: string;
  location: string;
  blurb: string;
  /** What the role does day to day. */
  duties: string[];
}

const OPENINGS: Opening[] = [
  {
    id: "ops-executive",
    title: "Operations Executive",
    team: "Operations",
    type: "Full-time",
    location: "Pitampura, Delhi",
    blurb:
      "Coordinate bookings, vendors and dispatch to keep service delivery running smoothly across the city.",
    duties: [
      "Assign incoming bookings to the right professional",
      "Track every job from booking to completion",
      "Coordinate with vendors and partners on schedules",
    ],
  },
  {
    id: "field-supervisor",
    title: "Field Service Supervisor",
    team: "Field service",
    type: "Full-time",
    location: "Delhi NCR",
    blurb:
      "Lead on-ground technician teams, ensure quality standards and resolve escalations at customer sites.",
    duties: [
      "Lead and support technician teams on site",
      "Run quality checks on completed jobs",
      "Resolve customer escalations in person",
    ],
  },
  {
    id: "customer-support",
    title: "Customer Support Associate",
    team: "Support",
    type: "Full-time",
    location: "Pitampura, Delhi",
    blurb:
      "Be the voice of RestoCare — handle queries over call, chat and WhatsApp with empathy and speed.",
    duties: [
      "Answer customer queries on call, chat and WhatsApp",
      "Help customers book, reschedule and cancel",
      "Pass issues to operations and follow up",
    ],
  },
  {
    id: "business-dev",
    title: "Business Development Manager",
    team: "Sales",
    type: "Full-time",
    location: "Delhi NCR",
    blurb: "Onboard restaurants and partners, build relationships and grow our service network.",
    duties: [
      "Bring new restaurants onto RestoCare",
      "Onboard service partners in new areas",
      "Build long-term relationships with key accounts",
    ],
  },
];

const PERKS: { Icon: Icon; title: string; text: string }[] = [
  { Icon: TrendUp, title: "Fast growth", text: "Grow with a startup that's scaling across Delhi NCR." },
  { Icon: UsersIcon, title: "Great team", text: "A supportive, hands-on team that helps each other out." },
  { Icon: GraduationCapIcon, title: "Learning", text: "Build real skills on the job, from day one." },
  { Icon: WalletIcon, title: "Fair pay", text: "Competitive pay for the work you put in." },
];

const PROCESS = [
  { title: "Apply", text: "Email us your résumé with the role in the subject line." },
  { title: "Quick call", text: "If your profile fits, we call you to talk about the role." },
  { title: "Meet the team", text: "An interview with the people you'd work with." },
  { title: "Offer", text: "We share the offer and your joining date." },
];

const HR_EMAIL = "support@restocare.in";

function applyHref(role: string): string {
  const subject = encodeURIComponent(`Application: ${role}`);
  const body = encodeURIComponent(
    "Hi RestoCare team,\n\nI'd like to apply for this role.\n\nName:\nPhone:\nCurrent city:\nYears of experience:\n\nMy résumé is attached.\n",
  );
  return `mailto:${HR_EMAIL}?subject=${subject}&body=${body}`;
}

/* Page-load reveal for the hero copy. */
const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const RISE: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
/* Sections reveal once as they scroll into view. */
const inView = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

/* Headline: each word slides up out of its own clipped line. */
const WORDS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const WORD: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/* Cards whose icon wiggles when the card is hovered. */
const ICON_WIGGLE: Variants = {
  rest: { rotate: 0, scale: 1 },
  hover: { rotate: [0, -10, 10, -5, 0], scale: 1.1, transition: { duration: 0.5 } },
};

const HEADLINE = "Build the future of restaurant services";

export default function CareersPage() {
  // LandingHeader expects a controlled search box; this page has no listing to filter.
  const [search, setSearch] = useState("");

  // Hero photo drifts slower than the page as you scroll past it.
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  return (
    <div data-theme="light" className="min-h-screen bg-white text-rc-ink">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <MotionConfig reducedMotion="user">
        <main>
          {/* ===== Hero ===== */}
          <section ref={heroRef} className="relative overflow-hidden">
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

            <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-20">
              <motion.div variants={STAGGER} initial="hidden" animate="show">
                <motion.p
                  variants={RISE}
                  className="inline-flex items-center gap-2 rounded-full bg-rc-yellow-tint px-3 py-1 text-xs font-semibold text-rc-yellow-deep"
                >
                  {/* Live "hiring now" pulse */}
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-rc-yellow-deep"
                      animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rc-yellow-deep" />
                  </span>
                  We&apos;re hiring · {OPENINGS.length} open roles
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
                  className="mt-4 max-w-lg text-[15px] leading-relaxed text-rc-muted sm:text-lg"
                >
                  Every day, our team connects restaurants with trusted chefs, helpers and
                  technicians. Join us in operations, field service, support or sales.
                </motion.p>

                <motion.div
                  variants={RISE}
                  className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  <motion.a
                    href="#openings"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rc-yellow px-7 text-sm font-bold text-rc-ink shadow-md shadow-rc-yellow/25 transition-[filter] hover:brightness-95"
                  >
                    See open roles
                    <motion.span
                      className="flex"
                      animate={{ y: [0, 3, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ArrowRightIcon className="h-4 w-4 rotate-90" />
                    </motion.span>
                  </motion.a>
                  <a
                    href={`mailto:${HR_EMAIL}?subject=${encodeURIComponent("General Application")}`}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-rc-line bg-white px-7 text-sm font-semibold text-rc-ink transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <MailIcon className="h-4 w-4" />
                    Send your résumé
                  </a>
                </motion.div>

                <motion.ul
                  variants={RISE}
                  className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-rc-ink-2"
                >
                  <li className="flex items-center gap-1.5">
                    <MapPinIcon className="h-4 w-4 text-rc-yellow-deep" /> Delhi NCR
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ClockIcon className="h-4 w-4 text-rc-yellow-deep" /> Full-time roles
                  </li>
                  <li className="flex items-center gap-1.5">
                    <UsersIcon className="h-4 w-4 text-rc-yellow-deep" /> 4 teams hiring
                  </li>
                </motion.ul>
              </motion.div>

              {/* Team photo on a tinted card offset behind it; drifts on scroll */}
              <motion.div style={{ y: photoY }} className="relative w-full">
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                  className="relative"
                >
                  <motion.div
                    aria-hidden
                    initial={{ opacity: 0, x: 0, y: 0 }}
                    animate={{ opacity: 1, x: 10, y: 10 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 rounded-2xl bg-rc-yellow-tint ring-1 ring-rc-yellow/30"
                  />
                  <motion.div
                    whileHover="zoom"
                    className="relative aspect-2/1 overflow-hidden rounded-2xl bg-rc-ground shadow-sm ring-1 ring-rc-line"
                  >
                    <motion.div
                      variants={{ zoom: { scale: 1.04 } }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <Image
                        src="/verified-providers.png"
                        alt="The RestoCare team: chefs, waiters and housekeeping staff with a supervisor"
                        fill
                        preload
                        sizes="(min-width: 1024px) 640px, 100vw"
                        className="object-cover"
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </section>

          {/* ===== Why work with us ===== */}
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
            <motion.div {...inView} transition={{ duration: 0.45, ease: "easeOut" }}>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why work with us</h2>
              <p className="mt-2 max-w-xl text-sm text-rc-muted sm:text-base">
                A small, fast-moving team where your work shows up in real kitchens every day.
              </p>
            </motion.div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {PERKS.map(({ Icon, title, text }, i) => (
                <motion.div
                  key={title}
                  {...inView}
                  transition={{ duration: 0.4, delay: i * 0.07, ease: "easeOut" }}
                >
                  <motion.div
                    initial="rest"
                    animate="rest"
                    whileHover="hover"
                    variants={{ rest: { y: 0 }, hover: { y: -5 } }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className="group h-full rounded-2xl border border-rc-line bg-white p-4 transition-shadow hover:shadow-lg sm:p-5"
                  >
                    <motion.span
                      variants={ICON_WIGGLE}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-rc-yellow-tint text-rc-yellow-deep transition-colors group-hover:bg-rc-yellow group-hover:text-rc-ink"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.span>
                    <p className="mt-4 font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-rc-muted">{text}</p>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ===== Open roles ===== */}
          <section id="openings" className="bg-rc-ground/60 py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <motion.div
                {...inView}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
              >
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Open roles</h2>
                  <p className="mt-2 text-sm text-rc-muted sm:text-base">
                    Found a role that fits? Apply by email, it takes two minutes.
                  </p>
                </div>
                <p className="text-sm font-medium text-rc-ink-2">
                  {OPENINGS.length} positions
                </p>
              </motion.div>

              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                {OPENINGS.map((o, i) => (
                  <motion.article
                    key={o.id}
                    {...inView}
                    transition={{ duration: 0.4, delay: (i % 2) * 0.08, ease: "easeOut" }}
                    whileHover={{ y: -4 }}
                    className="flex flex-col rounded-2xl border border-rc-line bg-white p-5 transition-shadow hover:shadow-lg sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rc-yellow-tint px-2.5 py-0.5 text-xs font-semibold text-rc-yellow-deep">
                        {o.team}
                      </span>
                      <span className="rounded-full bg-rc-ground px-2.5 py-0.5 text-xs font-medium text-rc-ink-2">
                        {o.type}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold tracking-tight sm:text-xl">{o.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-rc-muted">
                      <MapPinIcon className="h-4 w-4 shrink-0" /> {o.location}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-rc-ink-2">{o.blurb}</p>

                    <p className="mt-4 text-xs font-semibold text-rc-ink">What you&apos;ll do</p>
                    <ul className="mt-2 space-y-1.5">
                      {o.duties.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-rc-muted">
                          <span
                            aria-hidden
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rc-yellow"
                          />
                          {d}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex flex-1 items-end border-t border-rc-line pt-4">
                      <motion.a
                        href={applyHref(o.title)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        className="group/btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rc-yellow px-6 text-sm font-bold text-rc-ink transition-[filter] hover:brightness-95 sm:w-auto"
                      >
                        Apply now
                        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                      </motion.a>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          {/* ===== Hiring process ===== */}
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
            <motion.h2
              {...inView}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              How hiring works
            </motion.h2>
            <ol className="mt-8 grid list-none grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {PROCESS.map((s, i) => (
                <motion.li
                  key={s.title}
                  {...inView}
                  transition={{ duration: 0.4, delay: i * 0.12, ease: "easeOut" }}
                  className="relative overflow-hidden rounded-2xl border border-rc-line bg-white p-4 sm:p-5"
                >
                  {/* Progress line fills step by step, left to right */}
                  <motion.span
                    aria-hidden
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.25 + i * 0.18, ease: "easeOut" }}
                    className="absolute inset-x-0 top-0 h-1 origin-left bg-rc-yellow"
                  />
                  <motion.span
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.2 + i * 0.18 }}
                    className="grid h-9 w-9 place-items-center rounded-full bg-rc-yellow text-sm font-bold text-rc-ink"
                  >
                    {i + 1}
                  </motion.span>
                  <p className="mt-4 font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-rc-muted">{s.text}</p>
                </motion.li>
              ))}
            </ol>
          </section>

          {/* ===== General application ===== */}
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
            <motion.div
              {...inView}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative overflow-hidden rounded-3xl bg-rc-ink px-6 py-10 text-center sm:px-12 sm:py-14 lg:flex lg:items-center lg:justify-between lg:text-left"
            >
              {/* Slow drifting glow */}
              <motion.div
                aria-hidden
                animate={{ x: [0, -60, 0], y: [0, 40, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rc-yellow/25 blur-3xl"
              />
              <div className="relative">
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Don&apos;t see the right role?
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/70 sm:text-base lg:mx-0">
                  Send us your résumé anyway. We&apos;ll reach out when something opens up.
                </p>
              </div>
              <motion.a
                href={`mailto:${HR_EMAIL}?subject=${encodeURIComponent("General Application")}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="relative mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rc-yellow px-7 text-sm font-bold text-rc-ink transition-[filter] hover:brightness-95 lg:mt-0"
              >
                <MailIcon className="h-4 w-4" />
                Email your résumé
              </motion.a>
            </motion.div>
          </section>
        </main>
      </MotionConfig>

      <Footer />
    </div>
  );
}
