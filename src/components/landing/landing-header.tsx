"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
} from "@/src/api/api";
import { useCurrentLocation } from "@/src/lib/location";
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
  const boxRef = useRef<HTMLDivElement>(null);

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

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
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

        {/* Primary nav */}
        <nav className="ml-1 hidden items-center gap-5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Location picker */}
        <button
          onClick={location.detect}
          title={location.label || "Use my current location"}
          className="ml-auto hidden h-10 max-w-72 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-left transition hover:border-orange-300 hover:bg-orange-50/50 sm:flex"
        >
          <MapPinIcon className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="truncate text-sm text-gray-700">
            {location.loading ? "Detecting…" : location.label}
          </span>
          {location.loading ? (
            <SpinnerIcon className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
          )}
        </button>

        {/* Search + live dropdown */}
        <div
          ref={boxRef}
          className="relative w-full max-w-xs sm:ml-2 sm:w-auto sm:flex-1 sm:max-w-sm"
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search for services or categories"
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20"
          />

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
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
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Cart"
            onClick={openMini}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100"
          >
            <CartIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold leading-none text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
          {isLoggedIn ? (
            <Link
              href="/account"
              title={`My account${user?.name ? ` (${user.name})` : user?.mobile ? ` (${user.mobile})` : ""}`}
              aria-label="My account"
              className="flex h-10 items-center rounded-full px-1 text-gray-700 transition hover:bg-gray-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {(user?.name ?? user?.mobile ?? "U").slice(0, 1).toUpperCase()}
              </span>
            </Link>
          ) : (
            <Link
              href="/account/login"
              aria-label="Account"
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100"
            >
              <UserCircleIcon className="h-5 w-5" />
            </Link>
          )}

          {/* Mobile menu toggle (nav links are hidden below lg) */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 lg:hidden"
          >
            {menuOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="border-t border-gray-100 bg-white lg:hidden">
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
            {/* Detect location too — the picker button is hidden on small screens */}
            <button
              onClick={() => {
                location.detect();
                setMenuOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:hidden"
            >
              <MapPinIcon className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="truncate">
                {location.loading ? "Detecting…" : location.label || "Use my location"}
              </span>
            </button>
          </nav>
        </div>
      )}
    </header>
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
