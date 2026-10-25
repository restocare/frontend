"use client";

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { META_PIXEL_ID } from "@/lib/meta-shared";
import { contactChannelFromHref, trackContactClick, trackPageView } from "@/lib/meta";

/**
 * The official Meta Pixel base code, with two changes so it is safe here:
 *  - the stub is only created when missing (a tracking call that runs before
 *    this script may already have queued events), and loading + init are
 *    guarded by a flag instead of the snippet's early `return`;
 *  - no `fbq('track','PageView')`: MetaPageView below fires PageView with an
 *    event id on first load and on every client-side navigation, so the
 *    Conversions API copy deduplicates against it.
 */
function baseCode(pixelId: string): string {
  return `
!function(f,b,e,v,n,t,s){
  if(!f.fbq){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}
  if(f.__rcMetaPixel)return;f.__rcMetaPixel=1;
  t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
  s?s.parentNode.insertBefore(t,s):b.head.appendChild(t);
  f.fbq('init','${pixelId}');
}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
`;
}

/** Fires PageView once per URL (pathname + query), including the first load. */
function MetaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = `${pathname}?${query}`;
    // Guards React StrictMode's double effect run and same-URL re-renders.
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    trackPageView();
  }, [pathname, query]);

  return null;
}

/**
 * Catches every WhatsApp / tel link to the support number anywhere on the
 * site (server-rendered content included) and fires Contact (+ Lead for
 * WhatsApp). Links rendered through <TrackedLink> opt out via
 * data-meta-tracked so a click is never counted twice.
 */
function useSupportLinkTracking() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.metaTracked) return;
      const channel = contactChannelFromHref(anchor.getAttribute("href"));
      if (!channel) return;
      trackContactClick(channel);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}

export function MetaPixel() {
  useSupportLinkTracking();

  useEffect(() => {
    if (!META_PIXEL_ID && process.env.NODE_ENV !== "production") {
      console.warn("[meta-pixel] NEXT_PUBLIC_META_PIXEL_ID is not set; Meta Pixel is disabled.");
    }
  }, []);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: baseCode(META_PIXEL_ID) }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      {/* useSearchParams needs a Suspense boundary so static pages stay static. */}
      <Suspense fallback={null}>
        <MetaPageView />
      </Suspense>
    </>
  );
}
