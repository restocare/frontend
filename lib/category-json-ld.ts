import type { CategoryTreeNode } from "@/src/api/api";
import type { CategoryFaq } from "@/lib/category-content";
import type { HourlyTerms } from "@/src/lib/booking-v2/hourly-terms";
import { categoryUsesSlots } from "@/src/lib/slot-categories";

const SITE = "https://www.restocare.in";

/**
 * Structured data for a category page, as a JSON string for a
 * <script type="application/ld+json"> tag.
 *
 * Deliberately NO aggregateRating or review markup: the ratings on the cards
 * are not real per-service review data, and marking them up would break
 * Google's structured-data rules.
 *
 * lowPrice is the same "From" figure the page shows (the cheapest base or
 * variant price), so the markup matches what visitors see. Slot categories
 * use the hourly headline rate instead, as their variants are unbilled.
 */
export function categoryJsonLd(
  category: CategoryTreeNode,
  slug: string,
  faqs: CategoryFaq[] = [],
  headline?: HourlyTerms | null,
): string {
  const services = [
    ...category.services,
    ...category.groups.flatMap((g) => g.services),
  ];

  const prices = services.flatMap((s) => [
    ...(s.price != null && s.price > 0 ? [s.price] : []),
    ...s.variants.map((v) => v.price).filter((p) => p > 0),
  ]);

  const lowPrice =
    categoryUsesSlots(category.name) && headline ? headline.rate : prices.length ? Math.min(...prices) : null;

  const url = `${SITE}/category/${slug}`;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: category.name, item: url },
        ],
      },
      {
        "@type": "Service",
        name: category.name,
        serviceType: category.name,
        url,
        provider: { "@type": "Organization", name: "RestoCare", url: SITE },
        areaServed: { "@type": "AdministrativeArea", name: "Delhi NCR" },
        ...(lowPrice != null
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "INR",
                lowPrice,
                offerCount: services.length,
              },
            }
          : {}),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `${category.name} services`,
          itemListElement: services.map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name },
          })),
        },
      },
      // Only with FAQs, and only the question/answer text shown on the page.
      ...(faqs.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  // "<" escaped so a service name can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
