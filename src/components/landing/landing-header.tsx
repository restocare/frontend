"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
import { fetchPlaceSuggestions, type PlaceSuggestion } from "@/src/lib/google-maps";
import { useCart } from "@/src/lib/cart";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import {
  CartIcon,
  ChevronDownIcon,
  CloseIcon,
  MapPinIcon,
  MenuIcon,
  SearchIcon,
  SpinnerIcon,
  UserCircleIcon,
} from "@/src/components/icons";

const LOGO_URL =
  "https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png";

const NAV_LINKS = [
  // Root-relative so they work from any route (e.g. /account, /category/[id]):
  // they navigate home and scroll to the section, not to "/current-path#section".
  { label: "Categories", href: "/#categories" },
  { label: "Services", href: "/#services" },
  { label: "Products", href: "/products" },
  { label: "Careers", href: "/careers" },
  { label: "About", href: "/about" },
];

const EMOJI_BY_NAME: Record<string, string> = {
  chef: "👨‍🍳",
  plumber: "🚿",
  electrician: "💡",
  technician: "🛠️",
  "deep cleaning": "🧼",
  "helpers & waiter": "🧑‍🍳",
  "pest controll": "🐜",
  "pest control": "🐜",
  carpenter: "🔨",
};

function emojiFor(name: string): string {
  return EMOJI_BY_NAME[name.trim().toLowerCase()] ?? "🧰";
}

/** Next.js Link with framer-motion gesture props (hover/tap springs). */
const MotionLink = motion.create(Link);

/** Profile photo from the loosely-shaped auth user, when the API sent one. */
function profileImageOf(user: Record<string, unknown> | null): string | null {
  if (!user) return null;
  for (const key of ["profileImage", "profile_image", "image", "avatar", "photo"]) {
    const v = user[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function formatPrice(price: number | null): string {
  if (price == null || price <= 0) return "On request";
  return `₹${price.toLocaleString("en-IN")}`;
}

interface CategoryResult {
  kind: "category";
  categoryId: number;
  name: string;
  profileImage: string | null;
  serviceCount: number;
}

interface ServiceResult {
  kind: "service";
  serviceId: number;
  name: string;
  price: number | null;
  profileImage: string | null;
  categoryId: number;
  categoryName: string;
}

interface LandingHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function LandingHeader({ search, onSearchChange }: LandingHeaderProps) {
  const location = useCurrentLocation();
  const { count, openMini } = useCart();
  const { isLoggedIn, user } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const locRef = useRef<HTMLDivElement>(null);

  // Location-scoped, so search can't surface a service nobody can deliver to
  // this customer. Reuses the header's existing location state.
  const { data } = useQuery({
    queryKey: queryKeys.categoryTreeAt(location.coords),
    queryFn: () => categoryTreeApi.tree(location.coords),
  });

  // Build flat, searchable indexes of categories + every service once.
  const { categories, services } = useMemo(() => {
    const cats: CategoryResult[] = [];
    const svcs: ServiceResult[] = [];
    for (const cat of data ?? ([] as CategoryTreeNode[])) {
      const direct = cat.services;
      const nested = cat.groups.flatMap((g) => g.services);
      cats.push({
        kind: "category",
        categoryId: cat.categoryId,
        name: cat.name,
        profileImage: cat.profileImage,
        serviceCount: direct.length + nested.length,
      });
      for (const s of [...direct, ...nested]) {
        svcs.push({
          kind: "service",
          serviceId: s.serviceId,
          name: s.name,
          price: s.price,
          profileImage: s.profileImage,
          categoryId: cat.categoryId,
          categoryName: cat.name,
        });
      }
    }
    return { categories: cats, services: svcs };
  }, [data]);

  const query = search.trim().toLowerCase();
  const matchedCategories = useMemo(
    () =>
      query
        ? categories.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 4)
        : [],
    [categories, query],
  );
  const matchedServices = useMemo(
    () =>
      query
        ? services.filter((s) => s.name.toLowerCase().includes(query)).slice(0, 6)
        : [],
    [services, query],
  );

  const hasResults = matchedCategories.length > 0 || matchedServices.length > 0;
  const showDropdown = open && query.length > 0;

  // Close dropdowns on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (locRef.current && !locRef.current.contains(e.target as Node)) {
        setLocOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-4">
        {/* Logo + brand name (always visible) */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- external CDN logo */}
          <img src={LOGO_URL} alt="RestoCare" className="h-9 w-auto object-contain" />
          <span className="hidden text-lg font-semibold tracking-tight text-gray-900 sm:inline">
            RestoCare
          </span>
        </Link>

        {/* Primary nav — animated underline slides in on hover */}
        <nav className="ml-1 hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link) => (
            <motion.div
              key={link.label}
              className="relative"
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap={{ scale: 0.94 }}
            >
              <Link
                href={link.href}
                className="text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
              >
                {link.label}
              </Link>
              <motion.span
                aria-hidden
                variants={{
                  rest: { scaleX: 0, opacity: 0 },
                  hover: { scaleX: 1, opacity: 1 },
                }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute -bottom-1.5 left-0 right-0 h-0.5 origin-left rounded-full bg-orange-500"
              />
            </motion.div>
          ))}
        </nav>

        {/* Location picker — auto-detected by default, click to change */}
        <div ref={locRef} className="relative ml-auto hidden sm:block">
          <motion.button
            onClick={() => setLocOpen((v) => !v)}
            title={location.label || "Choose your location"}
            aria-expanded={locOpen}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex h-10 max-w-72 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/50"
          >
            <MapPinIcon className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate text-sm text-gray-700">
              {location.loading ? "Detecting…" : location.shortLabel}
            </span>
            {location.loading ? (
              <SpinnerIcon className="h-4 w-4 shrink-0 text-gray-400" />
            ) : (
              <motion.span
                animate={{ rotate: locOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex shrink-0"
              >
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {locOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute right-0 top-12 z-40 w-80 origin-top-right rounded-2xl border border-gray-100 bg-white p-3 shadow-xl"
              >
                <LocationPicker location={location} onDone={() => setLocOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search + live dropdown */}
        <div
          ref={boxRef}
          className="relative w-full max-w-xs sm:ml-2 sm:w-auto sm:flex-1 sm:max-w-sm"
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <motion.input
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search for services or categories"
            whileFocus={{ scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
          />

          <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] origin-top overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
              {!hasResults ? (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  No matches for “{search.trim()}”
                </div>
              ) : (
                <>
                  {matchedCategories.length > 0 && (
                    <div className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Categories
                      </p>
                      {matchedCategories.map((c) => (
                        <Link
                          key={`c-${c.categoryId}`}
                          href={`/category/${c.categoryId}`}
                          onClick={close}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-gray-50"
                        >
                          <Thumb src={c.profileImage} fallback={emojiFor(c.name)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {c.name}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              Category · {c.serviceCount} services
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-orange-600">
                            View →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {matchedServices.length > 0 && (
                    <div>
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Services
                      </p>
                      {matchedServices.map((s) => (
                        <Link
                          key={`s-${s.serviceId}`}
                          href={`/category/${s.categoryId}?q=${encodeURIComponent(s.name)}`}
                          onClick={close}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-gray-50"
                        >
                          <Thumb src={s.profileImage} fallback={emojiFor(s.categoryName)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {s.name}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              in {s.categoryName}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-gray-900">
                            {formatPrice(s.price)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <motion.button
            aria-label="Cart"
            onClick={openMini}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
          >
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </motion.button>
          {isLoggedIn ? (
            <MotionLink
              href="/account"
              title={`My account${user?.name ? ` (${user.name})` : user?.mobile ? ` (${user.mobile})` : ""}`}
              aria-label="My account"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="flex h-10 items-center rounded-full px-1 text-gray-700 transition-colors hover:bg-gray-100"
            >
              {profileImageOf(user) ? (
                // eslint-disable-next-line @next/next/no-img-element -- external image
                <img
                  src={profileImageOf(user)!}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <UserCircleIcon className="h-4.5 w-4.5" />
                </span>
              )}
            </MotionLink>
          ) : (
            <MotionLink
              href="/account/login"
              aria-label="Account"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
            >
              <UserCircleIcon className="h-5 w-5" />
            </MotionLink>
          )}

          {/* Mobile menu toggle (nav links are hidden below lg) */}
          <motion.button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 lg:hidden"
          >
            {menuOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Mobile nav dropdown — slides open/closed */}
      <AnimatePresence>
      {menuOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden border-t border-gray-100 bg-white lg:hidden"
        >
          <nav className="mx-auto max-w-7xl px-3 py-2 sm:px-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
            {/* Location picker — the header pill is hidden on small screens */}
            <button
              onClick={() => setLocOpen((v) => !v)}
              aria-expanded={locOpen}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:hidden"
            >
              <MapPinIcon className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate">
                {location.loading ? "Detecting…" : location.shortLabel || "Choose location"}
              </span>
              <ChevronDownIcon
                className={`ml-auto h-4 w-4 shrink-0 text-gray-400 transition ${locOpen ? "rotate-180" : ""}`}
              />
            </button>
            {locOpen && (
              <div className="mb-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:hidden">
                <LocationPicker
                  location={location}
                  onDone={() => {
                    setLocOpen(false);
                    setMenuOpen(false);
                  }}
                />
              </div>
            )}
          </nav>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  );
}

/**
 * Body of the location dropdown: "use my current location" plus a Google
 * Places search for booking from another address.
 */
function LocationPicker({
  location,
  onDone,
}: {
  location: ReturnType<typeof useCurrentLocation>;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ignore out-of-order responses from older keystrokes.
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      seqRef.current++;
      queueMicrotask(() => {
        setResults([]);
        setSearching(false);
      });
      return;
    }
    const seq = ++seqRef.current;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await fetchPlaceSuggestions(q);
        if (seqRef.current !== seq) return;
        setResults(found);
        setFailed(false);
      } catch {
        if (seqRef.current !== seq) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (seqRef.current === seq) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const pick = async (suggestion: PlaceSuggestion) => {
    try {
      const { lat, lng } = await suggestion.resolve();
      location.setPlace({
        label: `${suggestion.label}, ${suggestion.address}`,
        shortLabel: suggestion.label,
        coords: { lat, lng },
      });
      onDone();
    } catch {
      setFailed(true);
    }
  };

  return (
    <div>
      <button
        onClick={() => {
          location.detect();
          onDone();
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
      >
        <MapPinIcon className="h-4 w-4 shrink-0" />
        Use my current location
      </button>

      <div className="relative mt-2">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area, locality or city"
          autoFocus
          className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
        />
        {searching && (
          <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="mt-2 max-h-64 overflow-y-auto">
          {results.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => void pick(s)}
                className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
              >
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {s.label}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{s.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {failed && (
        <p className="mt-2 px-3 text-xs text-gray-500">
          Search isn’t available right now. Use your current location instead.
        </p>
      )}
    </div>
  );
}

function Thumb({ src, fallback }: { src: string | null; fallback: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external image
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-lg">{fallback}</span>
      )}
    </div>
  );
}
