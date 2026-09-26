import type { Metadata } from "next";
import { NotFoundContent, type CategoryLink } from "./_not-found-content";
import { categoryHref } from "@/lib/category-slugs";

export const metadata: Metadata = {
  title: { absolute: "Page not found | RestoCare" },
  robots: { index: false, follow: false },
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";

interface CategoryNode {
  categoryId: number;
  name: string;
  isPublished?: boolean;
}

// Fetch is cached at the CDN / Next.js cache layer (revalidate 1 hour) so
// every 404 hit doesn't cold-call the API.
async function fetchCategoryLinks(): Promise<CategoryLink[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/catagories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return fallbackLinks();
    const categories = (await res.json()) as CategoryNode[];

    const targets = [
      { namePart: "chef", label: "Hire Chefs" },
      { namePart: "helper", label: "Hire Helpers & Waiters" },
      { namePart: "deep cleaning", label: "Kitchen Deep Cleaning" },
    ];

    const links: CategoryLink[] = [];
    for (const { namePart, label } of targets) {
      const match = categories.find(
        (c) =>
          c.isPublished !== false &&
          c.name.trim().toLowerCase().includes(namePart),
      );
      if (match) links.push({ name: label, href: categoryHref(match.categoryId) });
    }
    return links.length > 0 ? links : fallbackLinks();
  } catch {
    return fallbackLinks();
  }
}

function fallbackLinks(): CategoryLink[] {
  return [
    { name: "Browse all services", href: "/#categories" },
  ];
}

export default async function NotFound() {
  const categoryLinks = await fetchCategoryLinks();
  return <NotFoundContent categoryLinks={categoryLinks} />;
}
