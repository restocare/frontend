"use client";

/**
 * Step 2 of the hourly wizard: pick a saved address or add one (see
 * address-picker.tsx). Needs a signed-in customer (OTP login), because
 * addresses live on the account.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { computeBill, formatInr } from "@/src/lib/booking-v2/pricing";
import { fmtDateLong, fmtDuration, fmtTime } from "@/src/lib/booking-v2/schedule";
import { SpinnerIcon } from "@/src/components/icons";
import type { StepProps } from "./wizard";
import { emojiForCategory } from "./category-page-v2";
import { AddressPicker, hasPin, useAddressBook } from "./address-picker";
import { BillRow, PrimaryButton, SummaryCard, WizardLayout } from "./shell";

export function StepAddress({ draft, update, goTo, leave }: StepProps) {
  const router = useRouter();
  const { isLoggedIn, isHydrating } = useCustomerAuth();

  const loginUrl = `/account/login?redirect=${encodeURIComponent(
    `/booking/${draft.serviceId}?step=address`,
  )}`;
  useEffect(() => {
    if (!isHydrating && !isLoggedIn) router.replace(loginUrl);
  }, [isHydrating, isLoggedIn, router, loginUrl]);

  const book = useAddressBook(draft.address);
  const { selected } = book;

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
          <AddressPicker book={book} noun={noun} onSelect={(address) => update({ address })} />
        </>
      )}
    </WizardLayout>
  );
}
