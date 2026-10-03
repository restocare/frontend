"use client";

/**
 * Flow-2 category page for Deep Cleaning, sample design: the site's banner
 * (from the API category), a grid of the prototype's four sub-category tiles
 * that filter the list, then the packages as full-width rows grouped under a
 * heading with their pricing basis, one "Book" each. The packages are static
 * (see cleaning-packages.ts) until the backend catalogue has them.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { categoryTreeApi, queryKeys, type CategoryTreeNode } from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import {
  CLEANING_PACKAGE_COUNT,
  CLEANING_SUBS,
  type CleaningPackage,
  type CleaningSubKey,
} from "@/src/lib/booking-v2/cleaning-packages";
import {
  BadgeCheckIcon,
  ClockIcon,
  SpinnerIcon,
  WalletIcon,
} from "@/src/components/icons";
import { StorefrontShell } from "./shell";
import { CategoryBanner, type BannerTrustItem } from "./category-banner";
import {
  CANCEL_FAQ,
  FaqSection,
  GST_PERCENT,
  HelpCard,
  type Faq,
} from "./category-extras";

/** Cheapest package across every sub-category, for the banner's "From". */
const CLEANING_FROM_PRICE = Math.min(
  ...CLEANING_SUBS.flatMap((s) => s.packages.map((p) => p.price)),
);

const CLEANING_TRUST: BannerTrustItem[] = [
  { Icon: BadgeCheckIcon, label: "Trained crews" },
  { Icon: ClockIcon, label: "Slots all week" },
  { Icon: WalletIcon, label: "Online or COD" },
];

const CLEANING_FAQS: Faq[] = [
  {
    q: "How are packages priced?",
    a: `By size: fixture count for washrooms, cleanable area for kitchens, and area and seating for dining areas. A "from" price is the starting price for that size; the final price is confirmed at booking. Prices are before ${GST_PERCENT}% GST.`,
  },
  {
    q: "When can the crew come?",
    a: "Any day this week, in a morning, afternoon or evening slot.",
  },
  {
    q: "How do I pay?",
    a: "Online by UPI, card or net banking, or after the job (COD).",
  },
  {
    q: "Are the crews verified?",
    a: "Yes. Every crew member is background-checked before they take a booking.",
  },
  {
    q: "My size or area isn't listed. What now?",
    a: "Message us on WhatsApp with your outlet's size and what needs cleaning, and we'll quote it.",
  },
  CANCEL_FAQ,
];

/* ------------------------------- icons -------------------------------- */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** The prototype's four sub-category icons: washroom, kitchen, sitting, full. */
function SubIcon({ icon, className }: { icon: CleaningSubKey; className?: string }) {
  switch (icon) {
    case "washroom":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M7 3h7v8H7Z" />
          <path d="M5 11h15a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4Z" />
          <path d="M8 16v5h8v-5" />
        </svg>
      );
    case "kitchen":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M4 10 8 4h8l4 6Z" />
          <path d="M3 10h18" />
          <path d="M6 14h12M6 18h12" />
        </svg>
      );
    case "sitting":
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M3 9h18" />
          <path d="M12 9v11" />
          <path d="M8 20h8" />
          <path d="M4 21v-8M4 17h3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden>
          <path d="M3 9 5 4h14l2 5" />
          <path d="M3 9h18" />
          <path d="M4 9v11h16V9" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
  }
}

/* -------------------------------- page -------------------------------- */

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">{title}</h1>
      <p className="mt-2 text-gray-500">{text}</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Back to home
      </Link>
    </div>
  );
}

export function CleaningPageV2() {
  const params = useParams<{ id: string }>();
  const categoryId = Number(params?.id);
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [sub, setSub] = useState<string | null>(() => searchParams.get("sub"));

  const { coords } = useCurrentLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const category = useMemo<CategoryTreeNode | undefined>(
    () => data?.find((c) => c.categoryId === categoryId),
    [data, categoryId],
  );

  // The chosen tile narrows to one sub-category; the header search filters rows within.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CLEANING_SUBS.filter((s) => !sub || s.key === sub)
      .map((s) => ({
        ...s,
        packages: q
          ? s.packages.filter(
              (p) => p.name.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q),
            )
          : s.packages,
      }))
      .filter((s) => s.packages.length > 0);
  }, [sub, search]);
  const shownCount = shown.reduce((n, s) => n + s.packages.length, 0);
  const current = sub ? CLEANING_SUBS.find((s) => s.key === sub) : undefined;

  const pickSub = (key: string | null) => {
    setSub(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set("sub", key);
    else url.searchParams.delete("sub");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <StorefrontShell search={search} onSearchChange={setSearch}>
      <main className="bg-white">
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center text-gray-400">
            <SpinnerIcon className="h-7 w-7" />
          </div>
        ) : isError || !category ? (
          <Empty
            title={isError ? "Something went wrong" : "Category not found"}
            text={
              isError
                ? "We couldn’t load this category. Please try again."
                : "The category you’re looking for doesn’t exist or was removed."
            }
          />
        ) : category.comingSoon ? (
          <Empty
            title={`${category.name} is coming soon in your area`}
            text="We’re not serving this category at your location yet. Change your location, or check back soon."
          />
        ) : (
          <>
            <CategoryBanner
              category={category}
              description="Trained crews and commercial-grade cleaning for washrooms, kitchens, dining areas and whole outlets."
              price={{
                amount: CLEANING_FROM_PRICE,
                note: `${CLEANING_PACKAGE_COUNT} packages · Priced by size · Taxes extra`,
              }}
              ctaLabel="See packages"
              ctaHref="#packages"
              trust={CLEANING_TRUST}
              fallbackEmoji="🧼"
            />

            <section id="packages" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
              {/* Sub-category tiles: 2 across on phones, 4 on desktop */}
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Sub-categories</h2>
              <p className="mt-1 text-sm text-gray-500 sm:text-base">
                Pick an area to narrow the list, or browse all packages below.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" role="group" aria-label="Sub-categories">
                {CLEANING_SUBS.map((s) => {
                  const active = sub === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickSub(active ? null : s.key)}
                      className={`flex flex-col items-center gap-3 rounded-2xl border bg-white px-3 py-5 text-center transition sm:py-6 ${
                        active
                          ? "border-rc-yellow ring-2 ring-rc-yellow-tint"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      <span
                        className={`grid h-14 w-14 place-items-center rounded-2xl ${
                          active ? "bg-rc-yellow text-gray-900" : "bg-rc-yellow-tint text-rc-yellow-deep"
                        }`}
                      >
                        <SubIcon icon={s.key} className="h-7 w-7" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug sm:text-base">{s.name}</span>
                        <span className="mt-1 block text-xs text-gray-500">{s.meta}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* How booking works: the wizard's three steps */}
              <ol className="mt-8 grid list-none grid-cols-1 gap-3 rounded-2xl bg-white p-2 ring-1 ring-gray-200 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-gray-100">
                {[
                  ["Pick a package", "Choose the size that matches your outlet."],
                  ["Choose date and slot", "Any day this week, morning, afternoon or evening."],
                  ["Crew arrives", "Confirm the address and pay online or after the job."],
                ].map(([title, text], i) => (
                  <li key={title} className="flex items-start gap-3 px-3 py-2.5 sm:px-5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rc-yellow text-xs font-bold text-gray-900">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-gray-500">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>

              {/* Package cards */}
              <div className="mt-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {current ? current.title : "All services"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 sm:text-base">
                    {current
                      ? `${current.basis}. Prices before tax.`
                      : "Prices before tax. Starting prices are the minimum for that size."}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {search.trim() ? (
                    <span>
                      {shownCount} of {CLEANING_PACKAGE_COUNT} match “{search.trim()}”
                    </span>
                  ) : null}
                  {sub ? (
                    <button
                      type="button"
                      onClick={() => pickSub(null)}
                      className="font-semibold text-rc-yellow-deep hover:underline"
                    >
                      Show all
                    </button>
                  ) : null}
                </div>
              </div>

              {shown.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
                  <p className="text-4xl">🗂️</p>
                  <p className="mt-3 text-sm text-gray-500">No packages match your search.</p>
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-8">
                  {shown.map((s) => (
                    <section key={s.key} aria-labelledby={`sub-${s.key}`}>
                      {/* With one sub-category chosen its title is already the page heading. */}
                      <div className={`mb-3 flex items-baseline justify-between gap-3 ${sub ? "sr-only" : ""}`}>
                        <h3 id={`sub-${s.key}`} className="text-lg font-bold tracking-tight">
                          {s.title}
                        </h3>
                        <p className="m-0 text-sm text-gray-500">{s.basis}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {s.packages.map((p) => (
                          <PackageCard key={p.id} pkg={p} icon={s.key} />
                        ))}
                        {/* Fills the row's empty slots: sizes not on the list */}
                        <HelpCard
                          cardCount={s.packages.length}
                          columns={{ sm: 2, lg: 3, xl: 4 }}
                          title="Need a different size?"
                          text="Send us your outlet's size and we'll quote it."
                          whatsappText={`Hi, I need a deep cleaning quote for ${s.name.toLowerCase()} on RestoCare.`}
                          gapsOnly
                        />
                      </div>
                      {s.note ? <p className="m-0 mt-4 text-sm text-gray-500">{s.note}</p> : null}
                    </section>
                  ))}
                </div>
              )}
            </section>

            <FaqSection intro="Everything about booking a deep clean." faqs={CLEANING_FAQS} />
          </>
        )}
      </main>
    </StorefrontShell>
  );
}

function PackageCard({ pkg, icon }: { pkg: CleaningPackage; icon: CleaningSubKey }) {
  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-md">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-rc-yellow-tint text-rc-yellow-deep">
        <SubIcon icon={icon} className="h-6 w-6" />
      </span>
      <h4 className="m-0 mt-4 text-base font-bold leading-snug">{pkg.name}</h4>
      <p className="m-0 mt-1 text-sm text-gray-500">{pkg.spec}</p>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="m-0">
          {pkg.from ? <span className="block text-xs font-medium text-gray-500">from</span> : null}
          <span className="block text-2xl font-bold leading-none tracking-tight tabular-nums">
            {formatInr(pkg.price)}
          </span>
          <span className="mt-1 block text-xs text-gray-500">before tax</span>
        </p>
        {/* Sample design: booking connects once these packages are in the catalogue. */}
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center rounded-full bg-rc-yellow px-5 text-sm font-bold text-gray-900 transition hover:brightness-95"
        >
          Book
        </button>
      </div>
    </article>
  );
}
