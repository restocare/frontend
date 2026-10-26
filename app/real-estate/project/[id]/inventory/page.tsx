"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import apiClient from "@/app/api/apiClient";
import {
  ArrowLeft,
  PackagePlus,
  Upload,
  X,
  Loader2,
  Table2,
  FileSpreadsheet,
  CheckCircle2,
  Database,
  RefreshCw,
  Search,
  CloudUpload,
} from "lucide-react";
import { projectApi, propertiesApi } from "@/app/api/api";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryRow {
  [key: string]: string | number | boolean | null;
}

export default function InventoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sidebarInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Sidebar + file state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Inventory table state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Pull name from react-query cache if already loaded
  const cachedName = (() => {
    const list = queryClient.getQueryData<{ id: string; projectName?: string }[]>(["projects"]);
    return list?.find((p) => p.id === id)?.projectName ?? "";
  })();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectApi.getProject(id),
    enabled: !!id && !cachedName,
  });

  const displayName = cachedName || project?.projectName || project?.project_name || "";

  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    isError: propertiesError,
    refetch: refetchProperties,
  } = useQuery({
    queryKey: ["properties", id, page, limit],
    queryFn: () => propertiesApi.getProperties(id, page, limit),
    enabled: !!id,
  });

  const properties: InventoryRow[] = Array.isArray(propertiesData)
    ? propertiesData
    : Array.isArray(propertiesData?.data)
    ? propertiesData.data
    : propertiesData?.properties ?? propertiesData?.items ?? [];

  const filteredProperties = properties.filter((prop) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      String(prop.propertyCode ?? prop.property_code ?? "").toLowerCase().includes(q) ||
      String(prop.block ?? "").toLowerCase().includes(q) ||
      String(prop.property_type ?? "").toLowerCase().includes(q) ||
      String(prop.facing ?? "").toLowerCase().includes(q) ||
      String(prop.status ?? "").toLowerCase().includes(q)
    );
  });

  const propertyHeaders: string[] =
    properties.length > 0 ? Object.keys(properties[0]) : [];

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<InventoryRow>(sheet, { defval: "" });
        if (json.length > 0) {
          setHeaders(Object.keys(json[0]));
          setRows(json);
        } else {
          setHeaders([]);
          setRows([]);
          toast.warning("The file appears to be empty.");
        }
      } catch {
        toast.error("Could not parse the file. Make sure it is a valid CSV, XLS, or XLSX.");
      }
    };
    reader.readAsArrayBuffer(file);
    setUploadFile(file);
    setUploaded(false);
    setUploadProgress(0);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const clearFile = () => {
    setUploadFile(null);
    setHeaders([]);
    setRows([]);
    setUploaded(false);
    setUploadProgress(0);
    if (sidebarInputRef.current) sidebarInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!uploadFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    const toastId = "inventory-upload";
    toast.loading("Uploading inventory...", { id: toastId });

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("projectId", id);

      await apiClient.post("/api/properties/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            if (isMountedRef.current) setUploadProgress(pct);
          }
        },
      });

      if (isMountedRef.current) {
        setUploadProgress(100);
        setUploaded(true);
      }
      toast.success("Inventory uploaded successfully!", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["properties", id] });

      setTimeout(() => {
        if (isMountedRef.current) {
          clearFile();
          setSidebarOpen(false);
        }
      }, 1500);
    } catch {
      toast.error("Failed to upload inventory.", { id: toastId });
      if (isMountedRef.current) setUploadProgress(0);
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  const downloadDemoExcel = async () => {
    const demoHeaders = [
      "Plot No", "Property Type", "Status", "Block", "Plot Size",
      "Facing", "Road Width (ft)", "Land Use", "Corner Plot",
      "Park Facing", "Price", "Project Name",
    ];
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([demoHeaders]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(
      workbook,
      `${displayName ? displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_") : "inventory"}_template.xlsx`
    );
    toast.success("Excel template downloaded successfully.");
  };

  const openSidebar = () => {
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    if (isUploading) {
      toast.info("Upload is running in the background. You can navigate freely.");
    }
    setSidebarOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/real-estate/project/manage-projects")}
          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          {!displayName && projectLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 className="font-semibold text-xl text-foreground tracking-tight leading-tight">
              {displayName || "Project"}
            </h1>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload inventory units for this project
          </p>
        </div>
      </div>

      {/* Add Inventories card — header only, no drop zone */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-sky-500/10">
              <PackagePlus className="size-3.5 text-sky-500" />
            </div>
            <h2 className="font-semibold text-xs text-foreground">Add Inventories</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openSidebar}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold transition-colors"
            >
              <Upload className="size-3.5" />
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar overlay */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 h-full bg-black/40 z-40 backdrop-blur-sm transition-opacity"
            onClick={closeSidebar}
          />

          {/* Sidebar panel */}
          <div className="fixed right-0 top-0 h-full w-full sm:w-1/2 bg-card border-l border-neutral-200 dark:border-neutral-800 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-full bg-sky-500/10">
                  <CloudUpload className="size-3.5 text-sky-500" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">Upload Inventory</h3>
              </div>
              <button
                type="button"
                onClick={closeSidebar}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Sidebar body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Download Demo Template */}
              <button
                type="button"
                onClick={downloadDemoExcel}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-100 dark:hover:bg-sky-950/70 transition-colors"
              >
                <FileSpreadsheet className="size-3.5" />
                Download Demo Template
              </button>

              {/* File picker area */}
              {!uploadFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => sidebarInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-10 ${
                    isDragging
                      ? "border-sky-400 bg-sky-50/50 dark:bg-sky-950/20"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Upload className="size-5 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Drop your file here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or{" "}
                      <span className="text-sky-600 dark:text-sky-400 font-medium underline underline-offset-2">
                        click to browse
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 pt-1">
                      Supports CSV, XLS, XLSX
                    </p>
                  </div>
                  <input
                    ref={sidebarInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseFile(f);
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected file info */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950 border border-sky-100 dark:border-sky-900 shrink-0">
                      <FileSpreadsheet className="size-5 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rows.length} row{rows.length !== 1 ? "s" : ""} &middot; {headers.length} column{headers.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {uploaded && <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />}
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={clearFile}
                        className="p-1 text-neutral-400 hover:text-destructive transition-colors shrink-0"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Upload progress bar */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Uploading…</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                          {uploadProgress}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        You can navigate to other pages — the upload will continue in the background.
                      </p>
                    </div>
                  )}

                  {/* Uploaded success state */}
                  {uploaded && !isUploading && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Inventory uploaded successfully!
                      </p>
                    </div>
                  )}

                  {/* Preview table */}
                  {rows.length > 0 && !isUploading && !uploaded && (
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-neutral-900/40">
                        <Table2 className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">Preview</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-muted-foreground">
                          {rows.length} entries
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-52">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-neutral-100 dark:border-neutral-800/80">
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground bg-neutral-50/80 dark:bg-neutral-900/40 w-8 shrink-0">#</th>
                              {headers.map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground bg-neutral-50/80 dark:bg-neutral-900/40 whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                                <td className="px-3 py-2 text-muted-foreground/60 tabular-nums">{i + 1}</td>
                                {headers.map((h) => (
                                  <td key={h} className="px-3 py-2 text-foreground whitespace-nowrap">
                                    {String(row[h] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {rows.length > 5 && (
                        <p className="px-4 py-2 text-[10px] text-muted-foreground border-t border-neutral-100 dark:border-neutral-800/80">
                          +{rows.length - 5} more rows not shown
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Instructions */}
              <div className="rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/60 dark:bg-neutral-900/20 p-4 space-y-2">
                <p className="text-[11px] font-semibold text-foreground">File requirements</p>
                <ul className="space-y-1 text-[10px] text-muted-foreground list-disc list-inside">
                  <li>CSV, XLS, or XLSX format</li>
                  <li>First row must contain column headers</li>
                  <li>Download the demo template for the correct format</li>
                </ul>
              </div>
            </div>

            {/* Sidebar footer */}
            <div className="p-5 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || isUploading || uploaded}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading {uploadProgress}%…
                  </>
                ) : uploaded ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Uploaded
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload Inventory
                  </>
                )}
              </button>
              {isUploading && (
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Close and continue in background
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Existing inventory from API */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">Inventory</span>
            {!propertiesLoading && !propertiesError && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-semibold text-muted-foreground">
                {propertiesData?.total ?? properties.length} {(propertiesData?.total ?? properties.length) === 1 ? "unit" : "units"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!propertiesLoading && !propertiesError && properties.length > 0 && (
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search units..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full sm:w-48 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-background pl-8 pr-7 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}

            {!propertiesLoading && !propertiesError && properties.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                <span>Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-background text-[11px] font-semibold text-foreground px-2 outline-none focus:border-sky-500 transition-colors"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => refetchProperties()}
              disabled={propertiesLoading}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
            >
              <RefreshCw className={`size-3.5 ${propertiesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {propertiesLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : propertiesError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <p className="text-sm font-medium text-destructive">Failed to load inventory</p>
            <button
              type="button"
              onClick={() => refetchProperties()}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Try again
            </button>
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <Database className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No inventory yet</p>
            <p className="text-xs text-muted-foreground">Click Upload above to add inventory units.</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No matching inventory units</p>
            <p className="text-xs text-muted-foreground">Adjust your search query and try again.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800/80">
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground bg-neutral-50/80 dark:bg-neutral-900/40 w-10 shrink-0">
                      #
                    </th>
                    {propertyHeaders.map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-semibold text-muted-foreground bg-neutral-50/80 dark:bg-neutral-900/40 whitespace-nowrap capitalize"
                      >
                        {h.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((prop, i) => (
                    <tr
                      key={String(prop.id ?? i)}
                      className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground/60 tabular-nums">{(page - 1) * limit + i + 1}</td>
                      {propertyHeaders.map((h) => (
                        <td key={h} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                          {String(prop[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {propertiesData && propertiesData.total > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 dark:border-neutral-800/80">
                <span className="text-[11px] text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, propertiesData.total)} of{" "}
                  {propertiesData.total} units
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-[11px] font-semibold text-foreground px-2">
                    Page {page} of {propertiesData.totalPages || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(propertiesData.totalPages || 1, p + 1))}
                    disabled={page === (propertiesData.totalPages || 1)}
                    className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
