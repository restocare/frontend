"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ChevronLeft, ChevronRight, Pencil, Check, Bot } from "lucide-react";
import apiClient from "@/app/api/apiClient";

export interface FormSchemaItem {
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

export interface FormConfig {
    id: string;
    title: string;
    description: string;
    fieldsCount: number;
    status: "active" | "paused" | "draft";
    createdAt: string;
    schema: FormSchemaItem[];
    aiMode?: boolean;
}

export interface CallRecord {
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
export type ResponseValue = string | number | boolean | string[] | null;

export interface Submission {
    id?: string;
    submittedAt?: string;
    createdAt?: string;
    responses: Record<string, ResponseValue>;
    callSummary?: string | null;
    callMade?: boolean;
    calls?: CallRecord[];
}

interface ResponseDetailSidebarProps {
    selectedRow: { submission: Submission; index: number };
    setSelectedRow: (row: { submission: Submission; index: number } | null) => void;
    form: FormConfig;
    filtered: Submission[];
}

/* ─── Helpers ─── */
function formatChatDate(dateStr?: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/* ─── Date-wise Summary ─── */
function SummaryDateWise({ summaryText, calls }: { summaryText: string; calls?: CallRecord[] }) {
    const segments = summaryText.split(/\s*---\s*/).map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) return null;

    // calls are newest-first from API; reverse to align with oldest summary first
    const orderedCalls = calls ? [...calls].reverse() : [];

    return (
        <div className="space-y-3">
            {segments.map((seg, idx) => {
                const call = orderedCalls[idx];
                const dateLabel = call?.createdAt ? formatChatDate(call.createdAt) : null;
                const timeLabel = call?.createdAt
                    ? new Date(call.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                    : null;

                return (
                    <div
                        key={idx}
                        className="rounded-lg border border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/60 dark:bg-neutral-900/40 p-3.5 space-y-1.5"
                    >
                        {(dateLabel || timeLabel) && (
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                                <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 px-1 whitespace-nowrap">
                                    {dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}
                                </span>
                                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                            </div>
                        )}
                        <p className="text-[12px] text-foreground leading-relaxed">{seg}</p>
                    </div>
                );
            })}
        </div>
    );
}

/* ─── WhatsApp-style transcription chat ─── */
type ChatRole = "agent" | "customer" | "divider";
interface ChatMessage { role: ChatRole; text: string; }

function TranscriptionChat({ text, calls }: { text: string; calls?: CallRecord[] }) {
    // Split transcription by "---" separators into conversation blocks
    const blocks = text.split(/\n?---+\n?/);

    // calls are newest-first; reverse to align oldest call with first block
    const orderedCalls = calls ? [...calls].reverse() : [];

    // Parse each block into chat messages
    const allSections: { date?: string; msgs: ChatMessage[] }[] = blocks.map((block, blockIdx) => {
        const msgs: ChatMessage[] = [];
        for (const raw of block.split("\n")) {
            const line = raw.trim();
            if (!line) continue;
            if (/^agent\s*:/i.test(line)) {
                msgs.push({ role: "agent", text: line.slice(line.indexOf(":") + 1).trim() });
            } else if (/^customer\s*:/i.test(line)) {
                msgs.push({ role: "customer", text: line.slice(line.indexOf(":") + 1).trim() });
            } else if (msgs.length > 0) {
                msgs[msgs.length - 1].text += " " + line;
            }
        }
        const call = orderedCalls[blockIdx];
        return {
            date: call?.createdAt,
            msgs,
        };
    });

    const hasAnyMsg = allSections.some(s => s.msgs.length > 0);
    if (!hasAnyMsg) {
        return <p className="text-xs text-neutral-400 italic mt-2 whitespace-pre-wrap">{text}</p>;
    }

    return (
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700/60">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700/60">
                <div className="size-7 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                    <Bot className="size-3.5 text-neutral-500 dark:text-neutral-400" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold text-foreground leading-none">Call Transcript</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-none">AI Voice Agent</p>
                </div>
            </div>

            {/* Chat area */}
            <div className="bg-neutral-50 dark:bg-neutral-900/60 px-3 pt-2 pb-3 space-y-1 max-h-72 overflow-y-auto">
                {allSections.map((section, sIdx) => (
                    <div key={sIdx}>
                        {/* Date pill between conversations */}
                        {sIdx > 0 || section.date ? (
                            <div className="flex justify-center my-3">
                                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-200/70 dark:bg-neutral-800 px-3 py-1 rounded-full border border-neutral-200 dark:border-neutral-700/60">
                                    {section.date ? formatChatDate(section.date) : `Call ${sIdx + 1}`}
                                </span>
                            </div>
                        ) : null}

                        {section.msgs.map((msg, i) => {
                            const isAgent = msg.role === "agent";
                            const prev = i > 0 ? section.msgs[i - 1] : null;
                            const isFirstInGroup = !prev || prev.role !== msg.role;
                            const next = i < section.msgs.length - 1 ? section.msgs[i + 1] : null;
                            const isLastInGroup = !next || next.role !== msg.role;

                            return (
                                <div
                                    key={i}
                                    className={`flex flex-col ${isAgent ? "items-start" : "items-end"} ${isFirstInGroup ? "mt-2" : "mt-0.5"}`}
                                >
                                    {isFirstInGroup && (
                                        <span className="text-[10px] font-semibold mb-1 px-1 text-neutral-400 dark:text-neutral-500">
                                            {isAgent ? "Agent" : "Customer"}
                                        </span>
                                    )}
                                    <div className={`max-w-[82%] px-3 py-2 text-[12px] leading-relaxed shadow-sm ${
                                        isAgent
                                            ? `bg-white dark:bg-neutral-800 text-foreground border border-neutral-200 dark:border-neutral-700/60 ${
                                                isFirstInGroup
                                                    ? "rounded-tr-2xl rounded-br-2xl rounded-bl-2xl rounded-tl-sm"
                                                    : "rounded-2xl"
                                            }`
                                            : `bg-neutral-200 dark:bg-neutral-700 text-foreground ${
                                                isLastInGroup
                                                    ? "rounded-tl-2xl rounded-bl-2xl rounded-tr-2xl rounded-br-sm"
                                                    : "rounded-2xl"
                                            }`
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Main sidebar ─── */
export default function ResponseDetailSidebar({
    selectedRow,
    setSelectedRow,
    form,
    filtered,
}: ResponseDetailSidebarProps) {
    const [editingCall, setEditingCall] = useState(false);
    const [callForm, setCallForm] = useState({
        status: "",
        leadClass: "",
        score: "",
        summary: "",
        nextDate: "",
        transcription: "",
    });

    const queryClient = useQueryClient();

    const saveCallMutation = useMutation({
        mutationFn: async (submissionId: string) => {
            const latestCall = selectedRow.submission.calls?.[0];
            const payload = {
                ...callForm,
                score: callForm.score ? Number(callForm.score) : null,
            };
            if (latestCall?.id) {
                const res = await apiClient.patch(`/api/calls/${latestCall.id}`, payload);
                return res.data;
            } else {
                const res = await apiClient.post(
                    `/api/meta-forms/submissions/${submissionId}/call`,
                    payload
                );
                return res.data;
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["form-submissions", form.id] });
            setEditingCall(false);
            if (data) {
                const existingCalls = selectedRow.submission.calls || [];
                const latestCall = existingCalls[0];
                const updatedCalls = latestCall?.id
                    ? existingCalls.map(c => (c.id === latestCall.id ? data : c))
                    : [data, ...existingCalls];
                setSelectedRow({
                    ...selectedRow,
                    submission: { ...selectedRow.submission, calls: updatedCalls },
                });
            }
        },
    });

    const latestCall = selectedRow.submission.calls?.[0];

    const statusColors: Record<string, string> = {
        interested: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        followup: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        site_visit: "text-violet-500 bg-violet-500/10 border-violet-500/20",
        deal_closed: "text-green-600 bg-green-600/10 border-green-600/20",
        not_interested: "text-rose-500 bg-rose-500/10 border-rose-500/20",
        lost: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20",
    };
    const leadClassColors: Record<string, string> = {
        hot: "text-orange-500 bg-orange-500/10 border-orange-500/20",
        warm: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
        cold: "text-sky-500 bg-sky-500/10 border-sky-500/20",
        low_priority: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20",
    };

    const inputCls =
        "w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-400";
    const labelCls =
        "block text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1";

    return (
        <>
            {/* Backdrop — z-40, strong blur */}
            <div
                className="fixed inset-0 h-full bg-black/25 backdrop-blur-md"
                onClick={() => setSelectedRow(null)}
            />

            {/* Sidebar panel — z-50, isolated from blur */}
            <div className="fixed right-0 top-0 bottom-0 z-50 isolate w-full max-w-md bg-card border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 shrink-0">
                    <div>
                        <h3 className="font-semibold text-sm text-foreground">
                            Response #{selectedRow.index + 1}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(
                                selectedRow.submission.createdAt ||
                                selectedRow.submission.submittedAt ||
                                ""
                            ).toLocaleString()}
                        </p>
                    </div>
                    <button
                        onClick={() => setSelectedRow(null)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {/* Form fields */}
                    {form.schema.map(field => {
                        const val =
                            selectedRow.submission.responses[field.Label] !== undefined
                                ? selectedRow.submission.responses[field.Label]
                                : field.Label
                                    ? selectedRow.submission.responses[field.Label.toLowerCase().trim()]
                                    : undefined;
                        const display = Array.isArray(val) ? val.join(", ") : (val ?? "");
                        return (
                            <div
                                key={field.Id}
                                className="rounded-lg border border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/60 dark:bg-neutral-900/40 p-3.5"
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider leading-none">
                                        {field.Label}
                                    </span>
                                    {field.Required && (
                                        <span className="text-[9px] text-rose-400 font-medium">required</span>
                                    )}
                                </div>
                                <p className="text-sm text-foreground leading-relaxed wrap-break-word">
                                    {String(display) === "" ? (
                                        <span className="text-neutral-300 dark:text-neutral-700 text-xs italic">
                                            No response
                                        </span>
                                    ) : (
                                        String(display)
                                    )}
                                </p>
                            </div>
                        );
                    })}

                    {/* AI Call Result */}
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                AI Call Result
                            </span>
                            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                        </div>

                        {/* Edit form */}
                        {editingCall ? (
                            <div className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
                                <div>
                                    <label className={labelCls}>Status</label>
                                    <select
                                        className={inputCls}
                                        value={callForm.status}
                                        onChange={e => setCallForm(f => ({ ...f, status: e.target.value }))}
                                    >
                                        <option value="">— select —</option>
                                        <option value="interested">Interested</option>
                                        <option value="followup">Follow-up</option>
                                        <option value="site_visit">Site Visit</option>
                                        <option value="deal_closed">Deal Closed</option>
                                        <option value="not_interested">Not Interested</option>
                                        <option value="lost">Lost</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Lead Class</label>
                                    <select
                                        className={inputCls}
                                        value={callForm.leadClass}
                                        onChange={e => setCallForm(f => ({ ...f, leadClass: e.target.value }))}
                                    >
                                        <option value="">— select —</option>
                                        <option value="hot">Hot</option>
                                        <option value="warm">Warm</option>
                                        <option value="cold">Cold</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Score (1–10)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        className={inputCls}
                                        placeholder="e.g. 7"
                                        value={callForm.score}
                                        onChange={e => setCallForm(f => ({ ...f, score: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Summary</label>
                                    <textarea
                                        rows={3}
                                        className={inputCls}
                                        placeholder="Brief summary of the conversation"
                                        value={callForm.summary}
                                        onChange={e => setCallForm(f => ({ ...f, summary: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Next Follow-up Date</label>
                                    <input
                                        type="datetime-local"
                                        className={inputCls}
                                        value={callForm.nextDate}
                                        onChange={e => setCallForm(f => ({ ...f, nextDate: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Transcription</label>
                                    <textarea
                                        rows={5}
                                        className={inputCls}
                                        placeholder={"Agent: ...\nCustomer: ..."}
                                        value={callForm.transcription}
                                        onChange={e => setCallForm(f => ({ ...f, transcription: e.target.value }))}
                                    />
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => {
                                            if (selectedRow.submission.id) {
                                                saveCallMutation.mutate(selectedRow.submission.id);
                                            }
                                        }}
                                        disabled={saveCallMutation.isPending}
                                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        <Check className="size-3.5" />
                                        {saveCallMutation.isPending ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                        onClick={() => setEditingCall(false)}
                                        disabled={saveCallMutation.isPending}
                                        className="flex-1 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* View mode */
                            <>
                                {!latestCall && !selectedRow.submission.callSummary ? (
                                    <div
                                        className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                                        onClick={() => {
                                            setCallForm({
                                                status: "",
                                                leadClass: "",
                                                score: "",
                                                summary: "",
                                                nextDate: "",
                                                transcription: "",
                                            });
                                            setEditingCall(true);
                                        }}
                                    >
                                        <Pencil className="size-4 text-neutral-400" />
                                        <p className="text-xs text-neutral-400">
                                            No call data — click to add manually
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Edit button */}
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => {
                                                    setCallForm({
                                                        status: latestCall?.status ?? "",
                                                        leadClass: latestCall?.leadClass ?? "",
                                                        score:
                                                            latestCall?.score != null
                                                                ? String(latestCall.score)
                                                                : "",
                                                        summary:
                                                            latestCall?.summary ??
                                                            selectedRow.submission.callSummary ??
                                                            "",
                                                        nextDate: latestCall?.nextDate
                                                            ? new Date(latestCall.nextDate)
                                                                .toISOString()
                                                                .slice(0, 16)
                                                            : "",
                                                        transcription: latestCall?.transcription ?? "",
                                                    });
                                                    setEditingCall(true);
                                                }}
                                                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-foreground transition-colors"
                                            >
                                                <Pencil className="size-3" /> Edit
                                            </button>
                                        </div>

                                        {/* Status + Lead Class + Score */}
                                        {latestCall && (
                                            <div className="flex flex-wrap gap-2">
                                                {latestCall.status && (
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold capitalize ${statusColors[latestCall.status] ??
                                                            "text-neutral-500 bg-neutral-100 border-neutral-200"
                                                            }`}
                                                    >
                                                        {latestCall.status.replace(/_/g, " ")}
                                                    </span>
                                                )}
                                                {latestCall.leadClass && (
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold capitalize ${leadClassColors[latestCall.leadClass] ??
                                                            "text-neutral-500 bg-neutral-100 border-neutral-200"
                                                            }`}
                                                    >
                                                        {latestCall.leadClass.replace(/_/g, " ")}
                                                    </span>
                                                )}
                                                {latestCall.score != null && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 text-[11px] font-semibold">
                                                        Score: {latestCall.score}/10
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Summary — date-wise */}
                                        {(latestCall?.summary || selectedRow.submission.callSummary) && (
                                            <div className="space-y-1">
                                                <span className={labelCls}>Summary</span>
                                                <SummaryDateWise
                                                    summaryText={
                                                        latestCall?.summary ||
                                                        selectedRow.submission.callSummary ||
                                                        ""
                                                    }
                                                    calls={selectedRow.submission.calls}
                                                />
                                            </div>
                                        )}

                                        {/* Next Follow-up */}
                                        {latestCall?.nextDate && (
                                            <div className="rounded-lg border border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/60 dark:bg-neutral-900/40 p-3.5">
                                                <span className={labelCls}>Next Follow-up</span>
                                                <p className="text-sm text-foreground mt-1.5">
                                                    {new Date(latestCall.nextDate).toLocaleString()}
                                                </p>
                                            </div>
                                        )}

                                        {/* Transcription — WhatsApp chat with date separators */}
                                        {latestCall?.transcription && (
                                            <div>
                                                <span className={labelCls}>Transcription</span>
                                                <TranscriptionChat
                                                    text={latestCall.transcription}
                                                    calls={selectedRow.submission.calls}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer — Prev / Next */}
                <div className="px-5 py-4 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const prev = filtered[selectedRow.index - 1];
                                if (prev) setSelectedRow({ submission: prev, index: selectedRow.index - 1 });
                            }}
                            disabled={selectedRow.index === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="size-3.5" />
                            Previous
                        </button>
                        <span className="text-[11px] text-neutral-400 tabular-nums">
                            {selectedRow.index + 1} / {filtered.length}
                        </span>
                        <button
                            onClick={() => {
                                const next = filtered[selectedRow.index + 1];
                                if (next) setSelectedRow({ submission: next, index: selectedRow.index + 1 });
                            }}
                            disabled={selectedRow.index === filtered.length - 1}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
