"use client";

import { BookingsView } from "@/src/components/dashboard/bookings-view";

// Identical to /dashboard/bookings by construction — same component, same data,
// same columns. Previously this tab had its own table and API, so bookings
// looked different inside CRM than outside it.
export default function CrmBookingsPage() {
  return <BookingsView />;
}
