"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { useCart } from "@/src/lib/cart";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import {
  getBookingSchedule,
  removeBookingSchedule,
  saveBookingSchedule,
} from "@/src/lib/booking-schedules";
import {
  buildShiftSlots,
  getNextDays,
  parseVariantShift,
} from "@/src/lib/booking-shifts";
import {
  bookingApi,
  couponsApi,
  paymentsApi,
  userApi,
  type CartItemData,
  type CreateBookingPayload,
  type CustomerCoupon,
  type UserAddress,
} from "@/src/api/api";
import {
  SpinnerIcon,
  CloseIcon,
  TrashIcon,
  PencilIcon,
} from "@/src/components/icons";
import { GOOGLE_MAPS_API_KEY } from "@/src/lib/maps";

function inr(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

const PAYMENT_LABELS = {
  COD: "Cash on Delivery (COD)",
  RAZORPAY: "Razorpay (Online)",
} as const;
type PaymentMode = keyof typeof PAYMENT_LABELS;

/** Lazily inject the Razorpay checkout script. */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface GeocodeResult {
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

const EMPTY_GEOCODE: GeocodeResult = {
  address: "",
  city: "",
  state: "",
  country: "India",
  zipCode: "",
};

/** Precise reverse geocoding via the Google Maps Geocoding API (full address
 *  components), matching the customer app. Returns null so the caller can fall
 *  back to a key-less provider. */
async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
    );
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const best = data.results[0];
    const comps = best.address_components ?? [];
    const pick = (type: string) =>
      comps.find((c) => c.types.includes(type))?.long_name ?? "";
    const city =
      pick("locality") ||
      pick("postal_town") ||
      pick("sublocality") ||
      pick("administrative_area_level_2");
    return {
      address: best.formatted_address ?? "",
      city,
      state: pick("administrative_area_level_1"),
      country: pick("country") || "India",
      zipCode: pick("postal_code"),
    };
  } catch {
    return null;
  }
}

/** OpenStreetMap (Nominatim) reverse geocoder — free, key-less, returns the full
 *  street-level address (display_name) like Google Maps. Used when the Google
 *  Geocoding API is unavailable (e.g. the key has it disabled). */
async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
        postcode?: string;
      };
    };
    const a = d.address ?? {};
    const city = a.city || a.town || a.village || a.suburb || a.county || "";
    if (!d.display_name && !city) return null;
    return {
      address:
        d.display_name || [a.road, a.suburb, city].filter(Boolean).join(", "),
      city,
      state: a.state || "",
      country: a.country || "India",
      zipCode: a.postcode || "",
    };
  } catch {
    return null;
  }
}

/** Reverse geocode to a full, precise address. Google first (if its Geocoding
 *  API is enabled), then OpenStreetMap, then the coarse BigDataCloud fallback. */
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult> {
  const google = await reverseGeocodeGoogle(lat, lng);
  if (google && google.address) return google;

  const osm = await reverseGeocodeNominatim(lat, lng);
  if (osm && osm.address) return osm;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    const d = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
      postcode?: string;
    };
    const city = d.city || d.locality || "";
    return {
      address: [d.locality, city].filter(Boolean).join(", ") || "",
      city,
      state: d.principalSubdivision || "",
      country: d.countryName || "India",
      zipCode: d.postcode || "",
    };
  } catch {
    return EMPTY_GEOCODE;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoggedIn, isHydrating } = useCustomerAuth();
  const { cart, isLoading, removeItem } = useCart();

  const cartItems: CartItemData[] = useMemo(() => cart?.items ?? [], [cart]);

  // Address form state
  const [addressLabel, setAddressLabel] = useState("Home");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("India");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Business details captured before checkout (shown on the GST invoice).
  const [ownerName, setOwnerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  // Prefill from the logged-in customer's profile once it hydrates.
  useEffect(() => {
    if (!user) return;
    setOwnerName((v) => v || String(user.name ?? ""));
    setRestaurantName((v) => v || String(user.restaurantName ?? ""));
    setGstNumber((v) => v || String(user.gstNumber ?? ""));
  }, [user]);

  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Modals
  const [addressModal, setAddressModal] = useState(false);
  const [slotModalFor, setSlotModalFor] = useState<CartItemData | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);

  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🎟️ Coupons — the same /v1/coupons endpoints the mobile app uses.
  const [myCoupons, setMyCoupons] = useState<CustomerCoupon[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CustomerCoupon | null>(
    null,
  );
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const summary = cart?.priceSummary ?? {};
  // The coupon is single-use, so it rides on ONE booking — the priciest item —
  // exactly as the server redeems it. Discount is that item × the coupon %.
  const cartItems2 = cart?.items ?? [];
  const couponTarget = appliedCoupon
    ? [...cartItems2].sort(
        (a, b) => (b.total || b.price) - (a.total || a.price),
      )[0]
    : undefined;
  // A FLAT_TOTAL coupon fixes the whole bill (e.g. ₹1) whatever the service
  // costs, so the saving is the remainder rather than a percentage of one line.
  const isFlatCoupon =
    appliedCoupon?.discountType === "FLAT_TOTAL" &&
    appliedCoupon.flatTotal != null;
  // Mirror the customer app: the payable amount is item total + GST, less the
  // coupon — nothing else. The cart API also returns a `discount` and a
  // `grandTotal` with it already taken off, but no booking honours that
  // discount (each bills its own price + GST), so building on it showed — and
  // collected online — less than the bookings actually charge.
  const cartGrandTotal = (summary.itemTotal ?? 0) + (summary.tax ?? 0);
  const couponBaseDiscount =
    appliedCoupon && couponTarget && !isFlatCoupon
      ? Math.round(
          (couponTarget.total || couponTarget.price) *
            (appliedCoupon.discountPercent / 100) *
            100,
        ) / 100
      : 0;
  // What the customer saves is GST-inclusive — the same maths the app shows.
  const couponSaving = isFlatCoupon
    ? Math.max(
        0,
        Math.round(
          (cartGrandTotal - (appliedCoupon!.flatTotal as number)) * 100,
        ) / 100,
      )
    : Math.round(couponBaseDiscount * 1.18 * 100) / 100;
  const grandTotal = Math.max(
    0,
    Math.round((cartGrandTotal - couponSaving) * 100) / 100,
  );
  // Some coupons are funded by the platform and only offered when the money is
  // collected up front. Caught here so the customer is told before they try to
  // book, rather than by the server refusing the booking afterwards.
  const couponNeedsPrepay =
    !!appliedCoupon?.prepaidOnly && paymentMode === "COD";

  useEffect(() => {
    if (!user) return;
    couponsApi
      .list()
      .then((list) => {
        setMyCoupons(list);
        const applied = list.find((c) => c.isApplied);
        if (applied) setAppliedCoupon(applied);
      })
      .catch(() => setMyCoupons([]));
  }, [user]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const applied = await couponsApi.apply(trimmed);
      setAppliedCoupon(applied);
      setCouponInput("");
    } catch (e) {
      setCouponError(
        e instanceof Error ? e.message : "Could not apply the coupon.",
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = async () => {
    if (!appliedCoupon) return;
    setCouponBusy(true);
    try {
      await couponsApi.remove(appliedCoupon.couponId);
    } catch {
      // Deselecting is best-effort; the booking simply won't carry the code.
    } finally {
      setAppliedCoupon(null);
      setCouponBusy(false);
    }
  };

  const fetchAddresses = async (userId: string | number) => {
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      const res = (await userApi.getAddresses(userId)) as
        { data?: UserAddress[]; addresses?: UserAddress[] } | UserAddress[];
      const list = Array.isArray(res)
        ? res
        : (res?.data ?? res?.addresses ?? []);
      setSavedAddresses(Array.isArray(list) ? list : []);
    } catch (e) {
      setAddressesError(
        e instanceof Error ? e.message : "Unable to load saved addresses.",
      );
      setSavedAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  const applyAddress = (a: UserAddress, key?: string) => {
    setSelectedAddressId(key ?? String(a.id ?? a.addressId ?? a.label));
    setAddress(a.address);
    setCity(a.city);
    setAddressLabel(a.label);
    setStateName(a.state ?? "");
    setZipCode(a.zipCode ?? "");
    setCountry(a.country ?? "India");
    setLatitude(a.latitude != null ? String(a.latitude) : "");
    setLongitude(a.longitude != null ? String(a.longitude) : "");
  };

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAddressesError("Geolocation is not supported in this browser.");
      return;
    }
    setIsLocating(true);
    setAddressesError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        setLatitude(String(lat));
        setLongitude(String(lng));
        setAddress(geo.address);
        setCity(geo.city);
        setStateName(geo.state);
        setCountry(geo.country);
        setZipCode(geo.zipCode);
        setIsLocating(false);
      },
      (err) => {
        setAddressesError(
          err.message || "Unable to fetch your current location.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleSaveAddress = async () => {
    if (!isLoggedIn || !user?.id) {
      router.push("/account/login?redirect=/checkout");
      return;
    }
    if (!address.trim() || !city.trim()) {
      setAddressesError("Address and city are required to save.");
      return;
    }
    setIsSavingAddress(true);
    setAddressesError(null);
    try {
      await userApi.addAddress(user.id, {
        label: addressLabel.trim() || "Home",
        address: address.trim(),
        city: city.trim(),
        zipCode: zipCode.trim(),
        state: stateName.trim(),
        country: country.trim(),
        latitude: Number(latitude) || undefined,
        longitude: Number(longitude) || undefined,
        isDefault: true,
      });
      await fetchAddresses(user.id);
      setAddressModal(false);
    } catch (e) {
      setAddressesError(
        e instanceof Error ? e.message : "Unable to save address.",
      );
    } finally {
      setIsSavingAddress(false);
    }
  };

  const openAddressModal = () => {
    if (!isLoggedIn || !user?.id) {
      router.push("/account/login?redirect=/checkout");
      return;
    }
    setAddressModal(true);
    fetchAddresses(user.id);
  };

  // Auto-detect the current location to prefill the delivery address when none
  // is selected yet — runs once when the cart has items and no address is set.
  const [autoLocated, setAutoLocated] = useState(false);
  useEffect(() => {
    if (autoLocated) return;
    if (cartItems.length === 0) return;
    if (selectedAddressId || address) return; // already have an address
    setAutoLocated(true);
    useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocated, cartItems.length, selectedAddressId, address]);

  const buildPayloads = (mode: PaymentMode): CreateBookingPayload[] => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const now = new Date();
    const fallbackDate = now.toISOString().slice(0, 10);
    const fallbackTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;

    return cartItems.map((item) => {
      const sched = getBookingSchedule(item.serviceId, item.variantId);
      // The server expects the PRE-TAX, post-discount amount plus the code on
      // the one booking that redeems the coupon; it reconstructs the list
      // price and reimburses the partner from the percentage.
      const discounted =
        appliedCoupon && couponTarget && item.id === couponTarget.id;
      const base = item.total || item.price;
      return {
        userId: Number(user?.id),
        professionalId: null,
        serviceId: item.serviceId,
        variantId: item.variantId ?? null,
        bookingDate: sched?.date || fallbackDate,
        startTime: sched?.startTime || fallbackTime,
        // A flat coupon has no per-line share to compute — the server prices
        // those from the booking itself and ignores this figure.
        totalAmount:
          discounted && !isFlatCoupon
            ? Math.round((base - couponBaseDiscount) * 100) / 100
            : base,
        serviceLat: lat,
        serviceLng: lng,
        serviceCity: city.trim(),
        serviceAddress: address.trim(),
        paymentMode: mode,
        ...(discounted ? { couponCode: appliedCoupon.code } : {}),
      };
    });
  };

  const clearCartAndSchedules = async () => {
    for (const item of cartItems) {
      removeBookingSchedule(item.serviceId, item.variantId);
      removeItem(item.id);
    }
  };

  const submitBookings = async (payloads: CreateBookingPayload[]) => {
    for (const p of payloads) {
      await bookingApi.create(p);
    }
    await clearCartAndSchedules();
    setSuccess(true);
    setTimeout(() => router.push("/"), 2200);
  };

  const payWithRazorpayThenBook = async (payloads: CreateBookingPayload[]) => {
    const ok = await loadRazorpay();
    if (!ok)
      throw new Error("Could not load the payment gateway. Please try again.");

    const order = await paymentsApi.createOrder(
      grandTotal || payloads.reduce((s, p) => s + p.totalAmount, 0),
      "INR",
    );
    if (!order?.id || !order?.keyId) {
      throw new Error("Could not start the payment. Please try again.");
    }

    const checkoutResult = await new Promise<{
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "RestoCare",
        description: cartItems[0]?.name ?? "Service booking",
        prefill: {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.mobile ?? user?.phone ?? undefined,
        },
        theme: { color: "#ea580c" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: (resp: any) => resolve(resp),
        modal: { ondismiss: () => reject(new Error("Payment was cancelled.")) },
      });
      rzp.open();
    });

    const verification = await paymentsApi.verify({
      razorpay_payment_id: checkoutResult.razorpay_payment_id,
      razorpay_order_id: checkoutResult.razorpay_order_id,
      razorpay_signature: checkoutResult.razorpay_signature,
    });
    if (!verification?.success) {
      throw new Error(
        verification?.message ?? "Payment could not be verified.",
      );
    }

    await submitBookings(payloads);
  };

  const handlePlaceOrder = async () => {
    setError(null);
    if (!isLoggedIn || !user?.id) {
      router.push("/account/login?redirect=/checkout");
      return;
    }
    if (cartItems.length === 0) return;
    if (!address.trim() || !city.trim()) {
      setError("Please add a delivery address.");
      setAddressModal(true);
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) {
      setError(
        "Location coordinates are invalid. Use 'Current location' in the address form.",
      );
      setAddressModal(true);
      return;
    }
    const owner = ownerName.trim();
    const restaurant = restaurantName.trim();
    const gst = gstNumber.trim(); // optional
    if (!owner || !restaurant) {
      setError("Please fill your owner name and restaurant name.");
      return;
    }
    if (!paymentMode) {
      setError("Please select a payment method.");
      setPaymentModal(true);
      return;
    }
    if (couponNeedsPrepay) {
      setError(
        `Coupon ${appliedCoupon?.code} only works with online payment. Switch to Razorpay, or remove the coupon.`,
      );
      setPaymentModal(true);
      return;
    }

    setIsPlacing(true);
    try {
      // Persist the business details to the customer's profile so they appear
      // on the invoice and in the admin dashboard.
      await userApi.updateProfile(user.id, {
        name: owner,
        restaurantName: restaurant,
        ...(gst ? { gstNumber: gst } : {}),
      });
      const payloads = buildPayloads(paymentMode);
      if (paymentMode === "RAZORPAY") {
        await payWithRazorpayThenBook(payloads);
      } else {
        await submitBookings(payloads);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Booking failed. Please try again.",
      );
    } finally {
      setIsPlacing(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  if (isHydrating || isLoading) {
    return (
      <div data-theme="light" className="min-h-dvh bg-gray-50">
        <LandingHeader search="" onSearchChange={() => {}} />
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </div>
    );
  }

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <LandingHeader search="" onSearchChange={() => {}} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-2xl leading-none text-gray-900"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Review Booking
          </h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <p className="text-5xl">🛒</p>
            <p className="mt-3 text-sm text-gray-500">Your cart is empty.</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Browse services
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Address */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-orange-600">📍</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedAddressId ? addressLabel : "Delivery address"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                      {address
                        ? city &&
                          !address.toLowerCase().includes(city.toLowerCase())
                          ? `${address}, ${city}`
                          : address
                        : isLocating
                          ? "Detecting your current location…"
                          : "No address selected yet."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={openAddressModal}
                  className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Change ›
                </button>
              </div>
            </section>

            {/* Business details (for GST invoice) */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-900">
                Your business details
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Used for your booking &amp; GST invoice. GST number is optional.
              </p>
              <div className="mt-3 space-y-2">
                <Input
                  value={ownerName}
                  onChange={setOwnerName}
                  placeholder="Owner name *"
                />
                <Input
                  value={restaurantName}
                  onChange={setRestaurantName}
                  placeholder="Restaurant name *"
                />
                <Input
                  value={gstNumber}
                  onChange={setGstNumber}
                  placeholder="GST number (optional)"
                />
              </div>
            </section>

            {/* Items */}
            <section className="space-y-3">
              {cartItems.map((item) => {
                const sched = getBookingSchedule(
                  item.serviceId,
                  item.variantId,
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external image
                        <img
                          src={item.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">
                          🧰
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {item.name}
                      </p>
                      {item.variantName ? (
                        <p className="truncate text-xs text-gray-400">
                          {item.variantName}
                        </p>
                      ) : null}
                      <button
                        onClick={() => setSlotModalFor(item)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        🕓{" "}
                        {sched
                          ? `${sched.dateLabel} · ${sched.label}`
                          : "Pick date & shift"}
                        <PencilIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {inr(item.total || item.price)}
                      </span>
                      <button
                        onClick={() => {
                          removeBookingSchedule(item.serviceId, item.variantId);
                          removeItem(item.id);
                        }}
                        aria-label="Remove item"
                        className="text-gray-300 transition hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Special instructions */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <label className="text-sm font-semibold text-gray-900">
                Special instructions
              </label>
              <input
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Anything the professional should know?"
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </section>

            {/* Coupons */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">
                Apply coupon
              </h2>
              {appliedCoupon ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-green-700">
                      {appliedCoupon.code} ·{" "}
                      {isFlatCoupon
                        ? `pay only ₹${appliedCoupon.flatTotal}`
                        : `${appliedCoupon.discountPercent}% off`}
                    </p>
                    <p className="text-xs text-green-600">
                      You save {inr(couponSaving)}
                    </p>
                  </div>
                  <button
                    onClick={removeCoupon}
                    disabled={couponBusy}
                    className="text-sm font-semibold text-red-500 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) =>
                        setCouponInput(e.target.value.toUpperCase())
                      }
                      placeholder="Enter coupon code"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm uppercase text-gray-900 placeholder:normal-case placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                    />
                    <button
                      onClick={() => applyCoupon(couponInput)}
                      disabled={couponBusy || !couponInput.trim()}
                      className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {couponBusy ? "Applying…" : "Apply"}
                    </button>
                  </div>
                  {myCoupons.filter((c) => !c.isUsed).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Your coupons
                      </p>
                      {myCoupons
                        .filter((c) => !c.isUsed)
                        .map((c) => (
                          <button
                            key={c.couponId}
                            onClick={() => applyCoupon(c.code)}
                            disabled={couponBusy || !!appliedCoupon}
                            className="flex w-full items-center justify-between rounded-xl border border-dashed border-orange-300 bg-orange-50/50 px-3.5 py-2.5 text-left disabled:opacity-50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-gray-900">
                                {c.code}
                              </span>
                              <span className="block text-xs text-gray-500">
                                {c.discountType === "FLAT_TOTAL" &&
                                c.flatTotal != null
                                  ? `Pay only ₹${c.flatTotal} for this booking`
                                  : c.description ||
                                    `${c.discountPercent}% off your booking`}
                              </span>
                              {c.prepaidOnly && (
                                <span className="mt-0.5 block text-[11px] font-medium text-orange-700">
                                  Online payment only
                                </span>
                              )}
                            </span>
                            <span className="text-sm font-semibold text-orange-600">
                              {c.isApplied ? "APPLIED" : "Apply"}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
              {couponError && (
                <p className="mt-2 text-sm text-red-500">{couponError}</p>
              )}
            </section>

            {/* Bill summary */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">
                Bill summary
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Item total" value={inr(summary.itemTotal ?? 0)} />
                <Row label="Taxes (18%)" value={inr(summary.tax ?? 0)} />
                {appliedCoupon && couponSaving > 0 ? (
                  <Row
                    label={`Coupon ${appliedCoupon.code}`}
                    value={`− ${inr(couponSaving)}`}
                    accent="text-green-600"
                  />
                ) : null}
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-base font-bold text-gray-900">
                  Amount payable
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {inr(grandTotal)}
                </span>
              </div>
            </section>

            {/* Payment */}
            <button
              onClick={() => setPaymentModal(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                💵{" "}
                {paymentMode
                  ? PAYMENT_LABELS[paymentMode]
                  : "Select payment method"}
              </span>
              <span className="text-sm font-semibold text-orange-600">
                Change ›
              </span>
            </button>

            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            {/* Consent */}
            <p className="text-center text-xs text-gray-400">
              By paying, you agree to our{" "}
              <a
                href="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-gray-600"
              >
                Terms &amp; Conditions
              </a>{" "}
              and{" "}
              <a
                href="/refund-cancellation-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-gray-600"
              >
                Refund &amp; Cancellation Policy
              </a>
              .
            </p>

            {/* Place order */}
            <button
              onClick={handlePlaceOrder}
              disabled={isPlacing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-sm font-bold tracking-wide text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {isPlacing ? <SpinnerIcon className="h-5 w-5" /> : "PLACE ORDER"}
            </button>

            {!isLoggedIn ? (
              <p className="text-center text-xs text-gray-400">
                You&apos;ll be asked to log in with your mobile number before
                placing the order.
              </p>
            ) : null}
          </div>
        )}
      </main>

      <Footer />

      {/* Address modal */}
      {addressModal && (
        <Sheet onClose={() => setAddressModal(false)} title="Delivery address">
          {addressesLoading ? (
            <div className="flex justify-center py-6">
              <SpinnerIcon className="h-5 w-5 text-gray-400" />
            </div>
          ) : savedAddresses.length > 0 ? (
            <div className="mb-4 max-h-44 space-y-2 overflow-y-auto">
              {savedAddresses.map((a, i) => {
                const key =
                  a.id != null
                    ? `id-${a.id}`
                    : a.addressId != null
                      ? `addr-${a.addressId}`
                      : `label-${a.label}-${i}`;
                const selected = key === selectedAddressId;
                return (
                  <button
                    key={key}
                    onClick={() => applyAddress(a, key)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-bold text-gray-900">{a.label}</p>
                    <p className="text-xs text-gray-600">{a.address}</p>
                    <p className="text-xs text-gray-400">
                      {a.city}
                      {a.state ? `, ${a.state}` : ""}
                      {a.zipCode ? ` - ${a.zipCode}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mb-4 text-sm text-gray-500">
              No saved addresses yet. Add one below.
            </p>
          )}

          <p className="mb-2 text-sm font-semibold text-gray-900">
            Add / update address
          </p>
          <div className="space-y-2">
            <Input
              value={addressLabel}
              onChange={setAddressLabel}
              placeholder="Label (Home, Work)"
            />
            <Input
              value={address}
              onChange={setAddress}
              placeholder="Address"
            />
            <Input value={city} onChange={setCity} placeholder="City" />
            <div className="flex gap-2">
              <Input
                value={stateName}
                onChange={setStateName}
                placeholder="State"
              />
              <Input
                value={zipCode}
                onChange={setZipCode}
                placeholder="Zip code"
              />
            </div>
            <Input
              value={country}
              onChange={setCountry}
              placeholder="Country"
            />
            <div className="flex gap-2">
              <Input
                value={latitude}
                onChange={setLatitude}
                placeholder="Latitude"
              />
              <Input
                value={longitude}
                onChange={setLongitude}
                placeholder="Longitude"
              />
            </div>
          </div>

          {addressesError ? (
            <p className="mt-2 text-sm text-red-600">{addressesError}</p>
          ) : null}

          <button
            onClick={useCurrentLocation}
            disabled={isLocating}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-700 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {isLocating ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              "📍 Use current location"
            )}
          </button>
          <button
            onClick={handleSaveAddress}
            disabled={isSavingAddress}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {isSavingAddress ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              "Save address"
            )}
          </button>
        </Sheet>
      )}

      {/* Slot edit modal */}
      {slotModalFor && (
        <SlotEditModal
          item={slotModalFor}
          onClose={() => setSlotModalFor(null)}
        />
      )}

      {/* Payment modal */}
      {paymentModal && (
        <Sheet onClose={() => setPaymentModal(false)} title="Payment method">
          {(Object.keys(PAYMENT_LABELS) as PaymentMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setPaymentMode(mode);
                setPaymentModal(false);
              }}
              className={`mb-2 w-full rounded-xl border p-4 text-left text-sm font-medium transition ${
                paymentMode === mode
                  ? "border-orange-500 bg-orange-50 text-gray-900"
                  : "border-gray-200 text-gray-900 hover:border-gray-300"
              }`}
            >
              {PAYMENT_LABELS[mode]}
            </button>
          ))}
        </Sheet>
      )}

      {/* Success */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <p className="text-5xl">✅</p>
            <h2 className="mt-3 text-xl font-bold text-gray-900">
              Booking confirmed!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your order has been placed successfully.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${accent ?? "text-gray-900"}`}>{value}</dd>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
    />
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SlotEditModal({
  item,
  onClose,
}: {
  item: CartItemData;
  onClose: () => void;
}) {
  const existing = getBookingSchedule(item.serviceId, item.variantId);
  const { durationHours: parsedDuration, timing } = parseVariantShift(
    item.variantName,
  );
  const durationHours = parsedDuration ?? 5;
  const slots = useMemo(
    () => buildShiftSlots(timing ? [timing] : undefined, durationHours),
    [timing, durationHours],
  );
  const days = useMemo(() => getNextDays(7), []);

  const [date, setDate] = useState(existing?.date ?? days[0]?.value ?? "");
  const [slotId, setSlotId] = useState<string | null>(
    existing
      ? (slots.find((s) => s.label === existing.label)?.id ?? null)
      : (slots[0]?.id ?? null),
  );

  const save = () => {
    const slot = slots.find((s) => s.id === slotId);
    const day = days.find((d) => d.value === date);
    if (!slot || !day) return;
    saveBookingSchedule(item.serviceId, item.variantId, {
      date,
      dateLabel: day.fullLabel,
      startTime: slot.startTime,
      label: slot.label,
      durationHours,
      variantName: item.variantName,
    });
    onClose();
  };

  return (
    <Sheet title="Select date & shift" onClose={onClose}>
      <p className="mb-2 text-sm font-semibold text-gray-700">Date</p>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d.value}
            onClick={() => setDate(d.value)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              d.value === date
                ? "bg-orange-600 text-white"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            {d.weekday} {d.day}
          </button>
        ))}
      </div>

      <p className="mb-2 text-sm font-semibold text-gray-700">Shift slot</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {slots.map((s) => (
          <button
            key={s.id}
            onClick={() => setSlotId(s.id)}
            className={`rounded-xl border py-3 text-sm font-semibold transition ${
              s.id === slotId
                ? "border-orange-500 bg-orange-50 text-gray-900"
                : "border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={save}
        className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Done
      </button>
    </Sheet>
  );
}
