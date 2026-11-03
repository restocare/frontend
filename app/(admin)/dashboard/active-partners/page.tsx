"use client";

import { ServicePartnersView } from "@/src/components/dashboard/service-partners-view";

/**
 * Active Partners: the roster ops works from — everyone cleared to take a job.
 * Same screen as Dispatcher → Service Partners, opened on the Active tab.
 */
export default function ActivePartnersPage() {
  return <ServicePartnersView initialStatus="ACTIVE" />;
}
