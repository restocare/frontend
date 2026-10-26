"use client";

import React, { useState, useRef, useEffect } from "react";
import { HardDriveUpload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { vectorDbApi, projectApi, type ApiProject } from "@/app/api/api";
import { unwrapList } from "@/app/api/unwrapList";
import { useQuery } from "@tanstack/react-query";
import {
    Search, X, Building2, Plus, Loader2,
    ChevronDown, FolderOpen, FolderPlus, Download,
} from "lucide-react";
import { toast } from "sonner";

// ── spreadsheet helpers ────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
    { key: "amenityName", label: "Amenity Name" },
    { key: "siteName",    label: "Site Name" },
];

const AUTO_HINTS: Record<string, string[]> = {
    amenityName: ["amenity", "name", "question"],
    siteName:    ["site"],
};

function autoMap(cols: string[]): Record<string, string> {
    const lower = cols.map((c) => c.toLowerCase());
    const used = new Set<string>();
    const map: Record<string, string> = {};
    for (const field of REQUIRED_FIELDS) {
        const hints = AUTO_HINTS[field.key] ?? [field.key.toLowerCase()];
        for (const hint of hints) {
            const idx = lower.findIndex((lc) => lc.includes(hint));
            if (idx !== -1 && !used.has(cols[idx])) {
                map[field.key] = cols[idx];
                used.add(cols[idx]);
                break;
            }
        }
        if (!map[field.key]) {
            const fallback = cols.find((c) => !used.has(c));
            if (fallback) { map[field.key] = fallback; used.add(fallback); }
        }
    }
    return map;
}

interface Project {
    id: string;
    projectName: string;
    [key: string]: unknown;
}

function useOutsideClick(ref: React.RefObject<HTMLDivElement | null>, cb: () => void) {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) cb();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [ref, cb]);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PropertiesData() {

    // ── spreadsheet upload ────────────────────────────────────────────────────
    const [fileName, setFileName] = useState("");
    const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
    const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);

    // ── step 1: project ───────────────────────────────────────────────────────
    const [projectSearch, setProjectSearch] = useState("");
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const projectRef = useRef<HTMLDivElement>(null);
    useOutsideClick(projectRef, () => setProjectDropdownOpen(false));

    // ── step 2: namespace ────────────────────────────────────────────────────
    // localNamespaces holds names typed in this session not yet returned by API
    const [localNamespaces, setLocalNamespaces] = useState<string[]>([]);
    const [nsSearch, setNsSearch] = useState("");
    const [nsDropdownOpen, setNsDropdownOpen] = useState(false);
    const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
    const [creatingNs, setCreatingNs] = useState(false);
    const [newNsName, setNewNsName] = useState("");
    const nsRef = useRef<HTMLDivElement>(null);
    useOutsideClick(nsRef, () => { setNsDropdownOpen(false); setCreatingNs(false); setNewNsName(""); });

    // ── projects query ────────────────────────────────────────────────────────
    const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            return unwrapList<ApiProject>(await projectApi.getProjects()).map((p) => ({
                ...p,
                projectName: p.projectName ?? p.project_name ?? "",
            }));
        },
    });

    // ── namespaces query (tenant-scoped, fetched from backend) ────────────────
    const { data: remoteNamespaces = [], refetch: refetchNamespaces } = useQuery<string[]>({
        queryKey: ["namespaces"],
        queryFn: () => vectorDbApi.getNamespaces(),
    });

    // Merged list: remote namespaces + any created locally in this session
    const namespaces = [
        ...remoteNamespaces,
        ...localNamespaces.filter((ns) => !remoteNamespaces.includes(ns)),
    ];

    const filteredProjects = projects.filter((p) =>
        p.projectName.toLowerCase().includes(projectSearch.toLowerCase())
    );

    const filteredNamespaces = namespaces.filter((ns) =>
        ns.toLowerCase().includes(nsSearch.toLowerCase())
    );

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleProjectSelect = (project: Project) => {
        setSelectedProject(project);
        setProjectSearch(project.projectName);
        setProjectDropdownOpen(false);
        setSelectedNamespace(null);
        setNsSearch("");
        setNsDropdownOpen(false);
        setCreatingNs(false);
        setNewNsName("");
    };

    const clearProject = () => {
        setSelectedProject(null);
        setProjectSearch("");
        setSelectedNamespace(null);
        setNsSearch("");
    };

    const handleNamespaceSelect = (ns: string) => {
        setSelectedNamespace(ns);
        setNsSearch(ns);
        setNsDropdownOpen(false);
        setCreatingNs(false);
        setNewNsName("");
    };

    const handleCreateNamespace = async () => {
        const name = newNsName.trim();
        if (!name) { toast.error("Enter a namespace name."); return; }
        if (namespaces.includes(name)) { handleNamespaceSelect(name); return; }
        // Optimistically add to local list and select it immediately
        setLocalNamespaces((prev) => [...prev, name]);
        handleNamespaceSelect(name);
        // Persist to DB right away — don't wait for a file upload
        try {
            await vectorDbApi.createNamespace(name);
            toast.success(`Namespace "${name}" saved.`);
            refetchNamespaces();
        } catch {
            toast.error(`Could not save namespace "${name}" to the server.`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null);
        setSubmitted(false);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = event.target?.result;
                if (!data) throw new Error("Could not read file data.");
                const XLSX = await import("xlsx");
                const workbook = XLSX.read(data, { type: "binary" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
                if (jsonData.length === 0) throw new Error("The uploaded sheet is empty.");
                const cols = Object.keys(jsonData[0] || {});
                if (cols.length === 0) throw new Error("No columns detected in the sheet.");
                setExcelData(jsonData);
                setFieldMap(autoMap(cols));
            } catch (err) {
                setUploadError(err instanceof Error && err.message ? err.message : "Failed to parse the file.");
                setExcelData([]);
                setFieldMap({});
            }
        };
        reader.readAsBinaryString(file);
    };

    const buildAndUpload = async () => {
        const mapped = excelData.map((row) =>
            Object.fromEntries(
                REQUIRED_FIELDS.map(({ key }) => [key, String(row[fieldMap[key]] ?? "").trim()])
            )
        );
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(mapped);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
        const file = new File([buffer], "upload.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        await vectorDbApi.uploadExcel(file, selectedNamespace!, selectedProject!.id);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploadError(null);
        setSubmitted(false);
        setUploadLoading(true);
        try {
            if (!selectedProject) { setUploadError("Please select a project first."); return; }
            if (!selectedNamespace) { setUploadError("Please select or create a namespace first."); return; }
            if (excelData.length === 0) { setUploadError("Please upload an Excel or CSV file first."); return; }
            const missing = REQUIRED_FIELDS.filter((f) => !fieldMap[f.key]);
            if (missing.length > 0) {
                setUploadError(`Please map the following columns: ${missing.map((f) => f.label).join(", ")}`);
                return;
            }
            await buildAndUpload();
            setFileName("");
            setExcelData([]);
            setFieldMap({});
            setSubmitted(true);
            // Refresh the namespace list so the newly saved namespace appears
            refetchNamespaces();
        } catch (err) {
            const response = axios.isAxiosError(err) ? err.response : undefined;
            console.error("Vector DB upload error:", response?.data ?? err);
            let message = "Network error — could not reach the server. Please try again.";
            if (response) {
                const d: unknown = response.data;
                const body = typeof d === "string" ? d : (d as { message?: string; error?: string } | null)?.message || (d as { error?: string } | null)?.error || JSON.stringify(d);
                message = body || `Upload failed (${response.status})`;
            }
            setUploadError(message);
        } finally {
            setUploadLoading(false);
        }
    };

    // ── Sample format download ────────────────────────────────────────────────
    const downloadSample = async () => {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();

        // Sheet 1 — Data template
        const dataRows = [
            { "name/question": "What amenities are available?", answer: "Swimming pool, gym, clubhouse, and 24/7 security are available." },
            { "name/question": "What is the price range?", answer: "2BHK units start from ₹45 L and 3BHK from ₹65 L onwards." },
            { "name/question": "Is parking included?", answer: "Yes, dedicated covered parking is included with every unit." },
            { "name/question": "What is the possession date?", answer: "Expected possession is December 2026 as per the current schedule." },
        ];
        const dataSheet = XLSX.utils.json_to_sheet(dataRows);
        dataSheet["!cols"] = [{ wch: 45 }, { wch: 70 }];
        XLSX.utils.book_append_sheet(wb, dataSheet, "Data");

        // Sheet 2 — Instructions
        const instructions = [
            ["INSTRUCTIONS — How to fill and upload your data"],
            [""],
            ["COLUMN: name/question"],
            ["  • Write the name of the amenity, feature, or the question a buyer might ask."],
            ["  • Keep it short and clear. Examples:"],
            ["      - What amenities are available?"],
            ["      - Is parking included?"],
            ["      - Swimming Pool"],
            ["      - Possession Date"],
            [""],
            ["COLUMN: answer"],
            ["  • Write the complete answer or description for the corresponding name/question."],
            ["  • Be as descriptive as possible — the AI will use this text to answer queries."],
            ["  • Examples:"],
            ["      - Yes, covered parking is provided for every unit at no extra cost."],
            ["      - The project offers a rooftop pool, fully-equipped gym, and kids' play area."],
            [""],
            ["HOW TO UPLOAD"],
            ["  1. Go to the Upload Properties Data page."],
            ["  2. Select your Project from the left panel (Step 1)."],
            ["  3. Select or create a Namespace — this groups your data (e.g. amenities, faqs, pricing)."],
            ["  4. Drop or choose your filled Excel / CSV file in Step 3."],
            ["  5. Click 'Add to Database'. Each row is embedded and stored in the vector database."],
            [""],
            ["TIPS"],
            ["  • You can add as many rows as needed — there is no row limit."],
            ["  • Do not change the column headers (name/question, answer)."],
            ["  • Save the file as .xlsx or .csv before uploading."],
            ["  • Each namespace is a separate category. Upload different topic files to different namespaces."],
        ];
        const instrSheet = XLSX.utils.aoa_to_sheet(instructions);
        instrSheet["!cols"] = [{ wch: 90 }];
        XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");

        XLSX.writeFile(wb, "sample-upload-format.xlsx");
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full gap-0">

            {/* ── Top bar ── */}
            <div className="flex items-start justify-between pb-4 border-b border-border shrink-0">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">Add Property Details</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-xl">
                        Upload your property information using a spreadsheet. All the details you add will be saved and used to answer customer queries.
                    </p>
                </div>
            </div>

            {/* ── Main area: stacks on mobile/tablet, side-by-side on lg+ ── */}
            <div className="flex flex-col lg:flex-row flex-1 gap-0 min-h-0 overflow-y-auto lg:overflow-hidden">

                {/* ── Left panel: selection steps ── */}
                <div className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col gap-6 py-6 lg:pr-6 lg:overflow-y-auto">

                    {/* Step 1 */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-full bg-[#a1a1aa] text-white text-[10px] flex items-center justify-center font-bold shrink-0">1</span>
                            <span className="text-xs font-semibold text-foreground uppercase tracking-widest">Select Project</span>
                        </div>

                        <div className="relative" ref={projectRef}>
                            <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-lg bg-background focus-within:border-[#a1a1aa]/60 focus-within:ring-2 focus-within:ring-[#a1a1aa]/20 transition-all">
                                {projectsLoading
                                    ? <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
                                    : <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                }
                                <input
                                    type="text"
                                    value={projectSearch}
                                    onChange={(e) => { setProjectSearch(e.target.value); setProjectDropdownOpen(true); }}
                                    onFocus={() => setProjectDropdownOpen(true)}
                                    placeholder="Search projects…"
                                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                />
                                {selectedProject
                                    ? <button type="button" onClick={clearProject} className="text-muted-foreground hover:text-foreground transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                }
                            </div>

                            {projectDropdownOpen && (
                                <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                                    {filteredProjects.length === 0 ? (
                                        <p className="text-xs text-muted-foreground px-4 py-3">
                                            {projectSearch ? "No projects match." : "No projects found."}
                                        </p>
                                    ) : (
                                        <ul className="max-h-52 overflow-y-auto divide-y divide-border">
                                            {filteredProjects.map((project) => (
                                                <li key={project.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProjectSelect(project)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-[#a1a1aa]/10 text-[#a1a1aa] flex items-center justify-center shrink-0">
                                                            <Building2 className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-sm text-foreground truncate">{project.projectName}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {selectedProject && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#a1a1aa]/5 border border-[#a1a1aa]/20">
                                <Building2 className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
                                <span className="text-xs font-medium text-[#a1a1aa] truncate">{selectedProject.projectName}</span>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground">then</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Step 2 */}
                    <div className={`flex flex-col gap-2 transition-opacity duration-200 ${selectedProject ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-full bg-[#a1a1aa] text-white text-[10px] flex items-center justify-center font-bold shrink-0">2</span>
                            <span className="text-xs font-semibold text-foreground uppercase tracking-widest">Select Namespace</span>
                        </div>

                        <div className="relative" ref={nsRef}>
                            <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-lg bg-background focus-within:border-[#a1a1aa]/60 focus-within:ring-2 focus-within:ring-[#a1a1aa]/20 transition-all">
                                <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                                <input
                                    type="text"
                                    value={nsSearch}
                                    onChange={(e) => { setNsSearch(e.target.value); setNsDropdownOpen(true); setCreatingNs(false); }}
                                    onFocus={() => setNsDropdownOpen(true)}
                                    placeholder="Search or create…"
                                    className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                />
                                {selectedNamespace
                                    ? <button type="button" onClick={() => { setSelectedNamespace(null); setNsSearch(""); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                }
                            </div>

                            {nsDropdownOpen && (
                                <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                                    {filteredNamespaces.length > 0 && !creatingNs && (
                                        <ul className="max-h-40 overflow-y-auto divide-y divide-border">
                                            {filteredNamespaces.map((ns) => (
                                                <li key={ns}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleNamespaceSelect(ns)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                                            <FolderOpen className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-sm text-foreground truncate">{ns}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {filteredNamespaces.length === 0 && !creatingNs && (
                                        <p className="text-xs text-muted-foreground px-4 py-3">
                                            {nsSearch ? "No namespaces match." : "No namespaces yet."}
                                        </p>
                                    )}

                                    <div className="border-t border-border">
                                        {!creatingNs ? (
                                            <button
                                                type="button"
                                                onClick={() => { setCreatingNs(true); setNewNsName(nsSearch); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors text-[#a1a1aa]"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-[#a1a1aa]/10 flex items-center justify-center shrink-0">
                                                    <FolderPlus className="w-3 h-3" />
                                                </div>
                                                <span className="text-sm font-medium">Create namespace</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2.5">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={newNsName}
                                                    onChange={(e) => setNewNsName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleCreateNamespace();
                                                        if (e.key === "Escape") { setCreatingNs(false); setNewNsName(""); }
                                                    }}
                                                    placeholder="Namespace name…"
                                                    className="flex-1 min-w-0 h-8 px-2 border border-border rounded-md bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#a1a1aa]/60"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCreateNamespace}
                                                    disabled={!newNsName.trim()}
                                                    className="h-8 px-3 btn-dashboard-primary rounded-md text-xs flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Create
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setCreatingNs(false); setNewNsName(""); }}
                                                    className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedNamespace && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-xs font-medium text-amber-500 truncate">{selectedNamespace}</span>
                            </div>
                        )}
                    </div>

                    {/* Namespace list (if any exist) */}
                    {namespaces.length > 0 && (
                        <div className="flex flex-col gap-1.5 lg:mt-auto pt-4 border-t border-border">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1">Namespaces</p>
                            <div className="flex flex-wrap lg:flex-col gap-1.5">
                                {namespaces.map((ns) => (
                                    <button
                                        key={ns}
                                        type="button"
                                        onClick={() => { setNsSearch(ns); handleNamespaceSelect(ns); }}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors ${selectedNamespace === ns ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                    >
                                        <FolderOpen className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{ns}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right panel: spreadsheet upload ── */}
                <div className={`flex-1 flex flex-col py-6 lg:pl-6 min-w-0 lg:overflow-y-auto transition-opacity duration-200 ${selectedNamespace ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <div className="w-9 h-9 rounded-full bg-[#a1a1aa]/10 text-[#a1a1aa] flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-[#a1a1aa] text-white text-[10px] flex items-center justify-center font-bold shrink-0">3</span>
                                <h2 className="text-sm font-semibold text-foreground">Add Spreadsheet Data</h2>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Upload your file to save the property information</p>
                        </div>
                        <button
                            type="button"
                            onClick={downloadSample}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#a1a1aa]/40 hover:bg-[#a1a1aa]/5 transition-all shrink-0"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Sample Format
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
                        {/* Dropzone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                const files = e.dataTransfer.files;
                                if (files?.length > 0) handleFileChange({ target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>);
                            }}
                            className="flex-1 border-2 border-dashed border-border hover:border-[#a1a1aa]/50 rounded-xl flex flex-col items-center justify-center gap-4 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-all relative group min-h-48 sm:min-h-64"
                        >
                            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#a1a1aa]/10 text-[#a1a1aa] flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                                <FileSpreadsheet className="w-7 h-7 sm:w-8 sm:h-8" />
                            </div>
                            <div className="text-center px-4">
                                <p className="text-sm sm:text-base font-semibold text-foreground">
                                    {fileName || "Choose a file or drag it here"}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                                {excelData.length > 0 && (
                                    <p className="text-xs text-[#a1a1aa] mt-2 font-medium">{excelData.length} records detected</p>
                                )}
                            </div>
                        </div>

                        {submitted && (
                            <div className="flex items-start sm:items-center gap-3 border border-[#22c55e]/30 rounded-lg px-4 py-3 bg-[#22c55e]/5 animate-in fade-in zoom-in-95 duration-200">
                                <CheckCircle2 className="w-5 h-5 text-[#22c55e] shrink-0 mt-0.5 sm:mt-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-[#22c55e]">Data added successfully</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Your information has been saved and is ready to use.</p>
                                </div>
                            </div>
                        )}

                        {uploadError && (
                            <div className="flex items-start sm:items-center gap-2 border border-red-500/20 rounded-lg px-4 py-2.5 bg-red-500/5 animate-in fade-in zoom-in-95 duration-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5 sm:mt-0" />
                                <p className="text-xs text-red-400">{uploadError}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={uploadLoading || excelData.length === 0}
                            className="h-11 px-6 btn-dashboard-primary transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1a1aa] w-full rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-sm font-medium"
                        >
                            {uploadLoading ? (
                                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</>
                            ) : (
                                <><HardDriveUpload className="w-4 h-4" />{excelData.length > 0 ? `Upload ${excelData.length} records to Database` : "Add to Database"}</>
                            )}
                        </button>
                    </form>
                </div>
            </div>

        </div>
    );
}
