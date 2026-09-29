"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Kitchen showreel with context. The clip sits in a contained, rounded card at
 * (or below) its source resolution instead of being stretched full-width, and
 * the copy + CTA say what the viewer is looking at.
 */
export function VideoBanner() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only play while on screen; metadata preload paints the first frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-white py-10 sm:py-14">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-[38px]">
            Inside a working kitchen
          </h2>
          <p className="mt-3 max-w-md text-sm text-gray-600 sm:text-base">
            The professionals you book on RestoCare — chefs, helpers and
            cleaning staff — on shift in the kitchens and dining rooms we serve.
          </p>
          <Link
            href="/#categories"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Book a professional
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z" />
            </svg>
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-black ring-1 ring-black/5">
          <video
            ref={videoRef}
            src="/videos/restocare-service.mp4"
            loop
            muted
            playsInline
            preload="metadata"
            className="aspect-video w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
