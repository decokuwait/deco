/**
 * Headers the browser must put on an upload request, given the target issued by /api/upload.
 *
 * Two rules, both of which the bucket enforces through the signature:
 *  - Content-Length is left out. XHR forbids setting it and the browser sends the real one anyway.
 *  - every name appears exactly once. `setRequestHeader` merges repeated names into a single
 *    comma-joined value, so setting Content-Type twice sends `image/png, image/png`, which no longer
 *    matches what was signed and the bucket rejects as a bad signature — reaching the panel as nothing
 *    but an opaque network error.
 */
export function uploadRequestHeaders(headers: Record<string, string> | undefined, fileType: string): [string, string][] {
  const source = headers ?? { "Content-Type": fileType || "application/octet-stream" };
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const [name, value] of Object.entries(source)) {
    const key = name.toLowerCase();
    if (key === "content-length" || seen.has(key)) continue;
    seen.add(key);
    out.push([name, value]);
  }
  return out;
}
