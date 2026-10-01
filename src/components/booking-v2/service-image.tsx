"use client";

/**
 * Service card photo. Service images are 1024px Cloudinary originals
 * (150–200 KB) shown in ~400px cards, so this asks Cloudinary for a
 * card-sized, auto-format copy, shows a shimmer while it loads instead of a
 * flat grey box, and fades the photo in once it's ready.
 */

import { useEffect, useRef, useState } from "react";

const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

/** Cloudinary URL resized to `width` px (auto format/quality); other URLs unchanged. */
export function cloudinarySized(url: string, width: number): string {
  const m = url.match(CLOUDINARY_IMAGE);
  if (!m) return url;
  // Already carries a transformation segment (e.g. "w_400,…/") — leave it alone.
  if (/^[a-z]{1,3}_[^/]*\//.test(m[2])) return url;
  return `${m[1]}f_auto,q_auto,w_${width}/${m[2]}`;
}

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
      {/* eslint-disable-next-line @next/next/no-img-element -- external Cloudinary image */}
      <img
        ref={imgRef}
        src={cloudinarySized(src, 800)}
        srcSet={`${cloudinarySized(src, 400)} 400w, ${cloudinarySized(src, 800)} 800w`}
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${className} ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
