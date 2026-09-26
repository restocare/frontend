"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dispatchApi,
  queryKeys,
  type PricingRuleInput,
  type PricingRuleRow,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import {
  CloseIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TagIcon,
  TrashIcon,
} from "@/src/components/icons";

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PricingRulesPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [editorTarget, setEditorTarget] = useState<PricingRuleRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<PricingRuleRow | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.pricingRules,
    queryFn: () => dispatchApi.listPricingRules(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dispatcher", "pricing-rules"] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      dispatchApi.updatePricingRule(id, { isActive }),
    onSuccess: invalidate,
    onError: (e) => setNotice(e instanceof ApiError ? e.message : "Action failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dispatchApi.deletePricingRule(id),
    onSuccess: (res) => {
      setNotice(res.message);
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => {
      setDeleteTarget(null);
      setNotice(e instanceof ApiError ? e.message : "Could not delete the rule.");
    },
  });

  const rules = data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pricing Rules</h1>
          <p className="text-sm text-muted-foreground">
            Delivery fare rules — base fare, distance and time components. Scope a rule to a team
            or zone, or leave it platform-wide.
          </p>
        </div>
        <button
          onClick={() => setEditorTarget("new")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-2.5 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-60 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">Couldn’t load pricing rules.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : rules.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
            <TagIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No pricing rules yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Rule</th>
                  <th className="px-5 py-3 font-medium">Base fare</th>
                  <th className="px-5 py-3 font-medium">Per km</th>
                  <th className="px-5 py-3 font-medium">Per min</th>
                  <th className="px-5 py-3 font-medium">Min fare</th>
                  <th className="px-5 py-3 font-medium">Scope</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.ruleId}
                    className="border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-5 py-3 font-medium text-foreground">{r.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {inr(r.baseFare)}
                      {r.baseDistanceKm > 0 && (
                        <span className="block text-xs">first {r.baseDistanceKm} km</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.perKmFare > 0 ? inr(r.perKmFare) : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.perMinuteFare > 0 ? inr(r.perMinuteFare) : "—"}
                      {r.waitingFarePerMin > 0 && (
                        <span className="block text-xs">wait {inr(r.waitingFarePerMin)}/min</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.minFare != null ? inr(r.minFare) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {r.team ? (
                        <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
                          Team · {r.team.name}
                        </span>
                      ) : r.geofence ? (
                        <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
                          Zone · {r.geofence.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Platform-wide</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <button
                          role="switch"
                          aria-checked={r.isActive}
                          onClick={() =>
                            toggleMutation.mutate({ id: r.ruleId, isActive: !r.isActive })
                          }
                          disabled={toggleMutation.isPending}
                          aria-label={r.isActive ? "Deactivate rule" : "Activate rule"}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                            r.isActive ? "bg-success" : "bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              r.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs font-medium ${
                            r.isActive ? "text-success" : "text-muted-foreground"
                          }`}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditorTarget(r)}
                          aria-label="Edit rule"
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          aria-label="Delete rule"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editorTarget !== null && (
        <PricingRuleFormDialog
          rule={editorTarget === "new" ? null : editorTarget}
          onClose={() => setEditorTarget(null)}
          onSaved={(message) => {
            setEditorTarget(null);
            setNotice(message);
            invalidate();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          danger
          title="Delete this pricing rule?"
          confirmLabel="Delete"
          busy={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.ruleId)}
          message={
            <>
              This will delete <strong className="text-foreground">{deleteTarget.name}</strong>.
              This action is irreversible.
            </>
          }
        />
      )}
    </div>
  );
}

/* ------------------------- Create / edit dialog ------------------------- */

type Scope = "PLATFORM" | "TEAM" | "GEOFENCE";

function PricingRuleFormDialog({
  rule,
  onClose,
  onSaved,
}: {
  rule: PricingRuleRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [baseFare, setBaseFare] = useState(rule ? String(rule.baseFare) : "");
  const [baseDistanceKm, setBaseDistanceKm] = useState(rule ? String(rule.baseDistanceKm) : "0");
  const [perKmFare, setPerKmFare] = useState(rule ? String(rule.perKmFare) : "0");
  const [perMinuteFare, setPerMinuteFare] = useState(rule ? String(rule.perMinuteFare) : "0");
  const [waitingFarePerMin, setWaitingFarePerMin] = useState(
    rule ? String(rule.waitingFarePerMin) : "0",
  );
  const [minFare, setMinFare] = useState(rule?.minFare != null ? String(rule.minFare) : "");
  const [scope, setScope] = useState<Scope>(
    rule?.teamId != null ? "TEAM" : rule?.geofenceId != null ? "GEOFENCE" : "PLATFORM",
  );
  const [teamId, setTeamId] = useState<number | null>(rule?.teamId ?? null);
  const [geofenceId, setGeofenceId] = useState<number | null>(rule?.geofenceId ?? null);
  const [error, setError] = useState<string | null>(null);

  const { data: teams } = useQuery({
    queryKey: queryKeys.dispatchTeams(""),
    queryFn: () => dispatchApi.listTeams(),
  });
  const { data: fences } = useQuery({
    queryKey: queryKeys.geofences(""),
    queryFn: () => dispatchApi.listGeofences(),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body: PricingRuleInput = {
        name: name.trim(),
        baseFare: Number(baseFare),
        baseDistanceKm: Number(baseDistanceKm) || 0,
        perKmFare: Number(perKmFare) || 0,
        perMinuteFare: Number(perMinuteFare) || 0,
        waitingFarePerMin: Number(waitingFarePerMin) || 0,
        minFare: minFare.trim() === "" ? undefined : Number(minFare),
        teamId: scope === "TEAM" ? teamId : null,
        geofenceId: scope === "GEOFENCE" ? geofenceId : null,
      };
      return rule
        ? dispatchApi.updatePricingRule(rule.ruleId, body)
        : dispatchApi.createPricingRule(body);
    },
    onSuccess: () => onSaved(rule ? "Pricing rule updated." : "Pricing rule created."),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the rule."),
  });

  const scopeValid =
    scope === "PLATFORM" ||
    (scope === "TEAM" && teamId != null) ||
    (scope === "GEOFENCE" && geofenceId != null);
  const canSave =
    name.trim().length >= 2 &&
    baseFare.trim() !== "" &&
    Number(baseFare) >= 0 &&
    scopeValid &&
    !mutation.isPending;

  const numberField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    hint?: string,
  ) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        type="number"
        min={0}
        step="0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) mutation.mutate();
        }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {rule ? "Edit Pricing Rule" : "Add Pricing Rule"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Standard Delhi"
            autoFocus
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {numberField("Base fare (₹)", baseFare, setBaseFare)}
          {numberField(
            "Base distance (km)",
            baseDistanceKm,
            setBaseDistanceKm,
            "Distance covered by the base fare.",
          )}
          {numberField("Per km beyond base (₹)", perKmFare, setPerKmFare)}
          {numberField("Per minute (₹)", perMinuteFare, setPerMinuteFare)}
          {numberField("Waiting per minute (₹)", waitingFarePerMin, setWaitingFarePerMin)}
          {numberField("Minimum fare (₹)", minFare, setMinFare, "Optional fare floor.")}
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Applies to</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["PLATFORM", "Platform-wide"],
                ["TEAM", "A team"],
                ["GEOFENCE", "A geofence"],
              ] as [Scope, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                  scope === key
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {scope === "TEAM" && (
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Choose a team…</option>
              {(teams ?? []).map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {scope === "GEOFENCE" && (
            <select
              value={geofenceId ?? ""}
              onChange={(e) => setGeofenceId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Choose a geofence…</option>
              {(fences ?? []).map((f) => (
                <option key={f.geofenceId} value={f.geofenceId}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? <SpinnerIcon className="h-4 w-4" /> : null}
            {rule ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </form>
    </div>
  );
}
