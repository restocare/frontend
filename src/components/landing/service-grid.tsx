"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { useCart } from "@/src/lib/cart";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { ArrowRightIcon, SpinnerIcon, StarIcon, StoreIcon } from "@/src/components/icons";

interface ServiceGridProps {
  search: string;
  categoryId: number | null;
}

/** A service flattened out of the category → group → service tree. */
interface FlatService extends CategoryTreeService {
  categoryName: string;
  groupName: string;
}

function flattenServices(
  categories: CategoryTreeNode[],
  categoryId: number | null,
): FlatService[] {
  const scoped = categoryId
    ? categories.filter((c) => c.categoryId === categoryId)
    : categories;

  return scoped.flatMap((category) => [
    // Services attached directly to the category.
    ...category.services.map((service) => ({
      ...service,
      categoryName: category.name,
      groupName: category.name,
    })),
    // Services nested under sub-categories.
    ...category.groups.flatMap((group) =>
      group.services.map((service) => ({
        ...service,
        categoryName: category.name,
        groupName: group.name,
      })),
    ),
  ]);
}

function priceLabel(service: FlatService): string {
  const prices = [
    ...(service.price != null ? [service.price] : []),
    ...service.variants.map((v) => v.price),
  ].filter((p): p is number => typeof p === "number");
  if (prices.length === 0) return "Price on request";
  const min = Math.min(...prices);
  return prices.length > 1 || service.variants.length > 0 ? `From ₹${min}` : `₹${min}`;
}

export function ServiceGrid({ search, categoryId }: ServiceGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Arrows only make sense when the row actually overflows.
  const [canScroll, setCanScroll] = useState(false);

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll by roughly the visible width so it pages through the row.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // Location-scoped: an unserved category arrives with no services, so
  // nothing unbookable is listed here.
  const { coords } = useCurrentLocation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
  });

  const services = useMemo(() => {
    let flat = flattenServices(data ?? [], categoryId);
    // On the home "Popular services" row (no category selected) only show the
    // services an admin has marked as featured. The category page shows all.
    if (!categoryId) {
      flat = flat.filter((s) => s.isFeatured);
    }
    const q = search.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q),
    );
  }, [data, categoryId, search]);

  // Watch the row for overflow so the arrows appear only when needed.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [services.length]);

  return (
    <section id="services" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
            {categoryId ? "Services in this category" : "Popular services"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {services.length > 0
              ? `${services.length} ${services.length === 1 ? "service" : "services"} available`
              : "Book trusted professionals near you"}
          </p>
        </div>

        {/* Row controls — beside the heading, never on top of the cards */}
        {canScroll && (
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scrollByCards(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <ArrowRightIcon className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scrollByCards(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="text-gray-500">Couldn’t load services.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 text-center">
          <StoreIcon className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            No services match your search yet. New services appear here automatically.
          </p>
        </div>
      ) : (
        // Single-line horizontally scrollable row of service cards
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 scrollbar-none"
        >
          {services.map((service) => (
            <div
              key={service.serviceId}
              className="w-64 shrink-0 snap-start sm:w-72"
            >
              <ServiceCard service={service} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ServiceCard({ service }: { service: FlatService }) {
  const router = useRouter();
  const { requestAdd } = useCart();
  const hasVariants = service.variants.length > 0;
  const useSlots = categoryUsesSlots(service.categoryName);

  const handleAdd = () => {
    if (hasVariants) {
      // Open the variant picker. For slot categories it then routes to the
      // schedule step; otherwise it adds straight to the cart.
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
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{ rest: { y: 0 }, hover: { y: -5 } }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-[border-color,box-shadow] duration-200 hover:border-orange-200 hover:shadow-lg"
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-linear-to-br from-gray-100 to-gray-200">
        {service.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external service images
          <img
            src={service.profileImage}
            alt={service.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-4xl font-bold text-gray-300">{service.name.charAt(0)}</span>
        )}
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-gray-900">{service.name}</h3>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-green-600 px-1.5 py-0.5 text-xs font-semibold text-white">
            <StarIcon className="h-3 w-3" />
            4.8
          </span>
        </div>

        <p className="text-xs font-medium text-gray-500">
          {service.categoryName}
          {service.groupName && service.groupName !== service.categoryName
            ? ` · ${service.groupName}`
            : ""}
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">
              {priceLabel(service)}
            </span>
            {/* Always present so every card has the same height */}
            <span className="text-xs text-gray-500">
              {hasVariants
                ? `${service.variants.length} ${service.variants.length === 1 ? "option" : "options"}`
                : "Fixed price"}
            </span>
          </div>
          <motion.button
            onClick={handleAdd}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rc-yellow px-4 py-2 text-sm font-bold text-gray-900 transition-[filter] hover:brightness-95"
          >
            Book
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
