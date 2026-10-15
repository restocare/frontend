"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  marketingLeadKeys,
  marketingLeadsApi,
  type LeadMasterRow,
  type LeadMasterType,
} from "@/src/api/api";
import {
  Btn,
  Card,
  Field,
  inputCls,
  Modal,
  Notice,
  PageHeader,
  Tabs,
} from "@/src/components/crm/ui";
import { PencilIcon, PlusIcon, TrashIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const TABS: { key: LeadMasterType; label: string }[] = [
  { key: "platforms", label: "Lead platforms" },
  { key: "staff-categories", label: "Staff requirements" },
  { key: "callers", label: "Callers" },
  { key: "call-statuses", label: "Call statuses" },
];

const errMsg = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

export default function LeadSettingsPage() {
  const [tab, setTab] = useState<LeadMasterType>("platforms");
  const canMasters = hasPermission("marketing-leads.masters");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Lead settings"
        subtitle="The add-on lists behind the Leads page — platforms, staff requirements, callers and call statuses"
        action={
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Back to leads
          </Link>
        }
      />
      {!canMasters && (
        <Notice kind="error">
          You can view these lists, but editing needs the marketing-leads.masters permission.
        </Notice>
      )}
      <Tabs
        tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
        active={tab}
        onChange={(k) => setTab(k as LeadMasterType)}
      />
      <MasterList key={tab} type={tab} canEdit={canMasters} />
    </div>
  );
}

function MasterList({ type, canEdit }: { type: LeadMasterType; canEdit: boolean }) {
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeadMasterRow | null>(null);
  const [addUnder, setAddUnder] = useState<LeadMasterRow | null>(null); // staff sub-type target
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);

  const isTree = type === "staff-categories";
  const hasColor = type === "call-statuses";

  const { data, isLoading, error } = useQuery({
    queryKey: marketingLeadKeys.masters(type),
    queryFn: () => marketingLeadsApi.masters.list(type),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: marketingLeadKeys.masters(type) });
    qc.invalidateQueries({ queryKey: ["marketing-leads", "list"] });
  };

  const onError = (e: unknown, fallback: string) => {
    setNotice(null);
    setErr(errMsg(e, fallback));
  };

  const toggle = useMutation({
    mutationFn: (id: number) => marketingLeadsApi.masters.toggle(type, id),
    onSuccess: () => {
      setErr(null);
      refresh();
    },
    onError: (e) => onError(e, "Could not update the entry."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => marketingLeadsApi.masters.remove(type, id),
    onSuccess: () => {
      setErr(null);
      setNotice("Entry deleted.");
      refresh();
    },
    onError: (e) => onError(e, "Could not delete the entry."),
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => marketingLeadsApi.masters.reorder(type, ids),
    onSuccess: () => refresh(),
    onError: (e) => onError(e, "Could not save the new order."),
  });

  /** Drag-reorder within one level (main categories, or one list). */
  const onDrop = (targetId: number, siblings: LeadMasterRow[]) => (e: DragEvent) => {
    e.preventDefault();
    if (dragId == null || dragId === targetId) return;
    const ids = siblings.map((r) => r.id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    ids.splice(at < 0 ? ids.length : at, 0, dragId);
    setDragId(null);
    reorder.mutate(ids);
  };

  const row = (r: LeadMasterRow, siblings: LeadMasterRow[], depth = 0) => (
    <div
      key={r.id}
      draggable={canEdit}
      onDragStart={() => setDragId(r.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop(r.id, siblings)}
      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${depth ? "ml-8 border-l border-border" : ""} ${
        dragId === r.id ? "opacity-50" : ""
      }`}
    >
      {canEdit && (
        <span className="cursor-grab select-none text-muted-foreground" title="Drag to reorder">
          ⠿
        </span>
      )}
      {hasColor && (
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-border"
          style={r.color ? { backgroundColor: r.color } : undefined}
          title={r.color ?? "No colour"}
        />
      )}
      <span className={`min-w-0 flex-1 truncate text-sm ${r.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}>
        {r.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {r.usage} lead{r.usage === 1 ? "" : "s"}
      </span>
      {canEdit && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={r.isActive}
              onChange={() => toggle.mutate(r.id)}
            />
            Active
          </label>
          {isTree && depth === 0 && (
            <Btn small tone="ghost" onClick={() => setAddUnder(r)}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add sub-type
            </Btn>
          )}
          <button
            type="button"
            onClick={() => setEditing(r)}
            title="Edit"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={r.usage > 0}
            onClick={() => {
              if (window.confirm(`Delete "${r.name}"?`)) remove.mutate(r.id);
            }}
            title={
              r.usage > 0
                ? "In use by leads — deactivate it instead of deleting"
                : "Delete"
            }
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      {canEdit && (
        <Btn
          onClick={() => {
            setNotice(null);
            setErr(null);
            setAdding(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          Add entry
        </Btn>
      )}
      <Card>
        <div className="divide-y divide-border">
          {isLoading && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!isLoading && !data?.length && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing here yet — add the first entry.
            </p>
          )}
          {(data ?? []).map((r) => (
            <div key={r.id}>
              {row(r, data ?? [])}
              {(r.children ?? []).map((sub) => row(sub, r.children ?? [], 1))}
            </div>
          ))}
        </div>
      </Card>

      {(adding || editing || addUnder) && (
        <MasterFormModal
          type={type}
          entry={editing}
          parent={addUnder}
          mains={isTree ? (data ?? []) : []}
          hasColor={hasColor}
          onClose={() => {
            setAdding(false);
            setEditing(null);
            setAddUnder(null);
          }}
          onSaved={(name, created) => {
            setAdding(false);
            setEditing(null);
            setAddUnder(null);
            setErr(null);
            setNotice(`“${name}” ${created ? "added" : "updated"}.`);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MasterFormModal({
  type,
  entry,
  parent,
  mains,
  hasColor,
  onClose,
  onSaved,
}: {
  type: LeadMasterType;
  entry: LeadMasterRow | null;
  parent: LeadMasterRow | null;
  mains: LeadMasterRow[];
  hasColor: boolean;
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const isTree = type === "staff-categories";
  const [name, setName] = useState(entry?.name ?? "");
  const [parentId, setParentId] = useState(
    entry?.parentId != null ? String(entry.parentId) : parent ? String(parent.id) : "",
  );
  const [color, setColor] = useState(entry?.color ?? "");
  const [err, setErr] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        ...(isTree && parentId ? { parentId: Number(parentId) } : {}),
        ...(hasColor && color ? { color } : {}),
      };
      return entry
        ? marketingLeadsApi.masters.update(type, entry.id, body)
        : marketingLeadsApi.masters.create(type, body);
    },
    onSuccess: (row) => onSaved(row.name, !entry),
    onError: (e) => setErr(errMsg(e, "Could not save the entry.")),
  });

  return (
    <Modal
      title={entry ? `Edit “${entry.name}”` : parent ? `Add sub-type under ${parent.name}` : "Add entry"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          if (!name.trim()) return setErr("Name is required.");
          save.mutate();
        }}
      >
        {err && <Notice kind="error">{err}</Notice>}
        <Field label="Name *">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        {isTree && !entry && (
          <Field label="Parent category">
            <select
              className={inputCls}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None — main category</option>
              {mains.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {hasColor && (
          <Field label="Badge colour">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color || "#6b7280"}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
              />
              {color && (
                <Btn small tone="ghost" onClick={() => setColor("")}>
                  Clear
                </Btn>
              )}
            </div>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={save.isPending}>
            {entry ? "Save changes" : "Add"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
