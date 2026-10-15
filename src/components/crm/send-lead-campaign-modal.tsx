"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmCampaignsApi } from "@/src/api/api";
import { Btn, Field, inputCls, Modal, Notice } from "@/src/components/crm/ui";
import {
  TemplateComposer,
  type TemplateChoice,
} from "@/src/components/crm/template-composer";

/**
 * Run a template campaign against leads ticked on the Leads page.
 *
 * The sibling of SendCampaignModal, for prospects instead of customers: leads
 * live in their own table and have no account, so the audience travels as
 * MarketingLead ids under the SELECTED_LEADS segment. Everything after that is
 * the same machinery — ledger, pacing, opt-out skips, resume and delivery
 * receipts — and the run shows up in the campaign list like any other.
 */
export function SendLeadCampaignModal({
  leadIds,
  sampleName,
  onClose,
  onStarted,
}: {
  leadIds: number[];
  /** Stands in for {{name}} in the preview — one of the picked leads. */
  sampleName: string | null;
  onClose: () => void;
  onStarted: (name: string, queued: number) => void;
}) {
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<TemplateChoice>({
    name: "",
    language: "",
    params: [],
  });
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      const campaign = await crmCampaignsApi.create({
        name: name.trim(),
        channel: "WHATSAPP",
        segment: "SELECTED_LEADS",
        // Not delivered — the approved template is. Kept as the record of why
        // this campaign existed, which the campaign list shows.
        message: `Template ${choice.name} to ${leadIds.length} selected leads`,
        templateName: choice.name,
        templateLanguage: choice.language,
        templateParams: choice.params,
        recipientLeadIds: leadIds,
        headerMediaUrl: choice.headerMediaUrl,
        couponCode: choice.couponCode,
      });
      const started = await crmCampaignsApi.sendTemplate(campaign.campaignId);
      return { campaign, started };
    },
    onSuccess: (r) => onStarted(r.campaign.name, r.started.pending),
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : "Could not start the campaign.",
      ),
  });

  return (
    <Modal title={`Send to ${leadIds.length} selected leads`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}

        <Field
          label="Campaign name *"
          hint="So you can find this run in the campaign list later"
        >
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali staffing offer — Meta leads"
          />
        </Field>

        <TemplateComposer
          value={choice}
          onChange={setChoice}
          previewName={sampleName}
          previewTo={`${leadIds.length} leads`}
        />

        <p className="text-xs text-muted-foreground">
          Leads who replied STOP, or whose number is not a valid Indian mobile,
          are skipped and recorded as such — so the number actually messaged may
          be lower than {leadIds.length}. Only message leads who asked to hear
          from you: WhatsApp requires opt-in before a marketing template.
        </p>

        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Btn>
          <Btn
            busy={run.isPending}
            disabled={!choice.name || !leadIds.length}
            onClick={() => {
              if (!name.trim()) return setError("Give the campaign a name.");
              if (!choice.name) return setError("Pick a template first.");
              if (choice.params.some((p) => !p.trim()))
                return setError(
                  "Fill every variable — a blank one sends an empty line.",
                );
              setError(null);
              run.mutate();
            }}
          >
            Send campaign
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
