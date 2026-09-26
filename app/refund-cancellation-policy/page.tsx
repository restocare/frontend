import { readFileSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import { LegalPageChrome } from "@/src/components/legal/legal-page-chrome";
import { renderLegalMd } from "@/src/lib/render-legal-md";

export default function RefundCancellationPolicyPage() {
  const source = readFileSync(
    join(process.cwd(), "content/legal/refund-cancellation-policy.md"),
    "utf-8"
  );

  // renderLegalMd throws in production while [[CONFIRM]] markers remain.
  // Catch it here so this one page 404s instead of failing the whole build.
  let html: string;
  try {
    html = renderLegalMd(source);
  } catch {
    notFound();
  }

  return (
    <LegalPageChrome title="Refund & Cancellation Policy">
      <div
        className="legal-prose rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </LegalPageChrome>
  );
}
