"use client";

/**
 * "Add more at the same time": extra services on one booking, sharing the
 * main service's date and time. Hourly bookings (chef, helpers and waiters)
 * take other hourly services; a Deep Cleaning package takes other packages.
 * Each extra becomes its own booking when the order is placed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
} from "@/src/api/api";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { fmtDateShort, fmtTime } from "@/src/lib/booking-v2/schedule";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import { isCleaningCategory } from "@/src/lib/booking-v2/cleaning";
import {
  extraBase,
  extraFromService,
  extraProblem,
  isFixedDraft,
  type BookingDraft,
  type DraftExtra,
} from "@/src/lib/booking-v2/draft";
import { CloseIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";
import { Card, SectionTitle, Thumb } from "./shell";
import { emojiForCategory } from "./category-page-v2";

interface Candidate {
  service: CategoryTreeService;
  category: CategoryTreeNode;
  extra: DraftExtra;
}

/**
 * Services that can join this booking, in sections: one per category, or
 * one per sub-category (Washroom, Kitchen, …) where a category has them.
 * Cheapest first in each.
 */
function candidatesFor(draft: BookingDraft, tree: CategoryTreeNode[] | undefined) {
  if (!tree) return [];
  const fixed = isFixedDraft(draft);
  const toItems = (category: CategoryTreeNode, services: CategoryTreeService[]): Candidate[] =>
    services
      .filter((s) => s.isActive !== false && s.serviceId !== draft.serviceId)
      .map((service) => ({ service, category, extra: extraFromService(service, category) }))
      .filter((c) => c.extra.rate > 0)
      .sort((a, b) => a.extra.rate - b.extra.rate);

  return tree
    .filter((c) => c.isPublished !== false && !c.comingSoon)
    .filter((c) => (fixed ? isCleaningCategory(c.name) : categoryUsesSlots(c.name)))
    .flatMap((category) => [
      { key: `c${category.categoryId}`, title: category.name, category, items: toItems(category, category.services) },
      ...category.groups
        .filter((g) => g.isPublished !== false)
        .map((g) => ({ key: `g${g.groupId}`, title: g.name, category, items: toItems(category, g.services) })),
    ])
    .filter((section) => section.items.length > 0);
}

export function ExtraServices({
  draft,
  update,
}: {
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
}) {
  const [open, setOpen] = useState(false);
  const extras = draft.extras ?? [];
  const fixed = isFixedDraft(draft);
  const when = fixed
    ? `${fmtDateShort(draft.date)}, from ${fmtTime(draft.start)}`
    : `${fmtDateShort(draft.date)}, ${fmtTime(draft.start)} to ${fmtTime(draft.end)}`;

  const remove = (serviceId: number) =>
    update({ extras: extras.filter((x) => x.serviceId !== serviceId) });

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle note={`Same date and time: ${when}. Each one is booked separately.`}>
        Add more services
      </SectionTitle>

      {extras.length > 0 ? (
        <ul className="m-0 mt-4 list-none divide-y divide-gray-100 p-0">
          {extras.map((x) => {
            const problem = extraProblem(draft, x);
            return (
              <li key={x.serviceId} className="flex items-center gap-3 py-3">
                <Thumb src={x.serviceImage} size="sm">
                  {emojiForCategory(x.categoryName)}
                </Thumb>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">{x.serviceName}</p>
                  {x.subtitle ? <p className="m-0 truncate text-xs text-gray-500">{x.subtitle}</p> : null}
                  <p className={`m-0 text-xs ${problem ? "text-rc-red" : "font-semibold text-gray-700"}`}>
                    {problem ?? formatInr(extraBase(draft, x))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(x.serviceId)}
                  aria-label={`Remove ${x.serviceName}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-rc-red"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rc-yellow-deep text-sm font-semibold text-rc-yellow-deep transition hover:bg-rc-yellow-tint/40"
      >
        <PlusIcon className="h-4 w-4" />
        {extras.length ? "Add another service" : "Add a service"}
      </button>

      <PickerSheet open={open} onClose={() => setOpen(false)} draft={draft} update={update} />
    </Card>
  );
}

function PickerSheet({
  open,
  onClose,
  draft,
  update,
}: {
  open: boolean;
  onClose: () => void;
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Same tree (and cache entry) the wizard uses for deep links.
  const tree = useQuery({
    queryKey: queryKeys.categoryTreeAt(null),
    queryFn: () => categoryTreeApi.tree(null),
    enabled: open,
  });
  const groups = useMemo(() => candidatesFor(draft, tree.data), [draft, tree.data]);
  const extras = draft.extras ?? [];
  const added = new Set(extras.map((x) => x.serviceId));
  // Latest list, so two quick taps both land (the second must not start from
  // the list the first one replaced).
  const latest = useRef(extras);
  useEffect(() => {
    latest.current = draft.extras ?? [];
  }, [draft.extras]);

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

  const toggle = (c: Candidate) => {
    const current = latest.current;
    const next = current.some((x) => x.serviceId === c.service.serviceId)
      ? current.filter((x) => x.serviceId !== c.service.serviceId)
      : [...current, c.extra];
    latest.current = next;
    update({ extras: next });
  };

  if (!mounted) return null;

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
            aria-label="Add a service"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="m-0 text-lg font-bold text-gray-900">Add a service</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tree.isLoading ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <SpinnerIcon className="h-6 w-6" />
                </div>
              ) : tree.isError ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  Could not load services. Close this and try again.
                </p>
              ) : groups.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  No other services can be booked for this time.
                </p>
              ) : (
                groups.map(({ key, title, category, items }) => (
                  <section key={key} className="py-2">
                    <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {title}
                    </h3>
                    <ul className="m-0 list-none p-0">
                      {items.map((c) => {
                        const on = added.has(c.service.serviceId);
                        const problem = extraProblem(draft, c.extra);
                        return (
                          <li key={c.service.serviceId} className="flex items-center gap-3 py-2.5">
                            <Thumb src={c.extra.serviceImage} size="sm">
                              {emojiForCategory(category.name)}
                            </Thumb>
                            <div className="min-w-0 flex-1">
                              <p className="m-0 truncate text-sm font-semibold text-gray-900">
                                {c.service.name}
                              </p>
                              {c.service.subtitle ? (
                                <p className="m-0 line-clamp-2 text-xs text-gray-500">{c.service.subtitle}</p>
                              ) : null}
                              <p
                                className={`m-0 mt-0.5 text-xs ${problem ? "text-rc-red" : "font-semibold text-gray-700"}`}
                              >
                                {problem ?? formatInr(extraBase(draft, c.extra))}
                                {!problem && !isFixedDraft(draft) ? (
                                  <span className="font-normal text-gray-500"> for these hours</span>
                                ) : null}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!!problem && !on}
                              onClick={() => toggle(c)}
                              aria-pressed={on}
                              className={`h-9 min-w-20 shrink-0 rounded-full px-4 text-sm font-bold transition disabled:opacity-40 ${
                                on
                                  ? "bg-rc-ink text-white"
                                  : "border border-rc-yellow-deep/50 text-rc-yellow-deep hover:bg-rc-yellow-tint"
                              }`}
                            >
                              {on ? "Added" : "Add"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>

            <div className="border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="h-12 w-full rounded-full bg-rc-yellow text-sm font-bold text-rc-ink transition hover:brightness-95"
              >
                {extras.length ? `Done · ${extras.length} added` : "Done"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
