"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MyBookingsContent } from "./_content";

// The list itself lives in _content.tsx so the account page can embed it.
// On desktop the account page shows it in its right pane, so "View my bookings"
// links land there instead of on this bare page; phones keep this page.
export default function MyBookingsPage() {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) router.replace("/account?section=orders");
  }, [router]);
  return <MyBookingsContent />;
}
