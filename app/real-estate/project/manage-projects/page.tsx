"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  AlertTriangle,
  X,
  Loader2,
  MapPin,
  HardHat,
  Search,
  ExternalLink,
  Eye,
} from "lucide-react";
import { projectApi } from "@/app/api/api";
import { Skeleton } from "@/components/ui/skeleton";
import { type ApiProject } from "@/app/api/api";
import { unwrapList } from "@/app/api/unwrapList";
import { normalizeProject, type Project } from "../lib/normalize-project";

// `Project` and the API-to-page mapping live in ./lib/normalize-project.

// Mirrors the 6-step form completion logic used on the project edit page
// (Heading, Images, Videos, Project Details, Basic/Amenities, Brochure) so
// the percentage shown here always matches the percentage shown there.
function getProjectProgress(p: Project): number {
  const checks = [
    !!p.projectName?.trim(),
    (p.imageUrls?.length ?? 0) > 0,
    (p.videoLinks?.length ?? 0) > 0,
    !!p.projectStatus?.trim() ||
      !!p.possessionDate?.trim() ||
      (p.facings?.length ?? 0) > 0 ||
      !!p.projectSubType?.trim() ||
      !!p.projectLandArea?.trim() ||
      !!p.startDate?.trim() ||
      !!p.endDate?.trim() ||
      !!p.description?.trim(),
    ((p.basicAmenities?.length ?? 0) + (p.featuredAmenities?.length ?? 0)) > 0,
    !!p.brochureUrl?.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const STATUS_COLORS: Record<string, string> = {
  active:
    "bg-transparent text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800/30",
  inactive:
    "bg-transparent text-neutral-500 border-neutral-300 dark:text-neutral-400 dark:border-neutral-700",
  upcoming:
    "bg-transparent text-sky-600 border-sky-200 dark:text-sky-400 dark:border-sky-800/30",
  completed:
    "bg-transparent text-violet-600 border-violet-200 dark:text-violet-400 dark:border-violet-800/30",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  inactive: "bg-neutral-400",
};

const STATUS_OPTIONS = ["active", "inactive"];

export default function ManageProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProjects = (projects: Project[]) => {
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((p) => {
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesSearch =
        !q ||
        p.projectName.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.builders?.some((b) => b.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  };

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      return unwrapList<ApiProject>(await projectApi.getProjects()).map(normalizeProject);
    },
  });

  const analytics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active").length;
    const inactive = projects.filter((p) => p.status === "inactive").length;
    const avgCompletion = total
      ? Math.round(projects.reduce((sum, p) => sum + getProjectProgress(p), 0) / total)
      : 0;
    return { total, active, inactive, avgCompletion };
  }, [projects]);

  // Status toggle mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await projectApi.updateProject(id, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const prev = queryClient.getQueryData<Project[]>(["projects"]);
      queryClient.setQueryData<Project[]>(
        ["projects"],
        (old = []) => old.map((p) => (p.id === id ? { ...p, status } : p))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["projects"], ctx.prev);
      toast.error("Failed to update status.");
    },
    onSuccess: (_data, { status }) => {
      toast.success(`Status updated to ${status}.`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectApi.deleteProject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const prev = queryClient.getQueryData<Project[]>(["projects"]);
      queryClient.setQueryData<Project[]>(
        ["projects"],
        (old = []) => old.filter((p) => p.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["projects"], ctx.prev);
      toast.error("Failed to delete project.");
    },
    onSuccess: () => {
      toast.success("Project deleted.");
      setDeleteTarget(null);
    },
  });

  const cycleStatus = (project: Project) => {
    const idx = STATUS_OPTIONS.indexOf(project.status);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
    statusMutation.mutate({ id: project.id, status: next });
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center">
        <Building2 className="size-10 text-neutral-300 dark:text-neutral-700 mb-3" />
        <h3 className="font-semibold text-sm text-foreground">Failed to load projects</h3>
        <p className="text-xs text-neutral-400 mt-1">Check your connection and try refreshing the page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm space-y-2"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72" />
                  <div className="flex gap-3 mt-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
                {/* Form Progress Skeleton */}
                <div className="w-[40%] space-y-1">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>

                {/* Action buttons skeleton */}
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-7 w-24 rounded-lg" />
                  <Skeleton className="h-7 w-28 rounded-lg" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                  <Skeleton className="h-7 w-14 rounded-lg" />
                  <Skeleton className="h-7 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            Manage Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View, edit, and manage all registered projects.
          </p>
        </div>
        <Link href="/real-estate/project/add-project">
          <button className="flex h-9 items-center justify-center gap-2 rounded-lg btn-dashboard-primary px-4 text-xs font-semibold transition-colors shadow-sm">
            <Plus className="size-4" />
            Add Project
          </button>
        </Link>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="size-3" />
            Total Projects
          </p>
          <p className="text-2xl font-bold text-foreground mt-1.5">{analytics.total}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${STATUS_DOT.active}`} />
            Active
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">{analytics.active}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${STATUS_DOT.inactive}`} />
            Inactive
          </p>
          <p className="text-2xl font-bold text-neutral-500 dark:text-neutral-400 mt-1.5">{analytics.inactive}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-card p-4 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Avg. Completion</p>
          <p className="text-2xl font-bold text-foreground mt-1.5">{analytics.avgCompletion}%</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, city, or builder…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-lg border border-input bg-background pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all capitalize ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:border-neutral-400 dark:hover:border-neutral-500"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Count badge */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="size-1.5 rounded-full bg-neutral-500" />
          <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
            {filteredProjects(projects).length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Project list */}
      {filteredProjects(projects).length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center">
          <Building2 className="size-10 text-neutral-300 dark:text-neutral-700 mb-3" />
          <h3 className="font-semibold text-sm text-foreground">
            {projects.length === 0 ? "No projects yet" : "No projects match your search"}
          </h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            {projects.length === 0
              ? "Add your first project to get started."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredProjects(projects).map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Top row */}
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-sm text-foreground leading-snug">
                    {project.projectName}
                  </h2>
                  {project.description && (
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {project.builders?.length > 0 && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <HardHat className="size-3" />
                        {project.builders.join(", ")}
                      </span>
                    )}
                    {project.city && (
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <MapPin className="size-3" />
                        {project.city}
                        {project.landmark ? `, ${project.landmark}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border select-none whitespace-nowrap shrink-0 ${
                    STATUS_COLORS[project.status] ?? STATUS_COLORS.inactive
                  }`}
                >
                  <span
                    className={`size-1 rounded-full ${
                      STATUS_DOT[project.status] ?? STATUS_DOT.inactive
                    }`}
                  />
                  {project.status}
                </span>
              </div>

              {/* Action row */}
              <div
                className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/50"
              >
                {/* Form Progress - left side */}
                {(() => {
                  const pct = getProjectProgress(project);
                  return (
                    <div className="w-[40%] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-medium">Form Progress</span>
                        <span className={`text-[10px] font-semibold ${pct >= 67 ? "text-emerald-600 dark:text-emerald-400" : pct >= 34 ? "text-amber-500" : "text-neutral-400"}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 67 ? "bg-emerald-500" : pct >= 34 ? "bg-amber-400" : "bg-neutral-300 dark:bg-neutral-600"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons - right side */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* View Details */}
                  <button
                    type="button"
                    onClick={() => router.push(`/real-estate/project/${project.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] font-semibold hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    Project Form
                  </button>

                  {/* Preview Landing Page */}
                  {project.slug ? (
                    <a
                      href={`/project-preview/${project.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </a>
                  ) : (
                    <span
                      title="Publish listing first to get a preview link"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 text-[11px] font-semibold cursor-not-allowed opacity-50"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </span>
                  )}

                  {/* Add Inventories */}
                  <button
                    type="button"
                    onClick={() => router.push(`/real-estate/project/${project.id}/inventory`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-semibold hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                  >
                    <PackagePlus className="size-3.5" />
                    Add Inventories
                  </button>

                  {/* Status toggle */}
                  <button
                    type="button"
                    onClick={() => cycleStatus(project)}
                    disabled={statusMutation.isPending}
                    title="Cycle status"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 text-[11px] font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {statusMutation.isPending &&
                    statusMutation.variables?.id === project.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span
                        className={`size-2 rounded-full ${
                          STATUS_DOT[project.status] ?? STATUS_DOT.inactive
                        }`}
                      />
                    )}
                    Status
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/real-estate/project/add-project?id=${project.id}`
                      )
                    }
                    title="Edit project"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 text-[11px] font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Pencil className="size-3" />
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(project)}
                    title="Delete project"
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-destructive/10 hover:border-destructive/20 text-neutral-500 hover:text-destructive dark:text-neutral-400 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in-50 zoom-in-95 slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="size-4 text-destructive" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                  Delete Project
                </h3>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-md text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  {deleteTarget.projectName}
                </span>
                ? It will be removed from your list. Its leads and property
                data are retained and can be restored by an administrator.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100 dark:border-neutral-800/80">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-1.5 text-xs font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
