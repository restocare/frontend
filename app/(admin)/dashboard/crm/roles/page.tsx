"use client";

import { PageHeader } from "@/src/components/crm/ui";
import { RolesPermissionsPanel } from "@/src/components/crm/roles-permissions";

export default function CrmRolesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage module access and permission levels per role."
      />
      <RolesPermissionsPanel />
    </div>
  );
}
