"use client";

import { Suspense } from "react";
import { CartWizard } from "@/src/components/booking-v2/cart-wizard";

/**
 * Checkout for a multi-item cart (Deep Cleaning on flow 2):
 * /booking/cart?category=ID[&step=address|review]. A static segment, so it
 * wins over /booking/[serviceId].
 */
export default function CartBookingPage() {
  return (
    <Suspense fallback={null}>
      <CartWizard />
    </Suspense>
  );
}
