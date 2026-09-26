"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { categoryTreeApi, queryKeys, type CategoryTreeNode } from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { categoryHref } from "@/lib/category-slugs";

interface PopularCategoriesProps {
  /** Kept for backwards-compat with the landing page; clicking a tile now
   *  navigates to the category page instead of filtering in place. */
  selectedCategoryId?: number | null;
  onSelect?: (categoryId: number | null) => void;
}

/** Videos for the right-hand collage (order: video2, video3, video4, video1). */
const COLLAGE_VIDEOS = [
  "/videos/video2.mp4",
  "/videos/video3.mp4",
  "/videos/video4.mp4",
  "/videos/video1.mp4",
];

/** Emoji fallback per category name (used when a category has no image). */
const EMOJI_BY_NAME: Record<string, string> = {
  "executive chef": "👨‍🍳",
  "sous chef": "🍳",
  cdp: "🍲",
  commis: "🔪",
  steward: "🍽️",
  housekeeping: "🧹",
  "utility staff": "🧽",
  bartender: "🍸",
  chef: "👨‍🍳",
  "chef catagory": "👨‍🍳",
  "helpers & waiters": "🧑‍🍳",
  carpenter: "🔨",
  electrician: "💡",
  "pest controll": "🐜",
  "pest control": "🐜",
  technician: "🛠️",
  "deep cleaning": "🧼",
  plumber: "🚿",
  cleaning: "🧹",
  beauty: "💇",
  salon: "💅",
};

const FALLBACK_EMOJI = "🧰";

/** Trust highlights shown under the category grid to fill the card nicely. */
const HIGHLIGHTS = [
  { icon: "✅", label: "Verified Staff", sub: "Background-checked" },
  { icon: "⭐", label: "Certified Staff", sub: "Trained & certified" },
  { icon: "⚡", label: "Instant Service", sub: "Quick availability" },
];

function emojiFor(name: string): string {
  return EMOJI_BY_NAME[name.trim().toLowerCase()] ?? FALLBACK_EMOJI;
}

export function PopularCategories(_props: PopularCategoriesProps) {
  void _props;
  // Scoped to where the customer actually is: the server then flags categories
  // nobody can serve there and sends no services for them.
  const { coords } = useCurrentLocation();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const categories = data ?? [];

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
          POPULAR CATEGORIES
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">
          Choose your service category and connect with top-rated professionals near you.
        </p>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT — category card */}
        <div className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-gray-100"
                />
              ))}
            </div>
          ) : isError ? (
            <p className="py-20 text-center text-sm text-gray-500">
              Couldn’t load categories.
            </p>
          ) : categories.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-500">No categories yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {categories.map((category) => (
                <CategoryTile key={category.categoryId} category={category} />
              ))}
            </div>
          )}

          {/* Bottom highlights + CTA — fills the remaining space nicely */}
          <div className="mt-auto pt-8">
            <div className="grid grid-cols-3 gap-3">
              {HIGHLIGHTS.map((h) => (
                <div
                  key={h.label}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/80 px-2 py-4 text-center"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm ring-1 ring-gray-100">
                    {h.icon}
                  </span>
                  <span className="text-xs font-semibold text-gray-800">{h.label}</span>
                  <span className="text-[11px] leading-tight text-gray-500">{h.sub}</span>
                </div>
              ))}
            </div>

            <div className="relative mt-5 flex flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl bg-linear-to-r from-orange-500 via-orange-500 to-amber-500 px-5 py-4 text-white sm:flex-row sm:text-left">
              {/* Decorative glow circles */}
              <span
                className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -bottom-12 right-24 h-24 w-24 rounded-full bg-white/10"
                aria-hidden
              />
              <div className="relative">
                <p className="text-sm font-bold">Can’t find your service?</p>
                <p className="text-xs text-orange-50">Browse our full catalog of trusted professionals.</p>
              </div>
              <Link
                href="#services"
                className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-bold text-orange-600 shadow-sm transition hover:bg-orange-50"
              >
                Explore all
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden>
                  <path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT — video collage stretched to match the card height */}
        <div className="hidden h-full grid-cols-2 grid-rows-2 gap-4 lg:grid">
          {COLLAGE_VIDEOS.map((src, i) => (
            <CollageVideo key={i} src={src} className="min-h-56" />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryTile({ category }: { category: CategoryTreeNode }) {
  const hasImage = Boolean(category.profileImage);
  // Two ways to be "coming soon": not published anywhere yet, or published but
  // with nobody who can be dispatched to THIS customer's location.
  const comingSoon = category.isPublished === false || category.comingSoon === true;
  const soonLabel =
    category.isPublished === false
      ? "Coming soon"
      : (category.comingSoonMessage ?? "Coming soon in your area");

  const icon = (
    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition group-hover:ring-amber-200">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- external category images
        <img
          src={category.profileImage}
          alt={category.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
        />
      ) : (
        <span className="text-2xl transition duration-300 group-hover:scale-110">
          {emojiFor(category.name)}
        </span>
      )}
    </div>
  );

  if (comingSoon) {
    return (
      <div
        aria-disabled
        title={soonLabel}
        className="relative flex cursor-not-allowed flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-2 py-3.5 text-center opacity-60"
      >
        <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          Soon
        </span>
        {icon}
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-500">
          {category.name}
        </p>
        <span className="text-[10px] font-semibold text-amber-600">{soonLabel}</span>
      </div>
    );
  }

  return (
    <Link
      href={categoryHref(category.categoryId)}
      className="group flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-2 py-3.5 text-center transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/70 hover:shadow-md"
    >
      {icon}
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-700 transition group-hover:text-gray-900">
        {category.name}
      </p>
    </Link>
  );
}

function CollageVideo({ src, className }: { src: string; className?: string }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-black ring-1 ring-black/5 ${className ?? ""}`}
    >
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      {/* Soft bottom vignette so the collage reads as one polished unit */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black/25 to-transparent"
        aria-hidden
      />
    </div>
  );
}
