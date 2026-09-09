"use client";

import type { ReactNode, MouseEvent } from "react";

declare global {
  interface Window {
    __dkTrack?: (eventKey: "whatsapp_click" | "call_click") => void;
  }
}

/**
 * Anchor that records a WhatsApp / call click (server event + browser pixels) before navigating.
 * The href already contains the visitor id inside the prefilled message.
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
      window.__dkTrack?.(kind);
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
