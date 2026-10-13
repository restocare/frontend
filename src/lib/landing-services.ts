import type { CategoryTreeNode, CategoryTreeService } from "@/src/api/api";

/** A service flattened out of the category → group → service tree. */
export interface FlatService extends CategoryTreeService {
  categoryName: string;
  groupName: string;
}

/** Same rule PopularCategories uses for its tiles. */
function isLiveCategory(c: CategoryTreeNode): boolean {
  return c.isPublished !== false && !c.comingSoon;
}

/**
 * Flattens live (published, non-coming-soon) categories into services,
 * optionally scoped to one category. With no category selected (the home
 * "Popular services" row) only featured services are kept.
 */
export function flattenServices(
  categories: CategoryTreeNode[],
  categoryId: number | null,
): FlatService[] {
  const live = categories.filter(isLiveCategory);
  const scoped = categoryId ? live.filter((c) => c.categoryId === categoryId) : live;

  const flat = scoped.flatMap((category) => [
    // Services attached directly to the category.
    ...category.services.map((service) => ({
      ...service,
      categoryName: category.name,
      groupName: category.name,
    })),
    // Services nested under sub-categories.
    ...category.groups.flatMap((group) =>
      group.services.map((service) => ({
        ...service,
        categoryName: category.name,
        groupName: group.name,
      })),
    ),
  ]);
  return categoryId ? flat : flat.filter((s) => s.isFeatured);
}
