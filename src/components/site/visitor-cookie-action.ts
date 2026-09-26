"use server";

import { cookies, headers } from "next/headers";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, VISITOR_FRESH_COOKIE } from "@/lib/config";
import { isValidVisitorCode } from "@/lib/visitor/code";

/**
 * Re-issue `dk_vid` from the server after a provisional code collided.
 *
 * Why this is a Server Function and not two lines of `document.cookie`: a cookie written by script is
 * capped by Safari's ITP at 7 days, and at **24 hours** when the page was reached by a link-decorated
 * cross-site navigation — which is exactly what `?fbclid=` from an Instagram ad is. iOS Safari
 * dominates in Kuwait, so the one-year visitor cookie was fiction for a large share of the visitors
 * who cost the most to acquire, and the visitor id printed in their WhatsApp message stopped matching
 * them the next day. A `Set-Cookie` from the server carries no such cap.
 *
 * Next cannot set a cookie while rendering a Server Component (the headers are already on their way),
 * and only the render knows the code that was finally allocated — so the client asks for it back.
 *
 * The code is not trusted, and does not need to be: `dk_vid` is an identifier, not a credential. An
 * existing visitor row can only be read or mutated by a caller that also presents the HttpOnly
 * `dk_vsec` secret, so a caller naming somebody else's code simply fails to authenticate and is given
 * a row of its own. The call is still fenced to the one moment it is legitimate — a request carrying
 * the proxy's first-visit marker — so it cannot be used as a general cookie-setting endpoint.
 */
export async function reconcileVisitorCookie(code: string): Promise<void> {
  if (!isValidVisitorCode(code)) return;
  const jar = await cookies();
  if (jar.get(VISITOR_FRESH_COOKIE)?.value !== "1") return;
  if (jar.get(VISITOR_COOKIE)?.value === code) return;
  const proto = (await headers()).get("x-forwarded-proto") || "https";
  jar.set(VISITOR_COOKIE, code, { path: "/", maxAge: VISITOR_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false, secure: proto === "https" });
}
