"use client";

import type { ReactNode, MouseEvent } from "react";

declare global {
  interface Window {
    __dkTrack?: (eventKey: "whatsapp_click" | "call_click") => void;
    /** Clicks that happened before the tracking runtime mounted; SiteRuntime drains this on mount. */
    __dkPending?: ("whatsapp_click" | "call_click")[];
  }
}

/**
 * Anchor that records a WhatsApp / call click (server event + browser pixels) before navigating.
 * The href already contains the visitor id inside the prefilled message.
 *
 * A click can land before the runtime has hydrated — on a phone that window is the first seconds of the
 * page, which is exactly when visitors tap the floating WhatsApp button. Those clicks used to vanish:
 * no pixel event, no server event, no conversion. They are queued instead and replayed on mount.
 */
export function WhatsAppLink({
  href,
  kind = "whatsapp_click",
  className,
  children,
  ariaLabel,
}: {
  href: string;
  kind?: "whatsapp_click" | "call_click";
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  function onClick(_e: MouseEvent<HTMLAnchorElement>) {
    try {
      if (window.__dkTrack) window.__dkTrack(kind);
      else (window.__dkPending ??= []).push(kind);
    } catch {
      /* ignore */
    }
  }
  return (
    <a href={href} onClick={onClick} className={className} target={kind === "whatsapp_click" ? "_blank" : undefined} rel="noopener noreferrer" aria-label={ariaLabel}>
      {children}
    </a>
  );
}
