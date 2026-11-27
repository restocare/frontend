"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, siteVideoApi, type SiteVideo } from "@/src/api/api";
import { SiteVideoForm } from "@/src/components/dashboard/site-video-form";
import { MonitorIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/src/components/icons";

const SECTION_LABEL: Record<string, string> = {
  REELS: "Provider reels",
  BANNER: "Kitchen banner",
  COLLAGE: "Category collage",
};

export default function VideosPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SiteVideo | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.siteVideos,
    queryFn: () => siteVideoApi.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.siteVideos });
    queryClient.invalidateQueries({ queryKey: ["site-videos", "active"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => siteVideoApi.remove(id),
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: (video: SiteVideo) =>
      siteVideoApi.update(video.videoId, { isActive: !video.isActive }),
    onSuccess: invalidate,
  });

  const videos = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (video: SiteVideo) => {
    setEditing(video);
    setFormOpen(true);
  };
  const handleDelete = (video: SiteVideo) => {
    if (confirm("Remove this video from the website? This cannot be undone.")) {
      deleteMutation.mutate(video.videoId);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Videos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            YouTube clips shown in the website&apos;s video sections. Paste a link — no upload
            needed.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Add video
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-60 items-center justify-center text-muted-foreground">
          <SpinnerIcon className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-center">
          <p className="text-muted-foreground">Couldn&apos;t load videos.</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card text-center">
          <MonitorIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No videos yet.</p>
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Add a video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative aspect-9/16 w-full bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail */}
                <img
                  src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                  alt={video.title ?? "Video thumbnail"}
                  className="h-full w-full object-cover"
                />
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                  {SECTION_LABEL[video.section] ?? video.section}
                </span>
                <span
                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${
                    video.isActive ? "bg-success/15 text-success" : "bg-black/50 text-white"
                  }`}
                >
                  {video.isActive ? "Active" : "Hidden"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {video.title || video.youtubeId}
                  </p>
                  {video.tag && (
                    <p className="truncate text-xs text-muted-foreground">{video.tag}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Order: {video.sortOrder}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    onClick={() => toggleMutation.mutate(video)}
                    disabled={toggleMutation.isPending}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {video.isActive ? "Hide" : "Show"}
                  </button>
                  <div className="flex items-center">
                    <button
                      onClick={() => openEdit(video)}
                      aria-label="Edit video"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(video)}
                      disabled={deleteMutation.isPending}
                      aria-label="Delete video"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && <SiteVideoForm video={editing} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
