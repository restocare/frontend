"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheckIcon,
  BoltIcon,
  ShieldIcon,
  StarIcon,
} from "@/src/components/icons";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.restocare.customer&pcampaignid=web_share";
const APP_STORE_URL =
  "https://apps.apple.com/in/app/restocare-stop-revenue-loss/id6787001148";

// Right-side photos from public/Banner.
const BANNER_IMAGES = ["/Banner/2.png", "/Banner/1.png", "/Banner/3.png"] as const;

interface HeroSlide {
  tagline: string;
  title: string;
  subtitle: string;
  image: string;
}

const SLIDES: HeroSlide[] = [
  {
    tagline: "Chefs by the hour",
    title: "Book a chef for just ₹149/hour",
    subtitle:
      "Indian curry, South Indian, Tandoor, Chinese and Continental chefs for your restaurant. Minimum 5-hour shift, plus GST.",
    image: BANNER_IMAGES[2],
  },
  {
    tagline: "India's trusted restaurant services app",
    title: "Skilled staff & repairs, delivered instantly",
    subtitle:
      "Book verified chefs, helpers, technicians and maintenance pros for your restaurant — on demand, near you.",
    image: BANNER_IMAGES[0],
  },
  {
    tagline: "Verified professionals at your doorstep",
    title: "Your restaurant, our care — every single day",
    subtitle:
      "From deep cleaning to kitchen equipment repair, Restocare keeps your restaurant running without a hitch.",
    image: BANNER_IMAGES[1],
  },
];

// Service highlights surfaced on the banner (Pronto-style trust strip).
const HIGHLIGHTS = [
  { Icon: BoltIcon, label: "Instant Service" },
  { Icon: BadgeCheckIcon, label: "Verified Staff" },
  { Icon: StarIcon, label: "Certified Staff" },
  { Icon: ShieldIcon, label: "Quality Assured" },
];

const SLIDE_INTERVAL_MS = 5000;

/** Render a title with the last two words highlighted in brand amber. */
function HighlightedTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const cut = Math.max(words.length - 2, 1);
  return (
    <>
      {words.slice(0, cut).join(" ")}{" "}
      <span className="text-amber-500">{words.slice(cut).join(" ")}</span>
    </>
  );
}

function Stars() {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${i < 4 ? "fill-amber-400" : "fill-amber-400/40"}`}
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

function StoreButton({
  href,
  top,
  bottom,
  icon,
}: {
  href: string;
  top: string;
  bottom: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.a
      href={href}
      target={href === "#" ? undefined : "_blank"}
      rel="noopener noreferrer"
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl bg-gray-900 px-4 py-2 shadow-lg"
    >
      {/* Brand colour sweeps in from the left on hover */}
      <motion.span
        aria-hidden
        variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="absolute inset-0 origin-left bg-rc-yellow"
      />
      {/* Text and icon turn dark ink on the yellow so they stay readable */}
      <span className="relative z-10 flex items-center gap-2.5">
        {icon}
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wide text-gray-400 transition-colors duration-200 group-hover:text-rc-ink/70">
            {top}
          </span>
          <span className="block text-sm font-bold text-white transition-colors duration-200 group-hover:text-rc-ink">
            {bottom}
          </span>
        </span>
      </span>
    </motion.a>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 512 512" className="h-6 w-6 fill-white transition-colors duration-200 group-hover:fill-rc-ink" aria-hidden>
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

function AppStoreIcon() {
  return (
    <svg viewBox="0 0 384 512" className="h-6 w-6 fill-white transition-colors duration-200 group-hover:fill-rc-ink" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (SLIDES.length < 2 || paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  const activeIndex = index % SLIDES.length;

  return (
    <section className="w-full">
      <div
        className="relative flex flex-col overflow-hidden bg-white lg:min-h-[80dvh]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Same container as every other home section, so the hero text sits
            on the page grid instead of full-bleed padding. Below lg the hero
            is content-height (no dead space); on lg it fills 80dvh. */}
        <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-end gap-x-10 gap-y-6 px-4 pt-8 sm:px-6 lg:grid-cols-2 lg:pt-12">
          <div className="self-center pb-2 lg:pb-16">
            {/* All slides stay mounted in one grid cell, so the hero keeps the
                height of the tallest slide and the page never shifts. */}
            <div className="grid">
              {SLIDES.map((slide, i) => (
                <div
                  key={i}
                  aria-hidden={i !== activeIndex}
                  className={`col-start-1 row-start-1 transition-opacity duration-700 ${
                    i === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                >
                  <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-600 sm:text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    {slide.tagline}
                  </p>

                  <h1
                    className="animate-fade-up mt-4 text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl lg:text-5xl xl:text-6xl"
                    style={{ animationDelay: "0.08s" }}
                  >
                    <HighlightedTitle title={slide.title} />
                  </h1>

                  <p
                    className="animate-fade-up mt-4 max-w-lg text-sm text-gray-600 sm:text-base lg:text-lg"
                    style={{ animationDelay: "0.16s" }}
                  >
                    {slide.subtitle}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="animate-fade-up mt-7 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "0.24s" }}
            >
              <StoreButton
                href={PLAY_STORE_URL}
                top="Get it on"
                bottom="Google Play"
                icon={<GooglePlayIcon />}
              />
              <StoreButton
                href={APP_STORE_URL}
                top="Download on the"
                bottom="App Store"
                icon={<AppStoreIcon />}
              />
            </div>

            <div
              className="animate-fade-up mt-6 hidden flex-wrap items-center gap-2.5"
              style={{ animationDelay: "0.32s" }}
            >
              <Stars />
              <span className="text-sm font-bold text-gray-900">4.8/5</span>
              <span className="text-sm text-gray-500">
                Rated by 2,000+ restaurant owners
              </span>
            </div>

            {/* Slide dots — in the text column, on the page grid */}
            {SLIDES.length > 1 && (
              <div className="mt-7 flex items-center">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Show slide ${i + 1}`}
                    className="group flex h-8 w-8 items-center justify-center"
                  >
                    <span
                      className={`h-2 rounded-full transition-all ${
                        i === activeIndex
                          ? "w-6 bg-rc-yellow"
                          : "w-2 bg-gray-300 group-hover:bg-gray-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: local Banner image container — centred below lg, anchored
              to the right column edge on desktop. */}
          <div className="relative mx-auto aspect-2/3 w-full max-w-72 overflow-hidden sm:max-w-sm lg:ml-auto lg:mr-0 xl:max-w-md">
            {SLIDES.map((slide, i) => (
              <Image
                key={i}
                src={slide.image}
                alt="Restocare service professional"
                fill
                sizes="(max-width: 1024px) 90vw, 448px"
                // contain + bottom: a photo taller than 2:3 (like 3.png) shows
                // whole instead of being enlarged and cropped; 2:3 photos are
                // unchanged.
                className={`object-contain object-bottom transition-opacity duration-700 ${
                  i === activeIndex ? "opacity-100" : "opacity-0"
                }`}
                preload={i === 0}
                loading={i === 0 ? undefined : "eager"}
              />
            ))}
          </div>
        </div>

        {/* Service highlights strip */}
        <div className="relative z-10 hidden border-t border-gray-100 bg-white sm:block">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-2 px-4 py-3.5 sm:px-6">
            {HIGHLIGHTS.map((h) => (
              <span
                key={h.label}
                className="flex items-center gap-2 text-sm font-semibold text-gray-800"
              >
                <h.Icon className="h-4 w-4 text-amber-500" aria-hidden />
                {h.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile highlights (below banner) */}
      <div className="mt-3 grid grid-cols-2 gap-2 px-4 sm:hidden">
        {HIGHLIGHTS.map((h) => (
          <span
            key={h.label}
            className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800"
          >
            <h.Icon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            {h.label}
          </span>
        ))}
      </div>
    </section>
  );
}
