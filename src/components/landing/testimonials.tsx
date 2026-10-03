"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon } from "@/src/components/icons";

export function PartnerCTA() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-[#070b16] px-6 py-12 shadow-2xl sm:px-10 sm:py-16">
        {/* Base gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1326] via-[#0a1020] to-[#070b16]" />

        {/* Glowing top arc */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[1200px] max-w-[150%] -translate-x-1/2 -translate-y-[86%] rounded-[50%] border border-blue-400/30 [box-shadow:0_40px_140px_rgba(59,130,246,0.25)]" />

        {/* Perspective grid floor */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px] [transform:perspective(320px)_rotateX(62deg)] [transform-origin:bottom]" />

        {/* Ambient center glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Content */}
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-xl font-bold sm:pt-4 tracking-tight text-white sm:text-[44px] sm:leading-[1.1]">
            Become a service partner
          </h2>
          <p className="mt-4 max-w-xl text-sm text-gray-400 sm:text-base">
            Grow your business by listing your services and receiving quality bookings daily.
          </p>
          <button className="group mt-8 inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-orange-400 [box-shadow:0_0_45px_rgba(249,115,22,0.55)]">
            Get Started
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
          <p className="mt-5 text-xs text-gray-500">
            Free to join. No hidden fees. Start receiving bookings today.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ testimonials ------------------------------ */

interface Review {
  brand: string;
  /** Brand logo from /public/brands, shown as the reviewer avatar. */
  logo: string;
  /** Person who gave the review; omitted when the brand replied as a team. */
  name?: string;
  rating: 4 | 5;
  quote: string;
}

const REVIEWS: Review[] = [
  {
    brand: "Govardhan",
    logo: "/brands/Govardhan.jpeg",
    name: "Rajeev Sharma",
    rating: 5,
    quote:
      "RestoCare has been a dependable partner for us. The waiters and housekeeping staff have been professional, well-mannered, and responsible in their work. We've had a smooth experience working with the RestoCare team.",
  },
  {
    brand: "Naan Baan Shaan",
    logo: "/brands/Naan.jpeg",
    rating: 5,
    quote:
      "Working with RestoCare has been a pleasant experience for our restaurant. The housekeeping and utility team has been sincere, cooperative, and efficient in handling their responsibilities. We appreciate the professionalism of the RestoCare team.",
  },
  {
    brand: "Crazy Chef",
    logo: "/brands/Crazy.jpeg",
    name: "Manish",
    rating: 4,
    quote:
      "RestoCare has been a good experience for our team. The staff have been hardworking, polite, and quick to understand our requirements. We've found the team consistent and professional in their work.",
  },
  {
    brand: "Postfix Coffee",
    logo: "/brands/Postfix.jpeg",
    name: "Sarthak",
    rating: 5,
    quote:
      "RestoCare has been a valuable support for our day-to-day operations. The staff provided have been responsible, well-behaved, and sincere with their work. We're happy with the service and professionalism shown by the RestoCare team.",
  },
  {
    brand: "Cafe Bistro 57",
    logo: "/brands/Bistro.jpeg",
    name: "Nityam Gupta",
    rating: 5,
    quote:
      "RestoCare has been a dependable choice for our staffing needs. The staff have been punctual, courteous, and dedicated towards their responsibilities. We've had a positive experience with the quality of service provided by the RestoCare team.",
  },
  {
    brand: "Amaira",
    logo: "/brands/Amaira.jpeg",
    name: "Yash",
    rating: 4,
    quote:
      "RestoCare has been a reliable part of our day-to-day staffing. The team has been sincere, well-mannered, and responsible with their work. We appreciate the consistent service and support provided by RestoCare.",
  },
];

/** Time each review stays on screen before the carousel advances. */
const AUTOPLAY_MS = 6500;
const SWIPE_PX = 60;

const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -48,
    transition: { duration: 0.22, ease: "easeIn" as const },
  }),
};

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={`h-4 w-4 ${filled ? "text-rc-yellow" : "text-rc-ink/15"}`}
      fill="currentColor"
    >
      <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8L10 1.5z" />
    </svg>
  );
}

export function Testimonials() {
  const reduceMotion = useReducedMotion();
  const [[index, dir], setSlide] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);
  const review = REVIEWS[index];
  const total = REVIEWS.length;

  const go = useCallback(
    (next: number, direction?: number) =>
      setSlide(([cur]) => {
        const target = (next + total) % total;
        return [target, direction ?? (target > cur ? 1 : -1)];
      }),
    [total],
  );
  const prev = () => go(index - 1, -1);
  const nextSlide = () => go(index + 1, 1);
  const autoplay = !reduceMotion;

  return (
    <section className="bg-white py-12 sm:py-16">
      {/* Progress bar keyframes: the bar's end also advances the carousel, so
          pausing the animation pauses the autoplay with it. */}
      <style>{`@keyframes rc-review-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#0A192F] sm:text-[38px]">
              What our customers say
            </h2>
            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Real feedback from the restaurants and cafes that staff with RestoCare.
            </p>
          </div>

          {/* Counter + arrows (desktop position; repeated below on phones) */}
          <div className="hidden items-center gap-3 sm:flex">
            <span className="text-sm font-semibold tabular-nums text-gray-400">
              <span className="text-gray-900">{String(index + 1).padStart(2, "0")}</span> /{" "}
              {String(total).padStart(2, "0")}
            </span>
            <NavArrows onPrev={prev} onNext={nextSlide} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="relative mt-8 overflow-hidden rounded-[2rem] bg-rc-yellow-tint sm:mt-10"
        >
          {/* Soft glow + giant quote mark behind the content */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-rc-yellow/30 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 right-6 select-none font-serif text-[12rem] leading-none text-rc-yellow/35 sm:right-10 sm:text-[16rem]"
          >
            &rdquo;
          </span>

          <motion.div
            drag={reduceMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_PX) nextSlide();
              else if (info.offset.x > SWIPE_PX) prev();
            }}
            className="relative grid gap-8 px-6 pb-8 pt-10 sm:px-10 sm:pt-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 lg:px-14 lg:py-14"
          >
            {/* Reviewer: stacked logo tiles + brand + rating */}
            <div className="flex items-center gap-5 lg:flex-col lg:items-start lg:gap-7">
              <div className="relative h-24 w-24 shrink-0 sm:h-32 sm:w-32 lg:h-44 lg:w-44">
                <div
                  aria-hidden
                  className="absolute inset-0 rotate-6 rounded-3xl bg-rc-yellow shadow-lg shadow-rc-yellow/30"
                />
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={review.logo}
                    initial={{ opacity: 0, rotate: -12, scale: 0.9 }}
                    animate={{ opacity: 1, rotate: -3, scale: 1 }}
                    exit={{ opacity: 0, rotate: 6, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    className="absolute inset-0 overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-rc-ink/10"
                  >
                    <Image
                      src={review.logo}
                      alt={review.brand}
                      fill
                      sizes="(min-width: 1024px) 176px, 128px"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false} mode="wait" custom={dir}>
                <motion.div
                  key={review.brand}
                  custom={dir}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="min-w-0"
                >
                  <p className="text-lg font-bold leading-tight text-rc-ink sm:text-2xl">
                    {review.name ?? review.brand}
                  </p>
                  <p className="mt-1 text-sm text-rc-ink-2">
                    {review.name ? review.brand : "Restaurant partner"}
                  </p>
                  <div
                    className="mt-3 flex items-center gap-2"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} filled={i < review.rating} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-rc-ink-2">{review.rating}.0</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Quote */}
            <div className="flex min-h-[9rem] items-center sm:min-h-[11rem]">
              <AnimatePresence initial={false} mode="wait" custom={dir}>
                <motion.blockquote
                  key={review.brand}
                  custom={dir}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="text-lg font-medium leading-relaxed text-rc-ink sm:text-xl lg:text-[1.65rem] lg:leading-snug"
                >
                  &ldquo;{review.quote}&rdquo;
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Logo rail: tap a brand to jump; the active one carries the timer */}
          <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-rc-ink/10 px-6 py-5 sm:px-10 lg:px-14">
            <div className="flex items-center gap-2 sm:gap-3" role="tablist" aria-label="Reviews">
              {REVIEWS.map((r, i) => {
                const active = i === index;
                return (
                  <button
                    key={r.brand}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Show review from ${r.brand}`}
                    onClick={() => go(i)}
                    className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition-all duration-300 sm:h-12 sm:w-12 ${
                      active
                        ? "scale-110 ring-rc-yellow shadow-md"
                        : "ring-transparent opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    }`}
                  >
                    <Image src={r.logo} alt="" fill sizes="48px" className="object-cover" />
                    {active && autoplay && (
                      <span
                        key={index}
                        aria-hidden
                        onAnimationEnd={nextSlide}
                        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-rc-yellow-deep"
                        style={{
                          animation: `rc-review-progress ${AUTOPLAY_MS}ms linear forwards`,
                          animationPlayState: paused ? "paused" : "running",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 sm:hidden">
              <span className="text-sm font-semibold tabular-nums text-gray-500">
                {index + 1} / {total}
              </span>
              <NavArrows onPrev={prev} onNext={nextSlide} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function NavArrows({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const cls =
    "flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors hover:border-rc-yellow hover:bg-rc-yellow-tint hover:text-rc-ink";
  return (
    <div className="flex items-center gap-2">
      <motion.button
        type="button"
        aria-label="Previous review"
        onClick={onPrev}
        whileTap={{ scale: 0.9 }}
        className={cls}
      >
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
      </motion.button>
      <motion.button
        type="button"
        aria-label="Next review"
        onClick={onNext}
        whileTap={{ scale: 0.9 }}
        className={cls}
      >
        <ArrowRightIcon className="h-4 w-4" />
      </motion.button>
    </div>
  );
}
