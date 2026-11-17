"use client";

/**
 * A partner document or grooming photo as a tile preview.
 *
 * Old uploads are public URLs and open directly. New KYC files are private: the
 * backend only streams them to a signed-in admin, so the browser cannot load them
 * through a plain img tag. They are fetched with the admin's token, shown from a
 * temporary object URL, and released when the tile goes away.
 */

import { useEffect, useState } from "react";
import { fetchPrivateMedia } from "@/src/api/partners";
import { isPrivateMediaPath } from "@/src/lib/media-url";

type PrivateState =
  | { path: string; status: "ready"; objectUrl: string; isImage: boolean }
  | { path: string; status: "failed" };

const frame = "flex h-28 w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground";

function PrivatePreview({ path, label }: { path: string; label: string }) {
  const [state, setState] = useState<PrivateState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchPrivateMedia(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ path, status: "ready", objectUrl, isImage: blob.type.startsWith("image/") });
      })
      .catch(() => {
        if (!cancelled) setState({ path, status: "failed" });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  // The state of an earlier path is not the answer for this one.
  const current = state?.path === path ? state : null;
  if (!current) return <div className={frame}>Loading…</div>;
  if (current.status === "failed") return <div className={frame}>Could not load</div>;
  return (
    <a href={current.objectUrl} target="_blank" rel="noopener noreferrer" title={`Open ${label}`}>
      {current.isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- temporary object URL of a private file
        <img src={current.objectUrl} alt={label} className="h-28 w-full object-cover" />
      ) : (
        <div className={frame}>PDF · tap to open</div>
      )}
    </a>
  );
}

export function DocumentPreview({ url, label }: { url: string; label: string }) {
  if (isPrivateMediaPath(url)) return <PrivatePreview path={url} label={label} />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external KYC document */}
      <img src={url} alt={label} className="h-28 w-full object-cover" />
    </a>
  );
}
