/** URL sanitising for admin-provided links and media so `javascript:`/`data:` values can never reach an href/src. */
export function safeUrl(input: string | null | undefined, opts: { allowRelativeFiles?: boolean } = {}): string {
  const v = (input || "").trim();
  if (!v) return "";
  if (v.startsWith("/api/files/") && (opts.allowRelativeFiles ?? true)) return v.replace(/[\s<>"']/g, "");
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

/** Only Google Maps embed URLs may be framed. */
export function safeMapEmbed(input: string | null | undefined): string {
  const v = safeUrl(input, { allowRelativeFiles: false });
  if (!v) return "";
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    const ok = (host === "www.google.com" || host === "google.com" || host === "maps.google.com") && u.pathname.startsWith("/maps");
    return ok ? u.toString() : "";
  } catch {
    return "";
  }
}

/** Accepts an uploaded/public media URL (our own storage or any https image/video host). */
export function safeMediaUrl(input: string | null | undefined): string {
  return safeUrl(input, { allowRelativeFiles: true });
}
