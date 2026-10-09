"use client";

/**
 * Step 2 of the hourly wizard: pick a saved address or add one (see
 * address-picker.tsx). Needs a signed-in customer (OTP login), because
 * addresses live on the account.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/src/lib/customer-auth";
import { formatInr } from "@/src/lib/booking-v2/pricing";
import { fmtDateLong, fmtDuration } from "@/src/lib/booking-v2/schedule";
import { SpinnerIcon } from "@/src/components/icons";
import { draftCopy, fullBill, isFixedDraft } from "@/src/lib/booking-v2/draft";
import type { StepProps } from "./wizard";
import { emojiForCategory } from "./category-page-v2";
import { AddressPicker, hasPin, useAddressBook } from "./address-picker";
import { BillRow, PrimaryButton, SummaryCard, WizardLayout } from "./shell";
import { categoryHref } from "@/lib/category-slugs";

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
  // Includes services added for the same time on the review step.
  const full = fullBill(draft, null);
  const bill = { ...full.main, total: full.total, tax: full.tax };
  const extraCount = draft.extras?.length ?? 0;
  const copy = draftCopy(draft);
  const fixed = isFixedDraft(draft);
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
      sub={copy.sub}
      onChange={leave}
      details={[
        { label: "Date", value: fmtDateLong(draft.date) },
        { label: "Time", value: copy.time },
        ...(fixed ? [] : [{ label: "Duration", value: fmtDuration(minutes) }]),
        ...(selected ? [{ label: "Address", value: `${selected.label}, ${selected.city}` }] : []),
      ]}
      rows={
        <>
          <BillRow
            label={copy.billLabel(draft.quantity > 1 ? ` × ${draft.quantity}` : "")}
            value={formatInr(bill.subtotal)}
          />
          {extraCount ? (
                <BillRow
                  label={`${extraCount} more service${extraCount === 1 ? "" : "s"}`}
                  value={formatInr(full.extrasBase)}
                />
              ) : null}
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
      title={copy.title}
      crumbs={[
        { label: "Home", href: "/" },
        { label: draft.categoryName, href: categoryHref(draft.categoryId) },
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
