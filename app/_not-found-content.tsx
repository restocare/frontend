"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";

export interface CategoryLink {
  name: string;
  href: string;
}

interface NotFoundContentProps {
  categoryLinks: CategoryLink[];
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function NotFoundContent({ categoryLinks }: NotFoundContentProps) {
  const [search, setSearch] = useState("");

  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-white">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          {/* Status */}
          <p className="text-[80px] font-black leading-none tracking-tighter text-gray-100 sm:text-[120px]">
            404
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-orange-600">
            Page not found
          </p>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            We couldn&apos;t find that page.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-gray-500">
            The link may be outdated or the page may have moved. Try one of
            these instead:
          </p>

          {/* Primary link */}
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
          >
            <HomeIcon className="h-4 w-4" />
            Back to home
          </Link>

          {/* Secondary links */}
          <div className="mt-10 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-left">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Browse our services
            </p>
            <ul className="space-y-2">
              {categoryLinks.map(({ name, href }) => (
                <li key={name}>
                  <Link
                    href={href}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  >
                    {name}
                    <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/products"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white hover:text-gray-900 hover:shadow-sm"
                >
                  Restaurant Cleaning Chemicals &amp; Supplies
                  <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white hover:text-gray-900 hover:shadow-sm"
                >
                  Contact us
                  <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
