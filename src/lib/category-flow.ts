/**
 * Which booking flow the category pages use, for every category.
 *
 * 1 = the current pages (production).
 * 2 = the new unified flow, being built in src/components/category-flow-v2.
 *
 * Set NEXT_PUBLIC_RC_CATEGORY_FLOW=1|2 per environment (.env.local for
 * development, .env.production for the live site). Unset means 1. The value
 * is inlined at build time, so the server and the client always agree.
 */

export type CategoryFlow = 1 | 2;

function parse(value: string | undefined): CategoryFlow {
  return value === "2" ? 2 : 1;
}

export const CATEGORY_FLOW: CategoryFlow = parse(process.env.NEXT_PUBLIC_RC_CATEGORY_FLOW);
