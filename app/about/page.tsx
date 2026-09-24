import type { Metadata } from "next";
import Link from "next/link";
import { AboutShell } from "./_about-shell";

export const metadata: Metadata = {
  title: { absolute: "About RestoCare" },
  description:
    "RestoCare, operated by Restroedge Private Limited, helps restaurants across Delhi NCR book verified staff, deep cleaning and kitchen supplies — and cut downtime.",
  alternates: {
    canonical: "https://www.restocare.in/about",
  },
  openGraph: {
    title: "About RestoCare",
    description:
      "RestoCare, operated by Restroedge Private Limited, helps restaurants across Delhi NCR book verified staff, deep cleaning and kitchen supplies — and cut downtime.",
    url: "https://www.restocare.in/about",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";

interface CategoryNode {
  categoryId: number;
  name: string;
  isPublished?: boolean;
}

async function fetchCategories(): Promise<CategoryNode[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/catagories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<CategoryNode[]>;
  } catch {
    return [];
  }
}

function findCategoryHref(categories: CategoryNode[], namePart: string): string {
  const match = categories.find(
    (c) =>
      c.isPublished !== false &&
      c.name.trim().toLowerCase().includes(namePart.toLowerCase()),
  );
  return match ? `/category/${match.categoryId}` : "/#categories";
}

// ─── Icons (inline SVG, no emoji) ─────────────────────────────────────────────

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3" />
      <path d="M17.5 14.5c.83.17 1.5.94 1.5 1.93V18h2v-2c0-1.66-2.33-3-4.5-3z" />
      <circle cx="9" cy="8" r="4" />
      <path d="M3 18v-1.07A6 6 0 019 11a6 6 0 016 5.93V18" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v3M12 18v3M3 12H6M18 12h3" />
      <path d="M5.636 5.636l2.122 2.122M16.243 16.243l2.121 2.121M16.243 7.757l2.121-2.121M5.636 18.364l2.122-2.121" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.restocare.customer";
const APP_STORE_URL =
  "https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Pick a service",
    body: "Browse our catalogue and choose the service your kitchen needs — staffing, deep cleaning or supplies.",
    Icon: SearchIcon,
  },
  {
    step: "2",
    title: "Choose your option",
    body: "Select the shift length or service variant that fits — a 5-hour shift, a full day, a specific cleaning package.",
    Icon: ListIcon,
  },
  {
    step: "3",
    title: "Pick a date and time",
    body: "Choose when you need the service. We show you available slots in real time.",
    Icon: CalendarIcon,
  },
  {
    step: "4",
    title: "Review and pay",
    body: "Confirm the booking, pay securely, and we handle the rest — from dispatching the professional to tracking the job.",
    Icon: CreditCardIcon,
  },
];

export default async function AboutPage() {
  const categories = await fetchCategories();
  const chefHref = findCategoryHref(categories, "chef");
  const helpersHref = findCategoryHref(categories, "helper");
  const cleaningHref = findCategoryHref(categories, "deep cleaning");

  const SERVICES = [
    {
      Icon: UsersIcon,
      title: "Restaurant Staffing",
      body: "Book verified chefs, kitchen helpers and waiters by the shift — from a 5-hour slot to a full week. Cover peak periods, staff shortages and special events.",
      href: chefHref !== helpersHref ? chefHref : "/#categories",
      cta: "Browse staffing services",
      accent: "bg-orange-50 text-orange-600 ring-orange-200",
    },
    {
      Icon: SparkleIcon,
      title: "Commercial Kitchen Deep Cleaning",
      body: "Professional deep cleaning for restaurant kitchens: hood and duct cleaning, floor scrubbing, equipment sanitizing, grease trap service and more.",
      href: cleaningHref,
      cta: "Browse cleaning services",
      accent: "bg-blue-50 text-blue-600 ring-blue-200",
    },
    {
      Icon: BoxIcon,
      title: "Cleaning Chemicals & Supplies",
      body: "Food-safe degreasers, sanitizers and cleaning chemicals for commercial kitchens, supplied in bulk to restaurants across Delhi NCR.",
      href: "/products",
      cta: "Browse products",
      accent: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    },
  ];

  return (
    <AboutShell>
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-gray-100 bg-white px-4 py-16 text-gray-900 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-600">
              About RestoCare
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">
              India&apos;s restaurant service marketplace
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm text-gray-600 sm:text-lg sm:leading-relaxed">
              Designed to help restaurants reduce downtime, improve operations
              and stop revenue loss — by making it easy to book verified staff,
              deep cleaning and kitchen supplies across Delhi NCR.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/#categories"
                className="rounded-full bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
              >
                Browse services
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                Get in touch
              </Link>
            </div>
          </div>
        </section>

        {/* ── What we offer ────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              What you can book today
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
              Everything delivered to your restaurant in Delhi NCR — staffed,
              cleaned and stocked.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {SERVICES.map(({ Icon, title, body, href, cta, accent }) => (
              <div
                key={title}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div
                  className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${accent}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-bold text-gray-900">
                  {title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-gray-600">
                  {body}
                </p>
                <Link
                  href={href}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 transition hover:text-orange-700"
                >
                  {cta}
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="bg-gray-50 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                How it works
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
                Book a service in minutes — online, on mobile or on the app.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map(({ step, title, body, Icon }) => (
                <div
                  key={step}
                  className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                      {step}
                    </span>
                    <Icon className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── App download ─────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-3xl bg-[#0A192F] px-8 py-12 text-white sm:px-12">
            <div className="max-w-xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-400">
                Mobile app
              </p>
              <h2 className="text-xl font-bold tracking-tight sm:text-3xl">
                Manage your bookings on the go
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Track bookings, manage schedules and stay in touch with our
                team — all from your phone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Google Play
                </a>
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  App Store
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Company ──────────────────────────────────────────────────────── */}
        <section className="border-t border-gray-100 bg-gray-50 px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-lg font-bold text-gray-900 sm:text-2xl">
              About the company
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-600">
              RestoCare is a brand operated by{" "}
              <span className="font-semibold text-gray-900">
                Restroedge Private Limited
              </span>
              , a company dedicated to building infrastructure that makes it
              easier for restaurants across India to operate efficiently. We
              are headquartered in Delhi and currently serve restaurants across
              Delhi NCR.
            </p>

            {/*
              TODO (founders only — block this section from going live until filled):
              ─────────────────────────────────────────────────────────────────────
              1. FOUNDING STORY: Add 2–3 sentences about how and why RestoCare
                 was started. What problem did the founders see? What was the
                 moment that made them build this?

              2. FOUNDER / TEAM: Add founder name(s), title(s) and a portrait
                 photo. If the team is larger, a team grid section would work well
                 here, matching the /careers perks grid style.

              3. RESTAURANT COUNT: Confirm the number of restaurants onboarded
                 before publishing any stat. Do NOT use the unverified "150+"
                 figure from the stats band. Once confirmed, add a line like:
                 "We have onboarded [N]+ restaurants to date."

              4. COMPANY DETAILS: Add a small "Company details" block with GSTIN
                 and CIN (for legal transparency — standard for Indian B2B
                 platforms). Example layout:
                   Registered name: Restroedge Private Limited
                   CIN: U[...]
                   GSTIN: [...]
              ─────────────────────────────────────────────────────────────────────
              While any of the above are open, this block should remain a plain
              paragraph (as above). Remove this TODO comment only when all four
              are addressed.
            */}

            <div className="mt-8 inline-flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="rounded-full bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
              >
                Contact us
              </Link>
              <Link
                href="/careers"
                className="rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                We&apos;re hiring
              </Link>
            </div>
          </div>
        </section>
      </main>
    </AboutShell>
  );
}
