"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useProductCart } from "@/src/lib/product-cart";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { formatInr } from "@/src/data/products";

const WHATSAPP_NUMBER = "919953532995";

export default function ProductCartPage() {
  const [search, setSearch] = useState("");
  const { items, subtotal, setQty, remove, clear } = useProductCart();
  const { user } = useCustomerAuth();

  const placeOrder = () => {
    const lines = items
      .map((i) => `• ${i.product.name} (${i.product.unit}) × ${i.qty} = ${formatInr(i.lineTotal)}`)
      .join("\n");
    const who = user?.name ? `\nName: ${user.name}` : "";
    const phone = user?.mobile ? `\nPhone: ${user.mobile}` : "";
    const message =
      `Hi RestoCare, I'd like to order these products:\n\n${lines}\n\n` +
      `Total: ${formatInr(subtotal)}${who}${phone}`;
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/products" className="text-2xl leading-none text-gray-900" aria-label="Back">
            ←
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Product Cart</h1>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-5xl">🛒</p>
            <p className="mt-3 text-sm text-gray-500">Your product cart is empty.</p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((i) => (
                <div
                  key={i.productId}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3"
                >
                  <Link href={`/products/${i.productId}`} className="shrink-0">
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element -- external product image */}
                      <img src={i.product.image} alt={i.product.name} className="h-full w-full object-cover" />
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${i.productId}`}>
                      <p className="truncate text-sm font-semibold text-gray-900">{i.product.name}</p>
                    </Link>
                    <p className="text-xs text-gray-400">{i.product.unit}</p>
                    <p className="mt-0.5 text-sm font-bold text-gray-900">{formatInr(i.product.price)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center rounded-full border border-gray-300">
                      <button
                        onClick={() => setQty(i.productId, i.qty - 1)}
                        className="flex h-8 w-8 items-center justify-center text-base font-bold text-gray-600 hover:text-gray-900"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-gray-900">{i.qty}</span>
                      <button
                        onClick={() => setQty(i.productId, i.qty + 1)}
                        className="flex h-8 w-8 items-center justify-center text-base font-bold text-gray-600 hover:text-gray-900"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => remove(i.productId)}
                      className="text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-900">{formatInr(subtotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-gray-500">Delivery</span>
                <span className="text-gray-500">Calculated on confirmation</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-lg font-bold text-emerald-700">{formatInr(subtotal)}</span>
              </div>

              <button
                onClick={placeOrder}
                className="mt-4 w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Place Order via WhatsApp
              </button>
              <button
                onClick={clear}
                className="mt-2 w-full rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Clear cart
              </button>
              <p className="mt-3 text-center text-[11px] text-gray-400">
                Product ordering is handled over WhatsApp until online checkout is enabled.
              </p>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
