"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  User, Phone, Building2, Users, MessageSquare, Send,
  Upload, FileSpreadsheet, Download,
  Trash2, AlertCircle, CheckCircle, CheckCircle2, Wallet,
  UserCheck, Activity, Calendar, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { manualLeadsApi, LEAD_STATUS_OPTIONS } from "@/app/api/manualLeadsApi";
import { projectApi } from "@/app/api/api";
import { ProjectDropdown } from "../ProjectDropdown";
import { useManualLeadUploadStore } from "@/store/manualLeadUploadStore";
import { toast } from "sonner";

// ── Excel bulk import helpers ─────────────────────────────────────────────────

interface ParsedRow {
  customerName: string;
  phoneNumber: string;
  projectName: string;
  budget: string;
  referenceType: string;
  referralName: string;
  agentName: string;
  initialSummary: string;
  _error?: string;
}

const COL_MAP: Record<string, keyof ParsedRow> = {
  "customer name": "customerName", "customername": "customerName", "name": "customerName", "customer": "customerName",
  "phone number": "phoneNumber", "phonenumber": "phoneNumber", "phone": "phoneNumber", "mobile": "phoneNumber",
  "mobile number": "phoneNumber", "contact": "phoneNumber",
  "project name": "projectName", "projectname": "projectName", "project": "projectName", "interested project": "projectName",
  "budget": "budget", "customer budget": "budget",
  "reference type": "referenceType", "reference": "referenceType", "source": "referenceType",
  "referral name": "referralName", "referredby": "referralName", "referred by": "referralName",
  "agent name": "agentName", "agent": "agentName", "sales person": "agentName",
  "summary": "initialSummary", "notes": "initialSummary", "follow up": "initialSummary", "remarks": "initialSummary",
};

async function parseExcel(file: File): Promise<ParsedRow[]> {
  const { read, utils } = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: "", raw: false });
        if (raw.length === 0) { reject(new Error("Sheet is empty")); return; }

        const rows: ParsedRow[] = raw.map((row) => {
          const parsed: ParsedRow = {
            customerName: "", phoneNumber: "", projectName: "",
            budget: "", referenceType: "", referralName: "", agentName: "", initialSummary: "",
          };
          for (const [rawKey, rawVal] of Object.entries(row)) {
            const field = COL_MAP[rawKey.trim().toLowerCase()];
            if (field) (parsed as unknown as Record<string, string>)[field] = String(rawVal ?? "").trim();
          }
          const errors: string[] = [];
          if (!parsed.customerName) errors.push("Customer Name missing");
          if (!parsed.phoneNumber) errors.push("Phone missing");
          if (!parsed.projectName) errors.push("Project missing");
          return { ...parsed, _error: errors.length ? errors.join(", ") : undefined };
        });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function downloadTemplate() {
  const { utils, writeFile } = await import("xlsx");
  const ws = utils.aoa_to_sheet([
    ["Customer Name", "Phone Number", "Project Name", "Budget", "Reference Type", "Referral Name", "Agent Name", "Summary"],
    ["Rahul Sharma", "9876543210", "Sunset Residency", "50 Lakh", "referral", "Amit Kumar", "Vijit Singh", "Interested in 3BHK"],
    ["Priya Verma", "9123456780", "Green Valley Phase 2", "1 Crore", "walk_in", "", "Rohit Gupta", "Walk-in customer"],
  ]);
  ws["!cols"] = [16, 14, 22, 12, 16, 16, 14, 30].map((w) => ({ wch: w }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Manual Leads");
  writeFile(wb, "manual_leads_template.xlsx");
}

// ── Indian number formatter ───────────────────────────────────────────────────

function formatIndianNumber(digits: string): string {
  if (!digits) return "";
  const lastThree = digits.slice(-3);
  const remaining = digits.slice(0, -3);
  if (!remaining) return lastThree;
  return remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
}

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = {
  customerName: "",
  phoneNumber: "",
  projectId: "",
  budget: "",
  referenceType: "" as "" | "walk_in" | "referral",
  referralName: "",
  agentName: "",
  status: "interested",
  siteVisitDate: "",
  initialSummary: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AddManualLeadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectFieldRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusTouched, setStatusTouched] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const { isUploading, progress, fileName: uploadingFileName, uploadRows } = useManualLeadUploadStore();

  const { data: projects = [] } = useQuery<{ id: string; projectName: string }[]>({
    queryKey: ["projects"],
    queryFn: projectApi.getProjects,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/,/g, "");
    if (/^\d*$/.test(digits)) {
      setForm((prev) => ({ ...prev, budget: formatIndianNumber(digits) }));
    } else {
      setForm((prev) => ({ ...prev, budget: raw }));
    }
  };

  // ── Single lead mutation ───────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () =>
      manualLeadsApi.create({
        customerName: form.customerName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        projectId: form.projectId,
        budget: form.budget.trim() || undefined,
        referenceType: form.referenceType || undefined,
        referralName: form.referenceType === "referral" ? form.referralName.trim() || undefined : undefined,
        agentName: form.agentName.trim() || undefined,
        status: form.status,
        siteVisitDate: form.siteVisitDate || undefined,
        initialSummary: form.initialSummary.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Lead added successfully!");
      setForm(emptyForm);
      setStatusTouched(false);
      router.push("/real-estate/lead-management");
    },
    onError: (err: any) => {
      const rawMessage = err?.response?.data?.message || err?.message || "Failed to add lead";
      const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : rawMessage;
      if (typeof message === "string" && message.toLowerCase().includes("projectid")) {
        setProjectError(true);
        projectFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        toast.error("Please select a valid project");
        return;
      }
      toast.error(message);
    },
  });

  // ── Bulk upload ──────────────────────────────────────────────────────────
  // Handed off to a global store (not useMutation) so the upload, its progress
  // bar, and its completion toast survive navigating away from this page.

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => !r._error).map((r) => ({
      customerName: r.customerName,
      phoneNumber: r.phoneNumber,
      projectName: r.projectName,
      budget: r.budget || undefined,
      referenceType: r.referenceType || undefined,
      referralName: r.referralName || undefined,
      agentName: r.agentName || undefined,
      status: "interested" as string,
      initialSummary: r.initialSummary || undefined,
    }));
    uploadRows(validRows, uploadFileName);
    setParsedRows([]);
    setUploadFileName("");
    setIsBulkModalOpen(false);
  };

  const handleSubmit = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { toast.error("Customer name is required"); return; }
    if (!form.phoneNumber.trim()) { toast.error("Phone number is required"); return; }
    if (!form.projectId || !projects.some((p) => p.id === form.projectId)) {
      setProjectError(true);
      projectFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a project from the list");
      return;
    }
    if (form.referenceType === "referral" && !form.referralName.trim()) {
      toast.error("Please enter the referral person's name"); return;
    }
    createMutation.mutate();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel (.xlsx/.xls) or CSV file"); return;
    }
    setIsParsing(true); setUploadFileName(file.name);
    try {
      const rows = await parseExcel(file);
      setParsedRows(rows);
      const errCount = rows.filter((r) => r._error).length;
      if (errCount > 0) {
        toast.warning(`${rows.length} rows parsed · ${errCount} will be skipped (missing required fields)`);
      } else {
        toast.success(`${rows.length} rows ready to import`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to parse file"); setUploadFileName("");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validCount = parsedRows.filter((r) => !r._error).length;
  const errorCount = parsedRows.filter((r) => r._error).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Add Manual Lead</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a single lead below, or bulk-import multiple leads from an Excel file.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(true)} className="gap-2">
          <FileSpreadsheet className="size-4" />
          Bulk Upload
        </Button>
      </div>

      {/* ── BULK UPLOAD MODAL ────────────────────────────────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-card shadow-xl animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-md text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3 flex-wrap pr-12">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Bulk Import via Excel</h2>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 text-xs">
                <Download className="size-3.5" />Download Template
              </Button>
            </div>
            <div className="px-6 py-6 flex flex-col gap-4">
              {isUploading && (
                <div className="border border-border rounded-lg p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{uploadingFileName}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Importing…</span>
                      <span className="font-semibold text-primary tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      You can navigate to other pages — the import will continue in the background and you&apos;ll get a notification when it&apos;s done.
                    </p>
                  </div>
                </div>
              )}

              {!isUploading && parsedRows.length === 0 && (
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {isParsing
                      ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      : <Upload className="size-5 text-primary" />}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{isParsing ? "Parsing file…" : "Click to upload Excel / CSV"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Supports .xlsx, .xls, .csv · Download the template for correct format</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                </div>
              )}

              {!isUploading && parsedRows.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{uploadFileName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">· {parsedRows.length} rows</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {validCount > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"><CheckCircle className="size-3.5" />{validCount} valid</span>}
                      {errorCount > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500"><AlertCircle className="size-3.5" />{errorCount} skipped</span>}
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setParsedRows([]); setUploadFileName(""); }} className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
                        <Trash2 className="size-3" />Remove
                      </Button>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b border-border">
                          <tr>
                            {["#", "Customer", "Phone", "Project", "Budget", "Reference", "Agent", "Status"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, i) => (
                            <tr key={i} className={`border-b border-border last:border-0 ${row._error ? "bg-red-500/5" : "hover:bg-muted/30"}`}>
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{row.customerName || <span className="text-red-400">—</span>}</td>
                              <td className="px-3 py-2 text-foreground whitespace-nowrap">{row.phoneNumber || <span className="text-red-400">—</span>}</td>
                              <td className="px-3 py-2 text-foreground whitespace-nowrap max-w-32 truncate">{row.projectName || <span className="text-red-400">—</span>}</td>
                              <td className="px-3 py-2 text-foreground">{row.budget || "—"}</td>
                              <td className="px-3 py-2 text-foreground">{row.referenceType || "—"}</td>
                              <td className="px-3 py-2 text-foreground">{row.agentName || "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {row._error
                                  ? <span className="inline-flex items-center gap-1 text-red-500"><AlertCircle className="size-3" />{row._error}</span>
                                  : <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="size-3" />Ready</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {errorCount > 0 ? `${errorCount} row(s) with missing required fields will be skipped.` : "All rows are valid and ready to import."}
                    </p>
                    <Button type="button" onClick={handleImport} disabled={validCount === 0} className="gap-2">
                      <Upload className="size-4" />
                      Import {validCount} Lead{validCount !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DIVIDER ────────────────────────────────────────────────────
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">or add single lead</span>
        <div className="flex-1 h-px bg-border" />
      </div> */}

      {/* ── SINGLE LEAD FORM ─────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">

          {/* Customer Info */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Customer Information</h2>
            </div>
            <div className="px-5 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Customer Name */}
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="flex items-center gap-2">
                    <User className="size-3.5 text-muted-foreground" />
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="customerName" name="customerName" value={form.customerName} onChange={handleChange} placeholder="e.g. Rahul Sharma" required />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" />
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input id="phoneNumber" name="phoneNumber" type="tel" value={form.phoneNumber}
                    onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") }))}
                    placeholder="e.g. 9876543210" maxLength={15} required />
                </div>

                {/* Project Dropdown */}
                <div className="space-y-2 md:col-span-2" ref={projectFieldRef}>
                  <Label className="flex items-center gap-2">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    Interested Project <span className="text-destructive">*</span>
                  </Label>
                  <div className={projectError ? "rounded-md ring-2 ring-destructive" : undefined}>
                    <ProjectDropdown
                      value={form.projectId}
                      onChange={(v) => { setForm((p) => ({ ...p, projectId: v })); setProjectError(false); }}
                      projects={projects}
                    />
                  </div>
                  {projectError && (
                    <p className="text-xs text-destructive">Please select a project from the dropdown above.</p>
                  )}
                </div>

                {/* Budget */}
                <div className="space-y-2">
                  <Label htmlFor="budget" className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-muted-foreground" />
                    Budget
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input id="budget" name="budget" value={form.budget} onChange={handleBudgetChange}
                      placeholder="e.g. 50 Lakh, 1.5 Crore" className="pl-6" />
                  </div>
                </div>

                {/* Agent Name */}
                <div className="space-y-2">
                  <Label htmlFor="agentName" className="flex items-center gap-2">
                    <UserCheck className="size-3.5 text-muted-foreground" />
                    Agent Name
                  </Label>
                  <Input id="agentName" name="agentName" value={form.agentName} onChange={handleChange}
                    placeholder="Name of the person filling this form" />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Activity className="size-3.5 text-muted-foreground" />
                    Status
                  </Label>
                  <select
                    value={form.status}
                    onChange={(e) => { setForm((p) => ({ ...p, status: e.target.value, siteVisitDate: "" })); setStatusTouched(true); }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                  >
                    {LEAD_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {statusTouched && (
                    <div className="mt-2 space-y-1.5">
                      <Label htmlFor="siteVisitDate" className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="size-3.5" />
                        {LEAD_STATUS_OPTIONS.find((o) => o.value === form.status)?.label ?? "Status"} Date
                      </Label>
                      <Input
                        id="siteVisitDate"
                        name="siteVisitDate"
                        type="date"
                        value={form.siteVisitDate}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                </div>

                {/* Reference Type */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="size-3.5 text-muted-foreground" />
                    Reference / Source
                  </Label>
                  <div className="flex gap-3 flex-wrap">
                    {(["walk_in", "referral"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, referenceType: type, referralName: "" }))}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.referenceType === type
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {type === "walk_in" ? "Walk-in" : "Referral"}
                      </button>
                    ))}
                  </div>
                  {form.referenceType === "referral" && (
                    <div className="mt-2 space-y-1.5">
                      <Label htmlFor="referralName" className="text-xs text-muted-foreground">
                        Referred by (Name) <span className="text-destructive">*</span>
                      </Label>
                      <Input id="referralName" name="referralName" value={form.referralName} onChange={handleChange}
                        placeholder="Name of the person who referred this customer" required />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Conversation Summary */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Conversation Summary</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Write all conversations with this customer. Saved with current date & time.</p>
            </div>
            <div className="px-5 py-6">
              <div className="space-y-2">
                <Label htmlFor="initialSummary" className="flex items-center gap-2">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  Summary
                </Label>
                <textarea
                  id="initialSummary" name="initialSummary" value={form.initialSummary} onChange={handleChange} rows={5}
                  placeholder="Write a detailed summary of your conversation — customer's requirements, budget discussed, objections, next steps, etc."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p className="text-xs text-muted-foreground">This summary will be saved with the current date &amp; time as the first conversation record.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-2">
            <Button type="button" variant="outline" onClick={() => router.push("/real-estate/lead-management")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              <Send className="size-4" />
              {createMutation.isPending ? "Saving..." : "Save Lead"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
