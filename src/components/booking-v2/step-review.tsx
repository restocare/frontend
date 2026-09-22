"use client";

/**
 * Step 3 of the hourly wizard: review, how many people, coupon, payment,
 * confirm. Online payment runs Razorpay first and creates the bookings once
 * the signature verifies, the same order of events as the flow-1 checkout.
 * One booking is created per person.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bookingApi,
  couponsApi,
  paymentsApi,
  type CustomerCoupon,
} from "@/src/api/api";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { computeBill, formatInr } from "@/src/lib/booking-v2/pricing";
import { fmtDateLong, fmtDuration, fmtTime } from "@/src/lib/booking-v2/schedule";
import { buildPayloads, clearDraft } from "@/src/lib/booking-v2/draft";
import { loadRazorpayScript, openRazorpay } from "@/src/lib/razorpay";
import { SpinnerIcon } from "@/src/components/icons";
import type { StepProps } from "./wizard";
import { emojiForCategory } from "./category-page-v2";
import {
  BillRow,
  Card,
  CheckGlyph,
  ChoiceCard,
  Hint,
  LinkButton,
  PinGlyph,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SummaryCard,
  Thumb,
  WizardLayout,
  inputClass,
} from "./shell";

const MAX_PEOPLE = 5;

type PaymentMode = "RAZORPAY" | "COD";

export function StepReview({ draft, update, goTo, leave }: StepProps) {
  const router = useRouter();
  const { user, isLoggedIn, isHydrating } = useCustomerAuth();

  const loginUrl = `/account/login?redirect=${encodeURIComponent(
    `/booking/${draft.serviceId}?step=review`,
  )}`;
  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace(loginUrl);
  }, [isHydrating, isLoggedIn, router, loginUrl]);

  const isChef = draft.categoryName.toLowerCase().includes("chef");
  const nounOne = isChef ? "chef" : "person";
  const nounMany = isChef ? "chefs" : "people";
  const qtyLabel = isChef ? "Chefs" : "People";

  /* ------------------------------- coupons -------------------------------- */

  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [applied, setApplied] = useState<CustomerCoupon | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    couponsApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setCoupons(list);
        const current = list.find((c) => c.isApplied);
        if (current) setApplied(current);
      })
      .catch(() => {
        if (!cancelled) setCoupons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const result = await couponsApi.apply(trimmed);
      setApplied(result);
      setCouponInput("");
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : `${trimmed} is not a valid code.`);
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = async () => {
    if (!applied) return;
    setCouponBusy(true);
    try {
      await couponsApi.remove(applied.couponId);
    } catch {
      // Best effort: the booking simply will not carry the code.
    } finally {
      setApplied(null);
      setCouponBusy(false);
    }
  };

  /* ---------------------------- amounts and pay --------------------------- */

  const minutes = draft.end - draft.start;
  const quantity = draft.quantity;
  const bill = computeBill({ hours: minutes / 60, rate: draft.rate, quantity, coupon: applied });
  const payment = draft.paymentMode;
  const couponNeedsPrepay = !!applied?.prepaidOnly && payment === "COD";

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ids: number[]; mode: PaymentMode; total: number } | null>(null);

  const confirm = async () => {
    setError(null);
    if (!user?.id) {
      router.replace(loginUrl);
      return;
    }
    if (!draft.address) {
      goTo("address");
      return;
    }
    if (!payment) {
      setError("Choose a payment method.");
      return;
    }
    if (couponNeedsPrepay) {
      setError(`Coupon ${applied?.code} only works with online payment. Pay online, or remove the coupon.`);
      return;
    }

    setPlacing(true);
    try {
      const payloads = buildPayloads({ ...draft, paymentMode: payment }, Number(user.id), applied);

      if (payment === "RAZORPAY") {
        const ok = await loadRazorpayScript();
        if (!ok) throw new Error("Could not load the payment gateway. Please try again.");
        const order = await paymentsApi.createOrder(bill.total, "INR");
        if (!order?.id || !order?.keyId) {
          throw new Error("Could not start the payment. Please try again.");
        }
        const signature = await openRazorpay(
          order,
          {
            name: user.name ?? undefined,
            email: user.email ?? undefined,
            contact: user.mobile ?? user.phone ?? undefined,
          },
          `${draft.serviceName}, ${fmtDateLong(draft.date)}`,
        );
        const verification = await paymentsApi.verify(signature);
        if (!verification?.success) {
          throw new Error(verification?.message ?? "Payment could not be verified.");
        }
      }

      const ids: number[] = [];
      for (const payload of payloads) {
        const result = await bookingApi.create(payload);
        ids.push(result.bookingId);
      }
      clearDraft();
      setDone({ ids, mode: payment, total: bill.total });
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  /* -------------------------------- render -------------------------------- */

  const address = draft.address;
  const addressLine = address
    ? [address.address, `${address.city}${address.zipCode ? ` ${address.zipCode}` : ""}`]
        .filter(Boolean)
        .join(", ")
    : "";

  const crumbs = [
    { label: "Home", href: "/" },
    { label: draft.categoryName, href: `/category/${draft.categoryId}` },
    { label: "Date & time", onClick: () => goTo("time") },
    { label: "Address", onClick: () => goTo("address") },
    { label: "Review" },
  ];

  if (done) {
    const idText = done.ids.filter(Boolean).map((id) => `#${id}`).join(", ");
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Card className="mx-auto max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-rc-green text-white">
            <CheckGlyph className="h-10 w-10" />
          </div>
          <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">Booking confirmed</h1>
          {idText ? (
            <p className="m-0 mt-2 text-sm text-gray-500">
              Booking {done.ids.length > 1 ? "IDs" : "ID"}{" "}
              <strong className="text-gray-900">{idText}</strong>
            </p>
          ) : null}
          <p className="m-0 mt-5 text-[15px] leading-relaxed text-gray-600">
            {quantity} {quantity === 1 ? draft.serviceName : `× ${draft.serviceName}`} on{" "}
            {fmtDateLong(draft.date)}, {fmtTime(draft.start)} to {fmtTime(draft.end)}, at{" "}
            {addressLine || "your address"}. {formatInr(done.total)}{" "}
            {done.mode === "COD" ? "to pay after the service." : "paid online."}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/account/orders"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-rc-yellow px-7 text-sm font-bold text-gray-900 transition hover:brightness-95"
            >
              View my orders
            </Link>
            <button
              type="button"
              onClick={leave}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-7 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
            >
              Book another {nounOne}
            </button>
          </div>
        </Card>
      </main>
    );
  }

  const payments: { id: PaymentMode; name: string; note: string }[] = [
    { id: "RAZORPAY", name: "Pay online", note: "UPI, cards and netbanking" },
    { id: "COD", name: "COD", note: `Cash or UPI to the ${nounOne} after the service` },
  ];

  const unusedCoupons = coupons.filter((c) => !c.isUsed && c.couponId !== applied?.couponId);

  const action = (
    <PrimaryButton onClick={confirm} disabled={!payment || !address || placing} wide>
      {placing ? <SpinnerIcon className="h-5 w-5" /> : "Confirm booking"}
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
        { label: qtyLabel, value: String(quantity) },
        { label: "Payment", value: payments.find((p) => p.id === payment)?.name ?? "Not chosen" },
      ]}
      rows={
        <>
          <BillRow
            label={`${fmtDuration(minutes)} × ${formatInr(draft.rate)}${
              quantity > 1 ? ` × ${quantity} ${nounMany}` : ""
            }`}
            value={formatInr(bill.subtotal)}
          />
          {applied && bill.couponSaving > 0 ? (
            <BillRow label={`Coupon ${applied.code}`} value={`−${formatInr(bill.couponSaving)}`} tone="discount" />
          ) : null}
          <BillRow label="Taxes (18%)" value={formatInr(bill.tax)} />
        </>
      }
      total={formatInr(bill.total)}
      totalLabel="Amount payable"
      action={action}
      note={
        error ? (
          <span className="font-medium text-rc-red">{error}</span>
        ) : payment ? (
          "Taxes included."
        ) : (
          "Choose a payment method to confirm."
        )
      }
    />
  );

  return (
    <WizardLayout
      current={2}
      title={`Book a ${draft.serviceName}`}
      crumbs={crumbs}
      sidebar={sidebar}
      bar={{
        total: formatInr(bill.total),
        note: payment ? "amount payable, taxes included" : "choose a payment method",
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
            <div className="flex items-start gap-4">
              <Thumb src={draft.serviceImage}>{emojiForCategory(draft.categoryName)}</Thumb>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-lg font-bold">{draft.serviceName}</h2>
                <p className="m-0 mt-1 text-sm text-gray-600">
                  {fmtDateLong(draft.date)}, {fmtTime(draft.start)} to {fmtTime(draft.end)} (
                  {fmtDuration(minutes)})
                </p>
              </div>
              <LinkButton onClick={() => goTo("time")}>Edit</LinkButton>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-100 pt-4">
              <div>
                <p className="m-0 text-sm font-semibold">{qtyLabel}</p>
                <p className="m-0 text-xs text-gray-500">Same hours for each {nounOne}. Each one is a separate booking.</p>
              </div>
              <div
                className="inline-flex items-center rounded-full border border-gray-200 bg-white"
                aria-label={`Number of ${nounMany}`}
              >
                <button
                  type="button"
                  aria-label={`One ${nounOne} fewer`}
                  disabled={quantity <= 1}
                  onClick={() => update({ quantity: Math.max(1, quantity - 1) })}
                  className="h-10 w-10 rounded-full text-xl leading-none text-gray-900 transition hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  −
                </button>
                <output className="min-w-8 text-center font-semibold tabular-nums">{quantity}</output>
                <button
                  type="button"
                  aria-label={`One ${nounOne} more`}
                  disabled={quantity >= MAX_PEOPLE}
                  onClick={() => update({ quantity: Math.min(MAX_PEOPLE, quantity + 1) })}
                  className="h-10 w-10 rounded-full text-xl leading-none text-gray-900 transition hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  +
                </button>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gray-50 text-rc-yellow-deep" aria-hidden>
                <PinGlyph className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-base font-bold">
                  {address
                    ? `${address.label}${address.restaurantName ? `, ${address.restaurantName}` : ""}`
                    : "No address yet"}
                </h2>
                <p className="m-0 mt-1 text-sm text-gray-600">
                  {address ? addressLine : "Add one on the previous step."}
                </p>
                {address ? (
                  <p className="m-0 mt-1 text-xs text-gray-500">
                    {[address.contactName, address.phone].filter(Boolean).join(", ")}
                  </p>
                ) : null}
              </div>
              <LinkButton onClick={() => goTo("address")}>Change</LinkButton>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle>Coupon</SectionTitle>
            {applied ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#E6F4EA] px-4 py-3 text-sm font-semibold text-rc-green">
                <span>
                  {applied.code} applied
                  {applied.discountType === "FLAT_TOTAL" && applied.flatTotal != null
                    ? `, pay only ${formatInr(applied.flatTotal)}`
                    : applied.discountPercent
                      ? `, ${applied.discountPercent}% off`
                      : ""}
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  disabled={couponBusy}
                  className="text-sm font-semibold text-rc-yellow-deep hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form
                className="mt-4 flex max-w-md gap-2"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void applyCoupon(couponInput);
                }}
              >
                <label htmlFor="coupon-code" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="coupon-code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={`${inputClass} min-w-0 flex-1 uppercase placeholder:normal-case`}
                />
                <SecondaryButton type="submit" disabled={couponBusy || !couponInput.trim()}>
                  {couponBusy ? "Applying…" : "Apply"}
                </SecondaryButton>
              </form>
            )}
            {couponError ? <Hint error>{couponError}</Hint> : null}
            {!applied && unusedCoupons.length > 0 ? (
              <div className="mt-4">
                <p className="m-0 mb-2 text-xs font-semibold text-gray-500">Your coupons</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {unusedCoupons.map((c) => (
                    <button
                      key={c.couponId}
                      type="button"
                      disabled={couponBusy}
                      onClick={() => applyCoupon(c.code)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-rc-yellow-deep bg-rc-yellow-tint/30 px-3.5 py-2.5 text-left transition hover:bg-rc-yellow-tint/60 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{c.code}</span>
                        <span className="block text-xs text-gray-500">
                          {c.discountType === "FLAT_TOTAL" && c.flatTotal != null
                            ? `Pay only ${formatInr(c.flatTotal)} for this booking`
                            : c.description || `${c.discountPercent}% off your booking`}
                          {c.prepaidOnly ? " (online payment only)" : ""}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-rc-yellow-deep">Apply</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle>Payment method</SectionTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              {payments.map((m) => (
                <ChoiceCard
                  key={m.id}
                  selected={payment === m.id}
                  onSelect={() => update({ paymentMode: m.id })}
                  title={m.name}
                  meta={m.note}
                />
              ))}
            </div>
            {couponNeedsPrepay ? (
              <Hint error>Coupon {applied?.code} only works with online payment.</Hint>
            ) : null}
            {error ? <Hint error>{error}</Hint> : null}
          </Card>
        </>
      )}
    </WizardLayout>
  );
}
