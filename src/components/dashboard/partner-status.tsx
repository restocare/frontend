import type { PartnerOnboardingStatus } from "@/src/api/api";

// Presentation config for each onboarding bucket — shared by the partners
// list, the detail page and the status tabs so labels/colours stay consistent.
export const ONBOARDING_STATUS_META: Record<
  PartnerOnboardingStatus,
  { label: string; badge: string; dot: string; border: string }
> = {
  PENDING: {
    label: "Pending review",
    badge: "bg-warning/10 text-warning",
    dot: "bg-warning",
    border: "border-warning/40",
  },
  VERIFIED: {
    label: "Verified",
    badge: "bg-primary/10 text-primary",
    dot: "bg-primary",
    border: "border-primary/40",
  },
  ACTIVE: {
    label: "Active",
    badge: "bg-success/10 text-success",
    dot: "bg-success",
    border: "border-success/40",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-danger/10 text-danger",
    dot: "bg-danger",
    border: "border-danger/40",
  },
  MANUAL_IMPORTED: {
    label: "Imported",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    border: "border-border",
  },
};

export function PartnerStatusBadge({ status }: { status: PartnerOnboardingStatus }) {
  const meta = ONBOARDING_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
