"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
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

/** Videos for the right-hand collage. Must not reuse restocare-service.mp4 —
 *  that's the banner clip shown right below this section. */
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

function emojiFor(name: string): string {
  return EMOJI_BY_NAME[name.trim().toLowerCase()] ?? FALLBACK_EMOJI;
}

/** Next.js Link with framer-motion gesture props. */
const MotionLink = motion.create(Link);

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
  // Bookable tiles up top; unavailable categories move to a separate
  // "Coming soon" row instead of greying out half the grid.
  const isSoon = (c: CategoryTreeNode) =>
    c.isPublished === false || c.comingSoon === true;
  const availableCategories = categories.filter((c) => !isSoon(c));
  const comingSoonCategories = categories.filter(isSoon);

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
          Popular categories
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">
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
          ) : isError && categories.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-500">
              Couldn’t load categories.
            </p>
          ) : categories.length === 0 ? (
            <p className="py-20 text-center text-sm text-gray-500">No categories yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {/* Bookable tiles first, coming-soon tiles after — same grid style */}
              {[...availableCategories, ...comingSoonCategories].map((category) => (
                <CategoryTile key={category.categoryId} category={category} />
              ))}
            </div>
          )}

          {/* Bottom CTA — fills the remaining space nicely */}
          <div className="mt-auto pt-8">
            <div className="relative flex flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl bg-linear-to-r from-orange-500 via-orange-500 to-amber-500 px-5 py-4 text-white sm:flex-row sm:text-left">
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
  const soonLabel = "Coming soon";

  const iconContent = hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- external category images
    <img
      src={category.profileImage}
      alt={category.name}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="text-2xl">{emojiFor(category.name)}</span>
  );

  if (comingSoon) {
    return (
      <div
        aria-disabled
        title={soonLabel}
        className="relative flex cursor-not-allowed flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-2 py-3.5 text-center opacity-60"
      >
        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          {iconContent}
        </div>
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-500">
          {category.name}
        </p>
        <span className="text-[10px] font-semibold text-amber-600">{soonLabel}</span>
      </div>
    );
  }

  return (
    <MotionLink
      href={categoryHref(category.categoryId)}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={{ scale: 0.95 }}
      variants={{ rest: { y: 0 }, hover: { y: -5 } }}
      transition={{ type: "spring", stiffness: 350, damping: 22 }}
      className="group flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-2 py-3.5 text-center transition-[border-color,background-color,box-shadow] duration-200 hover:border-amber-200 hover:bg-amber-50/70 hover:shadow-lg hover:shadow-amber-100/60"
    >
      {/* Icon pops and gives a playful wiggle on hover */}
      <motion.div
        variants={{
          rest: { scale: 1, rotate: 0 },
          hover: { scale: 1.12, rotate: [0, -8, 8, -4, 0] },
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition-shadow group-hover:ring-amber-200"
      >
        {iconContent}
      </motion.div>
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-700 transition-colors group-hover:text-gray-900">
        {category.name}
      </p>
    </MotionLink>
  );
}

function CollageVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only play while on screen; metadata preload paints the first frame as a
  // stand-in poster instead of downloading whole clips up front.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-black ring-1 ring-black/5 ${className ?? ""}`}
    >
      <video
        ref={videoRef}
        src={src}
        loop
        muted
        playsInline
        preload="metadata"
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
