/**
 * Markdown-backed legal pages. Each one 404s in production while its source
 * still has a [[CONFIRM: ...]] marker (see src/lib/render-legal-md.ts), so
 * links to it — footer, sitemap — must stay hidden until then too.
 *
 * Evaluated once in next.config.ts and exposed to the bundle as
 * process.env.PUBLISHED_LEGAL_PATHS, since the footer is a Client Component
 * and can't read the files itself.
 */
import { readFileSync } from "fs";
import { join } from "path";

const LEGAL_PAGES = [
  { path: "/terms-and-conditions", file: "content/legal/terms-and-conditions.md" },
  { path: "/refund-cancellation-policy", file: "content/legal/refund-cancellation-policy.md" },
];

/** Same gate as renderLegalMd: everything shows outside production. */
function isPublished(file: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return !readFileSync(join(process.cwd(), file), "utf-8").includes("[[CONFIRM");
}

export function publishedLegalPaths(): string[] {
  return LEGAL_PAGES.filter((p) => isPublished(p.file)).map((p) => p.path);
}
