import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { categoryHref, categoryIdForSlug } from "@/lib/category-slugs";
import { fetchCategoryTree } from "@/lib/category-tree-server";
import {
  cleaningTable,
  formatInr,
  shiftLead,
  shiftTable,
  type PriceCell,
  type ShiftTable,
} from "@/lib/price-guide";
import { formatGuideDate, GUIDE_PUBLISHED, GUIDE_UPDATED } from "@/lib/guide-meta";
import { ORGANIZATION_REF, SITE_URL } from "@/lib/site-identity";
import { GuideShell } from "../_guide-shell";

const SITE = SITE_URL;
const PAGE_URL = `${SITE}/guides/restaurant-staffing-prices`;
const TITLE = "Restaurant staffing prices in Delhi NCR (2026)";
// Intro from docs/seo/category-briefs.md ("Price guide"), used as written.
const INTRO =
  "What a chef, a kitchen helper or waiter, and a kitchen deep clean cost for a restaurant in Delhi NCR, as of October 2026.";
const HOW_TO_CHOOSE =
  "Book a chef or helpers when you are short-staffed for a shift or a week. Book deep cleaning before an inspection, after a long stretch, or on a regular schedule. Compare options by the 5-hour shift price, since 5 hours is the minimum.";
const DESCRIPTION =
  "What a chef, a kitchen helper or waiter, and a kitchen deep clean cost for a restaurant in Delhi NCR, as of October 2026. Hourly rates, shift prices and per-item cleaning prices.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "RestoCare",
    locale: "en_IN",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: TITLE, item: PAGE_URL },
      ],
    },
    {
      "@type": "Article",
      headline: TITLE,
      description: DESCRIPTION,
      url: PAGE_URL,
      mainEntityOfPage: PAGE_URL,
      inLanguage: "en-IN",
      datePublished: GUIDE_PUBLISHED,
      dateModified: GUIDE_UPDATED,
      // The guide inherits the root app/opengraph-image route.
      image: `${SITE}/opengraph-image`,
      author: ORGANIZATION_REF,
      publisher: ORGANIZATION_REF,
    },
  ],
};

function Cell({ cell }: { cell: PriceCell }) {
  if (!cell) return <>—</>;
  return (
    <>
      {cell.from ? "from " : ""}
      {formatInr(cell.price)}
    </>
  );
}

const th = "px-4 py-3 text-left font-semibold text-rc-ink";
const td = "px-4 py-3 text-rc-muted";

function ShiftPrices({ table }: { table: ShiftTable }) {
  return (
    <>
    <div className="mt-4 overflow-x-auto rounded-xl border border-rc-line">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className={th}>Shift</th>
            <th scope="col" className={th}>Day</th>
            <th scope="col" className={th}>Night</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rc-line">
          {table.rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={`${th} font-medium`}>{r.label}</th>
              <td className={td}><Cell cell={r.day} /></td>
              <td className={td}><Cell cell={r.night} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      <p className="mt-3 text-sm text-rc-muted">
        Prices exclude 18% GST.
        {table.premium > 0
          ? ` Hours after 6 PM cost ${formatInr(table.premium)}/hr extra.`
          : ""}
      </p>
    </>
  );
}

function Section({
  title,
  slug,
  lead,
  children,
}: {
  title: string;
  slug: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight text-rc-ink">{title}</h2>
      {lead}
      {children}
      <p className="mt-4 text-sm">
        <Link href={`/category/${slug}`} className="font-semibold text-rc-ink underline">
          {title}: see current prices and book
        </Link>
      </p>
    </section>
  );
}

function ShiftLead({ table }: { table: ShiftTable | null }) {
  if (!table) return null;
  const { shift, hourly } = shiftLead(table);
  if (!shift && !hourly) return null;
  return (
    <>
      {shift ? (
        <p className="mt-3 text-lg font-semibold text-rc-ink">
          5-hour shift: day <Cell cell={shift.day} />, night <Cell cell={shift.night} />
        </p>
      ) : null}
      {hourly ? (
        <p className={`${shift ? "mt-1 text-sm font-normal text-rc-muted" : "mt-3 text-lg font-semibold text-rc-ink"}`}>
          {shift ? "Hourly rate:" : "From"} {formatInr(hourly)} per hour
        </p>
      ) : null}
    </>
  );
}

export default async function PriceGuidePage() {
  // null on an API failure: no tables, only links to the live category pages.
  const tree = await fetchCategoryTree();
  const find = (slug: string) => {
    const id = categoryIdForSlug(slug);
    return tree?.find((c) => c.categoryId === id && c.isPublished !== false);
  };

  const chefCat = find("chef");
  const helpersCat = find("helpers-and-waiters");
  const cleaningCat = find("deep-cleaning");
  const chef = chefCat ? shiftTable(chefCat) : null;
  const helpers = helpersCat ? shiftTable(helpersCat) : null;
  const cleaning = cleaningCat ? cleaningTable(cleaningCat) : null;

  const unavailable = (slug: string) => (
    <p className="mt-3 text-sm text-rc-muted">
      <Link href={categoryHref(categoryIdForSlug(slug) ?? -1)} className="font-semibold text-rc-ink underline">
        See current prices
      </Link>
    </p>
  );

  return (
    <GuideShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-rc-muted">
          <Link href="/" className="hover:underline">Home</Link>
          <span aria-hidden> / </span>
          <span>{TITLE}</span>
        </nav>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-rc-ink sm:text-4xl">{TITLE}</h1>
        <p className="mt-4 text-base leading-relaxed text-rc-muted">{INTRO}</p>
        <p className="mt-2 text-sm text-rc-muted">
          Updated <time dateTime={GUIDE_UPDATED}>{formatGuideDate(GUIDE_UPDATED)}</time>
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight text-rc-ink">How to choose</h2>
          <p className="mt-3 text-base leading-relaxed text-rc-muted">{HOW_TO_CHOOSE}</p>
        </section>

        <Section title="Chef" slug="chef" lead={<ShiftLead table={chef} />}>
          {chef ? <ShiftPrices table={chef} /> : unavailable("chef")}
        </Section>

        <Section
          title="Helpers & Waiter"
          slug="helpers-and-waiters"
          lead={<ShiftLead table={helpers} />}
        >
          {helpers ? <ShiftPrices table={helpers} /> : unavailable("helpers-and-waiters")}
        </Section>

        <Section title="Deep Cleaning" slug="deep-cleaning">
          {cleaning ? (
            <>
              <div className="mt-4 overflow-x-auto rounded-xl border border-rc-line">
                <table className="w-full min-w-[320px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className={th}>Item</th>
                      <th scope="col" className={th}>Price</th>
                      <th scope="col" className={th}>Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rc-line">
                    {cleaning.rows.map((r) => (
                      <tr key={r.name}>
                        <th scope="row" className={`${th} font-medium`}>{r.name}</th>
                        <td className={td}>{formatInr(r.price)}</td>
                        <td className={td}>{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cleaning.totalItems > cleaning.rows.length ? (
                <p className="mt-3 text-sm text-rc-muted">
                  This table shows {cleaning.rows.length} of the cleaning items; the
                  category page lists them all.
                </p>
              ) : null}
            </>
          ) : (
            unavailable("deep-cleaning")
          )}
        </Section>

        <p className="mt-12 text-sm text-rc-muted">
          Prices are the live RestoCare catalogue and exclude GST.
        </p>
      </main>
    </GuideShell>
  );
}
