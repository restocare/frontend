import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

const CONFIRM_PATTERN = /\[\[CONFIRM[^\]]*\]\]/g;

export function renderLegalMd(source: string): string {
  if (process.env.NODE_ENV === "production" && source.includes("[[CONFIRM")) {
    throw new Error(
      "Legal content contains unresolved [[CONFIRM: ...]] markers. Resolve all markers before publishing."
    );
  }

  // Strip the first H1 — it's shown in the page hero, not in the body.
  const body = source.replace(/^#\s+.+\n?/m, "");

  const result = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(body);

  let html = String(result);

  // Wrap tables so they scroll horizontally on narrow viewports.
  html = html.replace(
    /<table>/g,
    '<div class="table-scroll-wrap"><table>'
  );
  html = html.replace(/<\/table>/g, "</table></div>");

  if (process.env.NODE_ENV !== "production") {
    html = html.replace(
      CONFIRM_PATTERN,
      (m) =>
        `<mark style="background:rgba(253,224,71,0.6);padding:0 3px;border-radius:3px;font-weight:500;">${m}</mark>`
    );
  }

  return html;
}
