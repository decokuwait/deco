/**
 * The visitor's bearer credential.
 *
 * The 6-digit `code` is a human-readable id: it is printed in the WhatsApp message, it lives in a
 * JavaScript-readable cookie, and there are only 900,000 of them. It was also the *only* thing
 * `/api/track` asked for before reading or mutating a visitor row, which made the endpoint an oracle
 * ("does code 412233 exist?") and a hijack tool (touch a stranger's row, overwrite its ip/user-agent, and
 * rewrite its ad attribution to your own click id).
 *
 * `dk_vsec` is the companion: 128 bits of randomness, **HttpOnly** so no script on any page can read it,
 * stored in `visitors.secret`, and required before an existing row is read or mutated. It is minted by the
 * proxy at the same moment as the code, so the two always travel together.
 *
 * Deliberately not in `src/lib/config.ts`: that file is shared, and the cookie only ever means something
 * to the proxy and the tracking endpoints.
 */
export const VISITOR_SECRET_COOKIE = "dk_vsec";

/** Forwarded by the proxy so the server render can store the secret on the row it creates. */
export const VISITOR_SECRET_HEADER = "x-dk-vsec";

/** Matches VISITOR_COOKIE_MAX_AGE: a secret that expires before its code strands the visitor. */
export const VISITOR_SECRET_MAX_AGE = 60 * 60 * 24 * 365;

const SECRET_RE = /^[0-9a-f]{32}$/;

/** 128 bits of hex. Web Crypto so the same function works in the proxy and in a route handler. */
export function generateVisitorSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidVisitorSecret(v: unknown): v is string {
  return typeof v === "string" && SECRET_RE.test(v);
}
