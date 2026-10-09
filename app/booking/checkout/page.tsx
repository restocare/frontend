import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CATEGORY_FLOW } from "@/src/lib/category-flow";
import { CategoryCheckout } from "@/src/components/category-flow-v2/checkout-page";

/**
 * Checkout of the new category flow: /booking/checkout?category=ID.
 * A static segment, so it wins over /booking/[serviceId]. Only on
 * NEXT_PUBLIC_RC_CATEGORY_FLOW=2; flow 1 keeps using the cart wizard.
 */
export default async function CategoryCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  if (CATEGORY_FLOW !== 2) {
    const { category } = await searchParams;
    redirect(category ? `/booking/cart?category=${encodeURIComponent(category)}` : "/");
  }
  return (
    <Suspense fallback={null}>
      <CategoryCheckout />
    </Suspense>
  );
}
