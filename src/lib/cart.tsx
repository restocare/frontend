"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cartApi,
  queryKeys,
  type CartItemData,
  type CartResponse,
} from "@/src/api/api";
import { trackEvent } from "@/lib/meta";

const SESSION_KEY = "rc_cart_session";
const noopSubscribe = () => () => {};

/** A service the user is trying to add — carries its variants so the cart
 *  layer can decide whether to prompt for a variant first. */
export interface AddCandidate {
  serviceId: number;
  name: string;
  price: number | null;
  profileImage: string | null;
  /** Whether this service's category uses the date + shift booking flow.
   *  When false, picking a variant adds straight to the cart (no slot step). */
  useSlots: boolean;
  variants: {
    variantId: number;
    name: string;
    price: number;
    profileImage: string | null;
  }[];
}

interface CartContextValue {
  sessionId: string;
  cart: CartResponse | undefined;
  count: number;
  isLoading: boolean;
  isMutating: boolean;
  /** Variant-selection modal target (null = closed). */
  variantTarget: AddCandidate | null;
  /** Mini-cart popup visibility. */
  miniOpen: boolean;
  /** Decide: prompt for a variant, or add straight away. */
  requestAdd: (candidate: AddCandidate) => void;
  /** Commit an add once a variant (if any) is chosen. */
  confirmAdd: (serviceId: number, variantId?: number) => void;
  /** Add an item and resolve when the cart is refreshed (no mini-cart popup).
   *  Used by the booking flow before navigating to checkout. */
  addItemAsync: (serviceId: number, variantId?: number) => Promise<void>;
  closeVariant: () => void;
  openMini: () => void;
  closeMini: () => void;
  updateQuantity: (item: CartItemData, action: "increment" | "decrement") => void;
  removeItem: (cartItemId: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Stable per-browser guest id. Lazily created on the client only.
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      let s = window.localStorage.getItem(SESSION_KEY);
      if (!s) {
        s =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `sess_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
        window.localStorage.setItem(SESSION_KEY, s);
      }
      return s;
    } catch {
      return "";
    }
  });

  const [variantTarget, setVariantTarget] = useState<AddCandidate | null>(null);
  const [miniOpen, setMiniOpen] = useState(false);

  // false on the server and during hydration, true afterwards. The session id
  // is browser-only, so the server renders "loading" and the client's first
  // paint must match it instead of jumping straight to "empty cart".
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const { data: cart, isLoading } = useQuery({
    queryKey: queryKeys.cart(sessionId),
    queryFn: () => cartApi.get(sessionId),
    enabled: !!sessionId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.cart(sessionId) });

  const addMutation = useMutation({
    mutationFn: (vars: { serviceId: number; variantId?: number }) =>
      cartApi.add({
        serviceId: vars.serviceId,
        variantId: vars.variantId,
        quantity: 1,
        sessionId,
      }),
    onSuccess: (_data, vars) => {
      // A service "Book" click that reached the cart. The cart modal that
      // follows is the checkout funnel's first step.
      trackEvent("AddToCart", {
        content_ids: [String(vars.serviceId)],
        content_type: "product",
        currency: "INR",
      });
      invalidate();
      setVariantTarget(null);
      setMiniOpen(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: CartItemData;
      action: "increment" | "decrement";
    }) =>
      cartApi.updateQuantity(cart?.id as number, {
        serviceId: item.serviceId,
        variantId: item.variantId ?? undefined,
        quantity: action === "increment" ? item.quantity + 1 : item.quantity - 1,
        action,
      }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (cartItemId: number) => cartApi.deleteItem(cartItemId),
    onSuccess: invalidate,
  });

  const value = useMemo<CartContextValue>(() => {
    const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
    return {
      sessionId,
      cart,
      count,
      isLoading: !hydrated || isLoading,
      isMutating: addMutation.isPending,
      variantTarget,
      miniOpen,
      requestAdd: (candidate) => {
        if (candidate.variants.length > 0) {
          setVariantTarget(candidate);
        } else {
          addMutation.mutate({ serviceId: candidate.serviceId });
        }
      },
      confirmAdd: (serviceId, variantId) =>
        addMutation.mutate({ serviceId, variantId }),
      addItemAsync: async (serviceId, variantId) => {
        await cartApi.add({ serviceId, variantId, quantity: 1, sessionId });
        trackEvent("AddToCart", {
          content_ids: [String(serviceId)],
          content_type: "product",
          currency: "INR",
        });
        await invalidate();
      },
      closeVariant: () => setVariantTarget(null),
      openMini: () => setMiniOpen(true),
      closeMini: () => setMiniOpen(false),
      updateQuantity: (item, action) => updateMutation.mutate({ item, action }),
      removeItem: (cartItemId) => removeMutation.mutate(cartItemId),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    cart,
    hydrated,
    isLoading,
    variantTarget,
    miniOpen,
    addMutation.isPending,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
