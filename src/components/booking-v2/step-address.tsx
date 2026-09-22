"use client";

/**
 * Step 2 of the hourly wizard: pick a saved address or add one. Needs a
 * signed-in customer (OTP login), because addresses live on the account.
 * Coordinates are required: without them the backend files the booking as
 * demand and never sends it to a partner.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { userApi, type UserAddress } from "@/src/api/api";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { computeBill, formatInr } from "@/src/lib/booking-v2/pricing";
import { fmtDateLong, fmtDuration, fmtTime } from "@/src/lib/booking-v2/schedule";
import type { DraftAddress } from "@/src/lib/booking-v2/draft";
import { currentPosition, reverseGeocode } from "@/src/lib/reverse-geocode";
import { fetchPlaceSuggestions, type PlaceSuggestion } from "@/src/lib/google-maps";
import { SpinnerIcon } from "@/src/components/icons";
import type { StepProps } from "./wizard";
import { emojiForCategory } from "./category-page-v2";
import {
  BillRow,
  Card,
  ChipButton,
  ChoiceList,
  ChoiceRow,
  Hint,
  Label,
  PinGlyph,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SummaryCard,
  TextInput,
  WizardLayout,
  inputClass,
} from "./shell";

const ADDRESS_TYPES = ["Restaurant", "Cloud kitchen", "Other"] as const;

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

/**
 * Google Places search for the address form, so a customer can book for a
 * restaurant they are not standing in. Same service and debounce as the
 * dispatcher's geofence editor.
 */
function PlaceSearch({
  onPick,
  disabled,
}: {
  onPick: (s: PlaceSuggestion) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0); // drop responses from superseded keystrokes

  useEffect(() => {
    const q = query.trim();
    const seq = ++seqRef.current;
    if (q.length < 3) {
      // Deferred so we never set state synchronously inside the effect body.
      queueMicrotask(() => {
        if (seq !== seqRef.current) return;
        setResults([]);
        setLoading(false);
        setFailed(false);
      });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const found = await fetchPlaceSuggestions(q);
        if (seq !== seqRef.current) return;
        setResults(found);
        setOpen(true);
      } catch {
        if (seq !== seqRef.current) return;
        setFailed(true);
        setResults([]);
        setOpen(true);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close the list when clicking outside the box.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: PlaceSuggestion) => {
    setQuery(s.label);
    setResults([]);
    setOpen(false);
    onPick(s);
  };

  const showList = open && query.trim().length >= 3;

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <SearchGlyph className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) pick(results[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        disabled={disabled}
        placeholder="Search area, landmark or restaurant"
        aria-label="Search for the address"
        autoComplete="off"
        className={`${inputClass} pl-10 pr-9`}
      />
      {loading ? (
        <SpinnerIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      ) : null}
      {showList ? (
        <ul
          className="absolute left-0 right-0 top-full z-20 m-0 mt-1.5 max-h-64 list-none overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
          role="listbox"
          aria-label="Matching places"
        >
          {failed ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">
              Search is not available right now. Use your current location instead.
            </li>
          ) : results.length === 0 && !loading ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">
              No places found. Try a nearby landmark.
            </li>
          ) : (
            results.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-900">{s.label}</span>
                  <span className="text-xs text-gray-500">{s.address}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** The API answers with an array, or wraps it in `data` / `addresses`. */
function unwrapAddresses(res: unknown): UserAddress[] {
  if (Array.isArray(res)) return res as UserAddress[];
  const r = res as { data?: UserAddress[]; addresses?: UserAddress[] } | null;
  const list = r?.data ?? r?.addresses ?? [];
  return Array.isArray(list) ? list : [];
}

export function StepAddress({ draft, update, goTo, leave }: StepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoggedIn, isHydrating } = useCustomerAuth();

  const loginUrl = `/account/login?redirect=${encodeURIComponent(
    `/booking/${draft.serviceId}?step=address`,
  )}`;
  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace(loginUrl);
  }, [isHydrating, isLoggedIn, router, loginUrl]);

  const profileName = str(user?.name);
  const profileRestaurant = str(user?.restaurantName);
  const profileGst = str(user?.gstNumber);
  const profilePhone = str(user?.mobile ?? user?.phone);

  const addresses = useQuery({
    queryKey: ["user-addresses", user?.id],
    queryFn: () => userApi.getAddresses(user!.id),
    enabled: !!user?.id,
  });

  const saved = useMemo<DraftAddress[]>(() => {
    return unwrapAddresses(addresses.data).map((a, i) => ({
      id: String(a.id ?? a.addressId ?? `label-${a.label}-${i}`),
      label: a.label,
      restaurantName: profileRestaurant,
      address: a.address,
      city: a.city,
      state: a.state ?? "",
      zipCode: a.zipCode ?? "",
      contactName: profileName,
      phone: profilePhone,
      lat: a.latitude ?? null,
      lng: a.longitude ?? null,
    }));
  }, [addresses.data, profileName, profileRestaurant, profilePhone]);

  const hasPin = (a: DraftAddress) => a.lat != null && a.lng != null && (a.lat !== 0 || a.lng !== 0);

  // The draft's address, matched back to the saved list once it refetches;
  // else the first pinned saved address.
  const selected = useMemo<DraftAddress | null>(() => {
    const chosen = draft.address;
    if (chosen) {
      const match = saved.find(
        (a) => a.id === chosen.id || (a.address === chosen.address && a.city === chosen.city),
      );
      if (match) return match;
      if (hasPin(chosen)) return chosen;
    }
    return saved.find(hasPin) ?? null;
  }, [draft.address, saved]);

  /* ------------------------------ new address ----------------------------- */

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<(typeof ADDRESS_TYPES)[number]>("Restaurant");
  const [restaurantName, setRestaurantName] = useState("");
  const [line1, setLine1] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [contactName, setContactName] = useState("");
  const [gst, setGst] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const openForm = () => {
    setRestaurantName((v) => v || profileRestaurant);
    setContactName((v) => v || profileName);
    setGst((v) => v || profileGst);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError(null);
    setInvalid(new Set());
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setFormError(null);
    try {
      const pos = await currentPosition();
      const geo = await reverseGeocode(pos.lat, pos.lng);
      setPin(pos);
      setArea(geo.address);
      setCity(geo.city);
      setStateName(geo.state);
      setPincode(geo.zipCode);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not read your location.");
    } finally {
      setLocating(false);
    }
  };

  const pickPlace = async (s: PlaceSuggestion) => {
    setLocating(true);
    setFormError(null);
    try {
      const { lat, lng } = await s.resolve();
      const geo = await reverseGeocode(lat, lng);
      setPin({ lat, lng });
      setArea(`${s.label}, ${s.address}`.replace(/,\s*India$/i, ""));
      setCity(geo.city);
      setStateName(geo.state);
      setPincode(geo.zipCode);
    } catch {
      setFormError("Could not find that place. Try another search or use your current location.");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!user?.id) return;
    const bad = new Set<string>();
    if (!line1.trim()) bad.add("line1");
    if (!area.trim()) bad.add("area");
    if (!city.trim()) bad.add("city");
    if (!/^\d{6}$/.test(pincode.replace(/\D/g, ""))) bad.add("pincode");
    if (!contactName.trim()) bad.add("contact");
    setInvalid(bad);
    if (bad.size) {
      setFormError(
        bad.size === 1 && bad.has("pincode")
          ? "Pincode needs 6 digits."
          : "Fill in the highlighted fields.",
      );
      return;
    }
    if (!pin) {
      setFormError("Use “Current location” to pin this address on the map.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const fullAddress = `${line1.trim()}, ${area.trim()}`;
    try {
      await userApi.addAddress(user.id, {
        label: type,
        address: fullAddress,
        city: city.trim(),
        zipCode: pincode.replace(/\D/g, ""),
        state: stateName.trim(),
        country: "India",
        latitude: pin.lat,
        longitude: pin.lng,
        isDefault: true,
      });
      await userApi.updateProfile(user.id, {
        name: contactName.trim(),
        restaurantName: restaurantName.trim(),
        ...(gst.trim() ? { gstNumber: gst.trim() } : {}),
      });
      update({
        address: {
          id: `local-${Date.now()}`,
          label: type,
          restaurantName: restaurantName.trim(),
          address: fullAddress,
          city: city.trim(),
          state: stateName.trim(),
          zipCode: pincode.replace(/\D/g, ""),
          contactName: contactName.trim(),
          phone: profilePhone,
          lat: pin.lat,
          lng: pin.lng,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["user-addresses", user.id] });
      closeForm();
      setNotice("Address saved.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the address.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------- render -------------------------------- */

  const minutes = draft.end - draft.start;
  const bill = computeBill({ hours: minutes / 60, rate: draft.rate, quantity: draft.quantity, coupon: null });
  const noun = draft.categoryName.toLowerCase().includes("chef") ? "chef" : "staff";
  const canContinue = !!selected && hasPin(selected);

  const next = () => {
    if (!selected || !hasPin(selected)) return;
    update({ address: selected });
    goTo("review");
  };

  const action = (
    <PrimaryButton onClick={next} disabled={!canContinue} wide>
      Next: review
    </PrimaryButton>
  );

  const sidebar = (
    <SummaryCard
      image={draft.serviceImage}
      fallback={emojiForCategory(draft.categoryName)}
      name={draft.serviceName}
      sub={`${formatInr(draft.rate)}/hour, minimum ${draft.minMinutes / 60} hrs`}
      onChange={leave}
      details={[
        { label: "Date", value: fmtDateLong(draft.date) },
        { label: "Time", value: `${fmtTime(draft.start)} to ${fmtTime(draft.end)}` },
        { label: "Duration", value: fmtDuration(minutes) },
        ...(selected ? [{ label: "Address", value: `${selected.label}, ${selected.city}` }] : []),
      ]}
      rows={
        <>
          <BillRow
            label={`${fmtDuration(minutes)} × ${formatInr(draft.rate)}${
              draft.quantity > 1 ? ` × ${draft.quantity}` : ""
            }`}
            value={formatInr(bill.subtotal)}
          />
          <BillRow label="Taxes (18%)" value={formatInr(bill.tax)} />
        </>
      }
      total={formatInr(bill.total)}
      action={action}
      note={canContinue ? "Taxes included." : "Pick an address with a map pin to continue."}
    />
  );

  return (
    <WizardLayout
      current={1}
      title={`Book a ${draft.serviceName}`}
      crumbs={[
        { label: "Home", href: "/" },
        { label: draft.categoryName, href: `/category/${draft.categoryId}` },
        { label: "Date & time", onClick: () => goTo("time") },
        { label: "Address" },
      ]}
      sidebar={sidebar}
      bar={{
        total: formatInr(bill.total),
        note: `${draft.serviceName}, ${fmtDateLong(draft.date)}`,
        action,
      }}
    >
      {isHydrating || !isLoggedIn ? (
        <div className="flex justify-center py-16 text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <SectionTitle note="Pick a saved address or add a new one. The contact person gets the arrival call.">
              Where should the {noun} come?
            </SectionTitle>

            {addresses.isLoading ? (
              <div className="flex justify-center py-8 text-gray-400">
                <SpinnerIcon className="h-5 w-5" />
              </div>
            ) : addresses.isError ? (
              <Hint error>Could not load your saved addresses. Add one below.</Hint>
            ) : saved.length === 0 ? (
              <Hint>No saved addresses yet. Add one below.</Hint>
            ) : (
              <div className="mt-4">
                <ChoiceList label="Saved addresses">
                  {saved.map((a) => {
                    const pinned = hasPin(a);
                    return (
                      <ChoiceRow
                        key={a.id}
                        selected={selected?.id === a.id}
                        disabled={!pinned}
                        onSelect={() => update({ address: a })}
                        tag={a.label}
                        title={a.restaurantName || null}
                        lines={[a.address, `${a.city}${a.zipCode ? ` ${a.zipCode}` : ""}`]
                          .filter(Boolean)
                          .join(", ")}
                        meta={
                          pinned
                            ? [a.contactName, a.phone].filter(Boolean).join(", ")
                            : "No map pin on this address. Add it again with your current location."
                        }
                      />
                    );
                  })}
                </ChoiceList>
              </div>
            )}

            {notice ? <Hint>{notice}</Hint> : null}

            {!formOpen ? (
              <button
                type="button"
                onClick={openForm}
                aria-expanded={formOpen}
                className="mt-4 h-11 w-full rounded-xl border border-dashed border-rc-yellow-deep text-sm font-semibold text-rc-yellow-deep transition hover:bg-rc-yellow-tint/40 md:w-auto md:px-6"
              >
                + Add a new address
              </button>
            ) : null}
          </Card>

          {formOpen ? (
            <Card className="p-5 sm:p-6">
              <form
                className="flex flex-col gap-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <SectionTitle note="Saved to your account for next time.">New address</SectionTitle>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Address type">
                  {ADDRESS_TYPES.map((t) => (
                    <ChipButton key={t} selected={type === t} onClick={() => setType(t)}>
                      {t}
                    </ChipButton>
                  ))}
                </div>

                <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
                  <p className="m-0 text-sm text-gray-600">
                    {pin
                      ? "Location pinned. Fill in the flat or building below."
                      : `Search the place, or use your current location. We need a map pin so the ${noun} reaches the right door.`}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <PlaceSearch onPick={pickPlace} disabled={locating} />
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locating}
                      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
                    >
                      {locating ? <SpinnerIcon className="h-4 w-4" /> : <PinGlyph className="h-4 w-4" />}
                      {pin ? "Pin again" : "Use current location"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <Label htmlFor="f-restaurant">Restaurant name</Label>
                    <TextInput
                      id="f-restaurant"
                      value={restaurantName}
                      onChange={setRestaurantName}
                      autoComplete="organization"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="f-contact">Contact name</Label>
                    <TextInput
                      id="f-contact"
                      value={contactName}
                      onChange={setContactName}
                      invalid={invalid.has("contact")}
                      autoComplete="name"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="f-line1">Flat, building, street</Label>
                    <TextInput
                      id="f-line1"
                      value={line1}
                      onChange={setLine1}
                      invalid={invalid.has("line1")}
                      autoComplete="address-line1"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="f-area">Area or locality</Label>
                    <TextInput
                      id="f-area"
                      value={area}
                      onChange={setArea}
                      invalid={invalid.has("area")}
                      autoComplete="address-line2"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="f-city">City</Label>
                    <TextInput
                      id="f-city"
                      value={city}
                      onChange={setCity}
                      invalid={invalid.has("city")}
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="f-pincode">Pincode</Label>
                      <TextInput
                        id="f-pincode"
                        value={pincode}
                        onChange={setPincode}
                        invalid={invalid.has("pincode")}
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="postal-code"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="f-state">State</Label>
                      <TextInput
                        id="f-state"
                        value={stateName}
                        onChange={setStateName}
                        autoComplete="address-level1"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="f-gst">GST number (optional)</Label>
                    <TextInput id="f-gst" value={gst} onChange={(v) => setGst(v.toUpperCase())} />
                  </div>
                </div>

                {formError ? <Hint error>{formError}</Hint> : null}

                <div className="flex justify-end gap-2.5">
                  <SecondaryButton onClick={closeForm} disabled={saving}>
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton type="submit" disabled={saving}>
                    {saving ? <SpinnerIcon className="h-4 w-4" /> : "Save address"}
                  </PrimaryButton>
                </div>
              </form>
            </Card>
          ) : null}
        </>
      )}
    </WizardLayout>
  );
}
