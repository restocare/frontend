"use client";
import { useState, useEffect, Suspense, use } from "react";
import { useTheme } from "@/src/lib/theme";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckIcon, SunIcon, MoonIcon, FileText, Loader2 } from "lucide-react";
import publicApiClient from "@/app/api/publicApiClient";

type BlockType = "text" | "name" | "checkbox" | "radio" | "select" | "budget" | "phone" | "project";

interface Option { id: number; value: string; }

/** What a field holds while the visitor fills the form: text, a budget number, a checkbox group, or cleared. */
type FormValue = string | number | string[] | null;

const stringValue = (v: FormValue | undefined) => (typeof v === "string" ? v : "");

/** One field of a form's stored schema, as built by the form designer. */
interface FormSchemaItem {
    Id?: string | number;
    Type?: string;
    Label?: string;
    Placeholder?: string;
    Required?: boolean;
    Options?: string[];
    "Slider Settings"?: { Min?: number | string; Max?: number | string; Step?: number | string; Prefix?: string };
    "Form ID"?: string;
}

interface MetaForm {
    id: string;
    title: string;
    description: string;
    schema: string | FormSchemaItem[];
}
interface Block {
    id: number; type: BlockType; label: string; placeholder: string;
    options: Option[]; created: boolean; required: boolean;
}

const WAVES = [
    "M-100,80  C200,58  500,102 800,80  C1100,58  1300,102 1540,80",
    "M-100,180 C200,202 500,158 800,180 C1100,202 1300,158 1540,180",
    "M-100,280 C200,258 500,302 800,280 C1100,258 1300,302 1540,280",
    "M-100,380 C200,402 500,358 800,380 C1100,402 1300,358 1540,380",
    "M-100,480 C200,458 500,502 800,480 C1100,458 1300,502 1540,480",
    "M-100,580 C200,602 500,558 800,580 C1100,602 1300,558 1540,580",
    "M-100,680 C200,658 500,702 800,680 C1100,658 1300,702 1540,680",
    "M-100,780 C200,802 500,758 800,780 C1100,802 1300,758 1540,780",
    "M-100,880 C200,858 500,902 800,880 C1100,858 1300,902 1540,880",
];

function WaveBackground({ isDark }: { isDark: boolean }) {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0" style={{ background: isDark ? "#000000" : "#f2f2f7" }} />
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 1440 960"
                preserveAspectRatio="xMidYMid slice"
            >
                {WAVES.map((d, i) => (
                    <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)"}
                        strokeWidth="1.2"
                        style={{
                            animation: `${i % 2 === 0 ? "wave-rise" : "wave-fall"} ${9 + i * 0.9}s ease-in-out infinite`,
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

function BudgetSlider({ min, max, step, prefix, onChange, isDark }: {
    min: number; max: number; step: number; prefix: string;
    onChange?: (val: number) => void; isDark: boolean;
}) {
    const [value, setValue] = useState<number>(min);

    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    return (
        <div className="space-y-2 w-full">
            <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">Amount</span>
                <span className="text-[13px] font-semibold tabular-nums">{prefix}{value.toLocaleString("en-IN")}</span>
            </div>
            <div className="relative py-3">
                <div className="w-full h-[2px] rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>
                    <div className="h-full rounded-full transition-all duration-75"
                        style={{ width: `${pct}%`, background: isDark ? "#ffffff" : "#000000" }} />
                </div>
                {/* Thumb pointer */}
                <div
                    className="absolute pointer-events-none transition-all duration-75"
                    style={{
                        left: `${pct}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: isDark ? "#ffffff" : "#000000",
                        boxShadow: isDark
                            ? "0 0 0 3px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.6)"
                            : "0 0 0 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.25)",
                    }}
                />
                <input type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => { const v = Number(e.target.value); setValue(v); if (onChange) onChange(v); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
            <div className="flex justify-between text-[11px] tabular-nums" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
                <span>{prefix}{min.toLocaleString("en-IN")}</span>
                <span>{prefix}{max.toLocaleString("en-IN")}</span>
            </div>
        </div>
    );
}

function FormPreview({ slug }: { slug: string }) {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const { theme: resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [formData, setFormData] = useState<Record<number, FormValue>>({});
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [formId, setFormId] = useState(slug);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    useEffect(() => {
        blocks.forEach(b => {
            if (b.type === "project" && b.options.length === 1) {
                setFormData(prev => (prev[b.id] !== undefined ? prev : { ...prev, [b.id]: b.options[0].value }));
            }
        });
    }, [blocks]);

    useEffect(() => {
        if (!slug) return;

        const applyForm = (form: MetaForm) => {
            setTitle(form.title);
            setDescription(form.description);
            const schema: FormSchemaItem[] = typeof form.schema === "string"
                ? (JSON.parse(form.schema) as FormSchemaItem[])
                : Array.isArray(form.schema)
                    ? form.schema
                    : [];
            setBlocks(schema.map((item, idx) => {
                const baseId = Number(item.Id) || Date.now() + idx;
                let options: Option[] = [];
                if (item.Type === "budget" && item["Slider Settings"]) {
                    const s = item["Slider Settings"];
                    options = [
                        { id: baseId + 1, value: String(s.Min) },
                        { id: baseId + 2, value: String(s.Max) },
                        { id: baseId + 3, value: String(s.Step) },
                        { id: baseId + 4, value: s.Prefix ?? "" },
                    ];
                } else if (item.Options) {
                    options = item.Options.map((opt: string, oIdx: number) => ({ id: baseId + 1 + oIdx, value: opt }));
                } else {
                    options = [{ id: baseId + 1, value: "" }];
                }
                return { id: baseId, type: item.Type as BlockType, label: item.Label ?? "", placeholder: item.Placeholder || "", options, created: true, required: item.Required ?? false };
            }));
        };

        const fetchForm = async () => {
            setLoading(true);
            setNotFound(false);
            try {
                // Primary: fetch by slug/id directly
                const res = await publicApiClient.get(`/api/meta-forms/${slug}`);

                if (res.status === 200) {
                    const form = res.data;
                    setFormId(form.id);
                    applyForm(form);
                    return;
                }
            } catch (error) {
                // Fallback: fetch all forms and find matching by id or slug
                try {
                    const listRes = await publicApiClient.get(`/api/meta-forms`);
                    if (listRes.status === 200) {
                        const allForms = listRes.data as MetaForm[];
                        const matched = allForms.find((f) => f.id === slug || (Array.isArray(f.schema) && f.schema[0]?.["Form ID"] === slug));
                        if (matched) {
                            setFormId(matched.id);
                            applyForm(matched);
                            return;
                        }
                    }
                } catch (fallbackError) {
                    console.error("Failed to load form in fallback:", fallbackError);
                }
                console.error("Failed to load form:", error);
                setNotFound(true);
                toast.error("Failed to load form.");
            } finally {
                setLoading(false);
            }
        };

        void fetchForm();
    }, [slug]);

    const handleSubmit = async () => {
        const missing = blocks.filter(b => {
            if (!b.required) return false;
            const v = formData[b.id];
            return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        }).map(b => b.label || "Untitled");
        if (missing.length) { toast.error(`Required: ${missing.join(", ")}`); return; }

        const responses: Record<string, FormValue> = {};
        blocks.forEach(b => {
            const key = (b.label || `Field ${b.id}`).toLowerCase().trim();
            responses[key] = formData[b.id] ?? "";
        });

        setIsSubmitting(true);
        try {
            await publicApiClient.post(`/api/meta-forms/${formId}/submit`, {
                submittedAt: new Date().toISOString(),
                responses
            });
            setSubmitted(true);
            toast.success("Submitted!");
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while submitting.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isDark = mounted && resolvedTheme === "dark";

    const cardBg = isDark ? "#1c1c1e" : "#ffffff";
    const divider = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    const inputBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)";
    const rowBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)";
    const rowSelBg = isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.07)";
    const checkFill = isDark ? "#ffffff" : "#000000";
    const checkText = isDark ? "#000000" : "#ffffff";
    const btnBg = isDark ? "#ffffff" : "#000000";
    const btnText = isDark ? "#000000" : "#ffffff";


    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center px-4">
                <WaveBackground isDark={isDark} />
                <div className="relative z-10 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }} />
                    </div>
                    <p className="text-[13px] text-muted-foreground">Loading form…</p>
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-dvh flex items-center justify-center px-4">
                <WaveBackground isDark={isDark} />
                <div className="relative z-10 text-center space-y-3 max-w-xs">
                    <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                        <FileText className="w-5 h-5" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }} />
                    </div>
                    <div>
                        <p className="text-[15px] font-semibold">Form not found</p>
                        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                            This form does not exist or has been removed.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-dvh flex items-center justify-center px-4">
                <WaveBackground isDark={isDark} />
                <div className="relative z-10 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                        <CheckIcon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[15px] font-semibold">Submitted</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">Your response was recorded.</p>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-dvh flex items-center justify-center px-4 py-10">
            <WaveBackground isDark={isDark} />

            {/* Theme toggle */}
            <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="fixed top-4 right-4 z-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                style={{
                    background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                }}
            >
                {mounted && isDark ? <SunIcon className="w-3.5 h-3.5" /> : <MoonIcon className="w-3.5 h-3.5" />}
            </button>

            <div className="relative z-10 w-full max-w-[420px]">
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: cardBg,
                        boxShadow: isDark
                            ? "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.7)"
                            : "0 0 0 1px rgba(0,0,0,0.07), 0 20px 60px rgba(0,0,0,0.1)",
                    }}
                >
                    {/* ── Header ── */}
                    <div className="px-5 pt-5 pb-4">
                        <div className="flex items-start gap-3">
                            <div
                                className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}
                            >
                                <FileText className="w-[17px] h-[17px]" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5"
                                    style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
                                    TSK&nbsp;·&nbsp;Form
                                </p>
                                <h1 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">
                                    {title || "Untitled Form"}
                                </h1>
                                {description && (
                                    <p className="mt-1 text-[13px] leading-relaxed"
                                        style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {blocks.length > 0 && (() => {
                            const visibleBlocks = blocks.filter(b => !(b.type === "project" && b.options.length === 1));
                            return (
                                <p className="mt-3 text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.3)" }}>
                                    {visibleBlocks.length} {visibleBlocks.length === 1 ? "field" : "fields"}
                                    {visibleBlocks.filter(b => b.required).length > 0 && ` · ${visibleBlocks.filter(b => b.required).length} required`}
                                </p>
                            );
                        })()}
                    </div>

                    <div className="h-px mx-5" style={{ background: divider }} />

                    {/* ── Fields ── */}
                    <div className="px-5 py-4 space-y-4">
                        {blocks.length === 0 ? (
                            <p className="text-[13px] text-center py-6 text-muted-foreground">No fields configured.</p>
                        ) : (
                            blocks.filter(b => !(b.type === "project" && b.options.length === 1)).map((block) => (
                                <div key={block.id} className="space-y-1.5">
                                    {/* Label */}
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-[12px] font-medium leading-none"
                                            style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.7)" }}>
                                            {block.label || "Untitled Field"}
                                        </span>
                                        {block.required && (
                                            <span className="text-red-500 text-[12px] leading-none ml-0.5">*</span>
                                        )}
                                    </div>

                                    {(block.type === "text" || block.type === "name") && (
                                        <input
                                            placeholder={block.placeholder || (block.type === "name" ? "Enter your name" : "")}
                                            value={formData[block.id] || ""}
                                            onChange={(e) => setFormData(prev => ({ ...prev, [block.id]: e.target.value }))}
                                            className="w-full h-10 px-3 rounded-xl text-[13px] outline-none transition-all"
                                            style={{
                                                background: inputBg,
                                                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                                caretColor: isDark ? "#ffffff" : "#000000",
                                            }}
                                            onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}`}
                                            onBlur={e => e.currentTarget.style.boxShadow = "none"}
                                        />
                                    )}

                                    {block.type === "phone" && (
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={10}
                                            placeholder={block.placeholder || "Enter phone number"}
                                            value={formData[block.id] || ""}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                setFormData(prev => ({ ...prev, [block.id]: digits }));
                                            }}
                                            className="w-full h-10 px-3 rounded-xl text-[13px] outline-none transition-all"
                                            style={{
                                                background: inputBg,
                                                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                                caretColor: isDark ? "#ffffff" : "#000000",
                                            }}
                                            onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"}`}
                                            onBlur={e => e.currentTarget.style.boxShadow = "none"}
                                            onKeyDown={(e) => {
                                                const input = e.currentTarget;
                                                if (!/[0-9]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                                if (/[0-9]/.test(e.key) && input.value.replace(/\D/g, "").length >= 10) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onPaste={(e) => {
                                                e.preventDefault();
                                                const input = e.currentTarget;
                                                const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                                                const start = input.selectionStart ?? input.value.length;
                                                const end = input.selectionEnd ?? input.value.length;
                                                const next = (input.value.slice(0, start) + pasted + input.value.slice(end)).replace(/\D/g, "").slice(0, 10);
                                                setFormData(prev => ({ ...prev, [block.id]: next }));
                                            }}
                                        />
                                    )}

                                    {block.type === "select" && (
                                        <Select
                                            value={stringValue(formData[block.id])}
                                            onValueChange={(val) => setFormData(prev => ({ ...prev, [block.id]: val }))}
                                        >
                                            <SelectTrigger
                                                className="h-10 w-full rounded-xl text-[13px] border-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0"
                                                style={{
                                                    background: inputBg,
                                                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                                    boxShadow: "none",
                                                }}
                                            >
                                                <SelectValue placeholder="Select…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {block.options.map((opt) => (
                                                    <SelectItem key={opt.id} value={opt.value || `opt-${opt.id}`} className="text-[13px]">
                                                        {opt.value || "Option"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {block.type === "checkbox" && (
                                        <div className="flex flex-col gap-1.5">
                                            {block.options.map((opt) => {
                                                const selected = formData[block.id];
                                                const checked = Array.isArray(selected) && selected.includes(opt.value);
                                                return (
                                                    <label key={opt.id} htmlFor={`cb-${opt.id}`}
                                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors"
                                                        style={{ background: checked ? rowSelBg : rowBg }}>
                                                        <div className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                                                            style={{ background: checked ? checkFill : "transparent", border: checked ? "none" : `1.5px solid ${isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)"}` }}>
                                                            {checked && <CheckIcon className="w-3 h-3" strokeWidth={3} style={{ color: checkText }} />}
                                                        </div>
                                                        <input type="checkbox" id={`cb-${opt.id}`} className="sr-only" checked={checked}
                                                            onChange={(e) => setFormData(prev => {
                                                                const existing = prev[block.id];
                                                                const cur = Array.isArray(existing) ? existing : [];
                                                                return { ...prev, [block.id]: e.target.checked ? [...cur, opt.value] : cur.filter((v) => v !== opt.value) };
                                                            })} />
                                                        <span className="text-[13px]">{opt.value || "Option"}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {block.type === "radio" && (
                                        <div className="flex flex-col gap-1.5">
                                            {block.options.map((opt) => {
                                                const selected = formData[block.id] === opt.value;
                                                return (
                                                    <label key={opt.id} htmlFor={`radio-${opt.id}`}
                                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors"
                                                        style={{ background: selected ? rowSelBg : rowBg }}>
                                                        <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                                                            style={{ border: `1.5px solid ${selected ? checkFill : isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)"}` }}>
                                                            {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: checkFill }} />}
                                                        </div>
                                                        <input type="radio" id={`radio-${opt.id}`} name={`rg-${block.id}`} className="sr-only"
                                                            checked={selected} onChange={() => setFormData(prev => ({ ...prev, [block.id]: opt.value }))} />
                                                        <span className="text-[13px]">{opt.value || "Option"}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {block.type === "budget" && (
                                        <div className="px-3 py-3 rounded-xl" style={{ background: rowBg }}>
                                            <BudgetSlider
                                                min={Number(block.options[0]?.value || 1000)}
                                                max={Number(block.options[1]?.value || 50000)}
                                                step={Number(block.options[2]?.value || 1000)}
                                                prefix={block.options[3]?.value || "₹"}
                                                isDark={isDark}
                                                onChange={(val) => setFormData(prev => ({ ...prev, [block.id]: val }))}
                                            />
                                        </div>
                                    )}

                                    {block.type === "project" && (
                                        <Select
                                            value={stringValue(formData[block.id])}
                                            onValueChange={(val) => setFormData(prev => ({ ...prev, [block.id]: val }))}
                                        >
                                            <SelectTrigger
                                                className="h-10 w-full rounded-xl text-[13px] border-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 animate-in fade-in-50 duration-200"
                                                style={{
                                                    background: inputBg,
                                                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                                                    boxShadow: "none",
                                                }}
                                            >
                                                <SelectValue placeholder="Select a project" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {block.options.map((opt) => (
                                                    <SelectItem key={opt.id} value={opt.value} className="text-[13px]">
                                                        {opt.value}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-5 pb-5 pt-1 space-y-2.5">
                        <div className="h-px" style={{ background: divider }} />
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full h-11 rounded-xl text-[14px] font-semibold transition-all duration-150 active:scale-[0.98] focus:outline-none flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                            style={{ background: btnBg, color: btnText }}
                            onMouseEnter={e => !isSubmitting && (e.currentTarget.style.opacity = "0.88")}
                            onMouseLeave={e => !isSubmitting && (e.currentTarget.style.opacity = "1")}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                        <p className="text-center text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)" }}>
                            Powered by <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}>TSK</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);
    return (
        <Suspense fallback={
            <div className="flex h-dvh items-center justify-center" style={{ background: "#f2f2f7" }}>
                <div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
            </div>
        }>
            <FormPreview slug={resolvedParams.slug} />
        </Suspense>
    );
}
