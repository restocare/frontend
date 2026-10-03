"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Provider review reels. Each card shows a branded loader animation until the
 * video's first frame is decodable (the clips are 12–26 MB), plays only while
 * on screen, and carries its own caption instead of one repeated line.
 */
const REELS = [
  {
    id: 1,
    video: "/videos/serviceprovider1.mp4",
    tag: "Review series · Ep 1",
    title: "Inside a client’s kitchen",
  },
  {
    id: 2,
    video: "/videos/serviceprovider2.mp4",
    tag: "Review series · Ep 2",
    title: "What restaurant owners say",
  },
  {
    id: 3,
    video: "/videos/serviceprovider3.mp4",
    tag: "Review series · Ep 3",
    title: "Real work, real ratings",
  },
  {
    id: 4,
    video: "/videos/serviceprovider4.mp4",
    tag: "Review series · Ep 4",
    title: "A word from our team",
  },
];

export function TopProviders() {
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
          {REELS.map((reel) => (
            <ReelCard key={reel.id} {...reel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReelCard({ video, tag, title }: { video: string; tag: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // False until the browser can paint the first frame — the loader shows
  // instead of a blank colour block.
  const [ready, setReady] = useState(false);

  // Heavy clips: only play (and therefore download) while on screen.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="group relative aspect-9/16 overflow-hidden rounded-2xl bg-gray-900 shadow-sm transition hover:shadow-lg">
      <video
        ref={videoRef}
        src={video}
        loop
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Loader — pulsing ring around a play mark on a soft dark gradient */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-linear-to-br from-gray-900 via-gray-800 to-gray-900">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/25" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400" />
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-white/90" aria-hidden>
              <path d="M5.5 3.2v9.6l8-4.8-8-4.8z" />
            </svg>
          </span>
          <span className="text-[11px] font-medium tracking-wide text-white/60">
            Loading reel…
          </span>
        </div>
      )}

      {/* Gradient overlay for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10" />

      {/* Series chip */}
      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        {tag}
      </span>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow">{title}</p>
      </div>
    </div>
  );
}
