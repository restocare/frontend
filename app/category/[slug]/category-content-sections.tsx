import type { CategoryContent } from "@/lib/category-content";

/** Intro paragraph under the banner. Server-rendered. */
export function CategoryIntro({ intro }: { intro: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6">
      <p className="max-w-3xl text-[15px] leading-relaxed text-rc-muted sm:text-base">{intro}</p>
    </section>
  );
}

/** FAQ list as native <details>, so the answers are in the HTML and need no JS. */
export function CategoryFaqs({ faqs }: { faqs: CategoryContent["faqs"] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
        <div className="divide-y divide-rc-line border-y border-rc-line">
          {faqs.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-rc-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="shrink-0 text-rc-muted transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-rc-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
