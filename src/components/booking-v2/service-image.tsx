"use client";

/**
 * Service card photo. Service images are 1024px originals (150–200 KB) shown
 * in ~400px cards, so this asks for a card-sized copy (see mediaSized), shows a
 * shimmer while it loads instead of a flat grey box, and fades the photo in
 * once it's ready. If the small copy is missing it falls back to the original.
 */

import { useEffect, useRef, useState } from "react";

import { mediaSized } from "@/src/lib/media-url";

export function ServiceImage({
  src,
  alt,
  eager = false,
  className = "",
}: {
  src: string;
  alt: string;
  /** First row of cards: start downloading immediately. */
  eager?: boolean;
  /** Must include a `transition` class for the fade-in to animate. */
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  useEffect(() => {
    // A cached image can finish before hydration attaches onLoad.
    if (imgRef.current?.complete) queueMicrotask(() => setLoaded(true));
  }, []);

  return (
    <>
      {!loaded ? (
        <div
          aria-hidden
          className="absolute inset-0 animate-pulse bg-linear-to-br from-gray-100 via-gray-200 to-gray-100"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- external image */}
      <img
        ref={imgRef}
        src={useOriginal ? src : mediaSized(src, 800)}
        srcSet={
          useOriginal ? undefined : `${mediaSized(src, 400)} 400w, ${mediaSized(src, 800)} 800w`
        }
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // The resized copy can be missing (an older upload): try the original once.
          if (!useOriginal && mediaSized(src, 800) !== src) setUseOriginal(true);
          else setLoaded(true);
        }}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
