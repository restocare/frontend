"use client";

/**
 * Deep Cleaning area picker, opened from the home page tile. Each area opens
 * its own page, e.g. /category/deep-cleaning/washroom.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { CategoryTreeGroup, CategoryTreeNode } from "@/src/api/api";
import { categoryHref } from "@/lib/category-slugs";
import { subSlugOf } from "@/src/lib/booking-v2/cleaning";
import { SubIcon, subIconFor } from "@/src/components/booking-v2/cleaning-catalog";
import { CloseIcon } from "@/src/components/icons";

/** Ask Cloudinary for a small copy: the icon shows at up to 44px. */
function thumb(url: string): string {
  return url.includes("/image/upload/")
    ? url.replace("/image/upload/", "/image/upload/w_96,h_96,c_fit,f_auto,q_auto/")
    : url;
}

export function CleaningSubcategoryDialog({
  category,
  open,
  onClose,
}: {
  category: CategoryTreeNode;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const href = categoryHref(category.categoryId);

  // Portal target exists only in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const go = (to: string) => {
    onClose();
    router.push(to);
  };

  if (!mounted) return null;

  // Portalled to <body>: the home tile has a transform, which would otherwise
  // trap this "fixed" layer inside the tile's section.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-rc-ink/50"
          />

          <motion.div
            role="dialog"
            aria-modal
            aria-label={`${category.name}: choose an area`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-xl rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6 lg:p-7"
          >
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{category.name}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 min-[360px]:grid-cols-3 sm:gap-3">
              {category.groups.map((group) => (
                <AreaButton
                  key={group.groupId}
                  group={group}
                  onPick={() => go(`${href}/${subSlugOf(group.name)}`)}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function AreaButton({ group, onPick }: { group: CategoryTreeGroup; onPick: () => void }) {
  const soon = group.isPublished === false;
  return (
    <button
      type="button"
      disabled={soon}
      onClick={onPick}
      title={soon ? "Coming soon" : undefined}
      className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-2 py-4 text-center sm:py-5 transition hover:border-rc-yellow hover:bg-rc-yellow-tint/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rc-yellow-tint text-rc-yellow-deep transition-transform group-hover:scale-105 sm:h-15 sm:w-15">
        {group.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- small catalogue icon
          <img
            src={thumb(group.profileImage)}
            alt=""
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            className="h-9 w-9 object-contain sm:h-11 sm:w-11"
          />
        ) : (
          <SubIcon kind={subIconFor(group.name)} className="h-7 w-7 sm:h-8 sm:w-8" />
        )}
      </span>
      <span className="text-[13px] font-semibold leading-tight text-gray-800 sm:text-sm">{group.name}</span>
    </button>
  );
}
