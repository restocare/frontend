"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCart } from "@/src/lib/cart";
import { SpinnerIcon, TrashIcon } from "@/src/components/icons";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function CartPage() {
  const [search, setSearch] = useState("");
  const { cart, isLoading, updateQuantity, removeItem } = useCart();

  const items = cart?.items ?? [];
  const summary = cart?.priceSummary ?? {};

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Your cart
        </h1>

        {isLoading ? (
          <div className="flex h-[40vh] items-center justify-center text-gray-400">
            <SpinnerIcon className="h-7 w-7" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <p className="text-5xl">🛒</p>
            <p className="mt-3 text-sm text-gray-500">Your cart is empty.</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Browse services
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external image
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">
                        🧰
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.name}
                    </p>
                    {item.variantName ? (
                      <p className="truncate text-xs text-gray-400">
                        {item.variantName}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-sm text-gray-500">
                      {inr(item.price)}
                    </p>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1 rounded-full border border-gray-200">
                    <button
                      onClick={() => updateQuantity(item, "decrement")}
                      aria-label="Decrease quantity"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item, "increment")}
                      aria-label="Increase quantity"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {inr(item.total)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="text-gray-300 transition hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Price summary */}
            <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-20">
              <h2 className="text-base font-bold text-gray-900">
                Price details
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Service charges" value={inr(summary.itemTotal ?? 0)} />
                <Row label="Taxes (18%)" value={inr(summary.tax ?? 0)} />
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-base font-bold text-gray-900">
                  Grand total
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {/* Item total + GST, as the customer app shows it — the API's
                      own grandTotal has a discount taken off that no booking
                      honours. Coupons are applied at checkout. */}
                  {inr((summary.itemTotal ?? 0) + (summary.tax ?? 0))}
                </span>
              </div>
              <Link
                href="/checkout"
                className="mt-5 block w-full rounded-xl bg-orange-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                Proceed to checkout
              </Link>
              <Link
                href="/"
                className="mt-3 block text-center text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${accent ?? "text-gray-900"}`}>{value}</dd>
    </div>
  );
}
