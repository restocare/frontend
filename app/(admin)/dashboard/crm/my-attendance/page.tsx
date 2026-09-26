"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { AttendanceSection } from "@/src/components/crm/portal";

export default function MyAttendancePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle="Geofenced check-in — you must be within your office radius (default 100 m)."
      />
      <AttendanceSection />
    </div>
  );
}
