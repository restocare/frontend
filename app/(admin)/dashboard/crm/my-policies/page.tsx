"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import { crmQueryKeys, hrApi, type HrPolicyRow } from "@/src/api/api";
import { Badge, Card, Modal, Notice, PageHeader, fmtDate } from "@/src/components/crm/ui";

/**
 * The employee's read-only view of the rulebook: the attendance rules that are
 * applied to their check-ins, plus every policy HR has published.
 */
export default function MyPoliciesPage() {
  const [reading, setReading] = useState<HrPolicyRow | null>(null);

  const { data, error } = useQuery({
    queryKey: crmQueryKeys.myPolicies,
    queryFn: () => hrApi.myPolicies(),
  });

  const rules = data?.attendancePolicy;
  const byCategory = (data?.policies ?? []).reduce<Record<string, HrPolicyRow[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Policies" subtitle="The rules that apply to you, in HR's own words." />
      {error && <Notice kind="error">{(error as ApiError).message}</Notice>}

      {rules && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Attendance rules</h3>
          {rules.autoApply ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You have <span className="font-medium text-foreground">{rules.graceMinutes} minutes</span>{" "}
              after your shift starts before a day counts as late. More than{" "}
              <span className="font-medium text-foreground">{rules.halfDayAfterMinutes} minutes</span>{" "}
              late is a half day. Otherwise it&apos;s a late mark, and every{" "}
              <span className="font-medium text-foreground">{rules.lateMarksForHalfDay}</span> late
              marks in a month also cost a half day. Past{" "}
              <span className="font-medium text-foreground">{rules.absentAfterMinutes} minutes</span>{" "}
              the day is counted as absent.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Automatic marking is currently switched off — attendance is recorded as normal.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              { label: "Grace period", value: `${rules.graceMinutes} min` },
              { label: "Half day after", value: `${rules.halfDayAfterMinutes} min late` },
              { label: "Late marks = half day", value: rules.lateMarksForHalfDay },
              { label: "Full day", value: `${rules.minHoursFullDay} h` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border px-3 py-2">
                <span className="block text-xs text-muted-foreground">{s.label}</span>
                <span className="font-medium text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Object.entries(byCategory).map(([category, policies]) => (
        <div key={category}>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{category}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {policies.map((p) => (
              <button key={p.hrPolicyId} onClick={() => setReading(p)} className="text-left">
                <Card className="h-full p-4 transition-colors hover:border-primary">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-foreground">{p.title}</h4>
                    {p.effectiveFrom && <Badge tone="muted">{fmtDate(p.effectiveFrom)}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{p.body}</p>
                </Card>
              </button>
            ))}
          </div>
        </div>
      ))}

      {!data?.policies.length && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          HR hasn&apos;t published any written policies yet.
        </Card>
      )}

      {reading && (
        <Modal title={reading.title} onClose={() => setReading(null)} wide>
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            {reading.category}
            {reading.effectiveFrom ? ` · effective ${fmtDate(reading.effectiveFrom)}` : ""}
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {reading.body}
          </div>
        </Modal>
      )}
    </div>
  );
}
