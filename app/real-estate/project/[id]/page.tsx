"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded project images come from arbitrary hosts; next/image needs each host in remotePatterns. */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Upload,
  X,
  FileText,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import axios from "axios";
import { projectApi } from "@/app/api/api";
import { getApiErrorMessage } from "@/app/api/errors";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentEntry {
  id: string;
  name: string;
  file: File | null;
  fileName: string;
  url?: string;
}

type ProjectFieldType = "text" | "date" | "month" | "number" | "textarea" | "select";

interface ProjectField {
  id: string;
  label: string;
  type: ProjectFieldType;
  value: string;
  unit?: string;
  unitOptions?: string[];
  options?: string[];
}

interface MultiStepForm {
  projectTitle: string;
  images: File[];
  imageUrls: string[];
  existingImageUrls: string[];
  videoLinks: string[];
  projectFields: ProjectField[];
  detailsSaved: boolean;
  documents: DocumentEntry[];
  amenities: string[];
  isFeatured: boolean;
  brochureFile: File | null;
  brochureFileName: string;
  brochureFileSize: number;
  existingBrochureUrl: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_STATUSES = ["Under Construction", "Ready to Move", "Upcoming"];
const PROJECT_SUB_TYPES = ["Apartment", "Villa", "Plot", "Row House", "Penthouse", "Studio", "Independent House"];
const FACING_OPTIONS = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"];
const LAND_UNITS = ["sq ft", "sq m", "acres"];

const ALL_AMENITIES = [
  "Swimming Pool", "Gym / Fitness Centre", "Club House", "Garden / Landscaping",
  "Car Parking", "Security", "Lift", "Generator", "CCTV", "Intercom",
  "24x7 Water Supply", "Maintenance Staff", "Fire Fighting System",
  "Kids Play Area", "Jogging Track", "Tennis Court", "Badminton Court",
  "Power Back Up", "Solar Water Heater", "Internet",
];

const STEPS = [
  { id: 0, name: "Heading",        shortName: "Heading"  },
  { id: 1, name: "Images",         shortName: "Images"   },
  { id: 2, name: "Videos",         shortName: "Videos"   },
  { id: 3, name: "Project Details",shortName: "Details"  },
  { id: 4, name: "Basic",          shortName: "Basic"    },
  { id: 5, name: "Brochure",       shortName: "Brochure" },
];

const DEFAULT_DOCUMENTS: DocumentEntry[] = [
  { id: "mda",  name: "MDA Approved",      file: null, fileName: "" },
  { id: "rera", name: "RERA Registration", file: null, fileName: "" },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

const DEFAULT_PROJECT_FIELDS: ProjectField[] = [
  { id: "status",     label: "Project Status",    type: "select",   value: "Under Construction", options: PROJECT_STATUSES },
  { id: "possession", label: "Possession Date",   type: "month",    value: "" },
  { id: "facing",     label: "Facing",            type: "select",   value: "", options: ["", ...FACING_OPTIONS] },
  { id: "subtype",    label: "Project Subtype",   type: "select",   value: "Apartment", options: PROJECT_SUB_TYPES },
  { id: "landArea",   label: "Project Land Area", type: "number",   value: "", unit: "sq ft", unitOptions: LAND_UNITS },
  { id: "startDate",  label: "Start Date",        type: "date",     value: "" },
  { id: "endDate",    label: "End Date",          type: "date",     value: "" },
  { id: "about",      label: "About",             type: "textarea", value: "" },
];

const DEFAULT_FORM: MultiStepForm = {
  projectTitle: "",
  images: [],
  imageUrls: [],
  existingImageUrls: [],
  videoLinks: [],
  projectFields: DEFAULT_PROJECT_FIELDS,
  detailsSaved: false,
  documents: DEFAULT_DOCUMENTS,
  amenities: [],
  isFeatured: false,
  brochureFile: null,
  brochureFileName: "",
  brochureFileSize: 0,
  existingBrochureUrl: "",
};

// ─── Progress helpers ─────────────────────────────────────────────────────────

function getStepProgress(form: MultiStepForm): { filled: number; total: number }[] {
  return [
    { filled: form.projectTitle ? 1 : 0, total: 1 },
    { filled: form.images.length > 0 || form.existingImageUrls.length > 0 ? 1 : 0, total: 1 },
    { filled: form.videoLinks.length > 0 ? 1 : 0, total: 1 },
    { filled: form.detailsSaved ? 1 : 0, total: 1 },
    { filled: form.amenities.length > 0 ? 1 : 0, total: 1 },
    { filled: form.brochureFile || form.existingBrochureUrl ? 1 : 0, total: 1 },
  ];
}

function getOverallProgress(form: MultiStepForm): number {
  const steps = getStepProgress(form);
  const filled = steps.reduce((a, s) => a + s.filled, 0);
  const total  = steps.reduce((a, s) => a + s.total,  0);
  return Math.round((filled / total) * 100);
}

function isStepComplete(idx: number, form: MultiStepForm): boolean {
  const s = getStepProgress(form)[idx];
  return s.filled === s.total;
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({ percentage }: { percentage: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percentage / 100);
  return (
    <div className="flex flex-col items-center gap-2 py-5">
      <div className="relative size-24">
        <svg viewBox="0 0 88 88" className="size-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7"
            className="text-neutral-100 dark:text-neutral-800" />
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="text-emerald-500 transition-all duration-500 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-foreground">{percentage}%</span>
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Form Completion
      </p>
    </div>
  );
}

// ─── Step Sidebar ─────────────────────────────────────────────────────────────

function StepSidebar({
  currentStep, form, onStepClick,
}: {
  currentStep: number;
  form: MultiStepForm;
  onStepClick: (s: number) => void;
}) {
  const pct = getOverallProgress(form);
  return (
    <aside className="w-full lg:w-64 lg:shrink-0">
      {/* Mobile: horizontal pill row */}
      <div className="flex lg:hidden overflow-x-auto gap-1.5 pb-1 scrollbar-none">
        {STEPS.map((step) => {
          const done   = isStepComplete(step.id, form);
          const active = currentStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : done
                  ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "bg-neutral-100 dark:bg-neutral-800 text-muted-foreground"
              }`}
            >
              {done && !active ? <Check className="size-3" /> : <span>{step.id + 1}</span>}
              {step.shortName}
            </button>
          );
        })}
      </div>

      {/* Desktop: card with circular progress + vertical nav */}
      <div className="hidden lg:block rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 dark:border-neutral-800">
          <CircularProgress percentage={pct} />
        </div>
        <nav className="flex flex-col gap-0.5 p-2.5">
          {STEPS.map((step) => {
            const done   = isStepComplete(step.id, form);
            const active = currentStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepClick(step.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${
                  active
                    ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                }`}
              >
                <span className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold shrink-0 border transition-all ${
                  active
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border-transparent"
                    : done
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-neutral-300 dark:border-neutral-600 text-muted-foreground"
                }`}>
                  {done && !active ? <Check className="size-3" /> : step.id + 1}
                </span>
                <span className="truncate">{step.name}</span>
                {done && !active && (
                  <Check className="ml-auto size-3.5 text-emerald-500 shrink-0" />
                )}
                {active && (
                  <span className="ml-auto size-1.5 rounded-full bg-white dark:bg-neutral-900 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

// ─── Step 0: Heading ──────────────────────────────────────────────────────────

function StepHeading({ form, isLoading }: { form: MultiStepForm; isLoading: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Heading</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          The project title is fetched automatically from your project record.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Project Title</Label>
        {!form.projectTitle && isLoading ? (
          <div className="h-9 rounded-md border border-input bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
        ) : (
          <div className="relative flex h-9 items-center rounded-md border border-input bg-neutral-50 dark:bg-neutral-900 px-3 pr-14 text-sm text-muted-foreground select-none">
            <span className="truncate">{form.projectTitle}</span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Auto
            </span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/60">Fetched automatically from your project record.</p>
      </div>
    </div>
  );
}

// ─── Step 1: Images ───────────────────────────────────────────────────────────

function StepImages({
  form, setForm,
}: {
  form: MultiStepForm;
  setForm: React.Dispatch<React.SetStateAction<MultiStepForm>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const urls  = valid.map((f) => URL.createObjectURL(f));
      setForm((p) => ({ ...p, images: [...p.images, ...valid], imageUrls: [...p.imageUrls, ...urls] }));
    },
    [setForm]
  );

  const remove = (i: number) => {
    setForm((p) => {
      URL.revokeObjectURL(p.imageUrls[i]);
      return {
        ...p,
        images:    p.images.filter((_, j) => j !== i),
        imageUrls: p.imageUrls.filter((_, j) => j !== i),
      };
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Images</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload high-quality images. Drag and drop or click to browse.
        </p>
      </div>

      {form.existingImageUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Already Uploaded</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {form.existingImageUrls.map((url, i) => (
              <div key={`existing-${i}`} className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 aspect-video">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-12 ${
          dragging
            ? "border-neutral-400 bg-neutral-50 dark:bg-neutral-900"
            : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Upload className="size-5 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop images here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP supported</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => addFiles(e.target.files)} />
      </div>

      {form.imageUrls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {form.imageUrls.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 aspect-video">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="size-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white/90 truncate">{form.images[i]?.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Videos ───────────────────────────────────────────────────────────

function StepVideos({
  form, setForm,
}: {
  form: MultiStepForm;
  setForm: React.Dispatch<React.SetStateAction<MultiStepForm>>;
}) {
  const [linkInput, setLinkInput] = useState("");

  const addLink = () => {
    const url = linkInput.trim();
    if (!url || form.videoLinks.includes(url)) { setLinkInput(""); return; }
    setForm((p) => ({ ...p, videoLinks: [...p.videoLinks, url] }));
    setLinkInput("");
  };

  const removeLink = (url: string) => {
    setForm((p) => ({ ...p, videoLinks: p.videoLinks.filter((l) => l !== url) }));
  };

  const getVideoThumb = (url: string) => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Videos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Add video links from YouTube or any other platform.</p>
      </div>

      <div className="space-y-3">
        <Label>Video Links</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Paste YouTube or video URL…"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            className="flex-1"
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!linkInput.trim()}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Add
          </button>
        </div>

        {form.videoLinks.length > 0 ? (
          <div className="space-y-2">
            {form.videoLinks.map((url, i) => {
              const thumb = getVideoThumb(url);
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-12 rounded-lg object-cover shrink-0 border border-neutral-200 dark:border-neutral-700" />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-700 shrink-0">
                      <svg className="size-5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  )}
                  <p className="text-xs text-foreground truncate flex-1">{url}</p>
                  <button type="button" onClick={() => removeLink(url)}
                    className="p-1 text-neutral-400 hover:text-destructive transition-colors shrink-0">
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No video links added yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Project Details ──────────────────────────────────────────────────

function StepProjectDetails({
  form, setForm,
}: {
  form: MultiStepForm;
  setForm: React.Dispatch<React.SetStateAction<MultiStepForm>>;
}) {
  const [certInput, setCertInput] = useState("");
  const [addingCert, setAddingCert] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ProjectFieldType>("text");

  // ── project field handlers ──────────────────────────────────────────────────
  const updateProjectField = (id: string, value: string) => {
    setForm((p) => ({
      ...p,
      projectFields: p.projectFields.map((f) => f.id === id ? { ...f, value } : f),
    }));
  };

  const updateProjectFieldUnit = (id: string, unit: string) => {
    setForm((p) => ({
      ...p,
      projectFields: p.projectFields.map((f) => f.id === id ? { ...f, unit } : f),
    }));
  };

  const removeProjectField = (id: string) => {
    setForm((p) => ({ ...p, projectFields: p.projectFields.filter((f) => f.id !== id) }));
  };

  const addProjectField = () => {
    const label = newLabel.trim();
    if (!label) return;
    setForm((p) => ({
      ...p,
      projectFields: [...p.projectFields, { id: genId(), label, type: newType, value: "" }],
    }));
    setNewLabel("");
    setNewType("text");
    setAddingField(false);
  };

  // ── document handlers ───────────────────────────────────────────────────────
  const removeDocument = (id: string) => {
    setForm((p) => ({ ...p, documents: p.documents.filter((d) => d.id !== id) }));
  };

  const updateDocumentFile = (id: string, file: File | null) => {
    setForm((p) => ({
      ...p,
      documents: p.documents.map((d) =>
        d.id === id ? { ...d, file, fileName: file?.name ?? "" } : d
      ),
    }));
  };

  const addDocument = () => {
    const name = certInput.trim();
    if (!name) return;
    setForm((p) => ({ ...p, documents: [...p.documents, { id: genId(), name, file: null, fileName: "" }] }));
    setCertInput("");
    setAddingCert(false);
  };

  // ── field input renderer ────────────────────────────────────────────────────
  const renderInput = (field: ProjectField) => {
    const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
    switch (field.type) {
      case "select":
        return (
          <select value={field.value ?? ""} onChange={(e) => updateProjectField(field.id, e.target.value)} className={selectCls}>
            {field.options?.map((o) => <option key={o} value={o}>{o || "Select…"}</option>)}
          </select>
        );
      case "textarea":
        return (
          <textarea rows={4} value={field.value ?? ""}
            onChange={(e) => updateProjectField(field.id, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}…`}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
        );
      case "number":
        if (field.unitOptions) {
          return (
            <div className="flex gap-2 min-w-0">
              <Input type="number" value={field.value ?? ""} placeholder="e.g. 40" className="min-w-0 flex-1"
                onChange={(e) => updateProjectField(field.id, e.target.value)} />
              <select value={field.unit ?? ""} onChange={(e) => updateProjectFieldUnit(field.id, e.target.value)}
                className="h-9 w-24 shrink-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {field.unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          );
        }
        return (
          <Input type="number" value={field.value ?? ""}
            placeholder={`Enter ${field.label.toLowerCase()}…`}
            onChange={(e) => updateProjectField(field.id, e.target.value)} />
        );
      default:
        return (
          <Input type={field.type} value={field.value ?? ""}
            placeholder={`Enter ${field.label.toLowerCase()}…`}
            onChange={(e) => updateProjectField(field.id, e.target.value)} />
        );
    }
  };

  const isWide = (f: ProjectField) => f.type === "textarea" || !!f.unitOptions;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Details</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Fill in the core project information. Add or remove fields as needed.</p>
      </div>

      {/* Dynamic project fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {form.projectFields.map((field) => (
          <div key={field.id} className={`space-y-1.5 ${isWide(field) ? "sm:col-span-2" : ""}`}>
            <div className="flex items-center justify-between">
              <Label>{field.label}</Label>
              <button type="button" onClick={() => removeProjectField(field.id)}
                className="text-neutral-400 hover:text-destructive transition-colors">
                <X className="size-3.5" />
              </button>
            </div>
            {renderInput(field)}
          </div>
        ))}
      </div>

      {/* Add field row */}
      {addingField ? (
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Input
            autoFocus
            placeholder="Field name…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addProjectField(); }
              if (e.key === "Escape") { setAddingField(false); setNewLabel(""); }
            }}
            className="flex-1 min-w-0"
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as ProjectFieldType)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0">
            <option value="text">Text</option>
            <option value="date">Date</option>
            <option value="month">Month</option>
            <option value="number">Number</option>
            <option value="textarea">Textarea</option>
          </select>
          <button type="button" onClick={addProjectField}
            className="px-3 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0">
            Add
          </button>
          <button type="button" onClick={() => { setAddingField(false); setNewLabel(""); }}
            className="p-2 text-neutral-400 hover:text-foreground transition-colors">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingField(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-sm font-medium text-muted-foreground hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all w-full justify-center">
          <Plus className="size-4" />
          Add Field
        </button>
      )}

      {/* Document (Certificates) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Document (Certificates)</Label>
          <button type="button" onClick={() => setAddingCert(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-xs font-medium text-muted-foreground hover:border-neutral-400 dark:hover:border-neutral-500 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all">
            <Plus className="size-3.5" />
            Add Certificate
          </button>
        </div>

        <div className="space-y-2">
          {form.documents.map((doc) => (
            <div key={doc.id} className="space-y-1.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{doc.name}</span>
                <button type="button" onClick={() => removeDocument(doc.id)}
                  className="p-1 text-neutral-400 hover:text-destructive transition-colors">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-dashed border-neutral-300 dark:border-neutral-600">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                {doc.fileName ? (
                  <span className="text-sm text-muted-foreground truncate flex-1">{doc.fileName}</span>
                ) : doc.url ? (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-emerald-600 dark:text-emerald-400 truncate flex-1 hover:underline">
                    View uploaded file
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground truncate flex-1">Upload PDF…</span>
                )}
                <label htmlFor={`doc-${doc.id}`}
                  className="shrink-0 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {doc.url || doc.fileName ? "Replace" : "Browse"}
                </label>
                {doc.fileName && (
                  <button type="button"
                    onClick={(e) => { e.preventDefault(); updateDocumentFile(doc.id, null); }}
                    className="shrink-0 text-neutral-400 hover:text-destructive transition-colors">
                    <X className="size-3.5" />
                  </button>
                )}
                <input id={`doc-${doc.id}`} type="file" accept=".pdf" className="hidden"
                  onChange={(e) => updateDocumentFile(doc.id, e.target.files?.[0] ?? null)} />
              </div>
            </div>
          ))}

          {addingCert && (
            <div className="flex gap-2">
              <Input autoFocus placeholder="Certificate name…" value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addDocument(); }
                  if (e.key === "Escape") { setAddingCert(false); setCertInput(""); }
                }}
                className="flex-1" />
              <button type="button" onClick={addDocument}
                className="px-3 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0">
                Add
              </button>
              <button type="button" onClick={() => { setAddingCert(false); setCertInput(""); }}
                className="p-2 text-neutral-400 hover:text-foreground transition-colors">
                <X className="size-4" />
              </button>
            </div>
          )}

          {form.documents.length === 0 && !addingCert && (
            <p className="text-sm text-muted-foreground py-1">No documents added.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Basic ────────────────────────────────────────────────────────────

function StepBasic({
  form, setForm,
}: {
  form: MultiStepForm;
  setForm: React.Dispatch<React.SetStateAction<MultiStepForm>>;
}) {
  const [search, setSearch] = useState("");

  const customAmenities = form.amenities.filter((a) => !ALL_AMENITIES.includes(a));

  const filtered = [
    ...ALL_AMENITIES.filter((a) => a.toLowerCase().includes(search.toLowerCase())),
    ...customAmenities.filter((a) => a.toLowerCase().includes(search.toLowerCase())),
  ];

  const trimmed = search.trim();
  const exactExists = [...ALL_AMENITIES, ...customAmenities].some(
    (a) => a.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = trimmed.length > 0 && !exactExists;

  const toggleAmenity = (a: string) => {
    setForm((p) => ({
      ...p,
      amenities: p.amenities.includes(a)
        ? p.amenities.filter((x) => x !== a)
        : [...p.amenities, a],
    }));
  };

  const createAmenity = () => {
    if (!canCreate) return;
    setForm((p) => ({ ...p, amenities: [...p.amenities, trimmed] }));
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Basic</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add amenities and mark if this is a featured project.
        </p>
      </div>

      {/* Amenities section */}
      <div className="space-y-3">
        <Label>Amenities <span className="text-red-500">*</span></Label>

        {form.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.amenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium">
                {a}
                <button type="button" onClick={() => toggleAmenity(a)} className="ml-0.5 hover:opacity-70 transition-opacity">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search + create row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search or create amenity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createAmenity(); } }}
              className="pl-8"
            />
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={createAmenity}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shrink-0"
            >
              <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
              </svg>
              Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>

        {/* Hint */}
        <p className="text-[11px] text-muted-foreground/70">
          Type an amenity name and press <kbd className="px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-[10px] font-mono">Enter</kbd> or click <span className="font-medium">Create</span> to add a custom one.
        </p>

        <div className="flex flex-wrap gap-2">
          {filtered.length > 0 ? filtered.map((a) => {
            const sel = form.amenities.includes(a);
            return (
              <button key={a} type="button" onClick={() => toggleAmenity(a)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  sel
                    ? "bg-foreground text-background border-foreground"
                    : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-foreground"
                }`}>
                {sel && <Check className="size-3 shrink-0" />}
                {a}
              </button>
            );
          }) : (
            <p className="text-sm text-muted-foreground py-2">
              No amenities match. {canCreate ? "Click Create to add it." : ""}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Step 5: Brochure ─────────────────────────────────────────────────────────

function StepBrochure({
  form, setForm,
}: {
  form: MultiStepForm;
  setForm: React.Dispatch<React.SetStateAction<MultiStepForm>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const fmt = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pick = (f: File) => setForm((p) => ({
    ...p, brochureFile: f, brochureFileName: f.name, brochureFileSize: f.size,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Brochure</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Upload the project brochure (PDF preferred).</p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors py-14"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Click to upload brochure</p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, DOC, DOCX supported</p>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
      </div>

      {form.brochureFileName ? (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 shrink-0">
            <FileText className="size-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{form.brochureFileName}</p>
            <p className="text-xs text-muted-foreground">{fmt(form.brochureFileSize)}</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Replace
          </button>
          <button type="button"
            onClick={() => setForm((p) => ({ ...p, brochureFile: null, brochureFileName: "", brochureFileSize: 0 }))}
            className="p-1 text-neutral-400 hover:text-destructive transition-colors">
            <X className="size-4" />
          </button>
        </div>
      ) : form.existingBrochureUrl && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 shrink-0">
            <FileText className="size-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Current brochure</p>
            <a href={form.existingBrochureUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              View / Download
            </a>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Replace
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<MultiStepForm>(() => {
    const cached = queryClient.getQueryData<{ id: string; projectName?: string; project_name?: string }[]>(["projects"]);
    const match = cached?.find((p) => p.id === id);
    const name = match?.projectName ?? match?.project_name;
    return { ...DEFAULT_FORM, projectTitle: name ?? "" };
  });
  const [currentStep, setCurrentStep] = useState(0);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectApi.getProject(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (!project) return;
    const p = project;
    const apiMap: Record<string, string | undefined> = {
      status:     p.projectStatus,
      possession: p.possessionDate,
      facing:     p.facings?.[0],
      subtype:    p.projectSubType,
      landArea:   p.projectLandArea,
      startDate:  p.startDate,
      endDate:    p.endDate,
      about:      p.description,
    };
    const serverDocs: Array<{ id: string; name: string; url: string; fileName: string }> = p.documents ?? [];
    const serverDocsById = new Map(serverDocs.map((d) => [d.id, d]));

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => {
      const mergedDocuments = prev.documents.map((d) => {
        const sd = serverDocsById.get(d.id);
        if (!sd) return d;
        serverDocsById.delete(d.id);
        return { ...d, url: sd.url, name: sd.name || d.name };
      });
      const extraDocuments = Array.from(serverDocsById.values()).map((sd) => ({
        id: sd.id, name: sd.name, file: null, fileName: "", url: sd.url,
      }));

      return {
        ...prev,
        projectTitle: p.projectName ?? p.project_name ?? prev.projectTitle,
        projectFields: prev.projectFields.map((f) =>
          apiMap[f.id] ? { ...f, value: apiMap[f.id] as string } : f
        ),
        detailsSaved: prev.detailsSaved || Object.values(apiMap).some((v) => !!v),
        amenities: [...(p.basicAmenities ?? []), ...(p.featuredAmenities ?? [])].length > 0
          ? [...(p.basicAmenities ?? []), ...(p.featuredAmenities ?? [])]
          : prev.amenities,
        isFeatured: p.isFeatured ?? prev.isFeatured,
        videoLinks: p.videoLinks ?? prev.videoLinks,
        existingImageUrls: p.imageUrls ?? prev.existingImageUrls,
        existingBrochureUrl: p.brochureUrl ?? prev.existingBrochureUrl,
        documents: [...mergedDocuments, ...extraDocuments],
      };
    });
  }, [project]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const fv = (fid: string) => form.projectFields.find((f) => f.id === fid)?.value ?? "";
      const fu = (fid: string) => form.projectFields.find((f) => f.id === fid)?.unit ?? "";
      return projectApi.updateProject(id, {
        projectStatus:    fv("status"),
        possessionDate:   fv("possession"),
        facings:          fv("facing") ? [fv("facing")] : [],
        projectSubType:   fv("subtype"),
        projectLandArea:  fv("landArea"),
        projectLandUnit:  fu("landArea"),
        startDate:        fv("startDate"),
        endDate:          fv("endDate"),
        description:      fv("about"),
        basicAmenities:   form.amenities,
        featuredAmenities: [],
        isFeatured:       form.isFeatured,
        videoLinks:       form.videoLinks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm((p) => ({ ...p, detailsSaved: true }));
    },
    onError: () => toast.error("Failed to save project details."),
  });

  const imagesMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      form.images.forEach((img) => fd.append("images", img));
      return projectApi.updateProjectImages(id, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm((p) => {
        p.imageUrls.forEach((u) => URL.revokeObjectURL(u));
        return { ...p, images: [], imageUrls: [] };
      });
    },
    onError: () => toast.error("Failed to upload images."),
  });

  const brochureMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("brochureFile", form.brochureFile as File);
      return projectApi.updateProjectBrochure(id, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm((p) => ({ ...p, brochureFile: null, brochureFileName: "", brochureFileSize: 0 }));
    },
    onError: () => toast.error("Failed to upload brochure."),
  });

  const documentsMutation = useMutation({
    mutationFn: () => {
      const pending = form.documents.filter((d) => d.file);
      const fd = new FormData();
      pending.forEach((d) => fd.append("documentFiles", d.file as File));
      fd.append(
        "documentsMetadata",
        JSON.stringify(pending.map((d) => ({ id: d.id, name: d.name }))),
      );
      return projectApi.updateProjectDocuments(id, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setForm((p) => ({
        ...p,
        documents: p.documents.map((d) =>
          d.file ? { ...d, file: null, fileName: "" } : d
        ),
      }));
    },
    onError: () => toast.error("Failed to upload documents."),
  });

  const isSaving =
    saveMutation.isPending ||
    imagesMutation.isPending ||
    brochureMutation.isPending ||
    documentsMutation.isPending;

  const handleSave = async () => {
    const tasks: Promise<unknown>[] = [saveMutation.mutateAsync()];
    if (form.images.length > 0) tasks.push(imagesMutation.mutateAsync());
    if (form.brochureFile) tasks.push(brochureMutation.mutateAsync());
    if (form.documents.some((d) => d.file)) tasks.push(documentsMutation.mutateAsync());

    const results = await Promise.allSettled(tasks);
    if (results.every((r) => r.status === "fulfilled")) {
      toast.success("Project saved successfully.");
    }
  };

  const listingMutation = useMutation({
    mutationFn: () => {
      const fv = (fid: string) => form.projectFields.find((f) => f.id === fid)?.value ?? "";
      const fu = (fid: string) => form.projectFields.find((f) => f.id === fid)?.unit ?? "";
      const fd = new FormData();

      form.images.forEach((img) => fd.append("images", img));
      form.videoLinks.forEach((url) => fd.append("videoLinks", url));

      form.amenities.forEach((a) => fd.append("amenities", a));
      fd.append("isFeatured",      String(form.isFeatured));
      fd.append("projectStatus",   fv("status"));
      fd.append("possessionDate",  fv("possession"));
      fd.append("facing",          fv("facing"));
      fd.append("projectSubType",  fv("subtype"));
      fd.append("projectLandArea", fv("landArea"));
      fd.append("projectLandUnit", fu("landArea"));
      fd.append("startDate",       fv("startDate"));
      fd.append("endDate",         fv("endDate"));
      fd.append("description",     fv("about"));

      return projectApi.createListing(id, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Listing published successfully.");
    },
    onError: (err: unknown) => {
      console.error("[listing 400]", axios.isAxiosError(err) ? err.response?.data : err);
      toast.error(getApiErrorMessage(err, "Failed to publish listing."));
    },
  });

  const projectName =
    form.projectTitle ||
    project?.projectName ||
    project?.project_name ||
    "";

  const stepPanels = [
    <StepHeading         key={0} form={form} isLoading={isLoading} />,
    <StepImages         key={1} form={form} setForm={setForm} />,
    <StepVideos         key={2} form={form} setForm={setForm} />,
    <StepProjectDetails key={3} form={form} setForm={setForm} />,
    <StepBasic          key={4} form={form} setForm={setForm} />,
    <StepBrochure       key={5} form={form} setForm={setForm} />,
  ];

  return (
    <div className="min-h-screen pb-16">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push("/real-estate/project/manage-projects")}
          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          {!projectName ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 className="font-semibold text-xl text-foreground tracking-tight leading-tight">
              {projectName}
            </h1>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Fill in all project details to create the complete listing
          </p>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Sidebar */}
        <div className="w-full lg:w-64 lg:shrink-0 lg:sticky lg:top-4">
          <StepSidebar
            currentStep={currentStep}
            form={form}
            onStepClick={setCurrentStep}
          />
        </div>

        {/* Form panel */}
        <div className="flex-1 min-w-0 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            {stepPanels[currentStep]}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || listingMutation.isPending}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button
                  onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => listingMutation.mutate()}
                  disabled={listingMutation.isPending || isSaving}
                  className="flex items-center gap-2"
                >
                  {listingMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Publish Listing
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
