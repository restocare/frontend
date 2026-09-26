"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { IncrementsSection } from "@/src/components/crm/portal";

export default function MyIncrementsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Increments" subtitle="Appraisal outcomes and your salary trend." />
      <IncrementsSection />
    </div>
  );
}
