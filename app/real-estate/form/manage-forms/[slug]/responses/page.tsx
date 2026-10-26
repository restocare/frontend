"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const ResponseDetailSidebar = dynamic(() => import("./ResponseDetailSidebar"), {
    ssr: false,
});
import {
    Table2,
    Download,
    Inbox,
    Search,
    X,
    Eye,
    SlidersHorizontal,
    Calendar,
    ArrowLeft,
    Users,
    UserCheck,
    Phone,
    PhoneCall,
    PhoneOff,
} from "lucide-react";
import apiClient from "@/app/api/apiClient";
import { Pagination } from "@/components/ui/Pagination";

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

interface CallRecord {
    id: string;
    summary?: string | null;
    transcription?: string | null;
    status?: string | null;
    score?: number | null;
    leadClass?: string | null;
    nextDate?: string | null;
    createdAt: string;
}

/** A submitted field value: text, number, choice, a checkbox group, or empty. */
type ResponseValue = string | number | boolean | string[] | null;

interface Submission {
    id?: string;
    submittedAt?: string;
    createdAt?: string;
    responses: Record<string, ResponseValue>;
    callSummary?: string | null;
    callMade?: boolean;
    calls?: CallRecord[];
}


type StatusCategory = "active" | "callInitiated" | "callConnected" | "inactive";

function getResponseStatusCategory(resp: Submission): StatusCategory | null {
    const combined = Object.values(resp.responses)
        .map(v => (Array.isArray(v) ? v.join(" ") : String(v ?? "")).toLowerCase())
        .join(" ");
    if (combined.includes("call connected")) return "callConnected";
    if (combined.includes("call initiated")) return "callInitiated";
    if (combined.includes("not interested") || combined.includes("inactive")) return "inactive";
    if (combined.includes("active")) return "active";
    return null;
}

export default function FormResponsesPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);
    const slug = resolvedParams.slug;

    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusCategory | "all">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [selectedRow, setSelectedRow] = useState<{ submission: Submission; index: number } | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const { data: form, isLoading: formLoading, isError: formError } = useQuery<FormConfig>({
        queryKey: ["meta-form-by-slug", slug],
        queryFn: async () => {
            let raw: FormConfig | null = null;
            try {
                const res = await apiClient.get(`/api/meta-forms/${slug}`);
                if (res.status === 200) raw = res.data;
            } catch {
                const listRes = await apiClient.get("/api/meta-forms");
                raw = (listRes.data as FormConfig[]).find((f) =>
                    f.id === slug || (f.schema && f.schema.length > 0 && f.schema[0]["Form ID"] === slug)
                ) ?? null;
            }
            if (!raw) throw new Error("Form not found");
            const parsed = { ...raw };
            if (typeof parsed.schema === "string") {
                try { parsed.schema = JSON.parse(parsed.schema as unknown as string); }
                catch { parsed.schema = []; }
            }
            return parsed;
        },
        enabled: !!slug,
        retry: false,
    });


    const { data: formResponses = [], isLoading: responsesLoading } = useQuery<Submission[]>({
        queryKey: ["form-submissions", form?.id],
        queryFn: async () => {
            const res = await apiClient.get(`/api/meta-forms/${form!.id}/submissions`);
            return res.data;
        },
        enabled: !!form?.id,
        retry: false,
    });

    const loading = formLoading || (!!form && responsesLoading);

    const filtered = useMemo(() => {
        let result = [...formResponses];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(resp =>
                Object.values(resp.responses).some(v => {
                    const str = Array.isArray(v) ? v.join(", ") : String(v ?? "");
                    return str.toLowerCase().includes(q);
                }) ||
                new Date(resp.createdAt || resp.submittedAt || "").toLocaleString().toLowerCase().includes(q)
            );
        }

        if (dateFrom) {
            const from = new Date(dateFrom);
            result = result.filter(resp => new Date(resp.createdAt || resp.submittedAt || "") >= from);
        }

        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter(resp => new Date(resp.createdAt || resp.submittedAt || "") <= to);
        }

        if (statusFilter !== "all") {
            result = result.filter(resp => getResponseStatusCategory(resp) === statusFilter);
        }

        return result;
    }, [formResponses, searchQuery, dateFrom, dateTo, statusFilter]);

    const statusCounts = useMemo(() => {
        const counts = { active: 0, callInitiated: 0, callConnected: 0, inactive: 0 };
        formResponses.forEach(resp => {
            const cat = getResponseStatusCategory(resp);
            if (cat) counts[cat]++;
        });
        return counts;
    }, [formResponses]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filtered.slice(start, start + itemsPerPage);
    }, [filtered, currentPage, itemsPerPage]);

    const hasActiveFilters = searchQuery.trim() || dateFrom || dateTo || statusFilter !== "all";

    const clearFilters = () => {
        setSearchQuery("");
        setDateFrom("");
        setDateTo("");
        setStatusFilter("all");
        setCurrentPage(1);
    };

    const exportToCSV = () => {
        if (!form || filtered.length === 0) return;
        const headers = ["#", "Submitted At", ...form.schema.map((f: FormSchemaItem) => f.Label)];
        const rows = filtered.map((resp, i) => [
            String(i + 1),
            new Date(resp.createdAt || resp.submittedAt || "").toLocaleString(),
            ...form.schema.map((f: FormSchemaItem) => {
                const val = resp.responses[f.Label] !== undefined ? resp.responses[f.Label] : (f.Label ? resp.responses[f.Label.toLowerCase().trim()] : undefined);
                return Array.isArray(val) ? val.join(", ") : String(val ?? "");
            })
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-responses.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="space-y-5 pb-16 animate-pulse">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800/50" />
                        <div>
                            <div className="h-5 w-44 bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                            <div className="h-3.5 w-28 bg-neutral-100 dark:bg-neutral-800/50 rounded-md mt-2" />
                        </div>
                    </div>
                    <div className="h-9 w-28 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-card px-3.5 py-2.5 flex items-center gap-3">
                            <div className="size-4 rounded bg-neutral-200 dark:bg-neutral-800 shrink-0" />
                            <div className="space-y-1.5">
                                <div className="h-2.5 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
                                <div className="h-4 w-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 shadow-sm">
                    <div className="h-8 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg" />
                </div>
                <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="h-11 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70" />
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-13 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center px-4 gap-4">
                            <div className="h-3.5 w-6 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                            <div className="h-3.5 w-36 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                            <div className="h-3.5 w-28 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                            <div className="h-3.5 w-24 bg-neutral-100 dark:bg-neutral-800/50 rounded hidden sm:block" />
                        </div>
                    ))}
                    <div className="h-12 border-t border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/30" />
                </div>
            </div>
        );
    }

    if (formError || !form) {
        return (
            <div className="flex h-dvh items-center justify-center px-4">
                <div className="text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-100 dark:bg-neutral-800">
                        <Table2 className="w-5 h-5 text-neutral-400" />
                    </div>
                    <div>
                        <p className="text-[15px] font-semibold">Form not found</p>
                        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                            The form you are looking for does not exist or has been removed.
                        </p>
                    </div>
                    <Link
                        href="/real-estate/form/manage-forms"
                        className="inline-block mt-4 px-4 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                    >
                        Back to Forms
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/real-estate/form/manage-forms"
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                    >
                        <ArrowLeft className="size-3.5 text-neutral-500" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground tracking-tight">{form.title}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {formResponses.length} {formResponses.length === 1 ? "response" : "responses"} total
                            {hasActiveFilters && filtered.length !== formResponses.length && (
                                <span className="text-violet-600 dark:text-violet-400"> · {filtered.length} matching</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={exportToCSV}
                        disabled={filtered.length === 0}
                        className="flex h-9 items-center justify-center gap-2 rounded-lg btn-dashboard-primary px-4 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="size-3.5" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
                {[
                    { label: "Total Leads", value: formResponses.length, icon: Users, iconClass: "text-neutral-500 dark:text-neutral-400", pct: null, status: "all" as const },
                    { label: "Today's Lead", value: statusCounts.active, icon: UserCheck, iconClass: "text-emerald-500", pct: formResponses.length > 0 ? Math.round((statusCounts.active / formResponses.length) * 100) : 0, status: "active" as const },
                    { label: "Call Initiated", value: statusCounts.callInitiated, icon: Phone, iconClass: "text-blue-500", pct: formResponses.length > 0 ? Math.round((statusCounts.callInitiated / formResponses.length) * 100) : 0, status: "callInitiated" as const },
                    { label: "Call Connected", value: statusCounts.callConnected, icon: PhoneCall, iconClass: "text-teal-500", pct: formResponses.length > 0 ? Math.round((statusCounts.callConnected / formResponses.length) * 100) : 0, status: "callConnected" as const },
                    { label: "Inactive / Not Interested", value: statusCounts.inactive, icon: PhoneOff, iconClass: "text-rose-500", pct: formResponses.length > 0 ? Math.round((statusCounts.inactive / formResponses.length) * 100) : 0, span: true, status: "inactive" as const },
                ].map(({ label, value, icon: Icon, iconClass, pct, span, status }) => (
                    <button
                        type="button"
                        key={label}
                        onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                        title={`Filter by ${label}`}
                        className={`text-left bg-card border rounded-lg px-3.5 py-2.5 flex items-center gap-3 shadow-sm transition-colors hover:border-violet-300 dark:hover:border-violet-700 ${
                            statusFilter === status
                                ? "border-violet-300 ring-1 ring-violet-300 dark:border-violet-700 dark:ring-violet-800"
                                : "border-neutral-200 dark:border-neutral-800"
                        }${span ? " col-span-2 md:col-span-1" : ""}`}
                    >
                        <Icon className={`size-4 shrink-0 ${iconClass}`} />
                        <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-semibold text-foreground leading-tight">{value}</span>
                                {pct !== null && (
                                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Search + Filter Bar */}
            <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search across all responses..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full rounded-lg border border-neutral-200 bg-transparent py-1.5 pl-9 pr-8 text-xs text-foreground outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-700 placeholder:text-neutral-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setCurrentPage(1);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-foreground transition-colors"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors shrink-0 ${showFilters || dateFrom || dateTo
                                ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-400"
                                : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            }`}
                    >
                        <SlidersHorizontal className="size-3.5" />
                        Filters
                        {(dateFrom || dateTo) && (
                            <span className="size-1.5 rounded-full bg-violet-500 shrink-0" />
                        )}
                    </button>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 hover:text-destructive hover:border-destructive/20 hover:bg-destructive/5 transition-colors shrink-0"
                        >
                            <X className="size-3" />
                            Clear
                        </button>
                    )}
                </div>
                {showFilters && (
                    <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800/60">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-neutral-400" />
                            <span className="text-xs text-neutral-500 font-medium">Date range:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => {
                                    setDateFrom(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-2.5 py-1 text-xs text-foreground outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                            />
                            <span className="text-xs text-neutral-400">to</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => {
                                    setDateTo(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-2.5 py-1 text-xs text-foreground outline-none focus:border-neutral-400 dark:focus:border-neutral-700"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 text-center p-12">
                        {formResponses.length === 0 ? (
                            <>
                                <div className="w-14 h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 flex items-center justify-center ring-1 ring-neutral-200 dark:ring-neutral-800">
                                    <Inbox className="size-6 text-neutral-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">No responses yet</p>
                                    <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                                        Share the live form link and responses will appear here once submitted.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 flex items-center justify-center ring-1 ring-neutral-200 dark:ring-neutral-800">
                                    <Search className="size-6 text-neutral-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">No matching responses</p>
                                    <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto">
                                        Try adjusting your search or date filters.
                                    </p>
                                </div>
                                <button
                                    onClick={clearFilters}
                                    className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline underline-offset-2"
                                >
                                    Clear all filters
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-neutral-50 dark:bg-neutral-900/70 border-b border-neutral-200 dark:border-neutral-800">
                                        <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap w-12">#</th>
                                        <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                            Submitted At
                                        </th>
                                        {form.schema.map((field) => (
                                            <th
                                                key={field.Id}
                                                className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
                                            >
                                                {field.Label}
                                                {field.Required && (
                                                    <span className="text-rose-400 ml-0.5">*</span>
                                                )}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400 w-16">
                                            View
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                                    {paginated.map((resp, i) => {
                                        return (
                                            <tr
                                                key={i}
                                                className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40 transition-colors group"
                                            >
                                                <td className="px-4 py-3.5 font-mono text-neutral-500 text-[11px]">
                                                    {i + 1}
                                                </td>
                                                <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                                                    {new Date(resp.createdAt || resp.submittedAt || "").toLocaleString()}
                                                </td>
                                                {form.schema.map((field) => {
                                                    const val = resp.responses[field.Label] !== undefined ? resp.responses[field.Label] : (field.Label ? resp.responses[field.Label.toLowerCase().trim()] : undefined);
                                                    const display = Array.isArray(val) ? val.join(", ") : (val ?? "");
                                                    return (
                                                        <td
                                                            key={field.Id}
                                                            className="px-4 py-3.5 max-w-50 truncate text-foreground"
                                                            title={String(display)}
                                                        >
                                                            {String(display) === "" ? (
                                                                <span className="text-neutral-400 dark:text-neutral-600">—</span>
                                                            ) : String(display)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-3.5 text-right">
                                                    <button
                                                        onClick={() => setSelectedRow({ submission: resp, index: i })}
                                                        className="inline-flex items-center justify-center size-7 rounded-md border border-neutral-200 dark:border-neutral-800 hover:bg-violet-50 hover:border-violet-200 dark:hover:bg-violet-950/30 dark:hover:border-violet-800/50 text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                                                        title="View full response"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filtered.length}
                            itemsPerPage={itemsPerPage}
                            onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                        />
                    </>
                )}
            </div>

            {/* Detail Side Panel */}
            {selectedRow && (
                <ResponseDetailSidebar
                    key={selectedRow.submission.id ?? selectedRow.index}
                    selectedRow={selectedRow}
                    setSelectedRow={setSelectedRow}
                    form={form}
                    filtered={filtered}
                />
            )}
        </div>
    );
}