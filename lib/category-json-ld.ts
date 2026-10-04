import type { CategoryTreeNode } from "@/src/api/api";

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
 * variant price), so the markup matches what visitors see.
 */
export function categoryJsonLd(category: CategoryTreeNode, slug: string): string {
  const services = [
    ...category.services,
    ...category.groups.flatMap((g) => g.services),
  ];

  const prices = services.flatMap((s) => [
    ...(s.price != null && s.price > 0 ? [s.price] : []),
    ...s.variants.map((v) => v.price).filter((p) => p > 0),
  ]);

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
        ...(prices.length
          ? {
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "INR",
                lowPrice: Math.min(...prices),
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
    ],
  };

  // "<" escaped so a service name can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
