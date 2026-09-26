"use client";

import { useEffect } from "react";
import { reconcileVisitorCookie } from "./visitor-cookie-action";

/**
 * Aligns the visitor cookie with the id the server finally allocated.
 *
 * That only differs from the proxy's provisional id when the provisional id collided with an existing
 * visitor, so this does nothing on the overwhelming majority of first visits and makes no request.
 *
 * It used to re-write `dk_vid` with `document.cookie` on every first visit, which handed a cookie the
 * server had already set properly to Safari's ITP: a script-written cookie is capped at 7 days, and at
 * 24 hours when the page was reached by a link-decorated cross-site navigation — `?fbclid=` from
 * Instagram being precisely that. The one-year lifetime was fiction for a large share of Kuwaiti
 * traffic. The reconciliation now comes back as a `Set-Cookie`, and clearing the first-visit marker is
 * left to the server too (the proxy and /api/track both already do it).
 */
export function VisitorCookie({ code, cookieCode }: { code: string | null; cookieCode?: string | null }) {
  useEffect(() => {
    if (!code) return;
    if (cookieCode !== undefined && cookieCode === code) return;
    reconcileVisitorCookie(code).catch(() => {
      /* the visitor keeps the provisional id for this page; /api/track converges it afterwards */
    });
  }, [code, cookieCode]);
  return null;
}
