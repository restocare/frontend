"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { HolidaysSection } from "@/src/components/crm/portal";

export default function MyHolidaysPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Holidays" subtitle="Company holiday calendar for the year." />
      <HolidaysSection />
    </div>
  );
}
