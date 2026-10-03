"use client";

import { useMemo, useState } from "react";
import type { ImportChange, ImportEntity, ImportIssue, ImportResult } from "@/src/api/api";
import { CloseIcon, SpinnerIcon } from "@/src/components/icons";

const ENTITY_LABELS: Record<ImportEntity, string> = {
  categories: "Categories",
  subcategories: "Sub-categories",
  services: "Services",
  variants: "Variants",
  vendors: "Vendors",
};

const CHANGE_ENTITY: Record<ImportChange["entity"], string> = {
  category: "Category",
  subcategory: "Sub-category",
  service: "Service",
  variant: "Variant",
  vendor: "Vendor",
};

interface ImportPreviewModalProps {
  fileName: string;
  /** The dry-run result, then the real one after confirming. */
  result: ImportResult;
  /** Set while the real import runs. */
  importing: boolean;
  /** The real import's failure, shown above the actions. */
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function issueWhere(issue: ImportIssue): string {
  if (!issue.row) return "File";
  return `${issue.sheet ? `${issue.sheet} ` : ""}row ${issue.row}`;
}

/**
 * What an Excel import will do, before it does it: counts per kind, every
 * row error with its sheet and row number, warnings, and the list of
 * changes. Nothing is written until the admin confirms; afterwards the same
 * modal shows what was imported.
 */
export function ImportPreviewModal({
  fileName,
  result,
  importing,
  error,
  onConfirm,
  onClose,
}: ImportPreviewModalProps) {
  const [tab, setTab] = useState<"changes" | "errors" | "warnings">(
    result.errors.length ? "errors" : "changes",
  );
  const done = result.dryRun === false;
  const total = result.totalChanges ?? result.changes?.length ?? result.imported;
  const warnings = result.warnings ?? [];
  const changes = result.changes ?? [];
  const summaryRows = useMemo(
    () =>
      result.summary
        ? (Object.keys(ENTITY_LABELS) as ImportEntity[])
            .map((k) => ({ key: k, ...result.summary![k] }))
            .filter((r) => r.create || r.update)
        : [],
    [result.summary],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={importing ? undefined : onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-preview-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="import-preview-title" className="text-lg font-semibold text-foreground">
              {done ? "Import finished" : "Import preview"}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{fileName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p
            className={`rounded-lg border px-4 py-2.5 text-sm ${
              done
                ? "border-success/30 bg-success/10 text-success"
                : total > 0
                  ? "border-border bg-muted/40 text-foreground"
                  : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {result.message}
            {!done && total > 0 ? ". Nothing is saved until you confirm." : ""}
          </p>

          {summaryRows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 font-medium">Kind</th>
                  <th className="py-1.5 text-right font-medium">New</th>
                  <th className="py-1.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-1.5 text-foreground">{ENTITY_LABELS[r.key]}</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{r.create}</td>
                    <td className="py-1.5 text-right tabular-nums text-foreground">{r.update}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex gap-1 border-b border-border" role="tablist">
            {(
              [
                ["changes", `Changes (${total})`],
                ["errors", `Errors (${result.errors.length})`],
                ["warnings", `Warnings (${warnings.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                } ${key === "errors" && result.errors.length ? "text-danger" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "changes" &&
            (changes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No changes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {changes.map((c, i) => (
                      <tr key={`${c.sheet}-${c.row}-${i}`} className="border-t border-border first:border-t-0">
                        <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-muted-foreground">
                          {c.sheet} {c.row}
                        </td>
                        <td className="py-1.5 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              c.action === "create" ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
                            }`}
                          >
                            {c.action === "create" ? "New" : "Update"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-muted-foreground">{CHANGE_ENTITY[c.entity]}</td>
                        <td className="py-1.5 text-foreground">{c.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total > changes.length ? (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Showing the first {changes.length} of {total} changes.
                  </p>
                ) : null}
              </div>
            ))}

          {tab === "errors" &&
            (result.errors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No errors.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  These rows are skipped; the rest {done ? "were" : "will be"} imported. Fix them in the file and
                  import it again: rows already imported are updated, not duplicated.
                </p>
                <IssueList issues={result.errors} tone="danger" />
              </>
            ))}

          {tab === "warnings" &&
            (warnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No warnings.</p>
            ) : (
              <IssueList issues={warnings} tone="muted" />
            ))}

          {error && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={importing || total === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {importing && <SpinnerIcon className="h-4 w-4" />}
              {importing ? "Importing…" : `Import ${total} change${total === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueList({ issues, tone }: { issues: ImportIssue[]; tone: "danger" | "muted" }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {issues.map((issue, i) => (
        <li key={i} className="flex gap-3 px-3 py-2 text-sm">
          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{issueWhere(issue)}</span>
          <span className={tone === "danger" ? "text-danger" : "text-foreground"}>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
