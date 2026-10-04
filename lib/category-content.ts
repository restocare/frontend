/**
 * Approved on-page copy for the Phase 1 category pages, from
 * docs/seo/category-briefs.md. Used word for word: the H1, the intro under
 * the banner, and the FAQs (visible on the page and in the FAQPage JSON-LD).
 * A slug with no entry here keeps the page's default heading and has no
 * intro or FAQ section.
 */
export interface CategoryFaq {
  q: string;
  a: string;
}

export interface CategoryContent {
  h1: string;
  intro: string;
  faqs: CategoryFaq[];
}

const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  chef: {
    h1: "Hire a Chef for Your Restaurant in Delhi NCR",
    intro:
      "Need a chef for your restaurant or cafe? RestoCare gives you a chef for a 5-hour or 10-hour shift, or for a full week. Shifts start at ₹799 for 5 hours. Pick the cuisine, the shift and the day, and book online.",
    faqs: [
      {
        q: "How fast can I get a chef?",
        a: "Assignment: Same day, arrival: Same day.",
      },
      {
        q: "Which cuisines can your chefs cook?",
        a: "Indian Curry, South Indian, Continental, Chinese, Tandoor.",
      },
      {
        q: "Can I book a chef for just one shift?",
        a: "5 hours, the shortest shift in the catalogue.",
      },
      {
        q: "Do I need to provide ingredients and equipment?",
        a: "The restaurant provides ingredients and kitchen equipment.",
      },
      {
        q: "How do I pay, and do I get a GST invoice?",
        a: "UPI, cards and net banking.",
      },
    ],
  },
  "helpers-and-waiters": {
    h1: "Hire Kitchen Helpers and Waiters for Your Restaurant",
    intro:
      "Short-staffed today? Book a kitchen helper, a waiter or housekeeping and utility staff for a 5-hour or 10-hour shift, or for a week. Shifts start at ₹599 for 5 hours. Choose the role and the shift, and book online.",
    faqs: [
      {
        q: "How quickly can I get staff?",
        a: "Assignment: 2 hour, arrival: Same shift.",
      },
      {
        q: "What does each role do?",
        a: "Kitchen Helper: Supports the kitchen team with prep, washing up and keeping the kitchen clean. Waiter: Serves guests, takes orders and clears tables. Housekeeping / Utility: Keeps the dining and utility areas clean and tidy.",
      },
      {
        q: "Do they wear a uniform?",
        a: "provided by the restaurant.",
      },
      {
        q: "Can I book for an event or party, not only a restaurant?",
        a: "Yes, you can book for events and parties as well as restaurants.",
      },
      {
        q: "How do I pay, and do I get a GST invoice?",
        a: "UPI, cards and net banking.",
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
        a: "UPI, cards and net banking.",
      },
    ],
  },
};

export function categoryContent(slug: string): CategoryContent | undefined {
  return Object.hasOwn(CATEGORY_CONTENT, slug) ? CATEGORY_CONTENT[slug] : undefined;
}
