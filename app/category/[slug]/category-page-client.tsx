"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
  type CategoryTreeVariant,
} from "@/src/api/api";
import { parseVariantShift } from "@/src/lib/booking-shifts";
import { useCurrentLocation } from "@/src/lib/location";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { SpinnerIcon, StarIcon, ArrowRightIcon } from "@/src/components/icons";
import { useCart } from "@/src/lib/cart";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { useBookingFlow } from "@/src/lib/booking-flow";
import { useDeepCleaningFlow } from "@/src/lib/deep-cleaning-flow";
import { CategoryPageV2 } from "@/src/components/booking-v2/category-page-v2";
import { categoryIdForSlug } from "@/lib/category-slugs";

/** A service flattened out of the category → group → service tree. */
interface FlatService extends CategoryTreeService {
  groupName: string | null;
}

/** Emoji fallback per category name when a service has no image. */
const EMOJI_BY_NAME: Record<string, string> = {
  chef: "👨‍🍳",
  plumber: "🚿",
  electrician: "💡",
  technician: "🛠️",
  "deep cleaning": "🧼",
  "helpers & waiter": "🧑‍🍳",
  "pest controll": "🐜",
  "pest control": "🐜",
  carpenter: "🔨",
};

function emojiFor(name: string): string {
  return EMOJI_BY_NAME[name.trim().toLowerCase()] ?? "🧰";
}

function formatPrice(price: number | null): string {
  if (price == null || price <= 0) return "On request";
  return `₹${price.toLocaleString("en-IN")}`;
}

export function CategoryPageClient() {
  // Flow 2 (see src/lib/booking-flow.ts) swaps in the hourly booking page for
  // staffing categories; every other category falls back to this page.
  const flow = useBookingFlow();
  const cleaningFlow = useDeepCleaningFlow();
  return (
    <Suspense fallback={null}>
      {flow === 2 || cleaningFlow === 2 ? (
        <CategoryPageV2 fallback={<CategoryPageContent />} />
      ) : (
        <CategoryPageContent />
      )}
    </Suspense>
  );
}

function CategoryPageContent() {
  const params = useParams<{ slug: string }>();
  const categoryId = categoryIdForSlug(params?.slug ?? "");
  const searchParams = useSearchParams();

  // Pre-fill the filter when arriving from a service search (…/category/5?q=Tandoor).
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  // Location-scoped, so a category nobody can serve here arrives flagged and
  // with no services — this page then shows the flag instead of an empty list.
  const { coords } = useCurrentLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const category = useMemo<CategoryTreeNode | undefined>(
    () => data?.find((c) => c.categoryId === categoryId),
    [data, categoryId],
  );

  const services = useMemo<FlatService[]>(() => {
    if (!category) return [];
    return [
      ...category.services.map((s) => ({ ...s, groupName: null })),
      ...category.groups.flatMap((g) =>
        g.services.map((s) => ({ ...s, groupName: g.name })),
      ),
    ];
  }, [category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [services, search]);

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main>
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center text-gray-400">
            <SpinnerIcon className="h-7 w-7" />
          </div>
        ) : isError || (data && !category) ? (
          <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
            <p className="text-5xl">🔍</p>
            <h1 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900">
              {isError ? "Something went wrong" : "Category not found"}
            </h1>
            <p className="mt-2 text-gray-500">
              {isError
                ? "We couldn’t load this category. Please try again."
                : "The category you’re looking for doesn’t exist or was removed."}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              ← Back to home
            </Link>
          </div>
        ) : category && category.comingSoon ? (
          <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
            <p className="text-5xl">📍</p>
            <h1 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">
              {category.name} is coming soon in your area
            </h1>
            <p className="mt-2 text-gray-500">
              We’re not serving this category at your location yet. Change your location, or check
              back soon — we’re expanding quickly.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              ← Back to home
            </Link>
          </div>
        ) : category ? (
          <>
            {/* ===== Category banner ===== */}
            <section className="relative h-80 w-full overflow-hidden sm:h-112 lg:h-128">
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
                {/* breadcrumb */}
                <nav className="mb-3 flex items-center gap-2 text-sm text-white/80">
                  <Link href="/" className="hover:text-white">
                    Home
                  </Link>
                  <span>/</span>
                  <span className="font-medium text-white">{category.name}</span>
                </nav>

                <h1 className="text-xl font-bold tracking-tight text-white sm:text-4xl">
                  {category.name}
                </h1>
                {category.description ? (
                  <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
                    {category.description}
                  </p>
                ) : null}
                <p className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  {services.length} {services.length === 1 ? "service" : "services"} available
                </p>
              </div>
            </section>

            {/* ===== Services list ===== */}
            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
                  <p className="text-4xl">🗂️</p>
                  <p className="mt-3 text-sm text-gray-500">
                    {search
                      ? "No services match your search."
                      : "No services in this category yet."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((service) => (
                    <ServiceCard
                      key={service.serviceId}
                      service={service}
                      fallbackEmoji={emojiFor(category.name)}
                      useSlots={categoryUsesSlots(category.name)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

/** Shortest shift among a staffing service's variants, read from names like
 *  "5 Hour Shift (11 AM – 4 PM)". Week-long shifts carry no hour count. */
function shortestShiftHours(variants: CategoryTreeVariant[]): number | null {
  const hours = variants
    .map((v) => parseVariantShift(v.name).durationHours)
    .filter((h): h is number => h != null && h > 0);
  return hours.length ? Math.min(...hours) : null;
}

function ServiceCard({
  service,
  fallbackEmoji,
  useSlots,
}: {
  service: FlatService;
  fallbackEmoji: string;
  useSlots: boolean;
}) {
  const { requestAdd } = useCart();
  const router = useRouter();
  const hasImage = Boolean(service.profileImage);
  const hasVariants = service.variants.length > 0;
  const lowestVariant = hasVariants
    ? Math.min(...service.variants.map((v) => v.price))
    : null;
  const basePrice =
    service.price != null && service.price > 0 ? service.price : null;

  // Staffing categories quote a rate per hour and sell it in shifts. The base
  // price is that rate only when every shift costs more than it. A base price
  // equal to the cheapest shift is a package price and must not say "/hour".
  const isHourly =
    useSlots &&
    basePrice != null &&
    lowestVariant != null &&
    basePrice < lowestVariant;
  const minShiftHours = useSlots ? shortestShiftHours(service.variants) : null;
  const displayPrice = basePrice ?? lowestVariant;
  const showFrom = !isHourly && hasVariants && displayPrice != null;

  const book = () => {
    if (hasVariants) {
      // Open the variant picker. For slot categories it then routes
      // to the schedule step; otherwise it adds straight to the cart.
      requestAdd({
        serviceId: service.serviceId,
        name: service.name,
        price: service.price,
        profileImage: service.profileImage,
        useSlots,
        variants: service.variants,
      });
      return;
    }
    if (useSlots) {
      // Slot category, no variants — go straight to the date & shift step.
      const qs = new URLSearchParams({
        name: service.name,
        image: service.profileImage ?? "",
      });
      router.push(`/booking/${service.serviceId}?${qs.toString()}`);
      return;
    }
    // Non-slot category, no variants — instant add to cart.
    requestAdd({
      serviceId: service.serviceId,
      name: service.name,
      price: service.price,
      profileImage: service.profileImage,
      useSlots,
      variants: [],
    });
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* Image / fallback */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external service image
          <img
            src={service.profileImage as string}
            alt={service.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {fallbackEmoji}
          </div>
        )}

        {service.groupName ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700 backdrop-blur">
            {service.groupName}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-tight text-gray-900">
            {service.name}
          </h3>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">
            <StarIcon className="h-3 w-3" /> 4.8
          </span>
        </div>

        {service.description ? (
          <p className="mt-2 line-clamp-3 text-sm text-gray-500">
            {service.description}
          </p>
        ) : null}

        {/* meta row */}
        <div className="mb-4 mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {service.durationMinutes ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
              <ClockIcon className="h-3.5 w-3.5" /> {service.durationMinutes} mins
            </span>
          ) : null}
          {hasVariants ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
              {service.variants.length}{" "}
              {useSlots
                ? service.variants.length === 1
                  ? "shift"
                  : "shifts"
                : service.variants.length === 1
                  ? "option"
                  : "options"}
            </span>
          ) : null}
        </div>

        {/* price + cta */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div className="min-w-0">
            {displayPrice == null ? (
              <p className="text-base font-semibold text-gray-900">
                {formatPrice(null)}
              </p>
            ) : (
              <p className="flex items-baseline gap-1 text-gray-900">
                {showFrom ? (
                  <span className="text-sm text-gray-500">From</span>
                ) : null}
                <span className="text-2xl font-bold leading-none tracking-tight">
                  {formatPrice(displayPrice)}
                </span>
                {isHourly ? (
                  <span className="text-sm font-medium text-gray-500">/hour</span>
                ) : null}
              </p>
            )}
            {isHourly ? (
              <p className="mt-1.5 text-xs text-gray-500">
                {minShiftHours
                  ? `Minimum ${minShiftHours}-hour shift`
                  : "Booked by the shift"}
                {lowestVariant != null ? `, from ${formatPrice(lowestVariant)}` : ""}
              </p>
            ) : null}
          </div>
          <button
            onClick={book}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            {hasVariants ? "Select" : useSlots ? "Book" : "Add"}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
