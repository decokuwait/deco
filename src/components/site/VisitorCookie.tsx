"use client";

import { useEffect } from "react";

/**
 * Aligns the visitor cookie with the id the server finally allocated (differs from the proxy's
 * provisional id only when that id collided with an existing visitor) and clears the first-visit marker.
 */
export function VisitorCookie({ code }: { code: string | null }) {
  useEffect(() => {
    if (!code) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `dk_vid=${code}; path=/; max-age=31536000; samesite=lax${secure}`;
    document.cookie = `dk_vid_new=; path=/; max-age=0`;
  }, [code]);
  return null;
}
