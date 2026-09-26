"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resumeApi, resumeQueryKeys, type ResumeSummaryRow } from "@/src/api/api";
import { starterResume } from "@/src/lib/resume";
import { getTemplate, RESUME_TEMPLATES } from "@/src/lib/resume-templates";
import { PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";
import { ImportResumeModal } from "@/src/components/resume-builder/import-modal";

export default function ResumeBuilderListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: resumeQueryKeys.resumes,
    queryFn: () => resumeApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => resumeApi.create({ title: "Untitled resume", data: starterResume() }),
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: resumeQueryKeys.resumes });
      router.push(`/dashboard/tools/resume-builder/${resume.resumeId}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => resumeApi.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumeQueryKeys.resumes }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resumeApi.remove(id),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: resumeQueryKeys.resumes });
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resume Builder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {RESUME_TEMPLATES.length} templates · inline editing · AI text enhancement · ATS scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            ⤴ Upload Resume
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <SpinnerIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            New Resume
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not load resumes.
        </p>
      ) : !data || data.length === 0 ? (
        <button
          onClick={() => createMutation.mutate()}
          className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-16 text-center transition hover:border-primary/60"
        >
          <span className="text-base font-semibold text-foreground">Create your first resume</span>
          <span className="text-sm text-muted-foreground">
            Starts with a ready-made structure you can edit in place.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((resume) => (
            <ResumeCard
              key={resume.resumeId}
              resume={resume}
              onOpen={() => router.push(`/dashboard/tools/resume-builder/${resume.resumeId}`)}
              onDuplicate={() => duplicateMutation.mutate(resume.resumeId)}
              onDelete={() => setDeleting(resume.resumeId)}
            />
          ))}
        </div>
      )}

      {importOpen && (
        <ImportResumeModal
          onCreated={(id) => {
            queryClient.invalidateQueries({ queryKey: resumeQueryKeys.resumes });
            router.push(`/dashboard/tools/resume-builder/${id}`);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {deleting !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleting(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Delete resume?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-input px-3.5 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleting)}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeCard({
  resume,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  resume: ResumeSummaryRow;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const template = getTemplate(resume.template);
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {/* schematic thumb colored by the resume's template */}
        <div className="h-28 w-full" style={{ background: template.sidebarBg ?? template.headerBg ?? `${template.accent}22` }}>
          <div className="flex h-full flex-col justify-end p-4">
            <div className="h-2 w-2/5 rounded-full" style={{ background: template.accent }} />
            <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-white/70" />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="truncate text-sm font-semibold text-foreground">{resume.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {template.name} · updated {new Date(resume.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={onOpen}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-accent"
        >
          Edit
        </button>
        <button
          onClick={onDuplicate}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
          title="Delete"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
