"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi, type PartnerProgressRow } from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { SearchIcon, SpinnerIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const PAGE_SIZE = 20;

const STAGE_TABS = [
  { key: "", label: "All" },
  { key: "ONBOARDING", label: "Onboarding" },
  { key: "TRAINING", label: "Training" },
  { key: "DEPLOYMENT", label: "Deployment" },
  { key: "LIVE", label: "Live" },
] as const;

function istDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** The 3-dot mini pipeline: ✓ for finished stages, a pulse on the current one. */
function StageDots({ p }: { p: PartnerProgressRow }) {
  const steps = [
    { label: "Onboarding", done: p.onboardingStatus === "VERIFIED" || p.stage > 1 || p.live },
    { label: "Training", done: !!p.trainingCompletedAt },
    { label: "Deployment", done: p.live },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => {
        const active = !s.done && (i === 0 || steps[i - 1].done);
        return (
          <div key={s.label} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className={`h-0.5 w-4 rounded ${steps[i - 1].done ? "bg-success" : "bg-border"}`} />
            )}
            <div
              title={s.label}
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                s.done
                  ? "bg-success text-white"
                  : active
                    ? "bg-warning text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StageBadge({ p }: { p: PartnerProgressRow }) {
  if (p.onboardingStatus === "REJECTED") {
    return (
      <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
        Rejected
      </span>
    );
  }
  const meta = p.live
    ? { text: "Live", cls: "bg-success/10 text-success" }
    : p.stageName === "DEPLOYMENT"
      ? { text: "Ready to deploy", cls: "bg-primary/10 text-primary" }
      : p.stageName === "TRAINING"
        ? { text: "In training", cls: "bg-warning/10 text-warning" }
        : { text: "Onboarding", cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
      {meta.text}
    </span>
  );
}

export default function PartnerProgressPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<PartnerProgressRow | null>(null);
  const [note, setNote] = useState("");

  const canManage = hasPermission("partner-progress.manage");

  const params = { search: search.trim() || undefined, stage: tab || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["partner-progress", params],
    queryFn: () => dashboardApi.partnerProgress(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["partner-progress"] });
  const onErr = (e: unknown) =>
    setNotice(e instanceof ApiError ? e.message : "Something went wrong. Try again.");

  const start = useMutation({
    mutationFn: (id: number) => dashboardApi.startTraining(id),
    onSuccess: (r) => {
      setNotice(r.message);
      invalidate();
    },
    onError: onErr,
  });
  const complete = useMutation({
    mutationFn: ({ id, note: n }: { id: number; note?: string }) =>
      dashboardApi.completeTraining(id, n),
    onSuccess: (r) => {
      setNotice(r.message);
      setNoteFor(null);
      setNote("");
      invalidate();
    },
    onError: onErr,
  });
  const deploy = useMutation({
    mutationFn: (id: number) => dashboardApi.deployPartner(id),
    onSuccess: (r) => {
      setNotice(r.message);
      invalidate();
    },
    onError: onErr,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The partner pipeline — document onboarding, the 15-day training a trainer signs off,
          then final deployment. Partners see the same stages in their app.
        </p>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {STAGE_TABS.map((t) => {
            const count =
              !counts
                ? null
                : t.key === ""
                  ? counts.all
                  : t.key === "LIVE"
                    ? counts.live
                    : counts[t.key.toLowerCase() as "onboarding" | "training" | "deployment"];
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {count != null ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, mobile, city…"
            className="w-64 rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <SpinnerIcon className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <p className="text-muted-foreground">Couldn’t load the pipeline.</p>
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Pipeline</th>
                  <th className="px-5 py-3 font-medium">Stage</th>
                  <th className="px-5 py-3 font-medium">Training</th>
                  <th className="px-5 py-3 font-medium">Grooming</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.partners ?? []).map((p) => (
                  <tr key={p.professionalId} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{p.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.mobile ?? ""}
                        {p.city ? ` · ${p.city}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StageDots p={p} />
                    </td>
                    <td className="px-5 py-3">
                      <StageBadge p={p} />
                      {p.live && p.deployedAt && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          since {istDate(p.deployedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.trainingCompletedAt ? (
                        <div>
                          <span className="font-medium text-success">Completed</span>
                          <div className="text-[11px] text-muted-foreground">
                            {istDate(p.trainingStartedAt)} → {istDate(p.trainingCompletedAt)}
                            {p.trainingNote ? ` · “${p.trainingNote}”` : ""}
                          </div>
                        </div>
                      ) : p.trainingStartedAt ? (
                        <div>
                          <span className="font-medium text-foreground">
                            Day {p.trainingDay}/{p.trainingDays}
                          </span>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded bg-muted">
                            <div
                              className="h-full rounded bg-warning"
                              style={{ width: `${(p.trainingDay / p.trainingDays) * 100}%` }}
                            />
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            started {istDate(p.trainingStartedAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not started</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          p.groomingApproved >= p.groomingTotal
                            ? "font-medium text-success"
                            : "text-muted-foreground"
                        }
                      >
                        {p.groomingApproved}/{p.groomingTotal}
                      </span>
                      {p.groomingEnforced && (
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          required
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!canManage ? null : p.live ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : p.onboardingStatus === "REJECTED" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : p.stageName === "ONBOARDING" ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Verify documents from Service Partners first"
                        >
                          Awaiting document verification
                        </span>
                      ) : !p.trainingStartedAt ? (
                        <button
                          onClick={() => start.mutate(p.professionalId)}
                          disabled={start.isPending}
                          className="rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          Start training
                        </button>
                      ) : !p.trainingCompletedAt ? (
                        <button
                          onClick={() => {
                            setNoteFor(p);
                            setNote("");
                          }}
                          disabled={complete.isPending}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                        >
                          Complete training
                        </button>
                      ) : (
                        <button
                          onClick={() => deploy.mutate(p.professionalId)}
                          disabled={deploy.isPending}
                          className="rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          🚀 Deploy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.partners.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                      No partners in this stage.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {data?.total ?? 0} partner(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((x) => Math.max(1, x - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Trainer sign-off dialog: optional remark stored on the profile. */}
      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNoteFor(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-foreground">Complete training</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirm that {noteFor.name ?? `partner #${noteFor.professionalId}`} finished the{" "}
              {noteFor.trainingDays}-day training
              {noteFor.trainingDay < noteFor.trainingDays
                ? ` (currently day ${noteFor.trainingDay})`
                : ""}
              .
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Trainer remark (optional)"
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNoteFor(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => complete.mutate({ id: noteFor.professionalId, note: note.trim() || undefined })}
                disabled={complete.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {complete.isPending ? "Saving…" : "Confirm completion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
