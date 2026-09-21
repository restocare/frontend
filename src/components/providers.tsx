"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "@/src/lib/theme";
import { CartProvider } from "@/src/lib/cart";
import { ProductCartProvider } from "@/src/lib/product-cart";
import { CustomerAuthProvider } from "@/src/lib/customer-auth";
import { CartLayer } from "@/src/components/cart/cart-layer";
import { BookingFlowSync } from "@/src/components/booking-flow-sync";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <ProductCartProvider>
              {children}
              <CartLayer />
              <BookingFlowSync />
            </ProductCartProvider>
          </CartProvider>
        </CustomerAuthProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
