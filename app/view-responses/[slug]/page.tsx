"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
// import { toast } from "sonner";
import {
    Table2,
    Download,
    Inbox,
    // Eye,
    // ArrowLeft,
    // Loader2
} from "lucide-react";
import apiClient from "@/app/api/apiClient";

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

export default function FormResponsesPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);
    const slug = resolvedParams.slug;

    const [form, setForm] = useState<FormConfig | null>(null);
    const [formResponses, setFormResponses] = useState<Array<{ submittedAt?: string; createdAt?: string; responses: Record<string, string | number | boolean | string[] | null> }>>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!slug) return;

        const loadData = async () => {
            setLoading(true);
            setNotFound(false);
            try {
                let currentForm: FormConfig | null = null;

                // Primary: fetch by slug/id directly
                try {
                    const res = await apiClient.get(`/api/meta-forms/${slug}`);
                    if (res.status === 200) {
                        currentForm = res.data;
                    }
                } catch {
                    // Fallback: fetch all forms and find matching by id or slug
                    try {
                        const listRes = await apiClient.get(`/api/meta-forms`);
                        if (listRes.status === 200) {
                            const allForms = listRes.data as FormConfig[];
                            currentForm = allForms.find((f) =>
                                f.id === slug || (f.schema && f.schema.length > 0 && f.schema[0]["Form ID"] === slug)
                            ) || null;
                        }
                    } catch (fallbackErr) {
                        console.error("Fallback failed:", fallbackErr);
                    }
                }

                if (!currentForm) {
                    setNotFound(true);
                    return;
                }

                // If schema is a string, parse it (backend might return it as string or object)
                const parsedForm = { ...currentForm };
                if (typeof parsedForm.schema === "string") {
                    try {
                        parsedForm.schema = JSON.parse(parsedForm.schema);
                    } catch {
                        parsedForm.schema = [];
                    }
                }
                setForm(parsedForm);

                // Fetch responses using the actual backend UUID
                try {
                    const respRes = await apiClient.get(`/api/meta-forms/${parsedForm.id}/submissions`);
                    if (respRes.status === 200) {
                        setFormResponses(respRes.data);
                    } else {
                        setFormResponses([]);
                    }
                } catch (err) {
                    console.error("Failed to fetch submissions:", err);
                    setFormResponses([]);
                }
            } catch (error) {
                console.error("Failed to fetch form or responses:", error);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [slug]);

    const exportToCSV = () => {
        if (!form || formResponses.length === 0) return;
        const headers = ["#", "Submitted At", ...form.schema.map((f: FormSchemaItem) => f.Label)];
        const rows = formResponses.map((resp, i) => [
            String(i + 1),
            new Date(resp.createdAt || resp.submittedAt || "").toLocaleString(),
            ...form.schema.map((f: FormSchemaItem) => {
                const val = resp.responses[f.Label] !== undefined ? resp.responses[f.Label] : (f.Label ? resp.responses[f.Label.toLowerCase().trim()] : undefined);
                return Array.isArray(val) ? val.join(", ") : String(val ?? "");
            })
        ]);
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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
            <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
                <div className="space-y-6 pb-16 animate-pulse">
                    {/* Skeleton Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800/50"></div>
                            <div>
                                <div className="h-6 w-48 bg-neutral-100 dark:bg-neutral-800/50 rounded-md"></div>
                                <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800/50 rounded-md mt-2"></div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-9 w-24 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg"></div>
                        </div>
                    </div>

                    {/* Skeleton Table */}
                    <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="h-12 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50"></div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-14 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center px-5 gap-4">
                                <div className="h-4 w-8 bg-neutral-100 dark:bg-neutral-800/50 rounded"></div>
                                <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800/50 rounded"></div>
                                <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800/50 rounded"></div>
                                <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-800/50 rounded hidden sm:block"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    if (notFound || !form) {
        return (
            <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
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
                        <Link href="/real-estate/form/manage-forms" className="inline-block mt-4 px-4 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors">
                            Back to Forms
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <div className="space-y-6 pb-16">
                {/* Header section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                                {form.title}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {formResponses.length} {formResponses.length === 1 ? "response" : "responses"} collected
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportToCSV}
                            disabled={formResponses.length === 0}
                            title="Export to CSV"
                            className="flex h-9 items-center justify-center gap-2 rounded-lg btn-dashboard-primary px-4 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="size-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Table area */}
                <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                    {formResponses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-12">
                            <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800/50 flex items-center justify-center ring-1 ring-neutral-200 dark:ring-neutral-800">
                                <Inbox className="size-7 text-neutral-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">No responses yet</p>
                                <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                                    Share the live form link and responses will appear here once submitted.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-neutral-50/80 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
                                        <th className="px-5 py-3.5 text-left font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap w-12 border-r border-neutral-200 dark:border-neutral-800">
                                            #
                                        </th>
                                        <th className="px-5 py-3.5 text-left font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap border-r border-neutral-200 dark:border-neutral-800">
                                            Submitted At
                                        </th>
                                        {form.schema.map((field) => (
                                            <th
                                                key={field.Id}
                                                className="px-5 py-3.5 text-left font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap border-r border-neutral-200 dark:border-neutral-800 last:border-r-0"
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {field.Label}
                                                    {field.Required && (
                                                        <span className="text-rose-500 font-bold">*</span>
                                                    )}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {formResponses.map((resp, i) => (
                                        <tr
                                            key={i}
                                            className={`border-b border-neutral-100 dark:border-neutral-800/60 last:border-b-0 transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-950/20 ${i % 2 === 0 ? "bg-transparent" : "bg-neutral-50/40 dark:bg-neutral-900/20"}`}
                                        >
                                            <td className="px-5 py-4 font-mono text-xs font-semibold text-neutral-400 border-r border-neutral-100 dark:border-neutral-800/60">
                                                {i + 1}
                                            </td>
                                            <td className="px-5 py-4 text-muted-foreground whitespace-nowrap border-r border-neutral-100 dark:border-neutral-800/60">
                                                {new Date(resp.createdAt || resp.submittedAt || "").toLocaleString()}
                                            </td>
                                            {form.schema.map((field) => {
                                                const val = resp.responses[field.Label] !== undefined ? resp.responses[field.Label] : (field.Label ? resp.responses[field.Label.toLowerCase().trim()] : undefined);
                                                const display = Array.isArray(val) ? val.join(", ") : (val ?? "—");
                                                return (
                                                    <td
                                                        key={field.Id}
                                                        className="px-5 py-4 text-foreground border-r border-neutral-100 dark:border-neutral-800/60 last:border-r-0 max-w-sm truncate"
                                                        title={String(display)}
                                                    >
                                                        {display === "" ? (
                                                            <span className="text-neutral-300 dark:text-neutral-700">—</span>
                                                        ) : (
                                                            String(display)
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
