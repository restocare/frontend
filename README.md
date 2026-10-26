This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # node --test tests/**/*.test.cjs
npm run build       # next build
```

The same four steps run on every pull request and push to `main` via
`.github/workflows/ci.yml`. Lint is non-blocking there until the existing
errors are cleared.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Meta Pixel + Conversions API

Ad conversions are measured twice for every event, once by the browser pixel and once server-side through the Conversions API (CAPI), sharing one event id so Meta deduplicates them.

| File | Role |
|---|---|
| `components/analytics/MetaPixel.tsx` | Loads the pixel base code (mounted once in `app/layout.tsx`), fires `PageView` on load and every client-side navigation, and reports every WhatsApp / `tel:` click to the support number (`Contact`, plus `Lead` for WhatsApp). |
| `components/analytics/TrackedLink.tsx` | `<a>` wrapper for explicit tracked links. |
| `components/analytics/MetaViewContent.tsx` | `ViewContent` on service / category pages. |
| `lib/meta.ts` | `trackEvent(name, params, userData)` and `trackPurchaseOnce(orderId, ...)`. |
| `app/api/meta/capi/route.ts` | CAPI relay: validates, hashes PII (SHA-256), forwards to Meta. |

Events: `PageView`, `ViewContent` (category pages), `AddToCart` (service added to cart), `InitiateCheckout` (checkout opened), `Purchase` (booking created, once per order), `Lead` (contact form accepted by the API, WhatsApp click), `Contact` (WhatsApp / phone click), `CompleteRegistration` (contact form with the Partner / Careers topic).

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | client + server | Pixel id. Missing → pixel disabled, dev console warning. |
| `META_CAPI_ACCESS_TOKEN` | server only | Conversions API token. Never exposed to the client. |
| `META_TEST_EVENT_CODE` | server only, optional | Routes server events to Events Manager → Test events. Unset in production. |

### Testing

1. Set the three variables in `.env.local`, run `npm run dev`, open `/` and `/contact`.
2. Console: `typeof fbq === "function"` and `fbq.getState().pixels[0].id` is the pixel id.
3. Network: `facebook.com/tr?...ev=PageView` on load and on each client-side navigation; a `POST /api/meta/capi` (200) next to every pixel request.
4. Submit the contact form: `ev=Lead` fires only after the API returns success.
5. Click a WhatsApp or phone link: `ev=Contact` (and `ev=Lead` for WhatsApp).
6. Events Manager → Test events shows each event from **Browser** and **Server**, marked **Deduplicated**.
7. Meta Pixel Helper shows no errors. Remove `META_TEST_EVENT_CODE` before deploying.
