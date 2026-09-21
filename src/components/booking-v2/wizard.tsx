"use client";

/**
 * The three-step hourly booking wizard at /booking/[serviceId] on flow 2.
 * The step lives in the `step` query param so the browser back button walks
 * back a step; the draft lives in sessionStorage so a refresh or a login
 * round-trip keeps it. Without a draft (a WhatsApp deep link, for example)
 * the wizard starts one from the live category tree.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  categoryTreeApi,
  queryKeys,
  type CategoryTreeNode,
  type CategoryTreeService,
} from "@/src/api/api";
import { categoryUsesSlots } from "@/src/lib/slot-categories";
import {
  loadDraft,
  saveDraft,
  startDraft,
  type BookingDraft,
} from "@/src/lib/booking-v2/draft";
import { SpinnerIcon } from "@/src/components/icons";
import { StorefrontShell } from "./shell";
import { StepTime } from "./step-time";
import { StepAddress } from "./step-address";
import { StepReview } from "./step-review";

export type WizardStep = "time" | "address" | "review";

export interface StepProps {
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
  goTo: (step: WizardStep) => void;
  /** Leave the wizard for the category page (the "Change" link). */
  leave: () => void;
}

function locateService(
  tree: CategoryTreeNode[] | undefined,
  serviceId: number,
): { service: CategoryTreeService; category: CategoryTreeNode } | null {
  if (!tree) return null;
  for (const category of tree) {
    const all = [...category.services, ...category.groups.flatMap((g) => g.services)];
    const service = all.find((s) => s.serviceId === serviceId);
    if (service) return { service, category };
  }
  return null;
}

function parseStep(value: string | null): WizardStep {
  return value === "address" || value === "review" ? value : "time";
}

export function BookingWizard() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = Number(params?.serviceId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStep = parseStep(searchParams.get("step"));

  // undefined = storage not read yet; null = no usable draft.
  const [draft, setDraft] = useState<BookingDraft | null | undefined>(undefined);

  useEffect(() => {
    const stored = loadDraft();
    queueMicrotask(() => {
      setDraft(stored && stored.serviceId === serviceId ? stored : null);
    });
  }, [serviceId]);

  // Deep link with no draft: build one from the tree.
  const tree = useQuery({
    queryKey: queryKeys.categoryTreeAt(null),
    queryFn: () => categoryTreeApi.tree(null),
    enabled: draft === null,
  });

  useEffect(() => {
    if (draft !== null) return;
    const located = locateService(tree.data, serviceId);
    if (!located) return;
    const fresh = startDraft(located.service, {
      categoryId: located.category.categoryId,
      name: located.category.name,
    });
    saveDraft(fresh);
    queueMicrotask(() => setDraft(fresh));
  }, [draft, tree.data, serviceId]);

  const update = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (step: WizardStep) => {
      router.push(step === "time" ? `/booking/${serviceId}` : `/booking/${serviceId}?step=${step}`);
    },
    [router, serviceId],
  );

  const leave = useCallback(() => {
    router.push(draft ? `/category/${draft.categoryId}` : "/");
  }, [router, draft]);

  if (draft === undefined || (draft === null && (tree.isLoading || !tree.data))) {
    return (
      <StorefrontShell>
        <div className="flex h-[60vh] items-center justify-center text-gray-400">
          <SpinnerIcon className="h-7 w-7" />
        </div>
      </StorefrontShell>
    );
  }

  if (draft === null) {
    const located = locateService(tree.data, serviceId);
    const unsupported = located && !categoryUsesSlots(located.category.name);
    return (
      <StorefrontShell>
        <div className="mx-auto flex h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
          <p className="text-5xl">🔍</p>
          <h1 className="mt-4 text-xl font-bold sm:text-2xl">
            {unsupported ? "This service is not booked by the hour" : "Service not found"}
          </h1>
          <p className="mt-2 text-gray-500">
            {unsupported
              ? "Open it from its category page to add it to your cart."
              : "The service you’re looking for doesn’t exist or was removed."}
          </p>
          <Link
            href={located ? `/category/${located.category.categoryId}` : "/"}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            {located ? `Back to ${located.category.name}` : "Back to home"}
          </Link>
        </div>
      </StorefrontShell>
    );
  }

  // Later steps need what earlier steps produce.
  const step: WizardStep =
    requestedStep === "review" && !draft.address ? "address" : requestedStep;

  const props: StepProps = { draft, update, goTo, leave };

  return (
    <StorefrontShell>
      {step === "time" ? (
        <StepTime {...props} />
      ) : step === "address" ? (
        <StepAddress {...props} />
      ) : (
        <StepReview {...props} />
      )}
    </StorefrontShell>
  );
}
