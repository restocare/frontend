"use client";

/**
 * The new category flow (NEXT_PUBLIC_RC_CATEGORY_FLOW=2), built step by step
 * while flow 1 keeps serving the current pages. So far: the top banner
 * (the existing CategoryBanner), then cart | services | sub-categories.
 */

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeGroup,
  type CategoryTreeNode,
  type CategoryTreeService,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { categoryIdForSlug } from "@/lib/category-slugs";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { isCleaningCategory, subSlugOf } from "@/src/lib/booking-v2/cleaning";
import { hourlyRate } from "@/src/lib/booking-v2/draft";
import { minShiftMinutes } from "@/src/lib/booking-v2/schedule";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { BadgeCheckIcon, BoltIcon, ClockIcon, SpinnerIcon, WalletIcon } from "@/src/components/icons";
import { StorefrontShell } from "@/src/components/booking-v2/shell";
import {
  CategoryBanner,
  type BannerPrice,
  type BannerTrustItem,
} from "@/src/components/booking-v2/category-banner";
import { emojiForCategory } from "@/src/components/booking-v2/category-page-v2";
import { CategoryLayout } from "./category-layout";

/* Same trust lines the current pages use for each kind of category. */
const HOURLY_TRUST: BannerTrustItem[] = [
  { Icon: BadgeCheckIcon, label: "Verified pros" },
  { Icon: ClockIcon, label: "Book by the hour" },
  { Icon: WalletIcon, label: "Online or COD" },
];
const CLEANING_TRUST: BannerTrustItem[] = [
  { Icon: BadgeCheckIcon, label: "Trained crews" },
  { Icon: ClockIcon, label: "Slots all week" },
  { Icon: WalletIcon, label: "Online or COD" },
];
const DEFAULT_TRUST: BannerTrustItem[] = [
  { Icon: BadgeCheckIcon, label: "Verified pros" },
  { Icon: BoltIcon, label: "Quick booking" },
  { Icon: WalletIcon, label: "Clear pricing" },
];

interface BannerProps {
  category: CategoryTreeNode;
  description: string;
  price: BannerPrice | null;
  ctaLabel: string;
  trust: BannerTrustItem[];
  fallbackEmoji: string;
  heading?: string;
}

function live(services: CategoryTreeService[]): CategoryTreeService[] {
  return services.filter((s) => s.isActive !== false);
}

/** A package's listed price: its own, else its cheapest size. */
function listPrice(s: CategoryTreeService): number | null {
  if (s.price != null && s.price > 0) return s.price;
  const sizes = s.variants.map((v) => v.price).filter((p) => p > 0);
  return sizes.length ? Math.min(...sizes) : null;
}

/** The category's own description, unless the API just repeats its name. */
function ownDescription(category: CategoryTreeNode): string | null {
  const d = category.description?.trim();
  return d && d.toLowerCase() !== category.name.trim().toLowerCase() ? d : null;
}

function fromPrice(services: CategoryTreeService[]): number | null {
  const prices = services.map(listPrice).filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}

/** Banner content for a category, or for one of its areas. */
function bannerFor(
  category: CategoryTreeNode,
  group: CategoryTreeGroup | undefined,
  heading: string | undefined,
): BannerProps {
  const all = live([...category.services, ...category.groups.flatMap((g) => g.services)]);
  const emoji = emojiForCategory(category.name);

  // Hourly staffing (Chef, Helpers & Waiter): a rate per hour.
  if (categoryUsesSlots(category.name)) {
    const priced = all
      .map((s) => ({ rate: hourlyRate(s), hours: minShiftMinutes(s.variants) / 60 }))
      .filter((p) => p.rate > 0);
    const cheapest = priced.length
      ? priced.reduce((best, p) => (p.rate * p.hours < best.rate * best.hours ? p : best))
      : null;
    const noun = /^[A-Za-z]+$/.test(category.name.trim()) ? category.name.trim().toLowerCase() : "service";
    return {
      category,
      description: "Quality-checked professionals, booked by the hour for the date and time you need.",
      price: priced.length
        ? {
            amount: Math.min(...priced.map((p) => p.rate)),
            unit: "/hour",
            note: cheapest
              ? `Minimum booking ${formatInr(cheapest.rate * cheapest.hours)} (${cheapest.hours} hrs) + taxes`
              : "Taxes extra",
          }
        : null,
      ctaLabel: `Choose a ${noun}`,
      trust: HOURLY_TRUST,
      fallbackEmoji: emoji,
      heading,
    };
  }

  // Deep Cleaning, the category or one of its areas: package prices.
  if (isCleaningCategory(category.name)) {
    const services = group ? live(group.services) : all;
    const from = fromPrice(services);
    return {
      category: group
        ? {
            ...category,
            bannerImage: group.bannerImage || category.bannerImage,
            bannerVideo: group.bannerVideo || category.bannerVideo,
          }
        : category,
      description:
        (group && (group.subtitle || group.description)) ||
        ownDescription(category) ||
        "Trained crews and commercial-grade cleaning for washrooms, kitchens, dining areas and whole outlets.",
      price:
        from != null
          ? {
              amount: from,
              note: `${services.length} package${services.length === 1 ? "" : "s"} · Priced by size · Taxes extra`,
            }
          : null,
      ctaLabel: "See packages",
      trust: CLEANING_TRUST,
      fallbackEmoji: "🧼",
      heading: group ? group.title || group.name : heading,
    };
  }

  // Everything else (Electrician, Plumber, …): service prices.
  const from = fromPrice(all);
  return {
    category,
    description: ownDescription(category) || "Verified professionals for your restaurant, booked online in a few taps.",
    price:
      from != null
        ? { amount: from, note: `${all.length} ${all.length === 1 ? "service" : "services"} · Taxes extra` }
        : null,
    ctaLabel: "View services",
    trust: DEFAULT_TRUST,
    fallbackEmoji: emoji,
    heading,
  };
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex h-[50vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
      <p className="mt-2 text-gray-500">{text}</p>
    </div>
  );
}

export function CategoryFlowV2Page({
  slug,
  sub,
  heading,
}: {
  slug: string;
  /** Area slug on /category/[slug]/[sub] (Deep Cleaning areas). */
  sub?: string;
  /** SEO H1 from lib/category-content.ts, when the category has one. */
  heading?: string;
}) {
  const categoryId = categoryIdForSlug(slug);
  const { coords } = useCurrentLocation();
  // Same query and cache entry as the current pages; the server seeds it.
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
    placeholderData: keepPreviousData,
  });

  const category = useMemo(() => data?.find((c) => c.categoryId === categoryId), [data, categoryId]);
  const group = sub ? category?.groups.find((g) => subSlugOf(g.name) === sub) : undefined;

  let body;
  if (isLoading) {
    body = (
      <div className="flex h-[50vh] items-center justify-center text-gray-400">
        <SpinnerIcon className="h-7 w-7" />
      </div>
    );
  } else if (isError) {
    body = <Message title="Something went wrong" text="We couldn't load this category. Please try again." />;
  } else if (!category || (sub && !group)) {
    body = <Message title="Not found" text="This category doesn't exist or was removed." />;
  } else if (category.isPublished === false) {
    // Not launched yet (the home page shows it as "Coming soon"): no booking.
    body = (
      <Message
        title={`${category.name} is coming soon`}
        text="We're not taking bookings for this category yet. Please check back soon."
      />
    );
  } else if (category.comingSoon) {
    body = (
      <Message
        title={`${category.name} is coming soon in your area`}
        text="We're not serving this category at your location yet. Change your location, or check back soon."
      />
    );
  } else {
    const banner = bannerFor(category, group, heading);
    body = (
      <>
        <CategoryBanner {...banner} ctaHref="#services" />
        <CategoryLayout category={category} group={group} />
      </>
    );
  }

  return (
    <StorefrontShell>
      <main className="bg-white">{body}</main>
    </StorefrontShell>
  );
}
