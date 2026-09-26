"use client";

/**
 * Flow-2 category page for the hourly categories: the site's banner, then a
 * grid of services priced per hour whose "Book now" opens the wizard. Renders
 * `fallback` (the flow-1 page) for categories that are not booked by the
 * hour, so the switch never changes those.
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { minShiftMinutes } from "@/src/lib/booking-v2/schedule";
import { hourlyRate, saveDraft, startDraft } from "@/src/lib/booking-v2/draft";
import { isCleaningCategory } from "@/src/lib/booking-v2/cleaning";
import { useDeepCleaningFlow } from "@/src/lib/deep-cleaning-flow";
import { SpinnerIcon } from "@/src/components/icons";
import { CheckGlyph, ClockGlyph, StorefrontShell } from "./shell";
import { CleaningPageV2 } from "./cleaning-page";

/** Emoji stand-in when a service has no image. */
export function emojiForCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("chef")) return "👨‍🍳";
  if (n.includes("helper") || n.includes("waiter")) return "🧑‍🍳";
  return "🧰";
}

/** "chef" for a one-word category, else "service". */
export function categoryNoun(name: string): string {
  const trimmed = name.trim();
  return /^[A-Za-z]+$/.test(trimmed) ? trimmed.toLowerCase() : "service";
}

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

export function CategoryPageV2({ fallback }: { fallback: ReactNode }) {
  const params = useParams<{ id: string }>();
  const categoryId = Number(params?.id);
  const router = useRouter();
  const searchParams = useSearchParams();

  // The site header's search box filters this list; ?q= pre-fills it.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [openId, setOpenId] = useState<number | null>(null);

  const cleaningFlow = useDeepCleaningFlow();
  const { coords } = useCurrentLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const category = useMemo<CategoryTreeNode | undefined>(
    () => data?.find((c) => c.categoryId === categoryId),
    [data, categoryId],
  );

  const services = useMemo<CategoryTreeService[]>(() => {
    if (!category) return [];
    return [...category.services, ...category.groups.flatMap((g) => g.services)];
  }, [category]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [services, search]);

  // Deep Cleaning has its own switch (NEXT_PUBLIC_DEEP_CLEANING_FLOW): 2 shows the
  // new page, 1 keeps production's. Other non-hourly categories always keep flow 1.
  if (category && isCleaningCategory(category.name)) {
    return cleaningFlow === 2 ? <CleaningPageV2 /> : <>{fallback}</>;
  }
  if (category && !categoryUsesSlots(category.name)) return <>{fallback}</>;

  const book = (service: CategoryTreeService) => {
    if (!category) return;
    saveDraft(startDraft(service, { categoryId: category.categoryId, name: category.name }));
    router.push(`/booking/${service.serviceId}`);
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
            <section className="relative h-72 w-full overflow-hidden sm:h-96 lg:h-[26rem]">
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
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  {category.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
                  Quality-checked professionals, booked by the hour for the date and time you need.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rc-yellow px-3 py-1 text-xs font-semibold text-gray-900">
                    <CheckGlyph className="h-3.5 w-3.5" /> Verified professionals
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    <ClockGlyph className="h-3.5 w-3.5" /> Custom hours
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                    {services.length} {services.length === 1 ? "service" : "services"} available
                  </span>
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
              <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Choose a {categoryNoun(category.name)}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 sm:text-base">
                    Pick who you need. You set the date and hours on the next step.
                  </p>
                </div>
                {search.trim() ? (
                  <p className="text-sm text-gray-500">
                    {shown.length} of {services.length} match “{search.trim()}”
                  </p>
                ) : null}
              </div>

              {shown.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
                  <p className="text-4xl">🗂️</p>
                  <p className="mt-3 text-sm text-gray-500">
                    {search.trim()
                      ? "No services match your search."
                      : "No services in this category yet."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((service) => (
                    <HourlyServiceCard
                      key={service.serviceId}
                      service={service}
                      emoji={emojiForCategory(category.name)}
                      open={openId === service.serviceId}
                      onToggle={() =>
                        setOpenId(openId === service.serviceId ? null : service.serviceId)
                      }
                      onBook={() => book(service)}
                    />
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

function HourlyServiceCard({
  service,
  emoji,
  open,
  onToggle,
  onBook,
}: {
  service: CategoryTreeService;
  emoji: string;
  open: boolean;
  onToggle: () => void;
  onBook: () => void;
}) {
  const rate = hourlyRate(service);
  const minHrs = minShiftMinutes(service.variants) / 60;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        {service.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external service image
          <img
            src={service.profileImage}
            alt={service.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">{emoji}</div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold leading-tight">{service.name}</h3>

        {service.description ? (
          <p className={`mt-2 text-sm text-gray-500 ${open ? "" : "line-clamp-3"}`}>
            {service.description}
          </p>
        ) : null}

        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
            <ClockGlyph className="h-3.5 w-3.5" /> Custom hours
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
            Minimum {minHrs} hrs
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div className="min-w-0">
            {rate > 0 ? (
              <p className="flex items-baseline gap-1">
                <span className="text-2xl font-bold leading-none tracking-tight">
                  {formatInr(rate)}
                </span>
                <span className="text-sm font-medium text-gray-500">/hour</span>
              </p>
            ) : (
              <p className="text-base font-semibold">Price on request</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Taxes extra
              {service.description ? (
                <>
                  {" "}
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={onToggle}
                    className="font-semibold text-rc-yellow-deep hover:underline"
                  >
                    {open ? "Hide details" : "View details"}
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            disabled={rate <= 0}
            onClick={onBook}
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-rc-yellow px-5 text-sm font-bold text-gray-900 transition hover:brightness-95 disabled:opacity-50"
          >
            Book now
          </button>
        </div>
      </div>
    </article>
  );
}
