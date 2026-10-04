"use client";

/**
 * The category hero shared by every category page. The banner media comes
 * from the admin panel and can be anything (a video, a photo, a poster with
 * its own text), so it sits in its own frame beside the copy instead of under
 * it: nothing is laid over the media and nothing in it is cropped away.
 */

import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import type { CategoryTreeNode } from "@/src/api/api";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { ArrowRightIcon } from "@/src/components/icons";

export interface BannerTrustItem {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

export interface BannerPrice {
  /** Rupees, pre-tax. */
  amount: number;
  /** e.g. "/hour"; omitted for package prices. */
  unit?: string;
  /** Small print after the price, e.g. "Minimum 5 hrs · Taxes extra". */
  note?: string;
}

/** Banner copy reveals line by line. */
const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const RISE: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function CategoryBanner({
  category,
  description,
  price,
  ctaLabel,
  ctaHref,
  trust,
  fallbackEmoji,
  heading,
}: {
  category: CategoryTreeNode;
  description: string;
  price?: BannerPrice | null;
  ctaLabel: string;
  /** In-page anchor of the list below, e.g. "#choose". */
  ctaHref: string;
  trust: BannerTrustItem[];
  /** Shown in the frame when the category has no banner media at all. */
  fallbackEmoji: string;
  /** Replaces the category name as the page H1 (the name stays in the breadcrumb). */
  heading?: string;
}) {
  const image = category.bannerImage || category.profileImage;
  const reduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative overflow-hidden bg-white">
        {/* Texture: a fine dot grid that fades out towards the edges and
            drifts very slowly, plus one warm wash behind the copy. */}
        <motion.div
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
          animate={reduceMotion ? undefined : { backgroundPosition: ["0px 0px", "20px 20px"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-rc-yellow-tint blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-14">
          {/* Copy — children reveal one after another */}
          <motion.div variants={STAGGER} initial="hidden" animate="show">
            <motion.nav
              variants={RISE}
              className="flex items-center gap-1.5 text-xs text-rc-muted sm:text-sm"
              aria-label="Breadcrumb"
            >
              <Link href="/" className="transition-colors hover:text-rc-ink">
                Home
              </Link>
              <span aria-hidden>/</span>
              <span className="font-medium text-rc-ink">{category.name}</span>
            </motion.nav>

            <motion.h1
              variants={RISE}
              className="mt-3 text-3xl font-bold tracking-tight text-rc-ink sm:text-5xl xl:text-6xl"
            >
              {heading ?? category.name}
            </motion.h1>
            <motion.p
              variants={RISE}
              className="mt-3 max-w-md text-[15px] leading-relaxed text-rc-muted sm:text-base"
            >
              {description}
            </motion.p>

            {price && price.amount > 0 ? (
              <motion.p
                variants={RISE}
                className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-6"
              >
                <span className="text-sm text-rc-muted">From</span>
                <span className="text-2xl font-bold tracking-tight text-rc-ink sm:text-3xl">
                  {formatInr(price.amount)}
                  {price.unit ? (
                    <span className="text-sm font-medium text-rc-ink-2">{price.unit}</span>
                  ) : null}
                </span>
                {price.note ? (
                  <span className="text-sm text-rc-muted">· {price.note}</span>
                ) : null}
              </motion.p>
            ) : null}

            <motion.div variants={RISE} className="mt-5 sm:mt-6">
              <motion.a
                href={ctaHref}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rc-yellow px-7 text-sm font-bold text-rc-ink shadow-md shadow-rc-yellow/25 transition-[filter] hover:brightness-95 sm:w-auto"
              >
                {ctaLabel}
                {/* Gentle nudge pointing down to the list */}
                <motion.span
                  className="flex"
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRightIcon className="h-4 w-4 rotate-90" />
                </motion.span>
              </motion.a>
            </motion.div>

            {/* Phones: three tidy tiles. Tablet and up: one quiet line. */}
            <motion.ul
              variants={RISE}
              className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2"
            >
              {trust.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-white/80 px-1 py-3 text-center text-xs font-medium text-rc-ink-2 ring-1 ring-rc-line backdrop-blur-sm sm:flex-row sm:gap-1.5 sm:bg-transparent sm:p-0 sm:text-sm sm:font-normal sm:ring-0 sm:backdrop-blur-none"
                >
                  <Icon className="h-4 w-4 shrink-0 text-rc-yellow-deep" />
                  {label}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Media (admin-managed), on a tinted card offset behind it */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="relative w-full"
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-rc-yellow-tint ring-1 ring-rc-yellow/30 sm:translate-x-3 sm:translate-y-3"
            />
            {/* One 16:9 frame on every screen size, so a single 1920×1080
                video fills it exactly on phone, tablet and desktop — nothing
                is cropped or zoomed. */}
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-rc-ground shadow-sm ring-1 ring-rc-line">
              {category.bannerVideo ? (
                <video
                  src={category.bannerVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster={image}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : image ? (
                <>
                  {/* Blurred copy fills the frame; the real image is shown
                      whole on top, so posters with text never get cut. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- external category image */}
                  <img
                    src={image}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element -- external category image */}
                  <img
                    src={image}
                    alt={category.name}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-6xl">
                  {fallbackEmoji}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}
