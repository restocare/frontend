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
import { SpinnerIcon } from "@/src/components/icons";
import { CheckGlyph, StorefrontShell } from "./shell";

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
      <main>
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
            {/* Banner, as on every category page */}
            <section className="relative h-72 w-full overflow-hidden sm:h-96 lg:h-104">
              {category.bannerVideo ? (
                <video
                  src={category.bannerVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster={category.bannerImage || category.profileImage}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- external category image
                <img
                  src={category.bannerImage || category.profileImage}
                  alt={category.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/55 to-black/30" />
              <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-8 sm:px-6">
                <nav className="mb-3 flex items-center gap-2 text-sm text-white/80" aria-label="Breadcrumb">
                  <Link href="/" className="hover:text-white">
                    Home
                  </Link>
                  <span>/</span>
                  <span className="font-medium text-white">{category.name}</span>
                </nav>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{category.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
                  Trained crews and commercial-grade cleaning for washrooms, kitchens, dining areas and whole outlets.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rc-yellow px-3 py-1 text-xs font-semibold text-gray-900">
                    <CheckGlyph className="h-3.5 w-3.5" /> {CLEANING_PACKAGE_COUNT} packages
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    Priced by size
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    Taxes extra
                  </span>
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
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
                      </div>
                      {s.note ? <p className="m-0 mt-4 text-sm text-gray-500">{s.note}</p> : null}
                    </section>
                  ))}
                </div>
              )}
            </section>
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
