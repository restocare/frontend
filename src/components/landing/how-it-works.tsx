"use client";

import { motion } from "framer-motion";
import { SearchIcon, StarIcon } from "@/src/components/icons";

function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

/** Step card: lifts on hover while its icon pops with a playful wiggle. */
function StepCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{ rest: { y: 0 }, hover: { y: -6 } }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg sm:p-8"
    >
      <motion.div
        variants={{
          rest: { scale: 1, rotate: 0 },
          hover: { scale: 1.12, rotate: [0, -8, 8, -4, 0] },
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white"
      >
        {icon}
      </motion.div>
      <h3 className="mb-3 text-lg font-bold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="bg-gray-50 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
            How it works
          </h2>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            A simple and reliable process from discovery to service completion.
          </p>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-3">
          <StepCard
            icon={<SearchIcon className="h-5 w-5" />}
            title="Search & Discover"
            desc="Browse through a wide range of professional services and filter by category, rating, and location."
          />
          <StepCard
            icon={<BoltIcon className="h-5 w-5" />}
            title="Book Instantly"
            desc="Select your preferred date and time, then confirm your booking with transparent pricing."
          />
          <StepCard
            icon={<StarIcon className="h-5 w-5" />}
            title="Enjoy & Review"
            desc="Relax while verified professionals handle the work and share your rating after completion."
          />
        </div>

        {/* Wide bottom card */}
        <div className="grid overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:grid-cols-[1fr_1fr]">
          <div className="relative flex min-h-62.5 items-center justify-center overflow-hidden bg-white md:min-h-75">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/how-it-works.png"
              alt="See how on-demand restaurant service works"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col justify-center p-8 md:p-12">
            <h3 className="mb-4 text-xl font-bold text-gray-900 sm:text-3xl">
              See how on-demand service works in real life
            </h3>
            <p className="text-sm leading-relaxed text-gray-500 sm:text-base">
              From instant booking to doorstep delivery, our on-demand workflow keeps everything simple, transparent, and fast. Watch how professionals are assigned, tracked, and completed with quality checks at every step.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
