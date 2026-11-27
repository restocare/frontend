"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys, siteVideoApi, type SiteVideo } from "@/src/api/api";

/**
 * Provider review reels — YouTube Shorts picked in the admin panel
 * (Dashboard → Videos, section "Provider reels"). Each card autoplays its
 * clip muted and on loop while on screen (like the old local .mp4 cards);
 * the iframe unmounts off-screen so four YouTube players aren't running at
 * once. A static thumbnail covers the gap before/between plays.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [ready, setReady] = useState(false);
  // frame0.jpg is the full-portrait frame YouTube keeps for Shorts; hqdefault
  // is the always-available 4:3 fallback (object-cover crops it to the card).
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${reel.youtubeId}/frame0.jpg`);

  // Only load (and therefore play) the embed while the card is on screen —
  // same gating the old <video> elements used. Clearing `ready` on the way
  // out means the thumbnail is back in place for the reload the next time
  // the card scrolls into view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (!entry.isIntersecting) setReady(false);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: reel.youtubeId, // required by YouTube for a single video to loop
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    disablekb: "1",
  });

  return (
    <div
      ref={containerRef}
      className="group relative aspect-9/16 overflow-hidden rounded-2xl bg-gray-900 shadow-sm transition hover:shadow-lg"
    >
      {onScreen && (
        <iframe
          key={reel.youtubeId}
          src={`https://www.youtube.com/embed/${reel.youtubeId}?${params.toString()}`}
          title={reel.title ?? "Provider reel"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          onLoad={() => setReady(true)}
          className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-500 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Thumbnail covers the loader gap and the off-screen state */}
      {!ready && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail host
        <img
          src={thumb}
          alt=""
          loading="lazy"
          onError={() => setThumb(`https://i.ytimg.com/vi/${reel.youtubeId}/hqdefault.jpg`)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Gradient overlay for legibility (pointer-events-none so the player stays usable) */}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/5" />

      {/* Series chip */}
      {reel.tag && (
        <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          {reel.tag}
        </span>
      )}

      {/* Caption */}
      {reel.title && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <span className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
            {reel.title}
          </span>
        </span>
      )}
    </div>
  );
}
