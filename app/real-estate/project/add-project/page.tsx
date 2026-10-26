"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, X, Plus, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { projectApi } from "@/app/api/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface ProjectFormData {
  project_name: string;
  description: string;
  address: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  builders: string[];
  circle_rate: string;
  status: "active" | "inactive";
}

const initialFormData: ProjectFormData = {
  project_name: "",
  description: "",
  address: "",
  landmark: "",
  pincode: "",
  city: "",
  state: "",
  builders: [],
  circle_rate: "",
  status: "active",
};

export default function AddProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const editId = searchParams.get("id");
  const isEditMode = !!editId;

  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormData, string>>>({});
  const [builderInput, setBuilderInput] = useState("");
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const builderInputRef = useRef<HTMLInputElement>(null);
  const pincodeAbortRef = useRef<AbortController | null>(null);

  // Fetch existing project when editing
  const { data: existingProject, isLoading: isFetching } = useQuery({
    queryKey: ["project", editId],
    queryFn: () => projectApi.getProject(editId!),
    enabled: isEditMode,
  });

  // Reset the form when landing on "add" mode (no id) — guards against the
  // Next.js router reusing this same client component instance (and its
  // state) across repeat visits to this route instead of remounting it.
  useEffect(() => {
    if (isEditMode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(initialFormData);
    setErrors({});
    setBuilderInput("");
  }, [isEditMode]);

  // Pre-fill form once project data arrives
  useEffect(() => {
    if (!existingProject) return;
    const rawBuilders = existingProject.builders ?? existingProject.builderName;
    const builders: string[] = Array.isArray(rawBuilders)
      ? rawBuilders.map((b) => (typeof b === "string" ? b : b?.name ?? "")).filter(Boolean)
      : typeof rawBuilders === "string" && rawBuilders
      ? rawBuilders.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      project_name: existingProject.projectName ?? "",
      description: existingProject.description ?? "",
      address: existingProject.address ?? "",
      landmark: existingProject.landmark ?? "",
      pincode: existingProject.pincode ?? "",
      city: existingProject.city ?? "",
      state: existingProject.state ?? "",
      builders,
      circle_rate:
        existingProject.circleRate !== undefined && existingProject.circleRate !== null
          ? String(existingProject.circleRate)
          : "",
      status: existingProject.status === "inactive" ? "inactive" : "active",
    });
  }, [existingProject]);

  // ── Pincode auto-fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    const pin = formData.pincode.trim();
    if (!/^\d{6}$/.test(pin)) return;

    pincodeAbortRef.current?.abort();
    const controller = new AbortController();
    pincodeAbortRef.current = controller;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPincodeLoading(true);
    fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
          const po = data[0].PostOffice[0];
          setFormData((prev) => ({
            ...prev,
            city: po.District ?? prev.city,
            state: po.State ?? prev.state,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setPincodeLoading(false));

    return () => controller.abort();
  }, [formData.pincode]);

  // ── Builder tag helpers ────────────────────────────────────────────────────

  const addBuilder = () => {
    const name = builderInput.trim();
    if (!name) return;
    if (formData.builders.includes(name)) {
      setBuilderInput("");
      return;
    }
    setFormData((prev) => ({ ...prev, builders: [...prev.builders, name] }));
    setErrors((prev) => ({ ...prev, builders: undefined }));
    setBuilderInput("");
  };

  const removeBuilder = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      builders: prev.builders.filter((b) => b !== name),
    }));
  };

  const handleBuilderKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addBuilder();
    } else if (e.key === "Backspace" && !builderInput && formData.builders.length > 0) {
      removeBuilder(formData.builders[formData.builders.length - 1]);
    }
  };

  // ── Generic field change ───────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ProjectFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProjectFormData, string>> = {};
    if (!formData.project_name.trim()) newErrors.project_name = "Project name is required.";
    if (!formData.city.trim()) newErrors.city = "City is required.";
    if (formData.builders.length === 0) newErrors.builders = "Add at least one builder.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Mutation ───────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data: ProjectFormData) => {
      const payload: Record<string, unknown> = {
        projectName: data.project_name,
        description: data.description,
        address: data.address,
        landmark: data.landmark,
        city: data.city,
        builderName: data.builders.join(", "),
        status: data.status,
        ...(data.circle_rate !== "" && { circleRate: Number(data.circle_rate) }),
      };
      if (isEditMode) return projectApi.updateProject(editId!, payload);
      return projectApi.createProject(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["project", editId] });
        toast.success("Project updated successfully!");
      } else {
        toast.success("Project created successfully!");
        // Next.js reuses this route's client component instance across
        // repeat visits instead of remounting it, so clear the form now —
        // otherwise the next "Add Project" visit shows this submission's data.
        setFormData(initialFormData);
        setErrors({});
        setBuilderInput("");
      }
      router.push("/real-estate/project/manage-projects");
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { message?: string | string[]; error?: string } }; message?: string };
const rawMessage = axiosError?.response?.data?.message;
      const message =
        (Array.isArray(rawMessage) ? rawMessage[0] : rawMessage) ||
        axiosError?.response?.data?.error ||
        axiosError?.message ||
        `Failed to ${isEditMode ? "update" : "create"} project.`;
      toast.error(message);
    },
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isEditMode && isFetching) {
    return (
      <div className="@container/main flex w-full flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm p-6 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="@container/main flex w-full flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Building2 className="size-4" />
          </div>
          <h1 className="font-semibold text-xl tracking-tight">
            {isEditMode ? "Edit Project" : "Add Project"}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {isEditMode
            ? "Update the project details below."
            : "Fill in the details below to register a new project."}
        </p>
      </div>

      {/* Form card */}
      <form onSubmit={(e) => { e.preventDefault(); if (validate()) saveMutation.mutate(formData); }}>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm p-6 space-y-6">

          {/* Row 1 — Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="project_name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project_name"
              name="project_name"
              placeholder="e.g. Skyline Residences"
              value={formData.project_name}
              onChange={handleChange}
              className={errors.project_name ? "border-destructive" : ""}
            />
            {errors.project_name && (
              <p className="text-xs text-destructive">{errors.project_name}</p>
            )}
          </div>

          {/* Row 2 — Builders multi-tag */}
          <div className="space-y-1.5">
            <Label>
              Builder(s) <span className="text-destructive">*</span>
            </Label>
            <div
              onClick={() => builderInputRef.current?.focus()}
              className={`flex flex-wrap gap-1.5 min-h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm cursor-text transition-colors focus-within:ring-1 focus-within:ring-ring ${
                errors.builders ? "border-destructive" : "border-input"
              }`}
            >
              {formData.builders.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-neutral-700"
                >
                  {b}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeBuilder(b); }}
                    className="text-neutral-400 hover:text-destructive transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                ref={builderInputRef}
                type="text"
                value={builderInput}
                onChange={(e) => setBuilderInput(e.target.value)}
                onKeyDown={handleBuilderKeyDown}
                onBlur={addBuilder}
                placeholder={formData.builders.length === 0 ? "Type a name and press Enter…" : "Add another…"}
                className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
              />
              {builderInput && (
                <button
                  type="button"
                  onClick={addBuilder}
                  className="text-neutral-400 hover:text-foreground transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
            {errors.builders && (
              <p className="text-xs text-destructive">{errors.builders}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-[10px] font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-[10px] font-mono">,</kbd> to add · <kbd className="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-[10px] font-mono">Backspace</kbd> to remove last
            </p>
          </div>

          {/* Row 3 — Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description of the project..."
              value={formData.description}
              onChange={handleChange}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Row 4 — Address + Landmark */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="Street / plot address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                name="landmark"
                placeholder="Nearby landmark"
                value={formData.landmark}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 5 — Pincode + State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pincode">Pincode</Label>
              <div className="relative">
                <Input
                  id="pincode"
                  name="pincode"
                  placeholder="e.g. 560001"
                  maxLength={6}
                  value={formData.pincode}
                  onChange={handleChange}
                  className="pr-8"
                />
                {pincodeLoading && (
                  <Loader2 className="size-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
                {!pincodeLoading && formData.pincode.length === 6 && formData.state && (
                  <MapPinned className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">City and state are auto-filled from pincode.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                placeholder="e.g. Karnataka"
                value={formData.state}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 6 — City + Circle Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                name="city"
                placeholder="e.g. Bengaluru"
                value={formData.city}
                onChange={handleChange}
                className={errors.city ? "border-destructive" : ""}
              />
              {errors.city && (
                <p className="text-xs text-destructive">{errors.city}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="circle_rate">Circle Rate (₹/sq.ft)</Label>
              <Input
                id="circle_rate"
                name="circle_rate"
                type="number"
                placeholder="e.g. 4500"
                value={formData.circle_rate}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Row 6 — Status toggle */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="status"
                checked={formData.status === "active"}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, status: checked ? "active" : "inactive" }))
                }
              />
              <span className="text-sm text-muted-foreground">
                {formData.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!isEditMode) {
                setFormData(initialFormData);
                setErrors({});
                setBuilderInput("");
              }
              router.push("/real-estate/project/manage-projects");
            }}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEditMode ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
