"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { CursorFollower } from "@/src/components/landing/cursor-follower";
import { SpinnerIcon } from "@/src/components/icons";
import {
  listProducts,
  formatInr,
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@/src/data/products";
import { useProductCart } from "@/src/lib/product-cart";

export function ProductsContent() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<ProductCategory | "All">("All");
  const { add, count } = useProductCart();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", "list"],
    queryFn: () => listProducts(),
  });

  const products = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      const matchCat = activeCat === "All" || p.category === activeCat;
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [data, search, activeCat]);

  return (
    <div className="min-h-screen bg-white">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />

      {/* Hero */}
      <section className="border-b border-gray-100 bg-white px-4 py-14 text-gray-900 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide ">
            Restaurant Supplies
          </p>
          <h1 className="text-xl font-bold tracking-tight sm:text-4xl">
            Chemical &amp; Cleaning Products
          </h1>
          <p className="mt-3 max-w-xl text-sm text-gray-600 sm:text-base">
            Commercial-grade cleaning, sanitizing and degreasing products for your
            kitchen — delivered to your door.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(["All", ...PRODUCT_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                activeCat === cat
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <SpinnerIcon className="h-7 w-7 text-emerald-600" />
          </div>
        ) : isError ? (
          <p className="py-20 text-center text-sm text-gray-500">
            Couldn&apos;t load products.
          </p>
        ) : products.length === 0 ? (
          <p className="py-20 text-center text-sm text-gray-500">
            No products match your search.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <Link href={`/products/${p.id}`} className="relative block">
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external product image */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  {!p.inStock && (
                    <span className="absolute left-2 top-2 rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
                      Out of stock
                    </span>
                  )}
                  {p.mrp && p.inStock && (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {Math.round(((p.mrp - p.price) / p.mrp) * 100)}% OFF
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">
                    {p.category}
                  </p>
                  <Link href={`/products/${p.id}`}>
                    <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900 hover:text-emerald-700">
                      {p.name}
                    </h3>
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-400">{p.unit}</p>

                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-base font-bold text-gray-900">
                      {formatInr(p.price)}
                    </span>
                    {p.mrp && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatInr(p.mrp)}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={!p.inStock}
                    onClick={() => add(p.id)}
                    className="mt-auto w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {p.inStock ? "Add to Cart" : "Unavailable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating cart button (when items present) */}
      {count > 0 && (
        <Link
          href="/products/cart"
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-gray-800"
        >
          🛒 Cart
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-xs">
            {count}
          </span>
        </Link>
      )}

      <Footer />
    </div>
  );
}
