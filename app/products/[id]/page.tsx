"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { CursorFollower } from "@/src/components/landing/cursor-follower";
import { SpinnerIcon } from "@/src/components/icons";
import { getProduct, listProducts, formatInr } from "@/src/data/products";
import { useProductCart } from "@/src/lib/product-cart";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useProductCart();

  const { data: product, isLoading } = useQuery({
    queryKey: ["products", "detail", id],
    queryFn: () => getProduct(id),
  });

  const { data: all } = useQuery({
    queryKey: ["products", "list"],
    queryFn: () => listProducts(),
  });

  const related = (all ?? [])
    .filter((p) => product && p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <LandingHeader search={search} onSearchChange={setSearch} />
        <div className="flex h-[60vh] items-center justify-center">
          <SpinnerIcon className="h-7 w-7 text-emerald-600" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <LandingHeader search={search} onSearchChange={setSearch} />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-5xl">🔍</p>
          <p className="text-sm text-gray-500">This product doesn&apos;t exist.</p>
          <Link
            href="/products"
            className="rounded-full bg-rc-yellow px-5 py-2.5 text-sm font-bold text-gray-900 hover:brightness-95"
          >
            Back to products
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const handleAdd = () => {
    add(product.id, qty);
    setAdded(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-gray-600">Products</Link>
          <span>/</span>
          <span className="text-gray-600">{product.category}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
            <div className="aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- external product image */}
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {product.mrp && (
              <span className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">
              {product.category}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{product.tagline}</p>

            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                ⭐ {product.rating.toFixed(1)}
              </span>
              <span className={`text-xs font-semibold ${product.inStock ? "text-emerald-600" : "text-red-500"}`}>
                {product.inStock ? "● In stock" : "● Out of stock"}
              </span>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <span className="text-3xl font-bold text-gray-900">
                {formatInr(product.price)}
              </span>
              {product.mrp && (
                <span className="mb-1 text-base text-gray-400 line-through">
                  {formatInr(product.mrp)}
                </span>
              )}
              <span className="mb-1 text-sm text-gray-500">/ {product.unit}</span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              {product.description}
            </p>

            {/* Features */}
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {product.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-emerald-600">✓</span> {f}
                </li>
              ))}
            </ul>

            {/* Quantity + actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-gray-300">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center text-lg font-bold text-gray-600 hover:text-gray-900"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-bold text-gray-900">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center text-lg font-bold text-gray-600 hover:text-gray-900"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                disabled={!product.inStock}
                onClick={handleAdd}
                className="flex-1 rounded-full bg-rc-yellow px-6 py-3 text-sm font-bold text-gray-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                {product.inStock ? (added ? "Added ✓ — add more" : "Add to Cart") : "Unavailable"}
              </button>
            </div>

            {added && (
              <button
                onClick={() => router.push("/products/cart")}
                className="mt-3 w-full rounded-full border border-emerald-600 px-6 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
              >
                Go to Cart →
              </button>
            )}

            {/* Specs */}
            <div className="mt-8 rounded-2xl border border-gray-200">
              <p className="border-b border-gray-200 px-4 py-3 text-sm font-bold text-gray-900">
                Specifications
              </p>
              <dl className="divide-y divide-gray-100">
                {product.specs.map((s) => (
                  <div key={s.label} className="flex justify-between px-4 py-2.5 text-sm">
                    <dt className="text-gray-500">{s.label}</dt>
                    <dd className="font-medium text-gray-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-bold text-gray-900">You might also need</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external product image */}
                    <img
                      src={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{p.name}</h3>
                    <p className="mt-1 text-sm font-bold text-emerald-700">{formatInr(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
