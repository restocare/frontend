"use client";

import { BookingsView } from "@/src/components/dashboard/bookings-view";

// Both this route and /dashboard/crm/bookings render the same component so the
// two tabs can never drift apart again.
export default function BookingsPage() {
  return <BookingsView />;
}
