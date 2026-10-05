import Link from "next/link";
import type { CategoryContent } from "@/lib/category-content";
import { ChevronDownIcon } from "@/src/components/icons";

// Same number as the booking pages' WhatsApp links (category-extras.tsx is a
// client module, so its constant can't be read from this Server Component).
const WHATSAPP_URL = "https://wa.me/919953532995";

/** Intro paragraph under the banner. Server-rendered. */
export function CategoryIntro({ intro }: { intro: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6">
      <p className="max-w-3xl text-[15px] leading-relaxed text-rc-muted sm:text-base">{intro}</p>
      <p className="mt-3 text-sm text-rc-muted">
        Compare shift and item prices across categories in our{" "}
        <Link
          href="/guides/restaurant-staffing-prices"
          className="font-semibold text-rc-ink underline"
        >
          restaurant staffing price guide
        </Link>
        .
      </p>
    </section>
  );
}

/**
 * FAQ list as native <details>, so the answers are in the HTML and need no JS.
 * Opening animates the answer's height where the browser supports
 * ::details-content; elsewhere it simply opens.
 */
export function CategoryFaqs({ faqs }: { faqs: CategoryContent["faqs"] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 max-w-sm text-sm text-rc-muted sm:text-base">
            Still unsure?{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rc-yellow-deep hover:underline"
            >
              Ask us on WhatsApp
            </a>
            .
          </p>
        </div>

        <div className="divide-y divide-rc-line border-y border-rc-line">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="group [interpolate-size:allow-keywords] [&::details-content]:h-0 [&::details-content]:overflow-hidden [&::details-content]:transition-[height,content-visibility] [&::details-content]:duration-300 [&::details-content]:ease-out [&::details-content]:[transition-behavior:allow-discrete] open:[&::details-content]:h-auto"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-rc-ink transition-colors hover:text-rc-yellow-deep [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDownIcon
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-rc-muted transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-rc-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
