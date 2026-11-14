"use client";

/**
 * Small pieces shared by the staff-plan ops pages (/dashboard/hr/*): error text, a modal form that
 * handles its own busy and error state, a pager, org and skill pick-lists, and status badges.
 * The look is the console's own (src/components/crm/ui.tsx); nothing here is new chrome.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { hrPlanApi } from "@/src/api/hr-plan";
import { Badge, Btn, Modal, Notice, inputCls } from "@/src/components/crm/ui";
import { SpinnerIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

/** The words to show for a failed call: the server's message when it sent one. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Cosmetic only: the server refuses writes without `hr-plan.manage` whatever the page shows. */
export const canManage = () => hasPermission("hr-plan.manage");

/** Every staff-plan query starts with "hr", so one call refreshes whatever a change touched. */
export function useRefreshHr() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["hr"] });
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** A query-string value on the page the ops opened (the pages mount only after the console's auth check). */
export function initialParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

/**
 * Renders a modal on the page body. A dialog opened from inside a table cell would otherwise inherit
 * the cell's alignment (the action column is right-aligned) and sit inside a <td>, which is not valid HTML.
 * Only ever rendered after a click, so `document` exists.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
      <SpinnerIcon className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="space-y-3 px-4 py-6">
      <Notice kind="error">{errorText(error)}</Notice>
      {onRetry && (
        <Btn tone="ghost" small onClick={onRetry}>
          Try again
        </Btn>
      )}
    </div>
  );
}

export function Pager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} in all · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Btn tone="ghost" small disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Btn>
        <Btn tone="ghost" small disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Btn>
      </div>
    </div>
  );
}

/** A modal around a form: runs `onSubmit`, shows what the server said when it refuses, and stays open. */
export function FormModal({
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  wide,
  tone = "primary",
  children,
}: {
  title: string;
  onClose: () => void;
  /** Throw (or reject) to keep the modal open with the message; resolve after closing it yourself. */
  onSubmit: () => Promise<unknown>;
  submitLabel?: string;
  wide?: boolean;
  tone?: "primary" | "danger";
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        {children}
        <div className="flex justify-end gap-2 pt-2">
          <Btn tone="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" busy={busy} tone={tone === "danger" ? "danger" : "primary"}>
            {submitLabel}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

export function Select({
  value,
  onChange,
  children,
  disabled,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} ${className}`}
    >
      {children}
    </select>
  );
}

/** Every organization (up to 200), for the filter and the create forms. */
export function useOrgOptions() {
  return useQuery({
    queryKey: ["hr", "orgs", "options"],
    queryFn: () => hrPlanApi.orgs({ limit: 100 }),
    staleTime: 30_000,
  });
}

export function OrgSelect({
  value,
  onChange,
  allLabel,
  className,
}: {
  value: string;
  onChange: (orgId: string) => void;
  /** When set, the first option is "all" with this label. */
  allLabel?: string;
  className?: string;
}) {
  const { data, isLoading } = useOrgOptions();
  return (
    <Select value={value} onChange={onChange} className={className} ariaLabel="Organization">
      {allLabel !== undefined ? (
        <option value="">{allLabel}</option>
      ) : (
        <option value="" disabled>
          {isLoading ? "Loading…" : "Choose an organization"}
        </option>
      )}
      {data?.items.map((o) => (
        <option key={o.orgId} value={o.orgId}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}

export const ROLE_GROUP_LABEL = {
  kitchen: "Kitchen",
  service: "Service",
  housekeeping: "Housekeeping",
} as const;

/** The pick-list of skills (partner sub-categories), marked when no service exists for one. */
export function SkillSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (skillSubcategoryId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["hr", "skills"],
    queryFn: () => hrPlanApi.skills(),
    staleTime: 5 * 60_000,
  });
  return (
    <Select value={value} onChange={onChange} ariaLabel="Skill">
      <option value="" disabled>
        {isLoading ? "Loading…" : "Choose a skill"}
      </option>
      {data?.skills.map((s) => (
        <option key={s.skillSubcategoryId} value={s.skillSubcategoryId}>
          {s.category ? `${s.category}: ` : ""}
          {s.name}
          {s.hasService ? "" : " (no service set up)"}
        </option>
      ))}
    </Select>
  );
}

const TONES: Record<string, string> = {
  // good
  active: "success",
  paid: "success",
  approved: "success",
  verified: "success",
  present: "success",
  on_time: "success",
  done: "success",
  arrived: "success",
  won: "success",
  fine: "success",
  // in motion
  assigned: "primary",
  on_the_way: "primary",
  issued: "primary",
  in_progress: "primary",
  covered: "primary",
  new: "primary",
  // needs a look
  pending: "warning",
  draft: "warning",
  open: "warning",
  late: "warning",
  requested: "warning",
  not_marked: "warning",
  on_leave: "warning",
  contacted: "warning",
  busy: "warning",
  // bad
  overdue: "danger",
  absent: "danger",
  rejected: "danger",
  failed: "danger",
  lost: "danger",
  expired: "danger",
  // neutral
  ended: "muted",
  cancelled: "muted",
  void: "muted",
  off: "muted",
  scheduled: "muted",
  none: "muted",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.replace(/_/g, " ");
  return <Badge tone={TONES[status] ?? "muted"}>{text.charAt(0).toUpperCase() + text.slice(1)}</Badge>;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">{children}</div>;
}
