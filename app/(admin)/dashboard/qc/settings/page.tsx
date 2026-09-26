"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qcApi } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SpinnerIcon } from "@/src/components/icons";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary";

/**
 * Store-level quick-commerce settings. The refund policy typed here is what
 * the customer app renders on every product page — panel is the source of
 * truth, the apps only display it.
 */
export default function QcSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["qc-settings"], queryFn: qcApi.settings });
  const [refundPolicy, setRefundPolicy] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRefundPolicy(data.refundPolicy ?? "");
    setSupportPhone(data.supportPhone ?? "");
    setSupportEmail(data.supportEmail ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      qcApi.updateSettings({ refundPolicy, supportPhone, supportEmail }),
    onSuccess: (r) => {
      setNotice(r.message);
      qc.invalidateQueries({ queryKey: ["qc-settings"] });
    },
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Could not save"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">QC Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown in the customer app on every product page.
        </p>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Refund / return policy
            </span>
            <textarea
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              rows={7}
              placeholder="Easy 7-day returns…"
              className={inputCls}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Support phone</span>
              <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Support email</span>
              <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
