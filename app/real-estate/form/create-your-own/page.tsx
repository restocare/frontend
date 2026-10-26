"use client";
import apiClient from "@/app/api/apiClient";
import { type ApiProject } from "@/app/api/api";
import { unwrapList } from "@/app/api/unwrapList";
import { projectApi } from "@/app/api/api";
import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/src/lib/theme";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Type,
    CheckSquare,
    CircleDot,
    ChevronDown,
    Trash2,
    RotateCcw,
    Pencil,
    GripVertical,
} from "lucide-react";


type BlockType =
    | "text"
    | "checkbox"
    | "radio"
    | "select"
    | "budget"
    | "phone"
    | "project"
    | "name";

interface Option {
    id: number;
    value: string;
}

interface Block {
    id: number;
    type: BlockType;
    label: string;
    placeholder: string;
    options: Option[];
    created: boolean;
    required: boolean;
}

/** One field of the exported schema (the shape stored on the meta-form). */
interface FormSchemaItem {
    Id: string;
    Type: BlockType;
    Label: string;
    Required: boolean;
    Placeholder: string;
    "Form ID": string;
    Order: number;
    Options?: string[];
    "Slider Settings"?: { Min: number; Max: number; Step: number; Prefix: string };
}

interface MetaForm {
    id: string;
    title: string;
    description: string;
    schema: string | FormSchemaItem[];
}

const matchesFormId = (f: MetaForm, id: string | null) =>
    f.id === id || (Array.isArray(f.schema) && f.schema[0]?.["Form ID"] === id);

function BudgetSlider({
    min,
    max,
    step,
    prefix,
    isDark,
}: {
    min: number;
    max: number;
    step: number;
    prefix: string;
    isDark?: boolean;
}) {
    const [value, setValue] = useState<number>(min);
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

    const containerClasses = isDark !== undefined
        ? `space-y-2 w-full rounded-xl p-3 shadow-sm border overflow-hidden ${isDark
            ? "bg-neutral-950 border-neutral-800 text-neutral-200"
            : "bg-white border-neutral-200 text-neutral-800"
        }`
        : "space-y-2 w-full bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 shadow-sm overflow-hidden";

    const labelClasses = isDark !== undefined
        ? (isDark ? "text-neutral-400" : "text-neutral-500")
        : "text-muted-foreground";

    const selectedClasses = isDark !== undefined
        ? (isDark ? "bg-neutral-800 text-primary border-neutral-700" : "bg-primary/10 text-primary border-primary/20")
        : "bg-primary/10 text-primary border-primary/20";

    const footerClasses = isDark !== undefined
        ? `flex justify-between gap-2 text-[10px] font-mono ${isDark ? "text-neutral-500" : "text-neutral-400"}`
        : "flex justify-between gap-2 text-[10px] text-muted-foreground font-mono";

    const trackColor = isDark !== undefined ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)") : undefined;
    const fillColor = isDark !== undefined ? (isDark ? "#ffffff" : "hsl(var(--primary))") : undefined;
    const thumbColor = isDark !== undefined ? (isDark ? "#ffffff" : "hsl(var(--primary))") : undefined;

    return (
        <div className={containerClasses}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium min-w-0">
                <span className={`${labelClasses} font-medium shrink-0 text-xs`}>Selected Budget:</span>
                <span className={`font-bold text-sm px-2 py-0.5 rounded-full border font-mono truncate max-w-full ${selectedClasses}`}>
                    {prefix}{value.toLocaleString("en-IN")}
                </span>
            </div>
            <div className="relative py-3">
                <div
                    className="w-full h-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800"
                    style={trackColor ? { background: trackColor } : undefined}
                >
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-75"
                        style={fillColor ? { width: `${pct}%`, background: fillColor } : { width: `${pct}%` }}
                    />
                </div>
                <div
                    className="absolute pointer-events-none transition-all duration-75 bg-primary rounded-full"
                    style={{
                        left: `${pct}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 16,
                        height: 16,
                        ...(thumbColor && { background: thumbColor }),
                        boxShadow: isDark
                            ? "0 0 0 3px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.6)"
                            : "0 0 0 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.25)",
                    }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
            <div className={footerClasses}>
                <span className="truncate">{prefix}{min.toLocaleString("en-IN")}</span>
                <span className="truncate">{prefix}{max.toLocaleString("en-IN")}</span>
            </div>
        </div>
    );
}

function createSlug(title: string) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric characters (except spaces and hyphens)
        .replace(/\s+/g, "-")          // replace spaces with hyphens
        .replace(/-+/g, "-")           // remove duplicate hyphens
        .replace(/^-+|-+$/g, "");      // trim leading/trailing hyphens
}

function getDefaultLabel(block: Block) {
    if (block.label) return block.label;
    switch (block.type) {
        case "name":
            return "Name";
        case "phone":
            return "Phone";
        case "project":
            return "Projects";
        case "budget":
            return "Budget";
        default:
            return "Untitled Field";
    }
}

function FormBuilder() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const editId = searchParams.get("id");
    const isPreviewOnly = searchParams.get("preview") === "true";
    const queryClient = useQueryClient();

    const [blocks, setBlocks] = useState<Block[]>(() => {
        if (editId) return [];
        const now = Date.now();
        return [
            {
                id: now,
                type: "name" as BlockType,
                label: "Name",
                placeholder: "",
                options: [{ id: now + 1, value: "" }],
                created: true,
                required: true,
            },
            {
                id: now + 100,
                type: "project" as BlockType,
                label: "Projects",
                placeholder: "",
                options: [],
                created: true,
                required: true,
            },
            {
                id: now + 200,
                type: "phone" as BlockType,
                label: "Phone",
                placeholder: "",
                options: [{ id: now + 201, value: "" }],
                created: true,
                required: true,
            },
            {
                id: now + 300,
                type: "budget" as BlockType,
                label: "Budget",
                placeholder: "",
                options: [
                    { id: now + 301, value: "1000" },
                    { id: now + 302, value: "50000" },
                    { id: now + 303, value: "1000" },
                    { id: now + 304, value: "₹" },
                ],
                created: true,
                required: true,
            },
        ];
    });
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [showDescription, setShowDescription] = useState<boolean>(true);
    const { theme: resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const { data: availableProjects = [], isFetched: projectsFetched } = useQuery<{ id: string; projectName: string }[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            return unwrapList<ApiProject>(await projectApi.getProjects()).map((p) => ({
                id: p.id,
                projectName: p.projectName ?? p.project_name ?? "",
            }));
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: fetchedForm } = useQuery({
        queryKey: ["meta-form", editId],
        queryFn: async () => {
            try {
                const res = await apiClient.get(`/api/meta-forms/${editId}`);
                if (res.status === 200) return res.data;
            } catch {
                const listRes = await apiClient.get("/api/meta-forms");
                const form = (listRes.data as MetaForm[]).find((f) => matchesFormId(f, editId));
                if (!form) throw new Error(`Form with id "${editId}" not found.`);
                return form;
            }
        },
        enabled: !!editId,
        staleTime: 5 * 60 * 1000,
        initialData: () => {
            if (!editId) return undefined;
            const cached = queryClient.getQueryData<MetaForm[]>(["meta-forms"]);
            return cached?.find((f) => matchesFormId(f, editId));
        },
        retry: false,
    });

    // Derived directly from query data — avoids the useEffect race condition where
    // actualFormId was still null when the user submitted, causing POST instead of PATCH.
    const actualFormId = fetchedForm?.id ?? null;

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!fetchedForm) return;
        /* eslint-disable react-hooks/set-state-in-effect */
        setTitle(fetchedForm.title);
        setDescription(fetchedForm.description);
        setShowDescription(!!fetchedForm.description);
        /* eslint-enable react-hooks/set-state-in-effect */

        const schema = typeof fetchedForm.schema === "string" ? JSON.parse(fetchedForm.schema) : fetchedForm.schema;
        const loadedBlocks = (schema as FormSchemaItem[]).map((item, idx) => {
            const baseId = Number(item.Id) || Date.now() + idx;
            let options: Option[] = [];

            if (item.Type === "budget" && item["Slider Settings"]) {
                const settings = item["Slider Settings"];
                options = [
                    { id: baseId + 1, value: String(settings.Min) },
                    { id: baseId + 2, value: String(settings.Max) },
                    { id: baseId + 3, value: String(settings.Step) },
                    { id: baseId + 4, value: settings.Prefix }
                ];
            } else if (item.Type === "project" && item.Options) {
                options = item.Options.map((opt: string, oIdx: number) => ({
                    id: baseId + 1 + oIdx,
                    value: opt
                }));
            } else if (item.Type === "project") {
                options = [];
            } else if (item.Options) {
                options = item.Options.map((opt: string, oIdx: number) => ({
                    id: baseId + 1 + oIdx,
                    value: opt
                }));
            } else {
                options = [{ id: baseId + 1, value: "" }];
            }

            return {
                id: baseId,
                type: item.Type as BlockType,
                label: item.Label,
                placeholder: item.Placeholder || "",
                options,
                created: true,
                required: item.Required
            };
        });
        setBlocks(loadedBlocks);
    }, [fetchedForm]);

    const hasAutoPopulated = useRef(false);

    useEffect(() => {
        if (editId || hasAutoPopulated.current || !projectsFetched) return;
        hasAutoPopulated.current = true;
        setBlocks((prev) =>
            prev.map((b) =>
                b.type === "project"
                    ? { ...b, options: availableProjects.map((p, i) => ({ id: Date.now() + i, value: p.projectName })) }
                    : b
            )
        );
    }, [editId, projectsFetched, availableProjects]);

    const previewTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";
    const [isDraggable, setIsDraggable] = useState<boolean>(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<number, string>>({});

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
    const [projectAbout, setProjectAbout] = useState("");

    const submitMutation = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            if (editId && actualFormId) {
                return apiClient.patch(`/api/meta-forms/${actualFormId}`, payload);
            }
            return apiClient.post("/api/meta-forms", payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meta-forms"] });
            if (editId) queryClient.invalidateQueries({ queryKey: ["meta-form", editId] });
            toast.success(editId ? "Form configuration updated successfully!" : "Form configuration successfully created!");
            setShowConfirmModal(false);
            router.push("/real-estate/form/manage-forms");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Something went wrong. Please try again.");
        },
    });

    // GENERATE EXPORT JSON SCHEMA IN EXACT SPECIFIED FORMAT
    const getFormJson = () => {
        // When editing, preserve the existing form ID instead of regenerating from the title
        const formIdSlug = editId || createSlug(title) || "dynamic-form";
        return blocks.map((block, index) => {
            const jsonField: FormSchemaItem = {
                "Id": block.id.toString(),
                "Type": block.type,
                "Label": block.label || "Untitled Field",
                "Required": block.required,
                "Placeholder": block.placeholder || "",
                "Form ID": formIdSlug,
                "Order": index + 1
            };

            // Include options if the type supports options
            if (block.type === "select" || block.type === "checkbox" || block.type === "radio" || block.type === "project") {
                jsonField["Options"] = block.options.map(opt => opt.value).filter(Boolean);
            }

            // Include budget slider range settings
            if (block.type === "budget") {
                jsonField["Slider Settings"] = {
                    "Min": Number(block.options[0]?.value || 1000),
                    "Max": Number(block.options[1]?.value || 50000),
                    "Step": Number(block.options[2]?.value || 1000),
                    "Prefix": block.options[3]?.value || "₹"
                };
            }

            return jsonField;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Please enter a form title.");
            return;
        }

        const hasName = blocks.some((b) => b.type === "name");
        const hasPhone = blocks.some((b) => b.type === "phone");
        const hasProject = blocks.some((b) => b.type === "project");

        if (!hasName) {
            toast.error("A Name field is required in this form.");
            return;
        }
        if (!hasPhone) {
            toast.error("A Phone Number field is required in this form.");
            return;
        }
        if (!hasProject) {
            toast.error("A Projects field is required in this form.");
            return;
        }

        const newSlug = createSlug(title) || "dynamic-form";
        const formSchema = getFormJson();

        const payload = {
            id: (editId && actualFormId) ? actualFormId : newSlug,
            title,
            description,
            fieldsCount: blocks.length,
            status: "active",
            createdAt: new Date().toISOString().split("T")[0],
            schema: formSchema,
        };

        setPendingPayload(payload);
        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = () => {
        if (pendingPayload) {
            submitMutation.mutate({ ...pendingPayload, about: projectAbout });
        }
    };

    // ADD BLOCK
    const handleAddBlock = (type: BlockType) => {
        const baseId = Date.now();
        setBlocks((prev) => [
            ...prev,
            {
                id: baseId,
                type,
                label: type === "budget" ? "Budget" : type === "phone" ? "Phone" : type === "project" ? "Projects" : type === "name" ? "Name" : "",
                placeholder: "",
                options: type === "budget"
                    ? [
                        { id: baseId + 1, value: "1000" },   // Min
                        { id: baseId + 2, value: "50000" },  // Max
                        { id: baseId + 3, value: "1000" },   // Step
                        { id: baseId + 4, value: "₹" }       // Prefix
                    ]
                    : type === "project"
                        ? availableProjects.map((p, i) => ({ id: baseId + 1 + i, value: p.projectName }))
                        : [
                            {
                                id: baseId + 1,
                                value: "",
                            },
                        ],
                created: false,
                required: ["name", "phone", "project", "budget"].includes(type),
            },
        ]);

        // Smoothly scroll and focus the new field
        setTimeout(() => {
            const element = document.getElementById(`block-${baseId}`);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                const input = element.querySelector("input");
                if (input) {
                    input.focus();
                }
            }
        }, 100);
    };

    // UPDATE LABEL
    const updateLabel = (
        id: number,
        value: string
    ) => {
        setErrors((prev) => {
            if (!prev[id]) return prev;
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setBlocks((prev) =>
            prev.map((block) =>
                block.id === id
                    ? {
                        ...block,
                        label: value,
                    }
                    : block
            )
        );
    };

    // UPDATE PLACEHOLDER
    const updatePlaceholder = (
        id: number,
        value: string
    ) => {
        setBlocks((prev) =>
            prev.map((block) =>
                block.id === id
                    ? {
                        ...block,
                        placeholder: value,
                    }
                    : block
            )
        );
    };

    // UPDATE OPTION
    const updateOption = (
        blockId: number,
        optionId: number,
        value: string
    ) => {
        setErrors((prev) => {
            if (!prev[blockId]) return prev;
            const updated = { ...prev };
            delete updated[blockId];
            return updated;
        });
        setBlocks((prev) =>
            prev.map((block) => {
                if (block.id !== blockId) return block;
                return {
                    ...block,
                    options: block.options.map((option) =>
                        option.id === optionId
                            ? {
                                ...option,
                                value,
                            }
                            : option
                    ),
                };
            })
        );
    };

    // REMOVE OPTION
    const removeOption = (blockId: number, optionId: number) => {
        setBlocks((prev) =>
            prev.map((block) => {
                if (block.id !== blockId) return block;
                return { ...block, options: block.options.filter((opt) => opt.id !== optionId) };
            })
        );
    };

    // ADD OPTION
    const addOption = (blockId: number) => {
        setBlocks((prev) =>
            prev.map((block) => {
                if (block.id !== blockId) return block;
                return {
                    ...block,
                    options: [
                        ...block.options,
                        {
                            id: Date.now(),
                            value: "",
                        },
                    ],
                };
            })
        );
    };

    // TOGGLE REQUIRED
    const toggleRequired = (
        blockId: number,
        checked: boolean
    ) => {
        setBlocks((prev) =>
            prev.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        required: checked,
                    }
                    : block
            )
        );
    };

    // VALIDATE FIELD RULES
    const validateBlock = (block: Block): string | null => {
        if (!block.label || block.label.trim() === "") {
            return "Field label is required and cannot be empty.";
        }

        if (block.type === "select" || block.type === "checkbox" || block.type === "radio") {
            if (block.options.length === 0) {
                return "At least one option is required.";
            }
            if (block.options.some((opt) => !opt.value || opt.value.trim() === "")) {
                return "All options must have a value and cannot be empty.";
            }
        }

        if (block.type === "project") {
            if (block.options.length === 0) {
                return "Please select at least one project.";
            }
        }

        if (block.type === "budget") {
            const maxValue = block.options[1]?.value;
            if (!maxValue || maxValue.trim() === "") {
                return "Max budget value is required and cannot be empty.";
            }
        }

        return null;
    };

    // CREATE FIELD WITH VALIDATION
    const createField = (blockId: number) => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        const error = validateBlock(block);
        if (error) {
            setErrors((prev) => ({ ...prev, [blockId]: error }));
            toast.error(error);
            return;
        }

        // Clear errors for this block upon successful creation
        setErrors((prev) => {
            const updated = { ...prev };
            delete updated[blockId];
            return updated;
        });

        setBlocks((prev) =>
            prev.map((b) =>
                b.id === blockId
                    ? {
                        ...b,
                        created: true,
                    }
                    : b
            )
        );


    };

    // DELETE BLOCK
    const handleDeleteBlock = (id: number) => {
        const block = blocks.find((b) => b.id === id);
        setErrors((prev) => {
            if (!prev[id]) return prev;
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setBlocks((prev) => prev.filter((block) => block.id !== id));
        toast.success(`Field "${block?.label || "Untitled"}" successfully deleted.`);
    };

    // CLEAR BLOCK FIELDS
    const handleClearBlock = (id: number) => {
        const block = blocks.find((b) => b.id === id);
        setErrors((prev) => {
            if (!prev[id]) return prev;
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setBlocks((prev) =>
            prev.map((block) => {
                if (block.id !== id) return block;
                const baseId = Date.now();
                return {
                    ...block,
                    label: block.type === "budget" ? "Budget" : block.type === "phone" ? "Phone" : block.type === "project" ? "Projects" : block.type === "name" ? "Name" : "",
                    placeholder: "",
                    options: block.type === "budget"
                        ? [
                            { id: baseId + 1, value: "1000" },   // Min
                            { id: baseId + 2, value: "50000" },  // Max
                            { id: baseId + 3, value: "1000" },   // Step
                            { id: baseId + 4, value: "₹" }       // Prefix
                        ]
                        : block.type === "project"
                            ? availableProjects.map((p, i) => ({ id: baseId + 1 + i, value: p.projectName }))
                            : [
                                {
                                    id: baseId + 1,
                                    value: "",
                                },
                            ],
                    required: ["name", "phone", "project", "budget"].includes(block.type),
                };
            })
        );
        toast.info(`Fields for "${block?.label || "Untitled"}" reset to default.`);
    };

    // EDIT FROM PREVIEW: toggles block state, scrolls and highlights
    const handleEditFromPreview = (blockId: number) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === blockId ? { ...b, created: false } : b))
        );

        setTimeout(() => {
            const element = document.getElementById(`block-${blockId}`);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });

                // Add a temporary highlight border class
                element.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-all", "duration-500");
                setTimeout(() => {
                    element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
                }, 2000);

                const input = element.querySelector("input");
                if (input) {
                    input.focus();
                }
            }
        }, 150);
    };

    // FOCUS TITLE FROM PREVIEW
    const handleFocusTitle = () => {
        const input = document.getElementById("form-title-input");
        if (input) {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            (input as HTMLInputElement).focus();
            input.classList.add("ring-2", "ring-primary", "transition-all", "duration-500");
            setTimeout(() => {
                input.classList.remove("ring-2", "ring-primary");
            }, 2000);
        }
    };

    // DRAG AND DROP HANDLERS
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;

        setBlocks((prev) => {
            const updated = [...prev];
            const [draggedItem] = updated.splice(draggedIndex, 1);
            updated.splice(index, 0, draggedItem);
            return updated;
        });
        setDraggedIndex(null);
        setIsDraggable(false);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setIsDraggable(false);
    };

    if (isPreviewOnly) {
        return (
            <div className="container max-w-2xl py-12 mx-auto">
                <Card className="shadow-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-card rounded-2xl">
                    <CardHeader className="space-y-2 text-center p-8 border-b border-neutral-100 dark:border-neutral-800/50">
                        <h1 className="text-2xl font-bold tracking-tight" style={{
                            color: previewTheme === "dark" ? "#ffffff" : "#171717"
                        }}>{title || "Untitled Form"}</h1>
                        {showDescription && description && (
                            <p className="text-sm text-muted-foreground wrap-break-words">{description}</p>
                        )}
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {blocks.length === 0 ? (
                            <div className="text-center py-10 px-4 text-muted-foreground">
                                <p className="text-sm font-semibold">This form has no configured fields yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {blocks.map((block) => (
                                    <div key={block.id} className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-semibold wrap-break-words max-w-[80%]" style={{
                                                color: previewTheme === "dark" ? "#e5e5e5" : "#262626"
                                            }}>
                                                {block.label || "Untitled Field"}
                                                {block.required && (
                                                    <span className="text-red-500 ml-0.5">*</span>
                                                )}
                                            </Label>
                                        </div>

                                        {block.type === "text" && (
                                            <Input
                                                placeholder={block.placeholder || "Enter response..."}
                                                className="h-10 text-sm bg-transparent"
                                                style={{
                                                    color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                    borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                }}
                                            />
                                        )}

                                        {block.type === "name" && (
                                            <Input
                                                placeholder={block.placeholder || "Enter your name"}
                                                className="h-10 text-sm bg-transparent"
                                                style={{
                                                    color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                    borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                }}
                                            />
                                        )}

                                        {block.type === "phone" && (
                                            <Input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={10}
                                                placeholder={block.placeholder || "Enter phone number"}
                                                className="h-10 text-sm bg-transparent"
                                                style={{
                                                    color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                    borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                }}
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
                                                    input.value = (input.value.slice(0, start) + pasted + input.value.slice(end)).replace(/\D/g, "").slice(0, 10);
                                                }}
                                            />
                                        )}

                                        {block.type === "select" && (
                                            <Select>
                                                <SelectTrigger className="h-10 w-full text-sm bg-transparent" style={{
                                                    color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                    borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                }}>
                                                    <SelectValue placeholder="Choose option" />
                                                </SelectTrigger>
                                                <SelectContent className={previewTheme === "dark" ? "bg-neutral-900 border-neutral-800 text-neutral-200" : ""}>
                                                    {block.options.map((opt) => (
                                                        <SelectItem key={opt.id} value={opt.value || `opt-${opt.id}`}>
                                                            {opt.value || "Option"}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {block.type === "checkbox" && (
                                            <div className="flex flex-col gap-2.5 pt-1">
                                                {block.options.map((opt) => (
                                                    <div key={opt.id} className="flex items-center space-x-3">
                                                        <Checkbox id={`prev-cb-${opt.id}`} className="h-4 w-4" style={{
                                                            borderColor: previewTheme === "dark" ? "#404040" : "#d4d4d4"
                                                        }} />
                                                        <label htmlFor={`prev-cb-${opt.id}`} className="text-sm cursor-pointer select-none" style={{
                                                            color: previewTheme === "dark" ? "#a3a3a3" : "#525252"
                                                        }}>
                                                            {opt.value || "Option"}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {block.type === "radio" && (
                                            <div className="flex flex-col gap-2.5 pt-1">
                                                {block.options.map((opt) => (
                                                    <div key={opt.id} className="flex items-center space-x-3">
                                                        <input
                                                            type="radio"
                                                            name={`prev-radio-${block.id}`}
                                                            id={`prev-radio-${opt.id}`}
                                                            className="h-4 w-4 rounded-full border bg-transparent text-primary accent-primary cursor-pointer focus:ring-primary"
                                                            style={{
                                                                borderColor: previewTheme === "dark" ? "#404040" : "#d4d4d4"
                                                            }}
                                                        />
                                                        <label htmlFor={`prev-radio-${opt.id}`} className="text-sm cursor-pointer select-none" style={{
                                                            color: previewTheme === "dark" ? "#a3a3a3" : "#525252"
                                                        }}>
                                                            {opt.value || "Option"}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {block.type === "budget" && (
                                            <div className="pt-1">
                                                <BudgetSlider
                                                    min={Number(block.options[0]?.value || 1000)}
                                                    max={Number(block.options[1]?.value || 50000)}
                                                    step={Number(block.options[2]?.value || 1000)}
                                                    prefix={block.options[3]?.value || "₹"}
                                                    isDark={previewTheme === "dark"}
                                                />
                                            </div>
                                        )}

                                        {block.type === "project" && (
                                            <Select>
                                                <SelectTrigger className="h-10 w-full text-sm bg-transparent" style={{ color: previewTheme === "dark" ? "#ffffff" : "#131517", borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5" }}>
                                                    <SelectValue placeholder="Select a project" />
                                                </SelectTrigger>
                                                <SelectContent className={previewTheme === "dark" ? "bg-neutral-900 border-neutral-800 text-neutral-200" : ""}>
                                                    {block.options.map((opt) => (
                                                        <SelectItem key={opt.id} value={opt.value}>
                                                            {opt.value}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="p-8 border-t flex flex-col items-center gap-4 bg-muted/20">
                        <Button className="w-full h-10 text-sm font-semibold" onClick={() => toast.success("Response simulated successfully!")}>
                            Submit Response
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                            This is a live interactive preview of the form as seen by your respondents.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <>
        <div className="@container/main flex w-full flex-col gap-4 md:gap-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        <CheckSquare className="size-4" />
                    </div>
                    <h1 className="font-semibold text-xl tracking-tight">
                        {editId ? `Edit Form: ${title || "Untitled"}` : "Create Your Own Form"}
                    </h1>
                </div>
                <p className="text-muted-foreground text-sm">
                    {editId ? "Modify and preview your custom dynamic form configurations in real time." : "Create and preview your custom dynamic forms in real time."}
                </p>
            </div>

            {/* TWO COLUMN GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">

                {/* LEFT COLUMN - FORM BUILDER (70% width) */}
                <div className="lg:col-span-7 space-y-6">
                    <form onSubmit={handleSubmit}>
                        <Card className="shadow-sm overflow-hidden border border-neutral-200 dark:border-neutral-800">
                            <CardHeader className="space-y-3 p-6 bg-card border-b border-neutral-100 dark:border-neutral-800/50">
                                <div className="flex items-center justify-between pb-1 border-b border-dashed border-neutral-100 dark:border-neutral-800/50">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={showDescription}
                                            onClick={() => {
                                                const nextVal = !showDescription;
                                                setShowDescription(nextVal);
                                                if (!nextVal) {
                                                    setDescription("");
                                                } else {
                                                    setDescription("Create your own dynamic form fields.");
                                                }
                                            }}
                                            className={"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-black dark:border-white bg-neutral-200 dark:bg-neutral-800 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary"}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${showDescription ? "translate-x-4 bg-white" : "translate-x-0 bg-white"}`}
                                            />
                                        </button>
                                        <span className="text-xs font-semibold text-muted-foreground select-none">
                                            Add Description
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Input
                                        id="form-title-input"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="text-xl md:text-2xl font-bold tracking-tight text-center border-0! bg-transparent! shadow-none! focus-visible:ring-1 focus-visible:ring-primary px-2 -ml-2 w-full rounded-md"
                                        placeholder="Form Title"
                                    />
                                    {showDescription && (
                                        <Input
                                            id="form-description-input"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="text-sm text-muted-foreground text-center border-0! bg-transparent! shadow-none! focus-visible:ring-1 focus-visible:ring-primary px-2 -ml-2 w-full rounded-md animate-in fade-in slide-in-from-top-1 duration-200"
                                            placeholder="Form Description"
                                        />
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-4">
                                {/* EMPTY STATE */}
                                {blocks.length === 0 && (
                                    <div className="flex flex-col items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center space-y-4 bg-muted/10">
                                        <div className="rounded-full bg-primary/10 p-4 text-primary">
                                            <Plus className="h-6 w-6 animate-pulse" />
                                        </div>
                                        <div className="space-y-1 max-w-sm">
                                            <p className="text-sm font-semibold text-foreground">No fields added yet</p>
                                            <p className="text-xs text-muted-foreground">Select a field type below to begin constructing your customized dynamic form.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 justify-center pt-3">
                                            <Button type="button" size="sm" variant="outline" onClick={() => handleAddBlock("text")} className="gap-1.5 h-8 text-xs"><Type className="h-3.5 w-3.5" /> Text</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => handleAddBlock("select")} className="gap-1.5 h-8 text-xs"><ChevronDown className="h-3.5 w-3.5" /> Dropdown</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => handleAddBlock("checkbox")} className="gap-1.5 h-8 text-xs"><CheckSquare className="h-3.5 w-3.5" /> Checkbox</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={() => handleAddBlock("radio")} className="gap-1.5 h-8 text-xs"><CircleDot className="h-3.5 w-3.5" /> Radio</Button>
                                        </div>
                                    </div>
                                )}

                                {blocks.map((block, index) => (
                                    <div
                                        key={block.id}
                                        id={`block-${block.id}`}
                                        draggable={isDraggable}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDrop(index)}
                                        onDragEnd={handleDragEnd}
                                        className={`border rounded-xl p-3 space-y-3 bg-muted/20 animate-in fade-in-50 slide-in-from-bottom-2 'duration-300' transition-all duration-300 relative ${draggedIndex === index ? "opacity-30 scale-95 border-dashed border-primary" : ""
                                            }`}
                                    >
                                        {/* Block Card Header with Grip Handle */}
                                        <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100 dark:border-neutral-800/50">
                                            {/* DRAG HANDLE BUTTON */}
                                            <button
                                                type="button"
                                                onMouseDown={() => setIsDraggable(true)}
                                                onMouseUp={() => setIsDraggable(false)}
                                                onMouseLeave={() => setIsDraggable(false)}
                                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 transition-colors"
                                                title="Drag to reorder"
                                            >
                                                <GripVertical className="h-4 w-4" />
                                            </button>
                                            {block.created && (
                                                <Label>
                                                    {getDefaultLabel(block)}
                                                    {block.required && (
                                                        <span className="text-red-500 ml-1">*</span>
                                                    )}
                                                </Label>
                                            )}
                                        </div>
                                        {/* EDIT MODE */}
                                        {!block.created && (
                                            <>
                                                {/* FIELD LABEL */}
                                                <div className="space-y-2">
                                                    <Label>
                                                        Field Label
                                                    </Label>
                                                    {block.type === "phone" || block.type === "name" ? (
                                                        <div className="h-10 px-3 flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-muted/50 text-sm font-medium text-muted-foreground select-none cursor-not-allowed">
                                                            {block.type === "phone" ? "Phone" : "Name"}
                                                        </div>
                                                    ) : (
                                                        <Input
                                                            placeholder="Enter field label"
                                                            value={block.label}
                                                            onChange={(e) =>
                                                                updateLabel(
                                                                    block.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </div>
                                                {/* TEXT PLACEHOLDER */}
                                                {block.type === "text" && (
                                                    <div className="space-y-2">
                                                        <Label>
                                                            Placeholder
                                                        </Label>
                                                        <Input
                                                            placeholder="Enter placeholder"
                                                            value={block.placeholder}
                                                            onChange={(e) =>
                                                                updatePlaceholder(
                                                                    block.id,
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                )}
                                                {/* PHONE PLACEHOLDER */}
                                                {block.type === "phone" && (
                                                    <div className="space-y-2">
                                                        <Label>Placeholder</Label>
                                                        <Input
                                                            placeholder="Enter placeholder"
                                                            value={block.placeholder}
                                                            onChange={(e) =>
                                                                updatePlaceholder(block.id, e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                )}
                                                {/* NAME PLACEHOLDER */}
                                                {block.type === "name" && (
                                                    <div className="space-y-2">
                                                        <Label>Placeholder</Label>
                                                        <Input
                                                            placeholder="Enter placeholder"
                                                            value={block.placeholder}
                                                            onChange={(e) =>
                                                                updatePlaceholder(block.id, e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                )}
                                                {/* OPTIONS */}
                                                {(block.type === "select" ||
                                                    block.type === "checkbox" ||
                                                    block.type === "radio") && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <Label>
                                                                    Options
                                                                </Label>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        addOption(block.id)
                                                                    }
                                                                >
                                                                    Add Option
                                                                </Button>
                                                            </div>
                                                            {block.options.map((option) => (
                                                                <Input
                                                                    key={option.id}
                                                                    placeholder="Enter option"
                                                                    value={option.value}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            block.id,
                                                                            option.id,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                {/* BUDGET SLIDER SETTINGS */}
                                                {block.type === "budget" && (
                                                    <div className="space-y-4 border rounded-xl p-4 bg-background/50">
                                                        <Label className="text-sm font-semibold text-foreground">Slider Range Settings</Label>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-muted-foreground">Currency/Prefix</Label>
                                                                <Input
                                                                    type="text"
                                                                    placeholder="₹"
                                                                    value={block.options[3]?.value || ""}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            block.id,
                                                                            block.options[3]?.id,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-muted-foreground">Min Value</Label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="1000"
                                                                    value={block.options[0]?.value || ""}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            block.id,
                                                                            block.options[0]?.id,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-muted-foreground">Max Value</Label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="50000"
                                                                    value={block.options[1]?.value || ""}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            block.id,
                                                                            block.options[1]?.id,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label className="text-xs text-muted-foreground">Step</Label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="1000"
                                                                    value={block.options[2]?.value || ""}
                                                                    onChange={(e) =>
                                                                        updateOption(
                                                                            block.id,
                                                                            block.options[2]?.id,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* PROJECT OPTIONS */}
                                                {block.type === "project" && (
                                                    <div className="space-y-4">
                                                        <Label>Options</Label>
                                                        {block.options.length === 0 && (
                                                            <p className="text-xs text-muted-foreground">No projects available. Add projects first.</p>
                                                        )}
                                                        {block.options.map((option) => (
                                                            <div key={option.id} className="flex items-center gap-2">
                                                                <div className="flex-1 h-10 px-3 flex items-center rounded-md border border-neutral-200 dark:border-neutral-800 bg-muted/50 text-sm text-foreground select-none">
                                                                    {option.value}
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => removeOption(block.id, option.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* REQUIRED TOGGLE */}
                                                <div className="flex items-center w-36 justify-between border rounded-lg px-4 py-3 bg-background">
                                                    <Label className="text-sm font-medium cursor-pointer" onClick={() => toggleRequired(block.id, !block.required)}>
                                                        Required
                                                    </Label>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={block.required}
                                                        onClick={() => toggleRequired(block.id, !block.required)}
                                                        className={"relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-black dark:border-white bg-neutral-200 dark:bg-neutral-800 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${block.required ? "translate-x-5 bg-white" : "translate-x-0 bg-white"}`}
                                                        />
                                                    </button>
                                                </div>

                                                {errors[block.id] && (
                                                    <p className="text-xs font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {errors[block.id]}
                                                    </p>
                                                )}

                                                {/* ACTION BUTTONS */}
                                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                                    <Button
                                                        type="button"
                                                        onClick={() =>
                                                            createField(block.id)
                                                        }
                                                        className="shadow-sm"
                                                    >
                                                        Create Field
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handleClearBlock(block.id)
                                                        }
                                                        className="hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 gap-2"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                        Clear Fields
                                                    </Button>
                                                    {!["name", "project", "phone", "budget"].includes(block.type) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() =>
                                                                handleDeleteBlock(block.id)
                                                            }
                                                            className="hover:bg-destructive/10 hover:text-destructive border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 gap-2 transition-colors duration-200"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete Field
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {/* FINAL FIELD */}
                                        {block.created && (
                                            <div className="space-y-4">
                                                {/* TEXT */}
                                                {block.type === "text" && (
                                                    <div className="space-y-3">
                                                        <Input
                                                            placeholder={
                                                                block.placeholder
                                                            }
                                                        />
                                                    </div>
                                                )}
                                                {/* PHONE */}
                                                {block.type === "phone" && (
                                                    <div className="space-y-3">
                                                        <Input
                                                            type="tel"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            maxLength={10}
                                                            placeholder={block.placeholder || "Enter phone number"}
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
                                                                input.value = (input.value.slice(0, start) + pasted + input.value.slice(end)).replace(/\D/g, "").slice(0, 10);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {/* NAME */}
                                                {block.type === "name" && (
                                                    <div className="space-y-3">
                                                        <Input placeholder={block.placeholder || "Enter your name"} />
                                                    </div>
                                                )}
                                                {/* SELECT */}
                                                {block.type === "select" && (
                                                    <div className="space-y-3">
                                                        <Select>
                                                            <SelectTrigger className="w-full max-w-62.5">
                                                                <SelectValue placeholder="Choose option" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {block.options.map((option) => (
                                                                    <SelectItem
                                                                        key={option.id}
                                                                        value={option.value}
                                                                    >
                                                                        {option.value || "Option"}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {/* BUDGET */}
                                                {block.type === "budget" && (
                                                    <div className="space-y-3">
                                                        <BudgetSlider
                                                            min={Number(block.options[0]?.value || 1000)}
                                                            max={Number(block.options[1]?.value || 50000)}
                                                            step={Number(block.options[2]?.value || 1000)}
                                                            prefix={block.options[3]?.value || "₹"}
                                                        />
                                                    </div>
                                                )}
                                                {/* CHECKBOX */}
                                                {block.type === "checkbox" && (
                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-3">
                                                            {block.options.map((option) => (
                                                                <div
                                                                    key={option.id}
                                                                    className="flex items-center space-x-3"
                                                                >
                                                                    <Checkbox
                                                                        id={`${block.id}-${option.id}`}
                                                                    />
                                                                    <Label
                                                                        htmlFor={`${block.id}-${option.id}`}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        {option.value || "Option"}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* RADIO */}
                                                {block.type === "radio" && (
                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-3">
                                                            {block.options.map((option) => (
                                                                <div
                                                                    key={option.id}
                                                                    className="flex items-center space-x-3"
                                                                >
                                                                    <input
                                                                        type="radio"
                                                                        name={`group-${block.id}`}
                                                                        value={option.value}
                                                                        id={`${block.id}-${option.id}`}
                                                                        className="h-4 w-4 rounded-full border border-neutral-300 text-primary focus:ring-primary dark:border-neutral-700 bg-transparent"
                                                                    />
                                                                    <Label
                                                                        htmlFor={`${block.id}-${option.id}`}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        {option.value || "Option"}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* PROJECT */}
                                                {block.type === "project" && (
                                                    <div className="space-y-3">
                                                        <Select>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select a project" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {block.options.map((option) => (
                                                                    <SelectItem key={option.id} value={option.value}>
                                                                        {option.value}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {/* ACTION FOOTER */}
                                                <div className="flex justify-between items-center pt-4 border-t border-dashed border-neutral-200 dark:border-neutral-800 mt-6">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setBlocks((prev) =>
                                                                prev.map((b) =>
                                                                    b.id === block.id
                                                                        ? { ...b, created: false }
                                                                        : b
                                                                )
                                                            );
                                                        }}
                                                        className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 gap-2"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit Field
                                                    </Button>
                                                    {!["name", "project", "phone", "budget"].includes(block.type) && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteBlock(block.id)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete Field
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* CONTEXTUAL QUICK-ADD TOOLBAR */}
                                {blocks.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                                        <span className="text-xs font-semibold text-muted-foreground mr-2">Quick Add:</span>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddBlock("text")} className="h-8 px-3 text-neutral-600 hover:text-primary hover:bg-primary/5 gap-1.5 text-xs"><Type className="h-3.5 w-3.5" /> Text</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddBlock("select")} className="h-8 px-3 text-neutral-600 hover:text-primary hover:bg-primary/5 gap-1.5 text-xs"><ChevronDown className="h-3.5 w-3.5" /> Dropdown</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddBlock("checkbox")} className="h-8 px-3 text-neutral-600 hover:text-primary hover:bg-primary/5 gap-1.5 text-xs"><CheckSquare className="h-3.5 w-3.5" /> Checkbox</Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddBlock("radio")} className="h-8 px-3 text-neutral-600 hover:text-primary hover:bg-primary/5 gap-1.5 text-xs"><CircleDot className="h-3.5 w-3.5" /> Radio</Button>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t p-6 bg-muted/40 rounded-b-xl">
                                <Button
                                    variant="outline"
                                    type="reset"
                                    onClick={() => {
                                        setBlocks([]);
                                        toast.info("Form workspace cleared.");
                                    }}
                                >
                                    Clear Form
                                </Button>
                                <Button type="submit" disabled={submitMutation.isPending}>
                                    {submitMutation.isPending ? (
                                        <>
                                            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        editId ? "Update Form" : "Submit Form"
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </div>

                {/* RIGHT COLUMN - INTERACTIVE LIVE PREVIEW SIDEBAR (30% width) */}
                <div className="lg:col-span-3 lg:sticky lg:top-24 space-y-6">
                    <Card className="shadow-sm overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-all duration-300 hover:shadow-lg">
                        {/* Preview Header */}
                        <div className="p-4 border-b flex items-center justify-between bg-card border-neutral-100 dark:border-neutral-800/50">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">Live Preview</span>
                            </div>

                            {/* Fields Count Badge */}
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded select-none ${previewTheme === "dark" ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-700"
                                }`}>
                                {blocks.length} {blocks.length === 1 ? "field" : "fields"}
                            </div>
                        </div>

                        {/* Form Body Preview */}
                        <CardContent className="p-6 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
                            {/* Form Title & Description Preview */}
                            <div
                                className={`text-center pb-4 border-b border-dashed border-neutral-200 dark:border-neutral-800 group cursor-pointer relative rounded-lg p-2 transition-all duration-200 ${previewTheme === "dark"
                                    ? "hover:bg-neutral-800/30"
                                    : "hover:bg-neutral-50"
                                    }`}
                                onClick={handleFocusTitle}
                                title="Click to edit Title"
                            >
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <h2 className="text-lg font-bold wrap-break-words select-none" style={{
                                    color: previewTheme === "dark" ? "#ffffff" : "#171717"
                                }}>{title || "Untitled Form"}</h2>
                                {showDescription && description && (
                                    <p className="text-xs mt-1 wrap-break-words select-none" style={{
                                        color: previewTheme === "dark" ? "#a3a3a3" : "#737373"
                                    }}>{description}</p>
                                )}
                            </div>

                            {/* Form Blocks Preview */}
                            {blocks.length === 0 ? (
                                <div className="text-center py-10 px-4 text-muted-foreground space-y-2">
                                    <p className="text-xs font-semibold" style={{
                                        color: previewTheme === "dark" ? "#d4d4d4" : "#404040"
                                    }}>Interactive Preview Empty</p>
                                    <p className="text-[11px] leading-relaxed" style={{
                                        color: previewTheme === "dark" ? "#737373" : "#a3a3a3"
                                    }}>Fields you add in the builder will render here automatically as interactive components.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {blocks.map((block) => {
                                        if (block.type === "project" && block.options.length <= 1) return null;
                                        return (
                                        <div
                                            key={block.id}
                                            className={`group relative border rounded-xl p-2.5 transition-all duration-200 border-transparent ${previewTheme === "dark"
                                                ? "hover:border-neutral-800 hover:bg-neutral-900/30"
                                                : "hover:border-neutral-200 hover:bg-neutral-50"
                                                }`}
                                        >
                                            {/* Hover Action Overlay / Toolbar */}
                                            <div className={`absolute -top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 border rounded-lg p-0.5 shadow-sm ${previewTheme === "dark" ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
                                                }`}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-6 w-6 rounded-md ${previewTheme === "dark"
                                                        ? "text-neutral-450 hover:text-primary hover:bg-neutral-800"
                                                        : "text-neutral-550 hover:text-primary hover:bg-neutral-100"
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditFromPreview(block.id);
                                                    }}
                                                    title="Edit block properties"
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-6 w-6 rounded-md ${previewTheme === "dark"
                                                        ? "text-neutral-450 hover:text-destructive hover:bg-destructive/20"
                                                        : "text-neutral-550 hover:text-destructive hover:bg-destructive/10"
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteBlock(block.id);
                                                    }}
                                                    title="Delete field"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            {/* Render Field Preview */}
                                            <div className="space-y-2">
                                                {/* Label */}
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-semibold select-none wrap-break-words max-w-[75%]" style={{
                                                        color: previewTheme === "dark" ? "#e5e5e5" : "#262626"
                                                    }}>
                                                        {block.label || "Untitled Field"}
                                                        {block.required && (
                                                            <span className="text-red-500 ml-0.5">*</span>
                                                        )}
                                                    </Label>
                                                    <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded select-none ${previewTheme === "dark" ? "bg-neutral-800 text-neutral-400" : "bg-neutral-100 text-neutral-500"
                                                        }`}>
                                                        {block.type}
                                                    </span>
                                                </div>

                                                {/* Text Input */}
                                                {block.type === "text" && (
                                                    <Input
                                                        placeholder={block.placeholder || "Enter text..."}
                                                        className={`h-8 text-xs bg-transparent border focus-visible:ring-1 focus-visible:ring-primary ${previewTheme === "dark"
                                                            ? "border-neutral-800 text-neutral-200 placeholder-neutral-600 focus-visible:ring-neutral-700"
                                                            : "border-neutral-200 text-neutral-900 placeholder-neutral-450 focus-visible:ring-neutral-300"
                                                            }`}
                                                        style={{
                                                            color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                            borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                        }}
                                                    />
                                                )}

                                                {/* Name Input */}
                                                {block.type === "name" && (
                                                    <Input
                                                        placeholder={block.placeholder || "Enter your name"}
                                                        className={`h-8 text-xs bg-transparent border focus-visible:ring-1 focus-visible:ring-primary ${previewTheme === "dark"
                                                            ? "border-neutral-800 text-neutral-200 placeholder-neutral-600 focus-visible:ring-neutral-700"
                                                            : "border-neutral-200 text-neutral-900 placeholder-neutral-450 focus-visible:ring-neutral-300"
                                                            }`}
                                                        style={{
                                                            color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                            borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                        }}
                                                    />
                                                )}

                                                {/* Phone Input */}
                                                {block.type === "phone" && (
                                                    <Input
                                                        type="tel"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        maxLength={10}
                                                        placeholder={block.placeholder || "Enter phone number"}
                                                        className={`h-8 text-xs bg-transparent border focus-visible:ring-1 focus-visible:ring-primary ${previewTheme === "dark"
                                                            ? "border-neutral-800 text-neutral-200 placeholder-neutral-600 focus-visible:ring-neutral-700"
                                                            : "border-neutral-200 text-neutral-900 placeholder-neutral-450 focus-visible:ring-neutral-300"
                                                            }`}
                                                        style={{
                                                            color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                            borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                        }}
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
                                                            input.value = (input.value.slice(0, start) + pasted + input.value.slice(end)).replace(/\D/g, "").slice(0, 10);
                                                        }}
                                                    />
                                                )}

                                                {/* Select Dropdown */}
                                                {block.type === "select" && (
                                                    <Select>
                                                        <SelectTrigger className="h-8 w-full text-xs bg-transparent border focus:ring-1 focus:ring-primary" style={{
                                                            color: previewTheme === "dark" ? "#ffffff" : "#131517",
                                                            borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5"
                                                        }}>
                                                            <SelectValue placeholder="Choose option" />
                                                        </SelectTrigger>
                                                        <SelectContent className={`${previewTheme === "dark" ? "bg-neutral-900 border-neutral-800 text-neutral-200" : ""
                                                            }`}>
                                                            {block.options.map((opt) => (
                                                                <SelectItem key={opt.id} value={opt.value || `opt-${opt.id}`}>
                                                                    {opt.value || "Option"}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}

                                                {/* Checkboxes */}
                                                {block.type === "checkbox" && (
                                                    <div className="flex flex-col gap-2 pt-1">
                                                        {block.options.map((opt) => (
                                                            <div key={opt.id} className="flex items-center space-x-2">
                                                                <Checkbox id={`prev-cb-${opt.id}`} className="h-3.5 w-3.5 animate-none" style={{
                                                                    borderColor: previewTheme === "dark" ? "#404040" : "#d4d4d4"
                                                                }} />
                                                                <label htmlFor={`prev-cb-${opt.id}`} className="text-xs cursor-pointer select-none transition-colors" style={{
                                                                    color: previewTheme === "dark" ? "#a3a3a3" : "#525252"
                                                                }}>
                                                                    {opt.value || "Option"}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Radio Buttons */}
                                                {block.type === "radio" && (
                                                    <div className="flex flex-col gap-2 pt-1">
                                                        {block.options.map((opt) => (
                                                            <div key={opt.id} className="flex items-center space-x-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`prev-radio-${block.id}`}
                                                                    id={`prev-radio-${opt.id}`}
                                                                    className="h-3.5 w-3.5 rounded-full border bg-transparent text-primary accent-primary cursor-pointer focus:ring-primary"
                                                                    style={{
                                                                        borderColor: previewTheme === "dark" ? "#404040" : "#d4d4d4"
                                                                    }}
                                                                />
                                                                <label htmlFor={`prev-radio-${opt.id}`} className="text-xs cursor-pointer select-none transition-colors" style={{
                                                                    color: previewTheme === "dark" ? "#a3a3a3" : "#525252"
                                                                }}>
                                                                    {opt.value || "Option"}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Budget Slider */}
                                                {block.type === "budget" && (
                                                    <div className="pt-1">
                                                        <BudgetSlider
                                                            min={Number(block.options[0]?.value || 1000)}
                                                            max={Number(block.options[1]?.value || 50000)}
                                                            step={Number(block.options[2]?.value || 1000)}
                                                            prefix={block.options[3]?.value || "₹"}
                                                            isDark={previewTheme === "dark"}
                                                        />
                                                    </div>
                                                )}

                                                {/* Projects */}
                                                {block.type === "project" && (
                                                    block.options.length === 0 ? (
                                                        <p className="text-xs" style={{ color: previewTheme === "dark" ? "#737373" : "#a3a3a3" }}>No projects selected yet.</p>
                                                    ) : (
                                                        <Select>
                                                            <SelectTrigger className="h-8 w-full text-xs bg-transparent border" style={{ color: previewTheme === "dark" ? "#ffffff" : "#131517", borderColor: previewTheme === "dark" ? "#2d2d2d" : "#e5e5e5" }}>
                                                                <SelectValue placeholder="Select a project" />
                                                            </SelectTrigger>
                                                            <SelectContent className={previewTheme === "dark" ? "bg-neutral-900 border-neutral-800 text-neutral-200" : ""}>
                                                                {block.options.map((opt) => (
                                                                    <SelectItem key={opt.id} value={opt.value}>
                                                                        {opt.value}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>

                        <CardFooter className="p-4 border-t flex justify-center bg-muted/40 border-neutral-100 dark:border-neutral-800/50 rounded-b-xl">
                            <p className="text-[10px] text-muted-foreground font-medium text-center select-none">
                                Test dynamic behaviors directly in this live preview container.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>

        {/* INTERNAL MODAL — not shown to frontend users */}
        {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowConfirmModal(false)}
                />
                <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
                        <h2 className="text-base font-semibold">What is this form about?</h2>
                        <button
                            type="button"
                            onClick={() => setShowConfirmModal(false)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-muted-foreground mb-4">
                            Describe your form&apos;s purpose so the AI can understand responses, ask the right follow-up questions, and engage leads accurately.
                        </p>
                        <textarea
                            value={projectAbout}
                            onChange={(e) => setProjectAbout(e.target.value)}
                            placeholder="Briefly describe what this project is about..."
                            rows={8}
                            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 px-6 pb-6">
                        <Button variant="outline" type="button" onClick={() => setShowConfirmModal(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleConfirmSubmit} disabled={submitMutation.isPending}>
                            {submitMutation.isPending ? (
                                <>
                                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

function FormBuilderSkeleton() {
    return (
        <div className="@container/main flex w-full flex-col gap-4 md:gap-6 animate-pulse">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800/50" />
                    <div className="h-7 w-56 bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                </div>
                <div className="h-4 w-80 bg-neutral-100 dark:bg-neutral-800/50 rounded-md mt-1" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
                <div className="lg:col-span-7 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-neutral-100 dark:border-neutral-800/50 space-y-3">
                        <div className="h-9 w-full bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                        <div className="h-5 w-3/4 mx-auto bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                    </div>
                    <div className="p-6 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
                                <div className="h-4 w-28 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                                <div className="h-9 w-full bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                            </div>
                        ))}
                    </div>
                    <div className="p-6 border-t border-neutral-100 dark:border-neutral-800/50 flex justify-between">
                        <div className="h-9 w-24 bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                        <div className="h-9 w-28 bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                    </div>
                </div>
                <div className="lg:col-span-3 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-neutral-100 dark:border-neutral-800/50 flex justify-between items-center">
                        <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                        <div className="h-4 w-12 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                    </div>
                    <div className="p-6 space-y-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-800/50 rounded" />
                                <div className="h-8 w-full bg-neutral-100 dark:bg-neutral-800/50 rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<FormBuilderSkeleton />}>
            <FormBuilder />
        </Suspense>
    );
}