import type { ApiProject } from "@/app/api/api";

/** Project as the real-estate pages render it (camelCase, defaults filled in). */
export interface Project {
  id: string;
  tenantId: string;
  projectName: string;
  description: string;
  address: string;
  landmark: string;
  city: string;
  state: string;
  builders: string[];
  circleRate?: number;
  slug?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // detail fields for progress
  projectSubType?: string;
  projectLandArea?: string;
  startDate?: string;
  endDate?: string;
  possessionDate?: string;
  projectStatus?: string;
  facings?: string[];
  basicAmenities?: string[];
  featuredAmenities?: string[];
  imageUrls?: string[];
  videoLinks?: string[];
  brochureUrl?: string;
}

function builderNames(p: ApiProject): string[] {
  if (Array.isArray(p.builders)) {
    return p.builders.map((b) => (typeof b === "string" ? b : b?.name ?? ""));
  }
  const joined = p.builderName || p.builder_name;
  return typeof joined === "string" && joined ? joined.split(",").map((s) => s.trim()) : [];
}

/**
 * Normalise an API project into the `Project` shape. Older rows still come
 * back in snake_case, so every detail field checks both spellings. Used by the
 * project list and by the prefetcher so the `["projects"]` query always holds
 * the same shape.
 */
export function normalizeProject(p: ApiProject): Project {
  return {
    ...p,
    id: p.id,
    tenantId: p.tenantId ?? "",
    projectName: p.projectName ?? p.project_name ?? "",
    description: p.description ?? "",
    address: p.address ?? "",
    landmark: p.landmark ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    builders: builderNames(p),
    circleRate: p.circleRate,
    slug: p.slug,
    status: p.status ?? "",
    createdAt: p.createdAt ?? "",
    updatedAt: p.updatedAt ?? "",
    projectSubType: p.projectSubType ?? p.project_sub_type,
    projectLandArea: p.projectLandArea ?? p.project_land_area,
    startDate: p.startDate ?? p.start_date,
    endDate: p.endDate ?? p.end_date,
    possessionDate: p.possessionDate ?? p.possession_date,
    projectStatus: p.projectStatus ?? p.project_status,
    facings: p.facings ?? p.facing ?? [],
    basicAmenities: p.basicAmenities ?? p.basic_amenities ?? [],
    featuredAmenities: p.featuredAmenities ?? p.featured_amenities ?? [],
    imageUrls: p.imageUrls ?? p.image_urls ?? [],
    videoLinks: p.videoLinks ?? p.video_links ?? [],
    brochureUrl: p.brochureUrl ?? p.brochure_url,
  };
}
