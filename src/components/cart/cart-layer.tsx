"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, type AddCandidate } from "@/src/lib/cart";
import { CartIcon, CloseIcon, TrashIcon } from "@/src/components/icons";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Mounted once (in Providers). Renders the variant picker + mini-cart popup. */
export function CartLayer() {
  return (
    <>
      <VariantModal />
      <MiniCart />
    </>
  );
}

function VariantModal() {
  const { variantTarget } = useCart();
  if (!variantTarget) return null;
  // Keyed so the picker remounts (and re-defaults its selection) per service.
  return <VariantPicker key={variantTarget.serviceId} target={variantTarget} />;
}

function VariantPicker({ target: variantTarget }: { target: AddCandidate }) {
  const { closeVariant, confirmAdd } = useCart();
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(
    variantTarget.variants[0]?.variantId ?? null,
  );

  // Slot categories: once a variant is chosen, go to the schedule step (date +
  // shift), which adds the item and routes to checkout. Every other category
  // adds the chosen variant straight to the cart (no slot step).
  const confirmSelection = () => {
    if (selected == null) return;
    if (!variantTarget.useSlots) {
      confirmAdd(variantTarget.serviceId, selected);
      closeVariant();
      return;
    }
    const variant = variantTarget.variants.find((v) => v.variantId === selected);
    const qs = new URLSearchParams({
      variantId: String(selected),
      variantName: variant?.name ?? "",
      name: variantTarget.name,
      image: variant?.profileImage ?? variantTarget.profileImage ?? "",
    });
    closeVariant();
    router.push(`/booking/${variantTarget.serviceId}?${qs.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeVariant}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Choose an option
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">{variantTarget.name}</p>
          </div>
          <button
            onClick={closeVariant}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {variantTarget.variants.map((v) => {
            const active = selected === v.variantId;
            return (
              <button
                key={v.variantId}
                onClick={() => setSelected(v.variantId)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-gray-900 ring-2 ring-gray-900/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      active ? "border-gray-900" : "border-gray-300"
                    }`}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-gray-900" />
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {inr(v.price)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          disabled={selected == null}
          onClick={confirmSelection}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
        >
          {variantTarget.useSlots ? "Continue ›" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}

function MiniCart() {
  const { miniOpen, closeMini, cart, count, removeItem } = useCart();
  const router = useRouter();

  const items = cart?.items ?? [];

  const goToCart = () => {
    closeMini();
    router.push("/cart");
  };

  return (
    <AnimatePresence>
      {miniOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40"
            onClick={closeMini}
            aria-hidden
          />

          {/* Drawer — full viewport height, slides in from the right edge */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 38,
              mass: 0.9,
            }}
            className="absolute inset-y-0 right-0 flex h-dvh w-full max-w-sm flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CartIcon className="h-5 w-5 text-gray-900" />
                <h3 className="text-base font-bold text-gray-900">
                  Your cart{count > 0 ? ` (${count})` : ""}
                </h3>
              </div>
              <button
                onClick={closeMini}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Items — fills the drawer, scrolls when the list is longer than the screen */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center text-gray-400">
                  <CartIcon className="h-10 w-10" />
                  <p className="mt-3 text-sm">Your cart is empty</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl p-2 transition hover:bg-gray-50"
                      onClick={goToCart}
                      title="View cart"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external image
                          <img
                            src={item.image}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg">
                            🧰
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.name}
                        </p>
                        {item.variantName ? (
                          <p className="truncate text-xs text-gray-400">
                            {item.variantName}
                          </p>
                        ) : null}
                        <p className="text-xs text-gray-500">
                          Qty {item.quantity} · {inr(item.price)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {inr(item.total)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.id);
                          }}
                          aria-label="Remove"
                          className="text-gray-300 transition hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {inr(cart?.priceSummary?.itemTotal ?? 0)}
                  </span>
                </div>
                <button
                  onClick={goToCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  View cart &amp; checkout
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
