"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { PositionsSection } from "@/src/components/crm/portal";

export default function MyPositionsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Open positions" subtitle="Internal openings — refer or apply through HR." />
      <PositionsSection />
    </div>
  );
}
