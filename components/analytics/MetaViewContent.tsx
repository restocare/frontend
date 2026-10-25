"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/meta";

/**
 * Fires ViewContent once when a service / category page is shown. Render it
 * from a Server Component (e.g. app/category/[slug]/page.tsx); it draws
 * nothing. Re-fires when the pathname changes to another tracked page.
 */
export function MetaViewContent({
  contentName,
  contentIds,
  contentCategory,
}: {
  contentName: string;
  contentIds?: (string | number)[];
  contentCategory?: string;
}) {
  const pathname = usePathname();
  const ids = contentIds?.map(String).join(",") ?? "";

  useEffect(() => {
    trackEvent("ViewContent", {
      content_name: contentName,
      content_ids: ids ? ids.split(",") : undefined,
      content_category: contentCategory,
      content_type: "product",
    });
    // One event per page URL; the ids string keeps the deps serialisable.
  }, [pathname, contentName, ids, contentCategory]);

  return null;
}
