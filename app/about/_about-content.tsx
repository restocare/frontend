"use client";

import { useRef, type ComponentType, type SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MotionConfig,
  motion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BuildingIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "@/src/components/icons";
import { PhoneScreens } from "@/src/components/landing/phone-screens";
import { SHOW_PRODUCTS } from "@/src/lib/features";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.restocare.customer";
const APP_STORE_URL =
  "https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148";

/* -------------------------------- icons -------------------------------- */

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Spray bottle — cleaning (the old sparkle icon read as a loading spinner). */
function SprayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props} aria-hidden>
      <path d="M8 9h6v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9Z" />
      <path d="M9 9V6h4v3" />
      <path d="M13 6h3l2 2" />
      <path d="M19 4.5h.01M20.5 7h.01M19 9.5h.01" />
    </svg>
  );
}

function BoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props} aria-hidden>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function GooglePlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props} aria-hidden>
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

function AppStoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" {...props} aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

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
  show: { transition: { staggerChildren: 0.06 } },
};
const WORD: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const ICON_WIGGLE: Variants = {
  rest: { rotate: 0, scale: 1 },
  hover: { rotate: [0, -10, 10, -5, 0], scale: 1.1, transition: { duration: 0.5 } },
};
const inView = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

const HEADLINE = "India’s restaurant service marketplace";

/* -------------------------------- content ------------------------------- */

const PROBLEMS: { Icon: Icon; problem: string; fix: string }[] = [
  {
    Icon: UsersIcon,
    problem: "A cook doesn’t turn up",
    fix: "Book a verified chef or helper by the hour, for the shift you need.",
  },
  {
    Icon: SprayIcon,
    problem: "The kitchen needs a deep clean",
    fix: "Schedule a trained cleaning crew for the area and size you have.",
  },
  {
    Icon: WrenchIcon,
    problem: "Equipment breaks mid-service",
    fix: "Get an electrician, plumber or technician sent to your outlet.",
  },
];

const STEPS = [
  { title: "Pick a service", text: "Staffing, deep cleaning or a repair — choose what your restaurant needs." },
  { title: "Choose when and where", text: "Set the date, time and address for the job." },
  { title: "Confirm and pay", text: "Pay online or COD. A verified professional is assigned." },
];

export function AboutContent({
  staffingHref,
  cleaningHref,
  repairsHref,
}: {
  staffingHref: string;
  cleaningHref: string;
  repairsHref: string;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const mosaicY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  const services: { Icon: Icon; title: string; body: string; href: string; cta: string }[] = [
    {
      Icon: UsersIcon,
      title: "Restaurant staffing",
      body: "Verified chefs, kitchen helpers and waiters, booked by the hour for peak periods, staff shortages and events.",
      href: staffingHref,
      cta: "Browse staffing",
    },
    {
      Icon: SprayIcon,
      title: "Kitchen deep cleaning",
      body: "Trained crews for washrooms, kitchens, dining areas and whole outlets, priced by size.",
      href: cleaningHref,
      cta: "Browse cleaning",
    },
    {
      Icon: WrenchIcon,
      title: "Maintenance and repairs",
      body: "Electricians, plumbers and technicians for wiring, equipment and installations at your outlet.",
      href: repairsHref,
      cta: "Browse repairs",
    },
    ...(SHOW_PRODUCTS
      ? [
          {
            Icon: BoxIcon,
            title: "Cleaning chemicals and supplies",
            body: "Food-safe degreasers, sanitizers and cleaning chemicals for commercial kitchens, in bulk.",
            href: "/products",
            cta: "Browse products",
          },
        ]
      : []),
  ];

  return (
    <MotionConfig reducedMotion="user">
      <main className="text-rc-ink">
        {/* ===== Hero ===== */}
        <section ref={heroRef} className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, #d6d8e0 1px, transparent 1.3px)",
              backgroundSize: "20px 20px",
              maskImage: "radial-gradient(ellipse 85% 75% at 65% 35%, #000 25%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 85% 75% at 65% 35%, #000 25%, transparent 80%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-rc-yellow-tint blur-3xl"
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:py-20">
            <motion.div variants={STAGGER} initial="hidden" animate="show">
              <motion.p
                variants={RISE}
                className="inline-flex items-center gap-2 rounded-full bg-rc-yellow-tint px-3 py-1 text-xs font-semibold text-rc-yellow-deep"
              >
                <BuildingIcon className="h-3.5 w-3.5" />
                About RestoCare
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
                We help restaurants cut downtime and stop revenue loss, by making it easy to book
                verified staff, deep cleaning and repairs across Delhi NCR.
              </motion.p>

              <motion.div
                variants={RISE}
                className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <motion.a
                  href="/#categories"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rc-yellow px-7 text-sm font-bold text-rc-ink shadow-md shadow-rc-yellow/25 transition-[filter] hover:brightness-95"
                >
                  Browse services
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </motion.a>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-rc-line bg-white px-7 text-sm font-semibold text-rc-ink transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  Get in touch
                </Link>
              </motion.div>

              <motion.ul
                variants={RISE}
                className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-rc-ink-2"
              >
                <li className="flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4 text-rc-yellow-deep" /> Delhi NCR
                </li>
                <li className="flex items-center gap-1.5">
                  <BadgeCheckIcon className="h-4 w-4 text-rc-yellow-deep" /> Verified professionals
                </li>
                <li className="flex items-center gap-1.5">
                  <WalletIcon className="h-4 w-4 text-rc-yellow-deep" /> Online or COD
                </li>
              </motion.ul>
            </motion.div>

            {/* Photo mosaic: tiles reveal one after another, drift on scroll */}
            <motion.div style={{ y: mosaicY }} className="relative">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } }}
                className="grid aspect-4/3 grid-cols-2 grid-rows-2 gap-3 sm:gap-4"
              >
                {[
                  {
                    src: "/Banner/1.png",
                    alt: "A RestoCare staff member greeting customers",
                    className: "row-span-2 bg-[#e9e9e9]",
                    pos: "object-top",
                  },
                  {
                    src: "/Kitchen Equipment Repair.png",
                    alt: "A RestoCare technician repairing kitchen equipment",
                    className: "",
                    pos: "object-center",
                  },
                  {
                    src: "/HVAC Maintenance.png",
                    alt: "A RestoCare technician servicing a kitchen exhaust",
                    className: "",
                    pos: "object-center",
                  },
                ].map((tile, i) => (
                  <motion.div
                    key={tile.src}
                    variants={{
                      hidden: { opacity: 0, y: 20, scale: 0.96 },
                      show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: "easeOut" } },
                    }}
                    whileHover="zoom"
                    className={`relative overflow-hidden rounded-2xl ring-1 ring-rc-line ${tile.className}`}
                  >
                    <motion.div
                      variants={{ zoom: { scale: 1.05 } }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={tile.src}
                        alt={tile.alt}
                        fill
                        preload={i === 0}
                        sizes="(min-width: 1024px) 320px, 50vw"
                        className={`object-cover ${tile.pos}`}
                      />
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ===== Why we exist ===== */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <motion.div {...inView} transition={{ duration: 0.45, ease: "easeOut" }} className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Every hour a kitchen runs short, a restaurant loses money
            </h2>
            <p className="mt-3 text-sm text-rc-muted sm:text-base">
              We built RestoCare so the everyday problems that stop a restaurant can be fixed in a
              few taps, by people you can trust.
            </p>
          </motion.div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PROBLEMS.map(({ Icon, problem, fix }, i) => (
              <motion.div
                key={problem}
                {...inView}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
              >
                <motion.div
                  initial="rest"
                  animate="rest"
                  whileHover="hover"
                  variants={{ rest: { y: 0 }, hover: { y: -5 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="group h-full rounded-2xl border border-rc-line bg-white p-5 transition-shadow hover:shadow-lg sm:p-6"
                >
                  <motion.span
                    variants={ICON_WIGGLE}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-rc-yellow-tint text-rc-yellow-deep transition-colors group-hover:bg-rc-yellow group-hover:text-rc-ink"
                  >
                    <Icon className="h-5 w-5" />
                  </motion.span>
                  <p className="mt-4 text-sm text-rc-muted line-through decoration-rc-muted/50">
                    {problem}
                  </p>
                  <p className="mt-1 font-semibold">{fix}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== What you can book ===== */}
        <section className="bg-rc-ground/60 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div {...inView} transition={{ duration: 0.45, ease: "easeOut" }}>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What you can book today</h2>
              <p className="mt-2 max-w-xl text-sm text-rc-muted sm:text-base">
                Everything your restaurant needs to stay staffed, clean and running.
              </p>
            </motion.div>

            {/* 3 cards: one row from tablet up. 4 cards: 2×2, then one row. */}
            <div
              className={`mt-8 grid grid-cols-1 gap-4 ${
                services.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
              }`}
            >
              {services.map(({ Icon, title, body, href, cta }, i) => (
                <motion.div
                  key={title}
                  {...inView}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                >
                  <motion.div
                    initial="rest"
                    animate="rest"
                    whileHover="hover"
                    variants={{ rest: { y: 0 }, hover: { y: -5 } }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className="group flex h-full flex-col rounded-2xl border border-rc-line bg-white p-5 transition-shadow hover:shadow-lg sm:p-6"
                  >
                    <motion.span
                      variants={ICON_WIGGLE}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-rc-yellow-tint text-rc-yellow-deep transition-colors group-hover:bg-rc-yellow group-hover:text-rc-ink"
                    >
                      <Icon className="h-5 w-5" />
                    </motion.span>
                    <h3 className="mt-4 font-bold tracking-tight">{title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-rc-muted">{body}</p>
                    <Link
                      href={href}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-rc-yellow-deep"
                    >
                      {cta}
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== How it works ===== */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <motion.h2
            {...inView}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            How booking works
          </motion.h2>
          <ol className="mt-8 grid list-none grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                {...inView}
                transition={{ duration: 0.4, delay: i * 0.12, ease: "easeOut" }}
                className="relative overflow-hidden rounded-2xl border border-rc-line bg-white p-5"
              >
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

        {/* ===== App ===== */}
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
          <motion.div
            {...inView}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative grid overflow-hidden rounded-3xl bg-rc-ink lg:grid-cols-[1.2fr_1fr]"
          >
            <motion.div
              aria-hidden
              animate={{ x: [0, -60, 0], y: [0, 40, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rc-yellow/25 blur-3xl"
            />
            <div className="relative px-6 py-10 sm:px-12 sm:py-14">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Manage your bookings on the go
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
                Book services, follow every job and talk to our team, all from your phone.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/15 bg-black px-4 py-2 transition hover:bg-gray-900 sm:w-44"
                >
                  <GooglePlayIcon className="h-6 w-6 shrink-0 text-white" />
                  <span className="text-left leading-tight">
                    <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                      Get it on
                    </span>
                    <span className="block text-sm font-bold text-white">Google Play</span>
                  </span>
                </a>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/15 bg-black px-4 py-2 transition hover:bg-gray-900 sm:w-44"
                >
                  <AppStoreIcon className="h-6 w-6 shrink-0 text-white" />
                  <span className="text-left leading-tight">
                    <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                      Download on the
                    </span>
                    <span className="block text-sm font-bold text-white">App Store</span>
                  </span>
                </a>
              </div>
            </div>

            {/* The live app screens, in a phone that rises out of the card */}
            <div className="relative hidden h-full min-h-80 justify-center lg:flex">
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                whileInView={{ y: 40, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute top-10 origin-top scale-[0.72] rounded-[42px] bg-gray-950 p-2.5 shadow-2xl ring-1 ring-white/10"
              >
                <div className="overflow-hidden rounded-[34px]">
                  <PhoneScreens />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ===== Company ===== */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
          <motion.div
            {...inView}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="grid gap-8 rounded-3xl border border-rc-line bg-white p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14"
          >
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">About the company</h2>
              <p className="mt-3 text-sm leading-relaxed text-rc-muted sm:text-base">
                RestoCare is a brand operated by{" "}
                <span className="font-semibold text-rc-ink">Restroedge Private Limited</span>, a
                company building the infrastructure that helps restaurants across India run
                smoothly. We are headquartered in Delhi and serve restaurants across Delhi NCR.
              </p>
              {/*
                TODO (founders only — keep this block a plain paragraph until filled):
                1. FOUNDING STORY: 2–3 sentences on how and why RestoCare started.
                2. FOUNDER / TEAM: founder name(s), title(s) and portrait photo(s).
                3. RESTAURANT COUNT: a confirmed "[N]+ restaurants onboarded" figure.
                   Do NOT use the unverified "150+" stats-band figure.
                4. COMPANY DETAILS: add CIN and GSTIN to the details list on the right.
                Remove this TODO only when all four are addressed.
              */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <motion.a
                  href="/contact"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-rc-yellow px-6 text-sm font-bold text-rc-ink transition-[filter] hover:brightness-95"
                >
                  Contact us
                </motion.a>
                <Link
                  href="/careers"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-rc-line px-6 text-sm font-semibold text-rc-ink transition-colors hover:bg-gray-50"
                >
                  We&apos;re hiring
                </Link>
              </div>
            </div>

            <dl className="space-y-4 rounded-2xl bg-rc-ground/70 p-5 text-sm sm:p-6">
              {[
                { Icon: BuildingIcon, label: "Registered name", value: "Restroedge Private Limited" },
                {
                  Icon: MapPinIcon,
                  label: "Office",
                  value: "KD-180 Kohat Enclave, Pitampura, Delhi - 110034",
                },
                { Icon: PhoneIcon, label: "Phone", value: "+91 99535 32995", href: "tel:+919953532995" },
                {
                  Icon: MailIcon,
                  label: "Email",
                  value: "support@restocare.in",
                  href: "mailto:support@restocare.in",
                },
                { Icon: ClockIcon, label: "Serving", value: "Restaurants across Delhi NCR" },
              ].map(({ Icon, label, value, href }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rc-yellow-deep" />
                  <div className="min-w-0">
                    <dt className="text-xs text-rc-muted">{label}</dt>
                    <dd className="font-medium text-rc-ink">
                      {href ? (
                        <a href={href} className="hover:underline">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </motion.div>
        </section>
      </main>
    </MotionConfig>
  );
}
