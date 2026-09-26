import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { diagnoseUploadFailure } from "@/lib/storage";
import { crossOriginRefusal } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Names the cause of an upload that has already failed in the browser.
 *
 * The panel calls this only on the failure path. A presigned upload goes straight from the browser to the
 * bucket, and when that request never lands the browser hands JavaScript a single opaque error — the same
 * one for a blocked CORS preflight, an unreachable bucket and a dead Wi-Fi connection. The owner saw
 * "connection lost" for all three and had no way to tell a fault in their own deployment from a fault on
 * their own desk. The server can ask the bucket directly, so it answers the question here instead.
 *
 * Guarded the same way `/api/upload` is, and for the same reason: it is signed-in-only, CSRF-gated, and
 * rate limited, because each call makes the deployment perform an outbound request to Cloudflare. The
 * answer names a failure category and nothing else — never the bucket, the account or the policy.
 */
export async function POST(req: NextRequest) {
  const refusal = crossOriginRefusal(req.headers);
  if (refusal) return NextResponse.json({ error: refusal }, { status: refusal === "cross_site" ? 403 : 415 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // A failed upload is retried by hand a few times at most; a loop of these is someone using the
  // deployment to probe Cloudflare. Falling back to "network" keeps the panel's message truthful when the
  // limit does bite, since an unanswered diagnosis is exactly as informative as no diagnosis.
  if (!(await rateLimit(`upload-diagnose:${user.id}`, 30, 3600))) return NextResponse.json({ reason: "network" });
  const origin = req.headers.get("origin") || (req.headers.get("x-forwarded-host") ? `https://${req.headers.get("x-forwarded-host")}` : null);
  return NextResponse.json({ reason: await diagnoseUploadFailure(origin) });
}
