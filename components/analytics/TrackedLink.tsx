"use client";

import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import {
  contactChannelFromHref,
  trackContactClick,
  trackEvent,
  type MetaEventParams,
} from "@/lib/meta";
import type { MetaEventName } from "@/lib/meta-shared";

export interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * Standard event to fire on click. Omit it for WhatsApp / tel links to the
   * support number: those fire Contact (+ Lead for WhatsApp) automatically.
   */
  event?: MetaEventName;
  /** Extra `custom_data` merged into the event. */
  eventParams?: MetaEventParams;
}

/**
 * A plain <a> that reports the click to Meta before the browser follows the
 * href (tel:, wa.me, mailto:, outbound). Marked data-meta-tracked so the
 * site-wide listener in MetaPixel.tsx leaves it alone.
 */
export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(function TrackedLink(
  { event, eventParams, onClick, href, ...rest },
  ref,
) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    // Report the click itself, whatever other handlers decide to do with it.
    const channel = contactChannelFromHref(href);
    if (channel) {
      trackContactClick(channel, eventParams);
    } else if (event) {
      trackEvent(event, eventParams, undefined, { beforeNavigation: true });
    }
  };

  return <a ref={ref} href={href} onClick={handleClick} data-meta-tracked="1" {...rest} />;
});
