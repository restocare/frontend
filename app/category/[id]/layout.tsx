import type { Metadata } from "next";
import type { ReactNode } from "react";

const SITE = "https://www.restocare.in";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";

// Per-category title/description overrides keyed by lowercased name.
// Use name (not numeric ID) so these survive the upcoming slug migration.
const CATEGORY_OVERRIDES: Record<string, { title: string; description: string }> = {
  chef: {
    title: "Hire Chefs for Your Restaurant in Delhi NCR",
    description:
      "Book tandoor, Chinese and Indian curry chefs by the shift or week for restaurants and cloud kitchens across Delhi NCR.",
  },
  "helpers & waiter": {
    title: "Hire Kitchen Helpers & Waiters in Delhi NCR",
    description:
      "Book kitchen helpers, utility staff and waiters by the shift for restaurants, cafés and cloud kitchens across Delhi NCR.",
  },
  "deep cleaning": {
    title: "Commercial Kitchen Deep Cleaning in Delhi NCR",
    description:
      "Professional kitchen deep cleaning in Delhi NCR — duct, hood, floor, equipment and grease trap services for restaurants and cloud kitchens.",
  },
};

interface CategoryNode {
  categoryId: number;
  name: string;
  description: string | null;
  isPublished?: boolean;
}

async function fetchCategories(): Promise<CategoryNode[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/catagories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<CategoryNode[]>;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const categories = await fetchCategories();
  const category = categories.find((c) => c.categoryId === Number(id));

  if (!category) {
    return {
      title: "Category Not Found",
      robots: { index: false, follow: false },
    };
  }

  // Unpublished / "coming soon" categories must not be indexed.
  // Note: one category is stored as "Pest Controll" (typo in DB) — noindex
  // ensures that typo never appears in a search snippet.
  if (category.isPublished === false) {
    return {
      title: { absolute: "RestoCare" },
      robots: { index: false, follow: false },
    };
  }

  const key = category.name.trim().toLowerCase();
  const override = CATEGORY_OVERRIDES[key];

  const title =
    override?.title ?? `${category.name} for Restaurants in Delhi NCR`;
  const description =
    override?.description ??
    (category.description
      ? category.description.slice(0, 155)
      : `Book ${category.name} services for your restaurant in Delhi NCR.`);

  const canonical = `${SITE}/category/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "RestoCare",
      locale: "en_IN",
      type: "website",
    },
  };
}

export default function CategoryLayout({ children }: { children: ReactNode }) {
  return children;
}
