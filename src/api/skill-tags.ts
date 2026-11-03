/**
 * Skill tags — the specialisations a lead is matched on.
 *
 * A tag ("Tandoor Chef", "Sofa Shampoo") is scoped to a top-level category and
 * can be required at three levels: on a main category, on a sub-category, or on
 * a single service. The most specific level wins:
 *
 *     service → its own category → that category's parent
 *
 * Partners declare the same tags. A partner who has declared NONE keeps
 * receiving every lead in their category, so tagging can be rolled out without
 * cutting anyone off from work.
 *
 * Matching is off until `tagMatchingEnabled` is switched on in
 * Dispatcher → Auto Allocation.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

export interface SkillTag {
  tagId: number;
  /** Stable machine name; never changes when the tag is renamed. */
  slug: string;
  name: string;
  /** The trade this skill belongs to — always a top-level category. */
  categoryId: number;
  /**
   * null = a MAIN tag, one per service category, created automatically.
   * Set = a sub-skill ops added under it.
   *
   * A partner holding only the main tag is a generalist and is rung for every
   * lead of that trade.
   */
  parentTagId: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  category?: { categoryId: number; name: string };
  /** Present on main tags from `list()` — the sub-skills under them. */
  children?: SkillTag[];
  /** How many services, categories and partners currently use the tag. */
  _count?: { services: number; categories: number; partners: number };
}

/** A tag attached to a service, category or partner. */
export interface SkillTagLink {
  tagId: number;
  tag: SkillTag;
  /** Partner links only: when ops confirmed the partner really has this skill. */
  verifiedAt?: string | null;
  verifiedBy?: number | null;
}

export interface SkillTagInput {
  name: string;
  categoryId: number;
  /** Main tag to nest under. Omitted, the category's own main tag is used. */
  parentTagId?: number;
  /** Derived from the name when omitted. */
  slug?: string;
  sortOrder?: number;
}

export interface SkillTagUpdate {
  name?: string;
  /** false hides the tag everywhere without deleting its history. */
  isActive?: boolean;
  sortOrder?: number;
}

export interface BulkApplyInput {
  /** Pass a sub-category to tag just that group, or a main category for the trade. */
  categoryId: number;
  tagIds: number[];
  /** "add" keeps each service's existing tags; "replace" overwrites them. */
  mode?: "add" | "replace";
  includeChildren?: boolean;
}

export interface BulkApplyResult {
  services: number;
  tags: number;
  mode: "add" | "replace";
}

/** One row of the coverage report — read this before enabling tag matching. */
export interface SkillTagCoverage {
  tagId: number;
  name: string;
  slug: string;
  category: { categoryId: number; name: string };
  services: number;
  categories: number;
  /** Everyone who declared the tag, blocked and pending included. */
  partners: number;
  /** Of those, the ones who are active and not blocked. */
  activePartners: number;
  verifiedPartners: number;
  /** Active partners online right now. Zero means its leads reach nobody. */
  onlinePartners: number;
}

export interface UntaggedReport {
  services: {
    count: number;
    rows: {
      serviceId: number;
      name: string;
      category: { categoryId: number; name: string; parentId: number | null };
    }[];
  };
  partners: {
    count: number;
    rows: {
      professionalId: number;
      city: string | null;
      isOnline: boolean;
      user: { name: string | null; mobile: string | null } | null;
      category: { categoryId: number; name: string } | null;
    }[];
  };
}

const BASE = "/v1/admin/skill-tags";

export const skillTagApi = {
  /* ---------------------------- tag catalogue ---------------------------- */

  /**
   * GET /v1/admin/skill-tags — the tag TREE: main tags (one per trade), each
   * carrying its sub-skills in `children`.
   *
   * `categoryId` may be a sub-category: the backend resolves it up to its
   * top-level parent, so pass whichever id you are holding.
   */
  list: (params: { categoryId?: number; includeInactive?: boolean } = {}) =>
    apiClient.get<SkillTag[]>(
      `${BASE}${toQueryString({
        categoryId: params.categoryId,
        includeInactive: params.includeInactive,
      })}`,
    ),

  /** Adds a sub-skill. Main tags are not created here — they mirror categories. */
  create: (body: SkillTagInput) => apiClient.post<SkillTag>(BASE, body),

  /** Creates the missing main tag for every category. Idempotent. */
  syncMainTags: () =>
    apiClient.post<{ created: number; total: number }>(`${BASE}/sync-main-tags`),

  update: (tagId: number, body: SkillTagUpdate) =>
    apiClient.patch<SkillTag>(`${BASE}/${tagId}`, body),

  /** Soft delete — the tag is deactivated, its history kept. */
  deactivate: (tagId: number) => apiClient.delete<{ message: string }>(`${BASE}/${tagId}`),

  reorder: (items: { tagId: number; sortOrder: number }[]) =>
    apiClient.put<{ message: string }>(`${BASE}/reorder`, { items }),

  /* --------------------------- what a job needs --------------------------- */

  serviceTags: (serviceId: number) =>
    apiClient.get<SkillTagLink[]>(`${BASE}/service/${serviceId}`),

  /** Replaces the whole set. An empty array clears every tag. */
  setServiceTags: (serviceId: number, tagIds: number[]) =>
    apiClient.put<SkillTagLink[]>(`${BASE}/service/${serviceId}`, { tagIds }),

  categoryTags: (categoryId: number) =>
    apiClient.get<SkillTagLink[]>(`${BASE}/category/${categoryId}`),

  /** The default for every service in the category that has no tags of its own. */
  setCategoryTags: (categoryId: number, tagIds: number[]) =>
    apiClient.put<SkillTagLink[]>(`${BASE}/category/${categoryId}`, { tagIds }),

  /**
   * Stamp the same tags onto every service of a category in one call — the only
   * practical way to tag a trade that has hundreds of services.
   */
  bulkApply: (body: BulkApplyInput) =>
    apiClient.post<BulkApplyResult>(`${BASE}/bulk-apply`, body),

  /* -------------------------- what a partner can do -------------------------- */

  partnerTags: (professionalId: number) =>
    apiClient.get<SkillTagLink[]>(`${BASE}/partner/${professionalId}`),

  /** An empty array puts the partner back on every lead in their category. */
  setPartnerTags: (professionalId: number, tagIds: number[]) =>
    apiClient.put<SkillTagLink[]>(`${BASE}/partner/${professionalId}`, { tagIds }),

  /** Ops confirming the partner really has these (already declared) skills. */
  verifyPartnerTags: (professionalId: number, tagIds: number[]) =>
    apiClient.post<SkillTagLink[]>(`${BASE}/partner/${professionalId}/verify`, { tagIds }),

  /* -------------------------------- reports -------------------------------- */

  coverage: (params: { categoryId?: number; city?: string } = {}) =>
    apiClient.get<SkillTagCoverage[]>(
      `${BASE}/coverage${toQueryString({ categoryId: params.categoryId, city: params.city })}`,
    ),

  untagged: (categoryId?: number) =>
    apiClient.get<UntaggedReport>(`${BASE}/untagged${toQueryString({ categoryId })}`),
};

/** Flatten link rows to plain tag ids, which is what every setter takes. */
export function tagIdsOf(links: SkillTagLink[] | undefined): number[] {
  return (links ?? []).map((link) => link.tagId);
}

/** Main tags and their sub-skills as one list, parents before their children. */
export function flattenTags(tree: SkillTag[] | undefined): SkillTag[] {
  return (tree ?? []).flatMap((main) => [main, ...(main.children ?? [])]);
}
