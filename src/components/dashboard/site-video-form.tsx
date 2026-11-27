"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  queryKeys,
  siteVideoApi,
  type SiteVideo,
  type SiteVideoSection,
} from "@/src/api/api";
import { ApiError } from "@/src/api/apiClient";
import { CloseIcon, SpinnerIcon } from "@/src/components/icons";

interface SiteVideoFormProps {
  video: SiteVideo | null; // null => create
  onClose: () => void;
}

const SECTIONS: { value: SiteVideoSection; label: string; hint: string }[] = [
  {
    value: "REELS",
    label: "Provider reels",
    hint: 'Shorts in "Our top service providers"',
  },
  { value: "BANNER", label: "Kitchen banner", hint: "Reserved for a later update" },
  { value: "COLLAGE", label: "Category collage", hint: "Reserved for a later update" },
];

export function SiteVideoForm({ video, onClose }: SiteVideoFormProps) {
  const isEdit = Boolean(video);
  const queryClient = useQueryClient();

  const [youtubeUrl, setYoutubeUrl] = useState(video?.youtubeUrl ?? "");
  const [section, setSection] = useState<SiteVideoSection>(video?.section ?? "REELS");
  const [title, setTitle] = useState(video?.title ?? "");
  const [tag, setTag] = useState(video?.tag ?? "");
  const [isActive, setIsActive] = useState(video?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<string>(String(video?.sortOrder ?? 0));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        youtubeUrl: youtubeUrl.trim(),
        section,
        title: title.trim(),
        tag: tag.trim(),
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };
      return video ? siteVideoApi.update(video.videoId, payload) : siteVideoApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteVideos });
      queryClient.invalidateQueries({ queryKey: ["site-videos", "active"] });
      onClose();
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    mutation.mutate();
  };

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit video" : "Add video"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">YouTube link *</span>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/…"
              required
              className={inputClass}
            />
            <span className="block text-xs text-muted-foreground">
              Watch, share or Shorts link — the video id is read automatically.
            </span>
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">Shown in</span>
            <div className="grid grid-cols-1 gap-2">
              {SECTIONS.map((opt) => {
                const active = section === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSection(opt.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-ring/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-muted-foreground">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inside a client's kitchen"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Tag</span>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Review series · Ep 1"
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-muted-foreground">Sort order</span>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <Toggle label="Show on website" checked={isActive} onChange={setIsActive} />

          {errorMessage && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending && <SpinnerIcon className="h-4 w-4" />}
              {isEdit ? "Save changes" : "Add video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
