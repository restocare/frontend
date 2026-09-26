"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, essApi, type OfferLetterRow } from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  fmtDate,
  statusTone,
} from "@/src/components/crm/ui";
import { OfferLetterPreview } from "@/src/components/crm/offer-letter-preview";
import { downloadOfferLetter } from "@/src/lib/offer-letter";
import { FileTextIcon } from "@/src/components/icons";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function MyOfferLettersPage() {
  const [viewing, setViewing] = useState<OfferLetterRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.myOfferLetters,
    queryFn: essApi.myOfferLetters,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My Offer Letters"
        subtitle="View, accept or decline, and download your offer letter as a PDF."
      />

      {error && (
        <Notice kind="error">
          {error instanceof ApiError
            ? error.message
            : "Could not load your offer letters — ask HR to link your login."}
        </Notice>
      )}

      <Card>
        <TableShell head={["Reference", "Position", "Annual CTC", "Joining", "Status", ""]}>
          {isLoading && <EmptyRow cols={6} label="Loading…" />}
          {!isLoading && !error && !data?.length && (
            <EmptyRow cols={6} label="No offer letters yet — they appear here once HR issues one." />
          )}
          {data?.map((o) => (
            <tr key={o.offerLetterId} className="text-foreground">
              <td className="px-4 py-3 font-medium">{o.referenceNo ?? "—"}</td>
              <td className="px-4 py-3">{o.designation}</td>
              <td className="px-4 py-3">{inr(o.annualCtc)}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.joiningDate)}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(o.status)}>{o.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Btn small tone="ghost" onClick={() => setViewing(o)}>
                  <FileTextIcon className="h-3.5 w-3.5" /> View
                </Btn>
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {viewing && <OfferLetterModal offerId={viewing.offerLetterId} onClose={() => setViewing(null)} />}
    </div>
  );
}

function OfferLetterModal({ offerId, onClose }: { offerId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");

  const { data: offer, isLoading } = useQuery({
    queryKey: crmQueryKeys.myOfferLetter(offerId),
    queryFn: () => essApi.myOfferLetter(offerId),
  });

  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") =>
      action === "accept" ? essApi.acceptOffer(offerId) : essApi.declineOffer(offerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ess", "offer-letters"] });
      qc.invalidateQueries({ queryKey: crmQueryKeys.myOfferLetter(offerId) });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Could not update the offer"),
  });

  return (
    <Modal title="Offer letter" onClose={onClose} wide>
      {isLoading || !offer ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          {err && <Notice kind="error">{err}</Notice>}
          <OfferLetterPreview offer={offer} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone={statusTone(offer.status)}>{offer.status}</Badge>
            <div className="flex flex-wrap gap-2">
              {offer.status === "ISSUED" && (
                <>
                  <Btn
                    tone="danger"
                    busy={respond.isPending && respond.variables === "decline"}
                    onClick={() => respond.mutate("decline")}
                  >
                    Decline
                  </Btn>
                  <Btn
                    tone="success"
                    busy={respond.isPending && respond.variables === "accept"}
                    onClick={() => respond.mutate("accept")}
                  >
                    Accept offer
                  </Btn>
                </>
              )}
              <Btn onClick={() => downloadOfferLetter(offer)}>
                <FileTextIcon className="h-4 w-4" /> Download PDF
              </Btn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
