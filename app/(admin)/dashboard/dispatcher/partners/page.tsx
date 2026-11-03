"use client";

import { ServicePartnersView } from "@/src/components/dashboard/service-partners-view";

/** Dispatcher → Service Partners: the review queue, so it opens on Pending. */
export default function ServicePartnersPage() {
  return <ServicePartnersView initialStatus="PENDING" />;
}
