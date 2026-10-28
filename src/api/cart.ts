/**
 * Customer cart.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";
import { toQueryString } from "./_shared";

/*
 * Guest-friendly cart. The backend uses an OptionalJwtAuthGuard, so for the
 * public storefront we identify the cart purely by a client-generated
 * `sessionId` (no customer login required). All calls skip auth so the
 * admin token is never attached to a shopper's cart.
 */

export interface CartItemData {
  id: number;
  serviceId: number;
  variantId: number | null;
  quantity: number;
  name: string;
  image: string | null;
  price: number;
  total: number;
  variantName: string | null;
}

export interface CartPriceSummary {
  itemTotal?: number;
  platformFee?: number;
  tax?: number;
  discount?: number;
  grandTotal?: number;
}

export interface CartResponse {
  id: number | null;
  items: CartItemData[];
  priceSummary: CartPriceSummary;
}

export interface AddToCartBody {
  serviceId: number;
  quantity?: number;
  variantId?: number;
  sessionId: string;
}

export interface UpdateCartBody {
  serviceId: number;
  variantId?: number | null;
  quantity: number;
  action: "increment" | "decrement";
}

export const cartApi = {
  /** GET /v1/manage-cart/get-cart?sessionId — full cart with price summary.
   *  NOT skipAuth: when a token is present the backend (OptionalJwtAuthGuard)
   *  prioritises the user's cart over the guest sessionId — essential after
   *  login/merge, when the guest cart no longer exists. */
  get: (sessionId: string) =>
    apiClient.get<CartResponse>(
      `/v1/manage-cart/get-cart${toQueryString({ sessionId })}`,
    ),

  /** POST /v1/manage-cart/merge — fold the guest cart (sessionId) into the
   *  logged-in user's cart. Requires the Bearer token (JwtAuthGuard). */
  merge: (sessionId: string) =>
    apiClient.post<{ message: string; cartId?: number }>(
      "/v1/manage-cart/merge",
      { sessionId },
    ),

  /** POST /v1/manage-cart/add — add a service (optionally a variant).
   *  NOT skipAuth: a logged-in user must add to their own cart (resolved via the
   *  token), while guests add to the sessionId cart. Keeps add + get consistent. */
  add: (body: AddToCartBody) =>
    apiClient.post<unknown>("/v1/manage-cart/add", body),

  /** PATCH /v1/manage-cart/update?cartId — change an item's quantity.
   *  NOT skipAuth: like get/add, a logged-in user edits their own cart (resolved
   *  from the token); guests have no token and keep using the session cart. */
  updateQuantity: (cartId: number, body: UpdateCartBody) =>
    apiClient.patch<unknown>(
      `/v1/manage-cart/update${toQueryString({ cartId })}`,
      body,
    ),

  /** DELETE /v1/manage-cart/delete/:cartItemId — remove one line item.
   *  NOT skipAuth, for the same reason as updateQuantity. */
  deleteItem: (cartItemId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/manage-cart/delete/${cartItemId}`,
    ),
};
