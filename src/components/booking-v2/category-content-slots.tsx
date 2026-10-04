"use client";

/**
 * The category page's client tree renders the banner and the footer, so
 * server-rendered content that belongs between them (the intro, the FAQs)
 * is passed in as ready-made nodes and dropped into place by these slots.
 * The nodes stay Server Components, so they are in the raw HTML.
 */

import { createContext, useContext, type ReactNode } from "react";

interface Slots {
  /** Replaces the category name as the page H1. */
  heading?: string;
  intro?: ReactNode;
  faqs?: ReactNode;
}

const SlotsContext = createContext<Slots>({});

export function CategoryContentProvider({
  heading,
  intro,
  faqs,
  children,
}: Slots & { children: ReactNode }) {
  return <SlotsContext.Provider value={{ heading, intro, faqs }}>{children}</SlotsContext.Provider>;
}

export function useCategoryHeading(): string | undefined {
  return useContext(SlotsContext).heading;
}

export function CategoryIntroSlot() {
  return <>{useContext(SlotsContext).intro}</>;
}

export function CategoryFaqSlot() {
  return <>{useContext(SlotsContext).faqs}</>;
}
