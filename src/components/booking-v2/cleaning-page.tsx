"use client";

/**
 * Flow-2 category page for Deep Cleaning, laid out the Urban Company way:
 * the site's banner, then sub-category tiles on the left (sticky on desktop),
 * the packages grouped by sub-category in the middle, and the cart on the
 * right. Packages are added to a cart, several at once, and booked together
 * through the cart wizard at /booking/cart.
 *
 * Everything comes from the catalog API (category → sub-categories →
 * services → variants), managed in the admin panel or by Excel import. The
 * newer fields (subtitle, MRP, "from" price, highlights, …) are optional and
 * a service without them still shows.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { categoryHref, categoryIdForSlug } from "@/lib/category-slugs";
import { subSlugOf } from "@/src/lib/booking-v2/cleaning";
import { saveDraft, startDraft } from "@/src/lib/booking-v2/draft";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
  type CategoryTreeVariant,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import {
  lineKey,
  reconcileLines,
  useCleaningCart,
  type CartLine,
} from "@/src/lib/booking-v2/cleaning-cart";
import { BadgeCheckIcon, ClockIcon, SpinnerIcon, WalletIcon } from "@/src/components/icons";
import { StorefrontShell } from "./shell";
import { CategoryBanner, type BannerTrustItem } from "./category-banner";
import {
  CategoryFaqSlot,
  CategoryIntroSlot,
  useCategoryHeading,
  useHasCategoryFaqs,
} from "./category-content-slots";

import { CANCEL_FAQ, FaqSection, GST_PERCENT, WHATSAPP_URL, type Faq } from "./category-extras";
import {
  CartSummary,
  DetailsSheet,
  OptionsSheet,
  SafeImage,
  ServiceCard,
  ServiceRow,
  SubIcon,
  subIconFor,
  type SubIconKind,
} from "./cleaning-catalog";

const CLEANING_TRUST: BannerTrustItem[] = [
  { Icon: BadgeCheckIcon, label: "Trained crews" },
  { Icon: ClockIcon, label: "Slots all week" },
  { Icon: WalletIcon, label: "Online or COD" },
];

const CLEANING_FAQS: Faq[] = [
  {
    q: "How are packages priced?",
    a: `By size: fixture count for washrooms, cleanable area for kitchens, and area and seating for dining areas. A "from" price is the starting price for that size; the final price is confirmed at booking. Prices are before ${GST_PERCENT}% GST.`,
  },
  {
    q: "Can I book several areas together?",
    a: "Yes. Add every package you need to the cart and book them for the same day and arrival time.",
  },
  {
    q: "When can the crew come?",
    a: "Any day this week, arriving in the morning, afternoon or evening.",
  },
  {
    q: "How do I pay?",
    a: "Online by UPI, card or net banking, or after the job (COD).",
  },
  {
    q: "My size or area isn't listed. What now?",
    a: "Message us on WhatsApp with your outlet's size and what needs cleaning, and we'll quote it.",
  },
  CANCEL_FAQ,
];

const DIRECT_SECTION = "more";

/** One block of the list: a sub-category, or the services directly in the category. */
interface Section {
  id: string;
  name: string;
  title: string;
  subtitle: string | null;
  note: string | null;
  image: string | null;
  icon: SubIconKind;
  comingSoon: boolean;
  services: CategoryTreeService[];
}

function buildSections(category: CategoryTreeNode): Section[] {
  // Drafts never reach the storefront; unpublished sub-categories show as "Coming soon".
  const live = (list: CategoryTreeService[]) => list.filter((s) => s.isActive !== false);
  const sections: Section[] = category.groups.map((g) => ({
    id: String(g.groupId),
    name: g.name,
    title: g.title || g.name,
    subtitle: g.subtitle ?? null,
    note: g.note ?? null,
    image: g.profileImage || null,
    icon: subIconFor(g.name),
    comingSoon: g.isPublished === false,
    services: g.isPublished === false ? [] : live(g.services),
  }));
  const direct = live(category.services);
  if (direct.length) {
    sections.push({
      id: DIRECT_SECTION,
      name: sections.length ? "More services" : "All services",
      title: sections.length ? "More services" : "All services",
      subtitle: null,
      note: null,
      image: null,
      icon: "other",
      comingSoon: false,
      services: direct,
    });
  }
  return sections;
}

/** The price a package is listed at (its own, else its cheapest size); no price sorts last. */
function listPrice(s: CategoryTreeService): number {
  const own = s.price != null && s.price > 0 ? s.price : null;
  const sizes = s.variants.map((v) => v.price).filter((p) => p > 0);
  return own ?? (sizes.length ? Math.min(...sizes) : Number.POSITIVE_INFINITY);
}

function matches(s: CategoryTreeService, q: string): boolean {
  return [s.name, s.subtitle, s.description, ...(s.highlights ?? [])].some((t) =>
    (t ?? "").toLowerCase().includes(q),
  );
}

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">{title}</h1>
      <p className="mt-2 text-gray-500">{text}</p>
      <div className="mt-6 flex gap-3">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
          >
            {action.label}
          </button>
        ) : null}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

/** The category page's list: one card per area, each opening that area's page. */
function AreaGrid({
  areas,
  hrefOf,
  priceOf,
  extra,
}: {
  areas: Section[];
  hrefOf: (s: Section) => string;
  priceOf: (s: Section) => number | null;
  extra?: ReactNode;
}) {
  return (
    <section aria-labelledby="areas-title">
      <h2 id="areas-title" className="m-0 text-xl font-bold tracking-tight sm:text-2xl">
        Choose an area
      </h2>
      <p className="m-0 mt-1 text-sm text-gray-500">Each area has its own packages and prices.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {areas.map((a) => {
          const from = a.comingSoon ? null : priceOf(a);
          const body = (
            <>
              <TileIcon section={a} className="h-14 w-14 rounded-2xl bg-rc-yellow-tint sm:h-16 sm:w-16" />
              <span className="mt-3 text-sm font-semibold leading-tight text-gray-900">{a.name}</span>
              <span className="mt-1 text-xs text-gray-500">
                {a.comingSoon ? "Coming soon" : from != null ? `From ${formatInr(from)}` : "Quote on inspection"}
              </span>
            </>
          );
          const cls =
            "flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-3 py-5 text-center transition";
          return a.comingSoon ? (
            <div key={a.id} aria-disabled className={`${cls} opacity-50`}>
              {body}
            </div>
          ) : (
            <Link key={a.id} href={hrefOf(a)} className={`${cls} hover:border-rc-yellow hover:bg-rc-yellow-tint/40`}>
              {body}
            </Link>
          );
        })}
      </div>
      {extra}
    </section>
  );
}

function TileIcon({ section, className }: { section: Pick<Section, "image" | "icon" | "name">; className: string }) {
  return (
    <SafeImage
      src={section.image}
      alt=""
      className={`${className} object-cover`}
      fallback={
        <span className={`${className} grid place-items-center text-rc-yellow-deep`}>
          <SubIcon kind={section.icon} className="h-7 w-7" />
        </span>
      }
    />
  );
}

/**
 * `subSlug` turns this into one sub-category's own page
 * (/category/deep-cleaning/washroom): only that area's packages, its own
 * heading, and the tiles link to the other areas' pages. Same cart.
 */
export function CleaningPageV2({ subSlug }: { subSlug?: string } = {}) {
  const params = useParams<{ slug: string }>();
  const heading = useCategoryHeading();
  const hasCategoryFaqs = useHasCategoryFaqs();
  // page.tsx already 404s unmapped slugs; NaN matches the old Number(params.id) miss.
  const categoryId = categoryIdForSlug(params?.slug ?? "") ?? NaN;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [active, setActive] = useState<string | null>(() => searchParams.get("sub"));
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const [detailsFor, setDetailsFor] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { coords } = useCurrentLocation();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.categoryTreeAt(coords),
    queryFn: () => categoryTreeApi.tree(coords),
    // Keep the server-rendered list on screen while the location-scoped
    // tree loads, instead of swapping it for a spinner.
    placeholderData: keepPreviousData,
  });

  const category = useMemo<CategoryTreeNode | undefined>(
    () => data?.find((c) => c.categoryId === categoryId),
    [data, categoryId],
  );
  const sections = useMemo(() => (category ? buildSections(category) : []), [category]);
  const allServices = useMemo(() => sections.flatMap((s) => s.services), [sections]);

  // Sub-category page: the one area it is about, else the whole category.
  const focus = subSlug
    ? sections.find((s) => s.id !== DIRECT_SECTION && subSlugOf(s.name) === subSlug)
    : undefined;
  const focusGroup = focus ? category?.groups.find((g) => String(g.groupId) === focus.id) : undefined;
  // An area page lists its packages cheapest first; quote-only ones go last.
  const pageSections = useMemo(
    () =>
      subSlug
        ? focus
          ? [{ ...focus, services: [...focus.services].sort((a, b) => listPrice(a) - listPrice(b)) }]
          : []
        : sections,
    [subSlug, focus, sections],
  );
  const pageServices = useMemo(() => pageSections.flatMap((s) => s.services), [pageSections]);
  const subHref = (s: Section) => `${categoryHref(categoryId)}/${subSlugOf(s.name)}`;

  const { cart, itemCount, add, setQuantity, update, quantityOf, serviceCount, hydrated } = useCleaningCart(
    categoryId,
    category?.name ?? "",
  );

  // Stored lines follow the live catalog: removed services drop out and
  // changed prices are refreshed, with a note saying so.
  useEffect(() => {
    // Not served here: the API sends no services, which is not "removed".
    if (!category || category.comingSoon || !hydrated || !cart.lines.length) return;
    const index = new Map<number, CategoryTreeService>();
    for (const s of [...category.services, ...category.groups.flatMap((g) => g.services)]) index.set(s.serviceId, s);
    const { lines, removed, repriced } = reconcileLines(cart.lines, (serviceId, variantId) => {
      const service = index.get(serviceId);
      if (!service) return null;
      return {
        service,
        variant: variantId != null ? (service.variants.find((v) => v.variantId === variantId) ?? null) : null,
      };
    });
    if (!removed.length && !repriced.length) return;
    update({ lines });
    const parts = [
      removed.length ? `${removed.join(", ")} ${removed.length === 1 ? "is" : "are"} no longer available and left your cart` : "",
      repriced.length ? `the price of ${repriced.join(", ")} changed` : "",
    ].filter(Boolean);
    queueMicrotask(() => setNotice(`Heads up: ${parts.join("; ")}.`));
  }, [category, hydrated, cart.lines, update]);

  const q = search.trim().toLowerCase();
  // Packages show as "Book now" cards on an area page and for search results;
  // the category page itself lists the areas, not every package.
  const gridMode = !!focus || !!q;
  const shown = useMemo(
    () =>
      pageSections
        .map((s) => ({ ...s, services: q ? s.services.filter((svc) => matches(svc, q)) : s.services }))
        .filter((s) => (q ? s.services.length > 0 : true)),
    [pageSections, q],
  );
  const shownCount = shown.reduce((n, s) => n + s.services.length, 0);

  // Scroll spy: highlight the tile of the section being read, i.e. the last
  // one whose top has passed a line just under the sticky site header.
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // Where a section clicked from a tile lands: the page's scroll-padding
      // (for the sticky header) plus the sections' scroll-mt-24, with slack.
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const LINE = pad + 96 + 24;
      let current: string | null = null;
      for (const s of shown) {
        const el = sectionRefs.current.get(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - LINE > 0) break;
        current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shown]);

  // Old ?sub=<groupId> links (from before areas had their own pages) go there now.
  useEffect(() => {
    if (subSlug || !sections.length) return;
    const wanted = searchParams.get("sub");
    const area = wanted ? sections.find((x) => x.id === wanted && x.id !== DIRECT_SECTION) : undefined;
    if (area) router.replace(`${categoryHref(categoryId)}/${subSlugOf(area.name)}`);
  }, [subSlug, sections, searchParams, router, categoryId]);

  // ?sub= from a shared link: scroll to that section once it renders.
  const scrolledOnce = useRef(false);
  useEffect(() => {
    if (scrolledOnce.current || !shown.length) return;
    const wanted = searchParams.get("sub");
    if (!wanted) return;
    scrolledOnce.current = true;
    sectionRefs.current.get(wanted)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [shown, searchParams]);

  const goTo = (id: string) => {
    setActive(id);
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("sub", id);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* URL update is a nicety only */
    }
  };

  const findService = useCallback(
    (id: number | null) => (id == null ? undefined : allServices.find((s) => s.serviceId === id)),
    [allServices],
  );
  const iconOf = useCallback(
    (serviceId: number): SubIconKind =>
      sections.find((s) => s.services.some((svc) => svc.serviceId === serviceId))?.icon ?? "other",
    [sections],
  );

  const toLine = (s: CategoryTreeService, v?: CategoryTreeVariant): Omit<CartLine, "key" | "quantity"> => ({
    serviceId: s.serviceId,
    variantId: v?.variantId ?? null,
    name: s.name,
    variantName: v?.name ?? null,
    subtitle: s.subtitle ?? null,
    image: v?.profileImage || s.profileImage || null,
    unitPrice: v ? v.price : (s.price ?? 0),
    originalPrice: v ? (v.originalPrice ?? null) : (s.originalPrice ?? null),
    isStartingPrice: s.isStartingPrice ?? false,
  });

  // The cart lives in localStorage; if the browser refuses, it still works
  // for this visit, and the customer is told it won't survive a refresh.
  const warnIfNotSaved = (saved: boolean) => {
    if (!saved) setNotice("Your browser blocked saving the cart, so it will be lost if you leave this page.");
  };
  const addLine = (s: CategoryTreeService, v?: CategoryTreeVariant) => warnIfNotSaved(add(toLine(s, v)));
  const changeLine = (key: string, next: number) => warnIfNotSaved(setQuantity(key, next));

  // "Book now": the same date and time wizard as a chef booking.
  const bookNow = (svc: CategoryTreeService) => {
    if (!category) return;
    saveDraft(startDraft(svc, { categoryId: category.categoryId, name: category.name }));
    router.push(`/booking/${svc.serviceId}`);
  };

  const subtotal = cart.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const checkout = () => router.push(`/booking/cart?category=${categoryId}`);
  const checkoutButton = (
    <button
      type="button"
      onClick={checkout}
      disabled={!itemCount}
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-rc-yellow px-6 text-sm font-bold text-gray-900 shadow-[0_6px_16px_rgba(244,180,0,0.3)] transition hover:brightness-95 disabled:opacity-50 disabled:shadow-none"
    >
      View cart and book
    </button>
  );

  const prices = pageServices
    .map((s) => s.price ?? (s.variants.length ? Math.min(...s.variants.map((v) => v.price)) : null))
    .filter((p): p is number => p != null && p > 0);
  const fromPrice = prices.length ? Math.min(...prices) : null;

  const optionsService = findService(optionsFor);
  const detailsService = findService(detailsFor);
  const liveTiles = sections.filter((s) => s.id !== DIRECT_SECTION);
  const directServices = sections.find((s) => s.id === DIRECT_SECTION)?.services ?? [];

  return (
    <StorefrontShell search={search} onSearchChange={setSearch}>
      <main className="bg-white pb-24">
        {isLoading ? (
          <div className="flex h-[60vh] items-center justify-center text-gray-400">
            <SpinnerIcon className="h-7 w-7" />
          </div>
        ) : isError ? (
          <Empty
            title="Something went wrong"
            text={`We couldn't load this category${error instanceof Error && error.message ? ` (${error.message})` : ""}. Please try again.`}
            action={{ label: isFetching ? "Retrying…" : "Try again", onClick: () => void refetch() }}
          />
        ) : !category ? (
          <Empty title="Category not found" text="The category you're looking for doesn't exist or was removed." />
        ) : subSlug && !focus ? (
          <Empty title="Area not found" text={`This ${category.name} area doesn't exist any more. Pick another one from the category page.`} />
        ) : category.comingSoon ? (
          <Empty
            title={`${category.name} is coming soon in your area`}
            text="We're not serving this category at your location yet. Change your location, or check back soon."
          />
        ) : (
          <>
            <CategoryBanner
              category={
                focusGroup
                  ? {
                      ...category,
                      bannerImage: focusGroup.bannerImage || category.bannerImage,
                      bannerVideo: focusGroup.bannerVideo || category.bannerVideo,
                    }
                  : category
              }
              description={
                (focus && (focus.subtitle || focusGroup?.description)) ||
                category.description ||
                "Trained crews and commercial-grade cleaning for washrooms, kitchens, dining areas and whole outlets."
              }
              price={
                fromPrice != null
                  ? {
                      amount: fromPrice,
                      note: `${pageServices.length} package${pageServices.length === 1 ? "" : "s"} · Priced by size · Taxes extra`,
                    }
                  : null
              }
              ctaLabel={focus ? "See packages" : "Choose an area"}
              ctaHref="#packages"
              trust={CLEANING_TRUST}
              fallbackEmoji="🧼"
              heading={focus ? focus.title : heading}
            />
            {focus ? null : <CategoryIntroSlot />}

            <div id="packages" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 lg:py-10">
              {notice ? (
                <div
                  role="status"
                  className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-rc-yellow-deep/30 bg-rc-yellow-tint/50 px-4 py-3 text-sm text-gray-800"
                >
                  <span>{notice}</span>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-gray-500">
                    ✕
                  </button>
                </div>
              ) : null}

              {gridMode ? (
              <div
                className={
                  gridMode
                    ? "grid gap-8"
                    : "grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_360px]"
                }
              >
                {/* Left: sub-category tiles (a grid on phones, sticky on desktop).
                    An area's own page leaves them out. */}
                <aside className={gridMode ? "hidden" : "min-w-0 lg:sticky lg:top-24 lg:self-start"}>
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <h2 className="m-0 text-base font-bold">Select a service</h2>
                    {liveTiles.length ? (
                      <nav className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-3" aria-label="Sub-categories">
                        {liveTiles.map((s) => {
                          const on = subSlug ? focus?.id === s.id : active === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              // On an area page each tile opens that area's page.
                              onClick={() => (subSlug ? router.push(subHref(s)) : goTo(s.id))}
                              aria-current={on ? "true" : undefined}
                              className="group flex flex-col items-center gap-1.5 text-center"
                            >
                              <span
                                className={`relative overflow-hidden rounded-xl ring-2 transition ${
                                  on ? "ring-rc-yellow" : "ring-transparent group-hover:ring-gray-200"
                                } ${s.comingSoon ? "opacity-50" : ""}`}
                              >
                                <TileIcon section={s} className="h-16 w-16 rounded-xl bg-rc-yellow-tint" />
                                {s.comingSoon ? (
                                  <span className="absolute inset-x-0 bottom-0 bg-gray-900/80 py-0.5 text-[9px] font-semibold uppercase text-white">
                                    Soon
                                  </span>
                                ) : null}
                              </span>
                              <span className={`text-xs leading-tight ${on ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                                {s.name}
                              </span>
                            </button>
                          );
                        })}
                      </nav>
                    ) : (
                      <p className="m-0 mt-2 text-sm text-gray-500">Browse every package on the right.</p>
                    )}
                  </div>
                  <ol className="mt-4 hidden list-none space-y-3 rounded-2xl bg-gray-50 p-4 lg:block">
                    {[
                      ["Add packages", "Pick the sizes you need, several at once."],
                      ["Pick a day and time", "Morning, afternoon or evening, any day this week."],
                      ["Crew arrives", "Pay online, or after the job."],
                    ].map(([title, text], i) => (
                      <li key={title} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rc-yellow text-xs font-bold">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-gray-500">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </aside>

                {/* Middle: the packages */}
                <div className="min-w-0">
                  {q ? (
                    <p className="m-0 mb-2 text-sm text-gray-500">
                      {shownCount} result{shownCount === 1 ? "" : "s"} for “{search.trim()}”{" "}
                      <button type="button" onClick={() => setSearch("")} className="font-semibold text-rc-yellow-deep hover:underline">
                        Clear
                      </button>
                    </p>
                  ) : null}

                  {sections.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                      <p className="text-4xl">🧽</p>
                      <p className="m-0 mt-3 font-semibold">Packages are on their way</p>
                      <p className="m-0 mt-1 text-sm text-gray-500">
                        Message us and we&apos;ll quote your cleaning in the meantime.
                      </p>
                      <a
                        href={`${WHATSAPP_URL}?text=${encodeURIComponent("Hi, I need a deep cleaning quote on RestoCare.")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
                      >
                        WhatsApp us
                      </a>
                    </div>
                  ) : shown.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                      <p className="text-4xl">🗂️</p>
                      <p className="m-0 mt-3 text-sm text-gray-500">No packages match your search.</p>
                    </div>
                  ) : (
                    shown.map((s) => (
                      <section
                        key={s.id}
                        data-section={s.id}
                        ref={(el) => {
                          if (el) sectionRefs.current.set(s.id, el);
                          else sectionRefs.current.delete(s.id);
                        }}
                        aria-labelledby={`sub-${s.id}`}
                        className="scroll-mt-24 border-b-8 border-gray-50 pb-4 pt-6 first:pt-0 last:border-b-0"
                      >
                        <h3 id={`sub-${s.id}`} className="m-0 text-xl font-bold tracking-tight sm:text-2xl">
                          {s.title}
                        </h3>
                        {s.subtitle ? <p className="m-0 mt-1 text-sm text-gray-500">{s.subtitle}</p> : null}
                        {s.comingSoon ? (
                          <p className="m-0 mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                            Coming soon. Message us on WhatsApp for a quote meanwhile.
                          </p>
                        ) : s.services.length === 0 ? (
                          <div className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                            <p className="m-0">Priced after a quick inspection.</p>
                            <a
                              href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hi, I need a quote for ${s.title} on Restocare.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
                            >
                              Get a quote on WhatsApp
                            </a>
                          </div>
                        ) : (
                          <div
                            className={
                              gridMode
                                ? "mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                                : "divide-y divide-gray-100"
                            }
                          >
                            {s.services.map((svc) => {
                              const actions = {
                                count: serviceCount(svc.serviceId),
                                quantity: quantityOf(svc.serviceId),
                                onAdd: () => addLine(svc),
                                onChange: (n: number) => changeLine(lineKey(svc.serviceId, null), n),
                                onOptions: () => setOptionsFor(svc.serviceId),
                                onDetails: () => setDetailsFor(svc.serviceId),
                                iconKind: s.icon,
                              };
                              return gridMode ? (
                                <ServiceCard key={svc.serviceId} service={svc} actions={{ ...actions, onBook: () => bookNow(svc) }} />
                              ) : (
                                <ServiceRow key={svc.serviceId} service={svc} actions={actions} />
                              );
                            })}
                          </div>
                        )}
                        {s.note ? <p className="m-0 mt-2 text-xs text-gray-500">{s.note}</p> : null}
                      </section>
                    ))
                  )}
                </div>

                {/* Right: the cart */}
                <aside className={gridMode ? "hidden" : "hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start"}>
                  <div className="rounded-2xl border border-gray-200 p-5">
                    <h2 className="m-0 mb-3 text-base font-bold">Cart</h2>
                    <CartSummary
                      lines={cart.lines}
                      subtotal={subtotal}
                      onChange={(l, n) => changeLine(l.key, n)}
                      action={checkoutButton}
                    />
                  </div>
                  <div className="mt-4 rounded-2xl border border-gray-200 p-5">
                    <h3 className="m-0 text-sm font-bold">The RestoCare promise</h3>
                    <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm text-gray-600">
                      <li>✓ Background-checked, trained crews</li>
                      <li>✓ Prices shown upfront, before tax</li>
                      <li>✓ Pay online, or after the job</li>
                    </ul>
                  </div>
                </aside>
              </div>
              ) : (
                <AreaGrid
                  areas={liveTiles}
                  hrefOf={subHref}
                  priceOf={(sec) => {
                    const ps = sec.services.map(listPrice).filter((v) => Number.isFinite(v));
                    return ps.length ? Math.min(...ps) : null;
                  }}
                  extra={
                    // Services filed under no area still need a way in.
                    directServices.length ? (
                      <div className="mt-10">
                        <h3 className="m-0 text-xl font-bold tracking-tight">More services</h3>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {directServices.map((svc) => (
                            <ServiceCard
                              key={svc.serviceId}
                              service={svc}
                              actions={{
                                count: 0,
                                quantity: 0,
                                onAdd: () => bookNow(svc),
                                onChange: () => {},
                                onOptions: () => bookNow(svc),
                                onDetails: () => setDetailsFor(svc.serviceId),
                                iconKind: "other",
                                onBook: () => bookNow(svc),
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  }
                />
              )}
            </div>

            {/* One FAQ block per page: the category's own FAQs when it has them */}
            {hasCategoryFaqs ? null : (
              <FaqSection intro="Everything about booking a deep clean." faqs={CLEANING_FAQS} />
            )}
            <CategoryFaqSlot />

            {/* Carts filled before areas had their own pages can still be booked from this bar */}
            {itemCount > 0 ? (
              <div
                data-bottom-bar
                className={`fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]`}
              >
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                  <div className="leading-tight">
                    <p className="m-0 text-base font-bold tabular-nums">{formatInr(subtotal)}</p>
                    <p className="m-0 text-xs text-gray-500">
                      {itemCount} item{itemCount === 1 ? "" : "s"} · before tax
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={checkout}
                    className="h-11 rounded-xl bg-rc-yellow px-6 text-sm font-bold text-gray-900"
                  >
                    View cart
                  </button>
                </div>
              </div>
            ) : null}

            {optionsService ? (
              <OptionsSheet
                service={optionsService}
                quantityOf={(v) => quantityOf(optionsService.serviceId, v.variantId)}
                onAdd={(v) => addLine(optionsService, v)}
                onChange={(v, n) => changeLine(lineKey(optionsService.serviceId, v.variantId), n)}
                onClose={() => setOptionsFor(null)}
                footer={
                  <div className="flex items-center justify-between gap-3">
                    <p className="m-0 text-sm">
                      <span className="font-bold tabular-nums">{formatInr(subtotal)}</span>{" "}
                      <span className="text-gray-500">
                        · {itemCount} item{itemCount === 1 ? "" : "s"}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setOptionsFor(null)}
                      className="h-10 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white"
                    >
                      Done
                    </button>
                  </div>
                }
              />
            ) : null}

            {detailsService ? (
              <DetailsSheet
                service={detailsService}
                iconKind={iconOf(detailsService.serviceId)}
                onClose={() => setDetailsFor(null)}
                action={
                  detailsService.variants.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailsFor(null);
                        setOptionsFor(detailsService.serviceId);
                      }}
                      className="h-11 w-full rounded-xl bg-rc-yellow text-sm font-bold text-gray-900"
                    >
                      Choose an option
                    </button>
                  ) : quantityOf(detailsService.serviceId) > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDetailsFor(null)}
                      className="h-11 w-full rounded-xl bg-gray-900 text-sm font-semibold text-white"
                    >
                      In your cart · Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={detailsService.price == null}
                      onClick={() => {
                        addLine(detailsService);
                        setDetailsFor(null);
                      }}
                      className="h-11 w-full rounded-xl bg-rc-yellow text-sm font-bold text-gray-900 disabled:opacity-50"
                    >
                      Add to cart
                    </button>
                  )
                }
              />
            ) : null}
          </>
        )}
      </main>
    </StorefrontShell>
  );
}
