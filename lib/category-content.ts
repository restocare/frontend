/**
 * Approved on-page copy for the Phase 1 category pages, from
 * docs/seo/category-briefs.md. Used word for word: the H1, the intro under
 * the banner, and the FAQs (visible on the page and in the FAQPage JSON-LD).
 * A slug with no entry here keeps the page's default heading and has no
 * intro or FAQ section. Electrician has no FAQs by design (none approved),
 * so its page renders no FAQ section and no FAQPage JSON-LD.
 */
import type { HourlyTerms } from "@/src/lib/booking-v2/hourly-terms";

export interface CategoryFaq {
  q: string;
  a: string;
}

export interface CategoryContent {
  h1: string;
  intro: string;
  faqs: CategoryFaq[];
}

const ELECTRICIAN_DESCRIPTION =
  "Book an electrician for your restaurant or commercial kitchen in Delhi NCR, priced per job, with taxes extra.";

const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  chef: {
    h1: "Hire a Chef for Your Restaurant in Delhi NCR",
    intro:
      "Need a chef for your restaurant or cafe? RestoCare gives you a chef for a 5-hour or 10-hour shift, or for a full week. {price} Pick the cuisine, the shift and the day, and book online.",
    faqs: [
      {
        q: "How fast can I get a chef?",
        a: "Same day. We assign a chef on the day you book, and they arrive the same day.",
      },
      {
        q: "Which cuisines can your chefs cook?",
        a: "Indian Curry, South Indian, Continental, Chinese, Tandoor.",
      },
      {
        q: "Can I book a chef for just one shift?",
        a: "Yes. The shortest shift is 5 hours.",
      },
      {
        q: "Do I need to provide ingredients and equipment?",
        a: "The restaurant provides ingredients and kitchen equipment.",
      },
      {
        q: "What's the difference between day and night shifts?",
        a: "Day shift: 8 am to 6 pm. Night shift: 6 pm to 4 am.",
      },
      {
        q: "How do I pay, and do I get a GST invoice?",
        a: "You can pay by UPI, cards or net banking. Yes, you get a GST invoice.",
      },
    ],
  },
  "helpers-and-waiters": {
    h1: "Hire Kitchen Helpers and Waiters for Your Restaurant",
    intro:
      "Short-staffed today? Book a kitchen helper, a waiter or housekeeping and utility staff for a 5-hour or 10-hour shift, or for a week. {price} Choose the role and the shift, and book online.",
    faqs: [
      {
        q: "How quickly can I get staff?",
        a: "We assign staff within 2 hours, and they arrive the same shift.",
      },
      {
        q: "Can I book several helpers or waiters at once?",
        a: "Yes. You can book several at once, depending on availability.",
      },
      {
        q: "What does each role do?",
        a: "Kitchen Helper: Supports the kitchen team with prep, washing up and keeping the kitchen clean. Waiter: Serves guests, takes orders and clears tables. Housekeeping / Utility: Keeps the dining and utility areas clean and tidy.",
      },
      {
        q: "Can I book for an event or party, not only a restaurant?",
        a: "Yes, you can book for events and parties as well as restaurants.",
      },
      {
        q: "How do I pay, and do I get a GST invoice?",
        a: "You can pay by UPI, cards or net banking. Yes, you get a GST invoice.",
      },
    ],
  },
  "deep-cleaning": {
    h1: "Restaurant & Commercial Kitchen Deep Cleaning in Delhi NCR",
    intro:
      "From the burners and exhaust to the floors, walls and freezers, RestoCare cleans your commercial kitchen item by item. Choose what you need and book online.",
    faqs: [
      {
        q: "How do I pay, and do I get a GST invoice?",
        a: "You can pay by UPI, cards or net banking. Yes, you get a GST invoice.",
      },
    ],
  },
  electrician: {
    h1: "Electrician for Restaurants in Delhi NCR",
    intro: ELECTRICIAN_DESCRIPTION,
    faqs: [],
  },
};

/**
 * The approved copy for a slug. Where the intro carries a {price} slot it is
 * filled from the live hourly headline, and dropped (with its leading space)
 * when there is no rate.
 */
export function categoryContent(
  slug: string,
  headline?: HourlyTerms | null,
): CategoryContent | undefined {
  if (!Object.hasOwn(CATEGORY_CONTENT, slug)) return undefined;
  const content = CATEGORY_CONTENT[slug];
  const sentence = headline
    ? ` Book at ₹${headline.rate} per hour, with a ${headline.minHours}-hour minimum of ₹${headline.minPrice}.`
    : "";
  return { ...content, intro: content.intro.replace(" {price}", () => sentence) };
}
