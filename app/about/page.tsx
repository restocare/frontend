import type { Metadata } from "next";
import { AboutShell } from "./_about-shell";
import { AboutContent } from "./_about-content";

export const metadata: Metadata = {
  title: { absolute: "About RestoCare" },
  description:
    "RestoCare, operated by Restroedge Private Limited, helps restaurants across Delhi NCR book verified staff, deep cleaning and kitchen supplies — and cut downtime.",
  alternates: {
    canonical: "https://www.restocare.in/about",
  },
  openGraph: {
    title: "About RestoCare",
    description:
      "RestoCare, operated by Restroedge Private Limited, helps restaurants across Delhi NCR book verified staff, deep cleaning and kitchen supplies — and cut downtime.",
    url: "https://www.restocare.in/about",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";

interface CategoryNode {
  categoryId: number;
  name: string;
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

function findCategoryHref(categories: CategoryNode[], namePart: string): string {
  const match = categories.find(
    (c) =>
      c.isPublished !== false &&
      c.name.trim().toLowerCase().includes(namePart.toLowerCase()),
  );
  return match ? `/category/${match.categoryId}` : "/#categories";
}

export default async function AboutPage() {
  const categories = await fetchCategories();

  return (
    <AboutShell>
      <AboutContent
        staffingHref={findCategoryHref(categories, "chef")}
        cleaningHref={findCategoryHref(categories, "deep cleaning")}
        repairsHref={findCategoryHref(categories, "electrician")}
      />
    </AboutShell>
  );
}
