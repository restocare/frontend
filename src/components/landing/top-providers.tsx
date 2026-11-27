"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, siteVideoApi, type SiteVideo } from "@/src/api/api";

/**
 * Provider review reels — YouTube Shorts picked in the admin panel
 * (Dashboard → Videos, section "Provider reels"). Each card shows the clip's
 * thumbnail with a play button; tapping swaps in the YouTube player, so the
 * page never preloads four videos.
 */
export function TopProviders() {
  const { data } = useQuery({
    queryKey: queryKeys.siteVideosActive("REELS"),
    queryFn: () => siteVideoApi.listActive("REELS"),
  });
  const reels = data ?? [];

  // No clips chosen in the admin yet — the section simply doesn't render.
  if (reels.length === 0) return null;

  return (
    <section className="bg-gray-50 py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="text-xl font-bold tracking-tight text-[#0A192F] sm:text-[38px]">
            Our top service providers
          </h2>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Watch our trusted professionals in action.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {reels.map((reel) => (
            <ReelCard key={reel.videoId} reel={reel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReelCard({ reel }: { reel: SiteVideo }) {
  const [playing, setPlaying] = useState(false);
  // frame0.jpg is the full-portrait frame YouTube keeps for Shorts; hqdefault
  // is the always-available 4:3 fallback (object-cover crops it to the card).
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${reel.youtubeId}/frame0.jpg`);

  if (playing) {
    return (
      <div className="relative aspect-9/16 overflow-hidden rounded-2xl bg-black shadow-lg">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${reel.youtubeId}?autoplay=1&playsinline=1&rel=0`}
          title={reel.title ?? "Provider reel"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play: ${reel.title ?? reel.tag ?? "provider reel"}`}
      className="group relative block aspect-9/16 w-full overflow-hidden rounded-2xl bg-gray-900 text-left shadow-sm transition hover:shadow-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail host */}
      <img
        src={thumb}
        alt=""
        loading="lazy"
        onError={() => setThumb(`https://i.ytimg.com/vi/${reel.youtubeId}/hqdefault.jpg`)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Gradient overlay for legibility */}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10" />

      {/* Play button */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm ring-1 ring-white/25 transition group-hover:scale-110 group-hover:bg-black/70">
          <svg viewBox="0 0 16 16" className="ml-0.5 h-5 w-5 fill-white" aria-hidden>
            <path d="M5.5 3.2v9.6l8-4.8-8-4.8z" />
          </svg>
        </span>
      </span>

      {/* Series chip */}
      {reel.tag && (
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          {reel.tag}
        </span>
      )}

      {/* Caption */}
      {reel.title && (
        <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <span className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
            {reel.title}
          </span>
        </span>
      )}
    </button>
  );
}
