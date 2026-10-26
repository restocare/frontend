/**
 * Categories, services and variants, the public category tree, and banners.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, downloadFile, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";

export interface Category {
  categoryId: number;
  name: string;
}

/**
 * Create/update body for a category or sub-category. Every field but `name`
 * is optional: `undefined` leaves it as it is, `null` clears it.
 */
export interface CategoryInput {
  name: string;
  description?: string | null;
  /** Parent category id: set it for a sub-category; omit/0 for top-level. */
  parentId?: number | null;
  /** Section heading on the storefront (falls back to the name). */
  title?: string | null;
  /** Line under the heading, e.g. "Priced by fixture count". */
  subtitle?: string | null;
  /** Small print after the list. */
  note?: string | null;
  sortOrder?: number | null;
  /** false = shown as "Coming soon". */
  isPublished?: boolean;
  /** Free-form extras. */
  attributes?: Record<string, unknown> | null;
  /** Square icon image — optional. */
  image?: File | null;
  /** Wide banner image shown on the category page — optional. */
  banner?: File | null;
  /** Banner video shown on the category page — optional. */
  video?: File | null;
}

function categoryFormData(body: CategoryInput): FormData {
  const fd = new FormData();
  fd.append("name", body.name);
  // Multipart has no null: an empty string is the "clear it" signal.
  const text = (key: string, value: string | null | undefined) => {
    if (value !== undefined) fd.append(key, value ?? "");
  };
  text("description", body.description);
  text("title", body.title);
  text("subtitle", body.subtitle);
  text("note", body.note);
  if (body.parentId != null) fd.append("parentId", String(body.parentId));
  if (body.sortOrder != null) fd.append("sortOrder", String(body.sortOrder));
  if (body.isPublished !== undefined) fd.append("isPublished", String(body.isPublished));
  if (body.attributes !== undefined) {
    fd.append("attributes", body.attributes === null ? "" : JSON.stringify(body.attributes));
  }
  if (body.image) fd.append("catagoryImage", body.image);
  if (body.banner) fd.append("bannerImage", body.banner);
  if (body.video) fd.append("bannerVideo", body.video);
  return fd;
}

export const categoryApi = {
  // GET /v1/catagories (public) — returns the full category tree.
  list: () => apiClient.get<Category[]>("/v1/catagories"),

  /** GET /v1/catagories/:id — one category (or sub-category) with its services and groups. */
  get: (id: number) =>
    apiClient.get<CategoryTreeNode>(`/v1/catagories/${id}`, { skipAuth: true }),

  /** POST /v1/catagories/create-categories — multipart; only the name is required. */
  create: (body: CategoryInput) =>
    uploadFile<CategoryTreeNode>(
      "/v1/catagories/create-categories",
      categoryFormData(body),
    ),

  /** PATCH /v1/catagories/:id — multipart, image optional. */
  update: (id: number, body: CategoryInput) =>
    uploadFile<CategoryTreeNode>(
      `/v1/catagories/${id}`,
      categoryFormData(body),
      "PATCH",
    ),

  /** DELETE /v1/catagories/service-categories/:id */
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/catagories/service-categories/${id}`,
    ),

  /** PATCH /v1/catagories/reorder — persist admin drag-and-drop order so the
   *  web storefront and customer app show categories in the same sequence. */
  reorder: (ids: number[]) =>
    apiClient.patch<{ message: string; count: number }>(
      "/v1/catagories/reorder",
      { ids },
    ),

  /** PATCH /v1/catagories/:id/publish — publish or unpublish a category.
   *  Unpublished categories still appear on the storefront but as "Coming soon". */
  setPublished: (id: number, isPublished: boolean) =>
    apiClient.patch<CategoryTreeNode>(`/v1/catagories/${id}/publish`, {
      isPublished,
    }),
};

export interface ServiceVariant {
  variantId: number;
  serviceId: number;
  name: string;
  price: number;
  durationMinutes: number | null;
  profileImage: string | null;
  subtitle?: string | null;
  originalPrice?: number | null;
  sortOrder?: number;
  attributes?: Record<string, unknown> | null;
}

export interface CatalogService {
  serviceId: number;
  name: string;
  description: string | null;
  basePrice: number | null;
  categoryId: number;
  vendorId: number | null;
  durationMinutes: number | null;
  isActive: boolean;
  isFeatured: boolean;
  profileImage: string | null;
  createdAt: string;
  subtitle?: string | null;
  originalPrice?: number | null;
  isStartingPrice?: boolean;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  sortOrder?: number;
  attributes?: Record<string, unknown> | null;
  category?: { categoryId: number; name: string; parentId?: number | null } | null;
  vendor?: { vendorId: number; name: string } | null;
  variantsCount?: number;
  variants?: ServiceVariant[];
}

export interface ServiceListResponse {
  services: CatalogService[];
  stats: {
    totalServices: number;
    publishedServices: number;
    featuredServices: number;
    newServices: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Variant body: `undefined` leaves a field alone, `null` clears it. */
export interface ServiceVariantInput {
  name: string;
  price: number;
  durationMinutes?: number | null;
  subtitle?: string | null;
  originalPrice?: number | null;
  sortOrder?: number | null;
  profileImage?: string | null;
}

/** Service body: only name + categoryId are required; null clears a field. */
export interface ServiceInput {
  name: string;
  categoryId: number;
  vendorId?: number;
  description?: string | null;
  basePrice?: number | null;
  durationMinutes?: number | null;
  isActive?: boolean;
  isFeatured?: boolean;
  profileImage?: string | null;
  subtitle?: string | null;
  originalPrice?: number | null;
  isStartingPrice?: boolean;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  sortOrder?: number | null;
  attributes?: Record<string, unknown> | null;
  variants?: ServiceVariantInput[];
}

/** One problem with one row of an imported workbook. */
export interface ImportIssue {
  /** Sheet name ("Services", …); "" for a workbook-level note. */
  sheet?: string;
  /** Excel row number; 0 for a workbook-level note. */
  row: number;
  message: string;
}

export type ImportEntity = "categories" | "subcategories" | "services" | "variants" | "vendors";

export interface ImportChange {
  sheet: string;
  row: number;
  action: "create" | "update";
  entity: "category" | "subcategory" | "service" | "variant" | "vendor";
  label: string;
}

export interface ImportResult {
  /** True for a preview: nothing was written. */
  dryRun?: boolean;
  /** Services created + updated. */
  imported: number;
  /** Rows skipped for errors. */
  failed: number;
  errors: ImportIssue[];
  warnings?: ImportIssue[];
  summary?: Record<ImportEntity, { create: number; update: number }>;
  /** The first planned changes (up to 500); totalChanges counts them all. */
  changes?: ImportChange[];
  totalChanges?: number;
  message: string;
}

export interface ServiceListParams {
  vendorId?: number;
  categoryId?: number;
  /** With categoryId: include the services of its sub-categories. */
  includeSubcategories?: boolean;
  search?: string;
  /** The backend defaults to 50 per page — pass a higher limit to show a whole
   *  catalog (a category can hold 100+ services). */
  limit?: number;
  page?: number;
}

export const serviceApi = {
  list: (params: ServiceListParams = {}) =>
    apiClient.get<ServiceListResponse>(
      `/v1/service${toQueryString({
        vendorId: params.vendorId,
        categoryId: params.categoryId,
        includeSubcategories: params.includeSubcategories,
        search: params.search,
        limit: params.limit,
        page: params.page,
      })}`,
    ),
  get: (id: number) => apiClient.get<CatalogService>(`/v1/service/${id}`),
  create: (body: ServiceInput) =>
    apiClient.post<CatalogService>("/v1/service", body),
  update: (id: number, body: Partial<ServiceInput>) =>
    apiClient.patch<CatalogService>(`/v1/service/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/service/${id}`),

  /** POST /v1/service/:id/image — multipart image upload to Cloudinary. */
  uploadImage: (id: number, image: File) => {
    const fd = new FormData();
    fd.append("serviceImage", image);
    return uploadFile<CatalogService>(`/v1/service/${id}/image`, fd);
  },

  listVariants: (serviceId: number) =>
    apiClient.get<{ variants: ServiceVariant[] }>(
      `/v1/service/${serviceId}/variants`,
    ),
  addVariant: (serviceId: number, body: ServiceVariantInput) =>
    apiClient.post<ServiceVariant>(`/v1/service/${serviceId}/variants`, body),
  updateVariant: (variantId: number, body: Partial<ServiceVariantInput>) =>
    apiClient.patch<ServiceVariant>(`/v1/service/variants/${variantId}`, body),
  /** PATCH /v1/service/:id/variants — several of one service's variants in one transaction. */
  updateVariants: (
    serviceId: number,
    variants: (Partial<ServiceVariantInput> & { variantId: number })[],
  ) =>
    apiClient.patch<{ updated: number; variants: ServiceVariant[] }>(
      `/v1/service/${serviceId}/variants`,
      { variants },
    ),
  removeVariant: (variantId: number) =>
    apiClient.delete<{ message: string }>(`/v1/service/variants/${variantId}`),

  /** POST /v1/service/variants/:id/image — multipart image upload. */
  uploadVariantImage: (variantId: number, image: File) => {
    const fd = new FormData();
    fd.append("variantImage", image);
    return uploadFile<ServiceVariant>(`/v1/service/variants/${variantId}/image`, fd);
  },

  /**
   * POST /v1/service/import — the catalog workbook (Subcategories, Services,
   * Variants sheets). `dryRun` returns the preview and writes nothing.
   */
  import: (file: File, opts?: { vendorId?: number; categoryId?: number; dryRun?: boolean }) => {
    const fd = new FormData();
    fd.append("file", file);
    const qs = toQueryString({
      vendorId: opts?.vendorId,
      categoryId: opts?.categoryId,
      dryRun: opts?.dryRun || undefined,
    });
    return uploadFile<ImportResult>(`/v1/service/import${qs}`, fd);
  },
  downloadTemplate: () => downloadFile("/v1/service/import/template"),
  /** GET /v1/service/export — the catalog in the import layout, ids included. */
  exportCatalog: (categoryId?: number) =>
    downloadFile(`/v1/service/export${toQueryString({ categoryId })}`),
};

/*
 * The public `/v1/catagories` endpoint returns the full storefront hierarchy:
 * category → groups (sub-categories) → services → variants. The landing page
 * is driven entirely from this, so no separate storefront/vendor API is needed.
 */

// Fields marked optional below arrived with the flexible catalog; older API
// builds omit them, so readers must not assume they are there.

export interface CategoryTreeVariant {
  variantId: number;
  name: string;
  price: number;
  profileImage: string | null;
  subtitle?: string | null;
  /** List price, shown struck through when above `price`. */
  originalPrice?: number | null;
  durationMinutes?: number | null;
  sortOrder?: number;
  attributes?: Record<string, unknown> | null;
}

export interface CategoryTreeService {
  serviceId: number;
  name: string;
  description: string | null;
  price: number | null;
  durationMinutes: number | null;
  profileImage: string | null;
  /** When true, the service appears in the landing "Popular services" row. */
  isFeatured?: boolean;
  /** false = a draft the admin hasn't published. */
  isActive?: boolean;
  /** Size or scope line under the name. */
  subtitle?: string | null;
  /** List price, shown struck through when above `price`. */
  originalPrice?: number | null;
  /** Show "from" before the price: the final price is confirmed at booking. */
  isStartingPrice?: boolean;
  sortOrder?: number;
  /** Card bullets. */
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  attributes?: Record<string, unknown> | null;
  variants: CategoryTreeVariant[];
}

export interface CategoryTreeGroup {
  groupId: number;
  name: string;
  profileImage: string | null;
  description?: string | null;
  /** Section heading (falls back to the name). */
  title?: string | null;
  /** Line under the heading, e.g. "Priced by fixture count". */
  subtitle?: string | null;
  /** Small print after the list. */
  note?: string | null;
  bannerImage?: string | null;
  bannerVideo?: string | null;
  /** false = show as "Coming soon". */
  isPublished?: boolean;
  sortOrder?: number;
  attributes?: Record<string, unknown> | null;
  services: CategoryTreeService[];
}

export interface CategoryTreeNode {
  categoryId: number;
  /** Set when this node is itself a sub-category (GET /catagories/:id). */
  parentId?: number | null;
  name: string;
  description: string | null;
  title?: string | null;
  subtitle?: string | null;
  note?: string | null;
  sortOrder?: number;
  attributes?: Record<string, unknown> | null;
  profileImage: string;
  /** Wide banner image shown on the category page (optional). */
  bannerImage?: string | null;
  /** Banner video shown on the category page (optional, takes priority over the image). */
  bannerVideo?: string | null;
  /** When false, the category shows as "Coming soon" on the storefront/customer app. */
  isPublished?: boolean;
  /**
   * Whether anyone can actually be dispatched for this category AT the
   * customer's location. Separate from isPublished: a category can be live
   * everywhere and still have nobody to serve this particular address. Absent
   * when the tree was fetched without coordinates, which means "don't know" —
   * treat it as available.
   */
  available?: boolean;
  comingSoon?: boolean;
  comingSoonMessage?: string | null;
  /** Services attached directly to this category (no sub-category). */
  services: CategoryTreeService[];
  groups: CategoryTreeGroup[];
}

export const categoryTreeApi = {
  /** GET /v1/catagories — full category → service → variant tree (public). */
  /**
   * The category tree. With coordinates the server also says which categories
   * can be served there — unserved ones come back flagged and with NO services
   * attached, so nothing is loaded for a category nobody could be sent to.
   */
  tree: (coords?: { lat: number; lng: number } | null) =>
    apiClient
      .get<CategoryTreeNode[]>(
        `/v1/catagories${coords ? toQueryString({ lat: coords.lat, lng: coords.lng }) : ""}`,
        { skipAuth: true },
      )
      // Display-side patch for a CMS typo ("Pest Controll"); the real fix
      // belongs in the category data, after which this is a no-op.
      .then((categories) =>
        categories.map((c) =>
          /\bcontroll\b/i.test(c.name)
            ? { ...c, name: c.name.replace(/\bControll\b/gi, "Control") }
            : c,
        ),
      ),
};

/** Where a banner is shown: the web storefront or the mobile app. */
export type BannerPlatform = "WEB" | "MOBILE" | "QC";

export interface Banner {
  bannerId: number;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  imagePublicId: string | null;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Defaults to WEB for banners created before the platform field existed. */
  platform?: BannerPlatform;
  createdAt: string;
  updatedAt: string;
}

export interface BannerInput {
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  platform?: BannerPlatform;
  /** Image file — required on create, optional on update. */
  image?: File | null;
}

/** Recommended banner image dimensions / size, per platform. */
export interface BannerSpec {
  width: number;
  height: number;
  minWidth: number;
  maxBytes: number;
  aspect: string;
  label: string;
}

export const BANNER_SPECS: Record<BannerPlatform, BannerSpec> = {
  // Web storefront hero — wide landscape.
  WEB: {
    width: 1920,
    height: 640,
    minWidth: 1200,
    maxBytes: 5 * 1024 * 1024,
    aspect: "3:1",
    label: "1920 × 640 px (3:1), max 5 MB",
  },
  // Mobile app banner — matches the app's full-width 2:1 hero.
  MOBILE: {
    width: 1080,
    height: 540,
    minWidth: 720,
    maxBytes: 5 * 1024 * 1024,
    aspect: "2:1",
    label: "1080 × 540 px (2:1), max 5 MB",
  },
  // Quick-commerce app hero carousel — same 2:1 full-width slides.
  QC: {
    width: 1080,
    height: 540,
    minWidth: 720,
    maxBytes: 5 * 1024 * 1024,
    aspect: "2:1",
    label: "1080 × 540 px (2:1), max 5 MB",
  },
};

/** Back-compat default spec (web). */
export const BANNER_SPEC = BANNER_SPECS.WEB;

function bannerFormData(body: BannerInput): FormData {
  const fd = new FormData();
  if (body.title !== undefined) fd.append("title", body.title);
  if (body.subtitle !== undefined) fd.append("subtitle", body.subtitle);
  if (body.linkUrl !== undefined) fd.append("linkUrl", body.linkUrl);
  if (body.isActive !== undefined) fd.append("isActive", String(body.isActive));
  if (body.sortOrder !== undefined)
    fd.append("sortOrder", String(body.sortOrder));
  if (body.platform !== undefined) fd.append("platform", body.platform);
  if (body.image) fd.append("bannerImage", body.image);
  return fd;
}

export const bannerApi = {
  /** GET /v1/banner — all banners (admin). */
  list: () => apiClient.get<Banner[]>("/v1/banner"),

  /** GET /v1/banner/active — active banners for a platform (public). */
  listActive: (platform?: BannerPlatform) =>
    apiClient.get<Banner[]>(
      `/v1/banner/active${platform ? toQueryString({ platform }) : ""}`,
      { skipAuth: true },
    ),

  /** POST /v1/banner — multipart, image required. */
  create: (body: BannerInput) =>
    uploadFile<Banner>("/v1/banner", bannerFormData(body)),

  /** PATCH /v1/banner/:id — multipart, image optional. */
  update: (id: number, body: BannerInput) =>
    uploadFile<Banner>(`/v1/banner/${id}`, bannerFormData(body), "PATCH"),

  /** DELETE /v1/banner/:id */
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/banner/${id}`),
};
