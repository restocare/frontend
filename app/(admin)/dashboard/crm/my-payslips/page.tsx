"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { PayslipsSection } from "@/src/components/crm/portal";

export default function MyPayslipsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Payslips" subtitle="Published salary slips — view or print any month." />
      <PayslipsSection />
    </div>
  );
}
