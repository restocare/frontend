"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/app/api/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Search,
    Plus,
    Pencil,
    Trash2,
    Copy,
    Calendar,
    Sliders,
    Layers,
    ArrowUpDown,
    Eye,
    Table2,
    LayoutGrid,
    List,
    Users,
    PhoneCall,
    Clock,
    ChevronDown,
    CheckSquare,
    X,
} from "lucide-react";

function FormStatMini({ formId }: { formId: string }) {
    const { data: submissions = [], isLoading } = useQuery<{ responses?: Record<string, unknown> }[]>({
        queryKey: ["form-submissions-mini", formId],
        queryFn: async () => {
            const res = await apiClient.get(`/api/meta-forms/${formId}/submissions`);
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    const total = submissions.length;
    const callConnected = submissions.filter(s => {
        const combined = Object.values(s.responses ?? {})
            .map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? "")).toLowerCase())
            .join(" ");
        return combined.includes("call connected");
    }).length;
    const pending = submissions.filter(s => {
        const combined = Object.values(s.responses ?? {})
            .map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? "")).toLowerCase())
            .join(" ");
        return !combined.includes("call connected") && !combined.includes("call initiated") && !combined.includes("not interested") && !combined.includes("inactive") && !combined.includes("active");
    }).length;

    if (isLoading) {
        return (
            <div className="flex items-center gap-1.5">
                {[1, 2, 3].map(i => <div key={i} className="h-10 w-20 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 w-20">
                <div className="flex items-center gap-1 mb-0.5">
                    <Users className="size-2.5 text-neutral-400" />
                    <span className="text-[9px] text-neutral-400 font-medium">Total</span>
                </div>
                <span className="text-sm font-bold text-foreground leading-none">{total}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 w-20">
                <div className="flex items-center gap-1 mb-0.5">
                    <Clock className="size-2.5 text-amber-500" />
                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                </div>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 leading-none">{pending}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/40 bg-teal-50 dark:bg-teal-950/20 w-20">
                <div className="flex items-center gap-1 mb-0.5">
                    <PhoneCall className="size-2.5 text-teal-500" />
                    <span className="text-[9px] text-teal-600 dark:text-teal-400 font-medium">Connected</span>
                </div>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400 leading-none">{callConnected}</span>
            </div>
        </div>
    );
}

interface FormSchemaItem {
    Id: string;
    Type: string;
    Label: string;
    Required: boolean;
    "Form ID": string;
    Order: number;
    Options?: string[];
    "Slider Settings"?: {
        Min: number;
        Max: number;
        Step: number;
        Prefix: string;
    };
}

interface FormConfig {
    id: string;
    title: string;
    description: string;
    fieldsCount: number;
    status: "active" | "paused" | "draft";
    createdAt: string;
    schema: FormSchemaItem[];
}


export default function Page() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "draft">("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "fields">("newest");
    const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
        if (typeof window !== "undefined") {
            const savedView = localStorage.getItem("forms-view-mode");
            if (savedView === "grid" || savedView === "list") return savedView as "grid" | "list";
        }
        return "grid";
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Bulk delete states
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
    const [showDeleteDropdown, setShowDeleteDropdown] = useState(false);
    const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
    const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);

    const deleteDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (deleteDropdownRef.current && !deleteDropdownRef.current.contains(e.target as Node)) {
                setShowDeleteDropdown(false);
            }
        };
        if (showDeleteDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showDeleteDropdown]);

    const handleViewModeChange = (mode: "grid" | "list") => {
        setViewMode(mode);
        localStorage.setItem("forms-view-mode", mode);
    };

    const { data: forms = [], isLoading: loading } = useQuery({
        queryKey: ["meta-forms"],
        queryFn: async () => {
            const res = await apiClient.get("/api/meta-forms");
            return res.data as FormConfig[];
        },
        staleTime: 30 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/api/meta-forms/${id}`);
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["meta-forms"] });
            const previousForms = queryClient.getQueryData<FormConfig[]>(["meta-forms"]);
            const formToDelete = previousForms?.find(f => f.id === id);
            if (previousForms) {
                queryClient.setQueryData<FormConfig[]>(["meta-forms"], previousForms.filter(f => f.id !== id));
            }
            if (formToDelete) {
                toast.error(`Form "${formToDelete.title}" deleted.`);
            }
            return { previousForms };
        },
        onError: (_err, _id, context) => {
            if (context?.previousForms) {
                queryClient.setQueryData(["meta-forms"], context.previousForms);
            }
            toast.error("Failed to delete form on server");
        }
    });

    const deleteAllMutation = useMutation({
        mutationFn: async () => {
            await apiClient.delete("/api/meta-forms");
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ["meta-forms"] });
            const previousForms = queryClient.getQueryData<FormConfig[]>(["meta-forms"]);
            queryClient.setQueryData<FormConfig[]>(["meta-forms"], []);
            toast.success("All forms deleted.");
            return { previousForms };
        },
        onError: (_err, _, context) => {
            if (context?.previousForms) {
                queryClient.setQueryData(["meta-forms"], context.previousForms);
            }
            toast.error("Failed to delete all forms");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["meta-forms"] });
        },
    });

    const deleteBulkMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await apiClient.delete("/api/meta-forms/bulk", { data: { ids } });
        },
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["meta-forms"] });
            const previousForms = queryClient.getQueryData<FormConfig[]>(["meta-forms"]);
            if (previousForms) {
                queryClient.setQueryData<FormConfig[]>(["meta-forms"], previousForms.filter(f => !ids.includes(f.id)));
            }
            toast.success(`${ids.length} form${ids.length > 1 ? "s" : ""} deleted.`);
            return { previousForms };
        },
        onError: (_err, _, context) => {
            if (context?.previousForms) {
                queryClient.setQueryData(["meta-forms"], context.previousForms);
            }
            toast.error("Failed to delete selected forms");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["meta-forms"] });
            setSelectedFormIds(new Set());
            setIsSelectionMode(false);
        },
    });

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = () => {
        if (deleteConfirmId) {
            deleteMutation.mutate(deleteConfirmId);
            setDeleteConfirmId(null);
        }
    };

    // Bulk delete handlers
    const handleDeleteAll = () => {
        setShowDeleteDropdown(false);
        setShowDeleteAllConfirm(true);
    };

    const confirmDeleteAll = () => {
        deleteAllMutation.mutate();
        setShowDeleteAllConfirm(false);
    };

    const handleCustomDelete = () => {
        setShowDeleteDropdown(false);
        setIsSelectionMode(true);
        setSelectedFormIds(new Set());
    };

    const toggleFormSelection = (id: string) => {
        setSelectedFormIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedFormIds(new Set());
    };

    const handleDeleteSelected = () => {
        if (selectedFormIds.size > 0) {
            setShowDeleteSelectedConfirm(true);
        }
    };

    const confirmDeleteSelected = () => {
        deleteBulkMutation.mutate(Array.from(selectedFormIds));
        setShowDeleteSelectedConfirm(false);
    };

    const duplicateMutation = useMutation({
        mutationFn: async (newForm: FormConfig) => {
            await apiClient.post("/api/meta-forms", newForm);
        },
        onMutate: async (newForm) => {
            await queryClient.cancelQueries({ queryKey: ["meta-forms"] });
            const previousForms = queryClient.getQueryData<FormConfig[]>(["meta-forms"]);
            if (previousForms) {
                queryClient.setQueryData<FormConfig[]>(["meta-forms"], [newForm, ...previousForms]);
            }
            toast.success(`Form "${newForm.title.replace(" (Copy)", "")}" duplicated successfully!`);
            return { previousForms };
        },
        onError: (_err, _newForm, context) => {
            if (context?.previousForms) {
                queryClient.setQueryData(["meta-forms"], context.previousForms);
            }
            toast.error("Failed to save duplicated form to server");
        }
    });

    const handleDuplicate = (formToDup: FormConfig) => {
        const newId = `form-${crypto.randomUUID()}`;
        const newForm: FormConfig = {
            ...formToDup,
            id: newId,
            title: `${formToDup.title} (Copy)`,
            createdAt: new Date().toISOString().split("T")[0],
            status: "active",
            schema: formToDup.schema.map((item) => ({
                ...item,
                "Form ID": `${item["Form ID"]}-copy`
            }))
        };
        duplicateMutation.mutate(newForm);
    };

    // Filtered & Sorted forms
    const filteredForms = forms
        .filter((form) => {
            const matchesSearch =
                form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                form.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === "all" || form.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (sortBy === "title") return a.title.localeCompare(b.title);
            if (sortBy === "fields") return b.fieldsCount - a.fieldsCount;
            return 0;
        });

    const totalForms = forms.length;
    const activeForms = forms.filter((f) => f.status === "active").length;
    const pausedForms = forms.filter((f) => f.status === "paused").length;
    const draftForms = forms.filter((f) => f.status === "draft").length;

    if (loading) {
        return (
            <div className="space-y-6 pb-16">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1.5">
                        <Skeleton className="h-6 w-36" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>

                {/* Filter bar */}
                <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                    <Skeleton className="h-8 w-full xl:w-56 rounded-lg" />
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-28 rounded-lg" />
                        <Skeleton className="h-8 w-28 rounded-lg" />
                        <Skeleton className="h-8 w-16 rounded-lg" />
                    </div>
                </div>

                {/* KPI badges */}
                <div className="flex flex-wrap items-center gap-2">
                    {[80, 72, 76, 68].map((w, i) => (
                        <Skeleton key={i} className={`h-6 w-${w === 80 ? "20" : w === 72 ? "[72px]" : w === 76 ? "[76px]" : "16"} rounded-full`} />
                    ))}
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col justify-between rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-card p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-3 gap-2">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-40" />
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-3 w-20" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                            <Skeleton className="h-3 w-full mt-1" />
                            <Skeleton className="h-3 w-4/5 mt-1.5" />
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
                                <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="size-6 rounded-lg" />)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Skeleton className="h-6 w-14 rounded-lg" />
                                    <Skeleton className="size-6 rounded-lg" />
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
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                        Manage Forms
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage, edit, duplicate, and export your dynamic campaign form configurations.
                    </p>
                </div>
                <Link href="/real-estate/form/create-your-own" passHref>
                    <button className="flex h-9 items-center justify-center gap-2 rounded-lg btn-dashboard-primary px-4 text-xs font-semibold transition-colors shadow-sm">
                        <Plus className="size-4" />
                        Create Form
                    </button>
                </Link>
            </div>

            {/* Filter / Search Controls Row */}
            <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm w-full">
                <div className="relative w-full xl:w-55 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search forms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-transparent py-1.5 pl-9 pr-3 text-xs text-foreground outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-700"
                    />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 bg-transparent">
                        <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "paused" | "draft")}
                            className="bg-transparent text-xs text-foreground font-medium outline-none cursor-pointer pr-1"
                        >
                            <option value="all" className="bg-card">All</option>
                            <option value="active" className="bg-card">Active</option>
                            <option value="paused" className="bg-card">Paused</option>
                            <option value="draft" className="bg-card">Draft</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 bg-transparent">
                        <ArrowUpDown className="size-3 text-neutral-400" />
                        <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as "title" | "newest" | "oldest" | "fields")}
                            className="bg-transparent text-xs text-foreground font-medium outline-none cursor-pointer pr-1"
                        >
                            <option value="newest" className="bg-card">Newest</option>
                            <option value="oldest" className="bg-card">Oldest</option>
                            <option value="title" className="bg-card">Title A-Z</option>
                            <option value="fields" className="bg-card">Fields Count</option>
                        </select>
                    </div>

                    <div className="hidden sm:flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 rounded-lg p-1 bg-transparent">
                        <button
                            onClick={() => handleViewModeChange("grid")}
                            className={`p-1 rounded-md transition-all ${viewMode === "grid" ? "bg-neutral-100 dark:bg-neutral-800 text-foreground shadow-sm" : "text-neutral-400 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="size-3.5" />
                        </button>
                        <button
                            onClick={() => handleViewModeChange("list")}
                            className={`p-1 rounded-md transition-all ${viewMode === "list" ? "bg-neutral-100 dark:bg-neutral-800 text-foreground shadow-sm" : "text-neutral-400 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}
                            title="List View"
                        >
                            <List className="size-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Badges + Bulk Delete Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 xl:gap-3 px-1">
                <div className="flex flex-wrap items-center gap-2 xl:gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <div className="size-1.5 rounded-full bg-neutral-500"></div>
                        <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">Total: {totalForms}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        <div className="size-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Active: {activeForms}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50/50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900/30 shadow-sm">
                        <div className="size-1.5 rounded-full bg-amber-500"></div>
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Paused: {pausedForms}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <div className="size-1.5 rounded-full bg-neutral-500"></div>
                        <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">Drafts: {draftForms}</span>
                    </div>
                </div>

                {/* Bulk Delete Dropdown */}
                {forms.length > 0 && (
                    <div className="relative" ref={deleteDropdownRef}>
                        <button
                            onClick={() => setShowDeleteDropdown(prev => !prev)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-red-400/40 hover:bg-red-950/10 text-neutral-500 dark:text-neutral-400 hover:text-red-500 transition-all text-[11px] font-semibold cursor-pointer"
                        >
                            <Trash2 className="size-3.5" />
                            Delete
                            <ChevronDown className={`size-3 transition-transform duration-150 ${showDeleteDropdown ? "rotate-180" : ""}`} />
                        </button>

                        {showDeleteDropdown && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                                <button
                                    onClick={handleDeleteAll}
                                    className="flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 transition-colors text-left"
                                >
                                    <Trash2 className="size-3.5 shrink-0" />
                                    Delete All
                                </button>
                                <div className="border-t border-neutral-100 dark:border-neutral-800" />
                                <button
                                    onClick={handleCustomDelete}
                                    className="flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-left"
                                >
                                    <CheckSquare className="size-3.5 shrink-0" />
                                    Custom Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Selection Mode Banner */}
            {isSelectionMode && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-950/15 border border-red-900/25 dark:border-red-800/30">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="size-4 text-red-400 shrink-0" />
                        <span className="text-xs font-medium text-red-400">
                            Custom Delete — click any form card to select it
                            {selectedFormIds.size > 0 && (
                                <span className="ml-1.5 font-bold">({selectedFormIds.size} selected)</span>
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={cancelSelectionMode}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors cursor-pointer"
                        >
                            <X className="size-3" />
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedFormIds.size === 0}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="size-3" />
                            Delete Selected ({selectedFormIds.size})
                        </button>
                    </div>
                </div>
            )}

            {/* Forms Grid / List */}
            {filteredForms.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-center">
                    <Layers className="size-10 text-neutral-300 dark:text-neutral-700 mb-3" />
                    <h3 className="font-semibold text-sm text-foreground">No forms found</h3>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                        Try adjusting your search query, or filter settings, or build a new form layout.
                    </p>
                </div>
            ) : (
                <div className={viewMode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
                    {filteredForms.map((form) => {
                        const formSlug = (form.schema && form.schema.length > 0 && form.schema[0]["Form ID"]) ? form.schema[0]["Form ID"] : form.id;
                        const isSelected = selectedFormIds.has(form.id);
                        return (
                            <div
                                key={form.id}
                                onClick={() => {
                                    if (isSelectionMode) {
                                        toggleFormSelection(form.id);
                                    } else {
                                        window.open(`/forms/${formSlug}`, "_blank");
                                    }
                                }}
                                className={`rounded-xl border p-4 shadow-sm transition-all duration-200 group cursor-pointer flex
                                    ${isSelectionMode && isSelected
                                        ? "border-red-500 bg-red-950/10 dark:bg-red-950/15 shadow-[0_0_0_2px_rgba(239,68,68,0.25),0_0_16px_rgba(239,68,68,0.12)]"
                                        : isSelectionMode
                                        ? "border-neutral-200 bg-card dark:border-neutral-800/80 hover:border-red-400/40 hover:bg-red-950/5"
                                        : "border-neutral-200 bg-card dark:border-neutral-800/80 hover:shadow-md"
                                    }
                                    ${viewMode === "grid" ? "flex-col justify-between" : "flex-col sm:flex-row sm:items-center justify-between gap-4"}`}
                            >
                                {/* Selection indicator */}
                                {isSelectionMode && (
                                    <div className="flex justify-end mb-2 -mt-1">
                                        <div className={`size-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? "border-red-500 bg-red-500" : "border-neutral-300 dark:border-neutral-600"}`}>
                                            {isSelected && (
                                                <svg className="size-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className={viewMode === "grid" ? "" : "flex-1 min-w-0"}>
                                    <div className={`flex flex-col sm:flex-row justify-between items-start gap-2 ${viewMode === "grid" ? "mb-2" : "mb-1"}`}>
                                        <div className="min-w-0 flex-1">
                                            <h2 className={`font-semibold text-sm transition-colors line-clamp-1 ${isSelectionMode && isSelected ? "text-red-400" : "text-foreground group-hover:text-primary"}`}>
                                                {form.title}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                    <Calendar className="size-3" />
                                                    {new Date(form.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                                                    <Sliders className="size-3" />
                                                    {form.fieldsCount} {form.fieldsCount === 1 ? "field" : "fields"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <FormStatMini formId={form.id} />
                                        </div>
                                    </div>
                                    <p className={`text-[11px] text-neutral-400 leading-relaxed ${viewMode === "grid" ? "mt-2 line-clamp-2" : "mt-1.5 line-clamp-1 max-w-3xl"}`}>
                                        {form.description}
                                    </p>
                                </div>

                                {/* Action Buttons — hidden in selection mode */}
                                {!isSelectionMode && (
                                    <div
                                        className={`flex flex-wrap items-center justify-between gap-y-2 ${viewMode === "grid" ? "border-t border-neutral-100 dark:border-neutral-800/50 mt-3 pt-2" : "sm:shrink-0 gap-4"}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {/* Duplicate */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDuplicate(form); }}
                                                title="Duplicate Template"
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400 cursor-pointer text-[11px] font-semibold"
                                            >
                                                <Copy className="size-3.5" />
                                                Duplicate
                                            </button>

                                            {/* Preview Live Form */}
                                            <a
                                                href={`/forms/${formSlug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Preview Live Form"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-emerald-500 cursor-pointer text-[11px] font-semibold"
                                            >
                                                <Eye className="size-3.5" />
                                                Preview
                                            </a>

                                            {/* View Responses — routes to dedicated page */}
                                            <Link
                                                href={`/real-estate/form/manage-forms/${formSlug}/responses`}
                                                title="View Form Responses"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-violet-500 cursor-pointer text-[11px] font-semibold"
                                            >
                                                <Table2 className="size-3.5" />
                                                Responses
                                            </Link>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {/* Edit Form */}
                                            <button
                                                title="Edit Fields"
                                                onClick={(e) => { e.stopPropagation(); router.push(`/real-estate/form/create-your-own?id=${formSlug}`); }}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-250 dark:border-neutral-800 bg-neutral-50 hover:bg-zinc-100 dark:bg-neutral-900 dark:hover:bg-zinc-950/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-neutral-600 dark:text-neutral-300 text-[11px] font-semibold"
                                            >
                                                <Pencil className="size-3" />
                                                Edit
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(form.id); }}
                                                title="Delete Form"
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-destructive/10 hover:border-destructive/20 text-neutral-500 hover:text-destructive dark:text-neutral-400 transition-colors cursor-pointer text-[11px] font-semibold"
                                            >
                                                <Trash2 className="size-3.5" />
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Single Form Delete Confirmation ── */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150">
                    <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-200 mb-4">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                            <h3 className="text-sm font-semibold text-foreground">Delete Form?</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Are you sure you want to delete <span className="font-medium text-foreground">&quot;{forms.find(f => f.id === deleteConfirmId)?.title}&quot;</span>? Form submissions will be preserved.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive hover:bg-destructive/90 text-white transition-colors cursor-pointer"
                            >
                                <Trash2 className="size-3.5" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete All Confirmation ── */}
            {showDeleteAllConfirm && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150">
                    <div className="bg-card border border-red-900/30 rounded-xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-200 mb-4">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2 mb-1">
                                <Trash2 className="size-4 text-red-500 shrink-0" />
                                <h3 className="text-sm font-semibold text-foreground">Delete All Forms?</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Are you sure you want to delete all <span className="font-semibold text-foreground">{totalForms}</span> form{totalForms !== 1 ? "s" : ""}? All form submissions and lead data will be preserved.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3">
                            <button
                                onClick={() => setShowDeleteAllConfirm(false)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                            >
                                <Trash2 className="size-3.5" />
                                Yes, Delete All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Selected Confirmation ── */}
            {showDeleteSelectedConfirm && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150">
                    <div className="bg-card border border-red-900/30 rounded-xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-200 mb-4">
                        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckSquare className="size-4 text-red-500 shrink-0" />
                                <h3 className="text-sm font-semibold text-foreground">Delete Selected Forms?</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Are you sure you want to delete the <span className="font-semibold text-foreground">{selectedFormIds.size}</span> selected form{selectedFormIds.size !== 1 ? "s" : ""}? All form submissions and lead data will be preserved.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3">
                            <button
                                onClick={() => setShowDeleteSelectedConfirm(false)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteSelected}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                            >
                                <Trash2 className="size-3.5" />
                                Yes, Delete Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
