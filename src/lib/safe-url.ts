/** URL sanitising for admin-provided links and media so `javascript:`/`data:` values can never reach an href/src. */
export function safeUrl(input: string | null | undefined, opts: { allowRelativeFiles?: boolean } = {}): string {
  const v = (input || "").trim();
  if (!v) return "";
  // A local file path is only ours if it stays inside /api/files: `..` segments are never part of a key.
  if (v.startsWith("/api/files/") && (opts.allowRelativeFiles ?? true)) return v.includes("..") ? "" : v.replace(/[\s<>"']/g, "");
  if (v.startsWith("#")) return v.replace(/[\s<>"']/g, "");
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function safeTel(input: string | null | undefined): string {
  return (input || "").replace(/[^\d+]/g, "").slice(0, 20);
}

/**
 * Only Google Maps *embed* URLs may be framed.
 *
 * `/maps/place/...` and `/maps?q=...` are the URLs the desktop address bar and the "Share" dialog give
 * you, and they used to pass this check — but Google refuses to be framed on those paths, so the site
 * showed an empty box and nothing said why. Only `/maps/embed` (the src inside the "Embed a map" iframe
 * snippet) is accepted; anything else is rejected so the admin field can explain what to paste.
 * Any Google country domain works, since `google.com.kw` is what a Kuwaiti browser hands the owner.
 */
const GOOGLE_HOST = /^(?:www\.|maps\.)?google(?:\.[a-z]{2,3}){1,2}$/;

export function safeMapEmbed(input: string | null | undefined): string {
  const v = safeUrl(input, { allowRelativeFiles: false });
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return "";
    const ok = GOOGLE_HOST.test(u.hostname.toLowerCase()) && u.pathname.startsWith("/maps/embed");
    return ok ? u.toString() : "";
  } catch {
    return "";
  }
}

/** True when the value looks like a Google Maps link but not the embed one, so the admin can be told. */
export function isNonEmbedMapUrl(input: string | null | undefined): boolean {
  const v = safeUrl(input, { allowRelativeFiles: false });
  if (!v) return false;
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    if (GOOGLE_HOST.test(host)) return u.pathname.startsWith("/maps") && !u.pathname.startsWith("/maps/embed");
    return host === "maps.app.goo.gl" || (host === "goo.gl" && u.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}

/** Accepts an uploaded/public media URL (our own storage or any https image/video host). */
export function safeMediaUrl(input: string | null | undefined): string {
  return safeUrl(input, { allowRelativeFiles: true });
}
