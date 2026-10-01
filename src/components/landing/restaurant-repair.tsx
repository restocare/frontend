"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { categoryTreeApi, queryKeys } from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { ArrowRightIcon, BoltIcon, StarIcon } from "@/src/components/icons";

/** Next.js Link with framer-motion gesture props. */
const MotionLink = motion.create(Link);

/** Each card books through its related category page. */
const SERVICES = [
  {
    id: 1,
    name: "Kitchen Equipment Repair",
    category: "Technician",
    rating: "4.73",
    reviews: "1.2k",
    hasInstant: true,
    price: "₹149",
    image: "/Kitchen Equipment Repair.png",
  },
  {
    id: 2,
    name: "Exhaust Fan Repair",
    category: "Electrician",
    rating: "4.74",
    reviews: "850",
    hasInstant: false,
    price: "₹99",
    image: "/Exhaust Fan Repair.png",
  },
  {
    id: 3,
    name: "Commercial Plumbing",
    category: "Plumber",
    rating: "4.79",
    reviews: "2.1k",
    hasInstant: false,
    price: "₹199",
    image: "/Commercial Plumbing.png",
  },
  {
    id: 4,
    name: "Switchboard Repair & Replacement",
    category: "Electrician",
    rating: "4.83",
    reviews: "3.4k",
    hasInstant: true,
    price: "₹99",
    image: "/Switchboard Repair & Replacement.png",
  },
  {
    id: 5,
    name: "HVAC Maintenance",
    category: "AC & Appliance Repair",
    rating: "4.80",
    reviews: "1.1k",
    hasInstant: true,
    price: "₹249",
    image: "/HVAC Maintenance.png",
  },
];

export function RestaurantRepair() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Resolve each card's related category to its live id by name, so the Book
  // button opens the right category page without hard-coding ids.
  const { coords } = useCurrentLocation();
  const { data } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const categoryIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data ?? []) {
      map.set(c.name.trim().toLowerCase(), c.categoryId);
    }
    return map;
  }, [data]);

  const bookHref = (categoryName: string): string => {
    const id = categoryIdByName.get(categoryName.trim().toLowerCase());
    return id != null ? `/category/${id}` : "/#categories";
  };

  return (
    <section className="bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-xl font-bold tracking-tight text-[#0A192F] sm:text-[38px]">
            Restaurant maintenance, repair &amp; installation services
          </h2>
        </div>

        <div className="group/scroller relative">
          {/* Left / right controls */}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByCards(-1)}
            className="absolute -left-5 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 sm:flex"
          >
            <ArrowRightIcon className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByCards(1)}
            className="absolute -right-5 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 sm:flex"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>

          {/* Carousel container */}
          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 pt-2 scrollbar-none"
          >
            {SERVICES.map((service) => (
              <div
                key={service.id}
                // Exactly 4 cards per view on lg (gap-5 × 3 = 3.75rem), so no
                // card is clipped at the container's right edge.
                className="w-70 shrink-0 snap-start sm:w-75 lg:w-[calc((100%-3.75rem)/4)]"
              >
                <motion.article
                  initial="rest"
                  animate="rest"
                  whileHover="hover"
                  variants={{ rest: { y: 0 }, hover: { y: -5 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-[border-color,box-shadow] duration-200 hover:border-orange-200 hover:shadow-lg"
                >
                  {/* Uniform image box: every card is the same height */}
                  <div className="relative aspect-4/3 w-full shrink-0 overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={service.image}
                      alt={service.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="mb-2 line-clamp-2 font-bold text-gray-900">
                      {service.name}
                    </h3>

                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                        <StarIcon className="h-3.5 w-3.5 text-yellow-400" />
                        <span>{service.rating}</span>
                      </div>

                      {service.hasInstant && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-green-600">
                            <BoltIcon className="h-3 w-3" /> Instant
                          </span>
                        </>
                      )}
                    </div>

                    {/* Price + CTA — opens the related category page */}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <span className="font-bold text-gray-900">{service.price}</span>
                      <MotionLink
                        href={bookHref(service.category)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.93 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
                      >
                        Book
                        <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                      </MotionLink>
                    </div>
                  </div>
                </motion.article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
