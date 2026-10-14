# SEO production check

`scripts/check-seo-prod.sh` is a curl-only smoke check of the live SEO surface.
It uses bash, curl and POSIX tools only (grep, sed, awk, wc, tr); no jq, python or node.

## Usage

```
scripts/check-seo-prod.sh [base-url]
```

`base-url` defaults to `https://www.restocare.in`; pass e.g. `http://localhost:3000`
to check a local `next start`. It fetches each of `/`, `/category/chef`,
`/category/helpers-and-waiters`, `/category/deep-cleaning`, `/category/electrician`
and `/guides/restaurant-staffing-prices` once, prints a table (HTTP status, `<h1`
count, `application/ld+json` count, `FAQPage` count, `BAILOUT_TO_CLIENT_SIDE_RENDERING`
count, canonical href, robots meta), then one `PASS`/`FAIL` line per check and a
summary. Exit code is 1 if any check failed, 0 only if all passed. An unreachable
host fails the checks (status `000`); it does not crash.

Absence checks (no bailout, no electrician `FAQPage`, no numeric homepage links, no
`aggregateRating`) only count as PASS when the page they read returned 200; otherwise
they FAIL with `skipped: <path> returned <status>` so an empty body is never a pass.

## Redirects

The script does not follow redirects (no `curl -L`) on purpose: an apex or `http://`
URL that redirects should be flagged. A 301/302 shows up as a failed "returns 200"
check, so pass the final canonical base URL (e.g. `https://www.restocare.in`).

## Checks and why

| Check | Why |
| --- | --- |
| Every page returns 200 | Broken pages cannot rank. |
| Homepage has exactly one `<h1` | One h1 per page is the SEO rule. |
| No page contains `BAILOUT_TO_CLIENT_SIDE_RENDERING` | It means Next.js fell back to client-side rendering, so content is missing from the server HTML. |
| Each page has a canonical and no `noindex` | Indexable pages must declare their canonical URL and must not block indexing. |
| Category pages and the guide have at least one `ld+json` | Structured data must be in the server HTML. |
| Chef, Helpers & Waiters, Deep Cleaning have `FAQPage`; Electrician has none | FAQ markup must match the FAQs actually on the page. |
| `/category/not-a-real-slug` returns 404 | Unknown slugs must not render soft-200 pages. |
| `/category/plumber` robots meta contains `noindex` | Coming-soon categories must stay out of the index. |
| `/sitemap.xml` lists exactly the Phase 1 URLs from `app/sitemap.ts` (`/`, `/about`, `/contact`, the four live categories, the guide) and none of the coming-soon slugs | Phase 1 URL lock. The URL list is printed. Hosts are ignored so local runs work. |
| Homepage has no `href="/category/<digits>"` | Links must use slugs, not numeric ids. |
| No fetched page contains `aggregateRating` | Card ratings are hardcoded; rating markup would be fabricated. |
| Homepage has `Organization` (`#organization`) and `WebSite` (`#website`) JSON-LD | Site-level structured data must be in the server HTML. |
| `/real-estate`, `/cart`, `/checkout`, `/account` return 200 and their robots meta contains `noindex` | These pages are deliberately kept out of the index. They are checked separately and are not required to have a canonical. |
| `/robots.txt` returns 200 and disallows `/real-estate`, `/cart`, `/checkout`, `/account/`, `/account/login`, `/delete-account`, `/payment/*`, `/api/*` | Crawlers must be kept off private and non-content paths. The Disallow lines are printed. |
| The guide contains `datePublished` and `dateModified` | Article JSON-LD must carry its dates. |

## Not a gate

The script needs the network and depends on live deployment state. It is NOT a
gate: it is not in `package.json` scripts, `tests/`, or CI. Run it by hand after a deploy.
