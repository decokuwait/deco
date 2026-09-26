import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSiteMember } from "@/lib/db/members";
import { SITE_STORAGE_QUOTA_BYTES, UPLOADS_PER_HOUR, createUploadTarget, storageStatus } from "@/lib/storage";
import { one, q, isUuid } from "@/lib/db/client";
import { crossOriginRefusal } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns an upload target (R2 presigned PUT or local POST) for an authorised site admin.
 *
 * Three things stand in front of the presigned URL, because this route hands out the right to write up to
 * 300 MB into the platform's bucket:
 *  - a CSRF gate. Server Actions get Next's built-in Origin/Host check; a plain route handler gets
 *    nothing, so `crossOriginRefusal` does it — and the `application/json` requirement means a foreign
 *    page cannot reach the handler without a preflight we never answer.
 *  - a per-user rate limit. There was none at all: one signed-in admin could mint presigned URLs in a
 *    loop, and every one of them also inserted a `media_assets` row.
 *  - a per-site storage quota. `media_assets.size` was recorded on every issue and never summed.
 */
export async function POST(req: NextRequest) {
  const refusal = crossOriginRefusal(req.headers);
  if (refusal) return NextResponse.json({ error: refusal }, { status: refusal === "cross_site" ? 403 : 415 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await rateLimit(`upload:${user.id}`, UPLOADS_PER_HOUR, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: { siteId?: unknown; filename?: unknown; contentType?: unknown; size?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const siteId = typeof body.siteId === "string" ? body.siteId : "";
  if (!siteId) return NextResponse.json({ error: "site_required" }, { status: 400 });
  // Shape-checked before the membership branch, not after: a super admin skips the membership check
  // entirely, and the value goes straight into the R2 object key and into a `media_assets` row. Anything
  // that is not a site id is a 400, never a directory of its own in the bucket.
  if (!isUuid(siteId)) return NextResponse.json({ error: "bad_site" }, { status: 400 });
  if (!user.isSuper && !(await isSiteMember(siteId, user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Refuse before handing out a presigned URL that is certain to fail: a browser upload blocked by the
  // bucket CORS policy surfaces in the panel as an opaque network error, and a bucket with no public URL
  // would store files under a URL that 404s. Both are deployment faults, so name them.
  const origin = req.headers.get("origin") || (req.headers.get("x-forwarded-host") ? `https://${req.headers.get("x-forwarded-host")}` : null);
  const storage = await storageStatus(origin);
  if (!storage.ok) {
    console.error(`[upload] refused: ${storage.problem}`);
    return NextResponse.json({ error: storage.cors === "missing" ? "storage_cors" : storage.backend === "r2" ? "storage_public_url" : "storage_not_configured" }, { status: 503 });
  }
  const filename = typeof body.filename === "string" ? body.filename : "file";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const size = typeof body.size === "number" ? body.size : undefined;
  // Quota is checked against what this upload would bring the site to, so the last file that fits is
  // allowed and the one after it is not.
  const used = Number((await one<{ total: unknown }>(`select coalesce(sum(size), 0) as total from media_assets where site_id = $1`, [siteId]))?.total ?? 0);
  if (used + (size ?? 0) > SITE_STORAGE_QUOTA_BYTES) {
    return NextResponse.json({ error: "quota_exceeded", used, quota: SITE_STORAGE_QUOTA_BYTES }, { status: 413 });
  }
  try {
    const target = await createUploadTarget({ siteId, filename, contentType, size });
    await q(
      `insert into media_assets (site_id, key, url, kind, content_type, size) values ($1, $2, $3, $4, $5, $6) on conflict (key) do nothing`,
      [siteId, target.key, target.publicUrl, contentType.startsWith("video/") ? "video" : "image", contentType, size ?? null],
    );
    return NextResponse.json(target);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const status = msg === "unsupported_type" || msg === "too_large" || msg === "size_required" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
