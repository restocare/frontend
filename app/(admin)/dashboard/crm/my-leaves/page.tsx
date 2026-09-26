"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { LeavesSection } from "@/src/components/crm/portal";

export default function MyLeavesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="My Leaves" subtitle="Your balances and leave requests." />
      <LeavesSection />
    </div>
  );
}
