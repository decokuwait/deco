import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSiteMember } from "@/lib/db/members";
import { one } from "@/lib/db/client";
import { ALLOWED_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, UPLOADS_PER_HOUR, r2Configured, saveLocalFile, publicUrlFor, contentTypeFor, sniffContentType } from "@/lib/storage";
import { crossOriginRefusal } from "@/lib/request-origin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The media types a browser may announce here. None of them is a CORS "simple" type, so a cross-origin
 *  caller has to pass a preflight that this route never answers. */
const UPLOAD_CONTENT_TYPES = [...ALLOWED_TYPES];

/**
 * Local-disk upload endpoint used only when Cloudflare R2 is not configured (development).
 * The key must have been issued by /api/upload (media_assets row) for a site the user administers.
 *
 * The declared type is checked against the bytes. It used to be taken on trust, and `/api/files` then
 * served the file back with the type the `media_assets` row recorded — so an HTML document declared as
 * `image/png` came back as a page on the tenant's own origin. `/api/files` defends itself with `nosniff`
 * and a `default-src 'none'; sandbox` CSP, which is the layer that must not be regressed; this is the
 * layer that stops the bad bytes being stored in the first place.
 */
export async function POST(req: NextRequest) {
  if (r2Configured() || process.env.VERCEL) return NextResponse.json({ error: "use_presigned_upload" }, { status: 400 });
  const refusal = crossOriginRefusal(req.headers, UPLOAD_CONTENT_TYPES);
  if (refusal) return NextResponse.json({ error: refusal }, { status: refusal === "cross_site" ? 403 : 415 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await rateLimit(`upload-local:${user.id}`, UPLOADS_PER_HOUR, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const key = req.nextUrl.searchParams.get("key") || "";
  const m = key.match(/^sites\/([0-9a-f-]{36})\/\d{4}\/\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$/);
  if (!m || key.includes("..")) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const siteId = m[1];
  if (!user.isSuper && !(await isSiteMember(siteId, user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const issued = await one<{ key: string; size: unknown; content_type: string | null }>(`select key, size, content_type from media_assets where key = $1 and site_id = $2`, [key, siteId]);
  if (!issued) return NextResponse.json({ error: "key_not_issued" }, { status: 400 });
  const limit = contentTypeFor(key).startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > limit) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.byteLength) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > limit) return NextResponse.json({ error: "too_large" }, { status: 413 });
  // The bytes must be a type we accept, and the same one `/api/upload` recorded on the row — that is the
  // type `/api/files` will hand back, so any disagreement is the file lying about what it is.
  const sniffed = sniffContentType(buf);
  if (!sniffed || !ALLOWED_TYPES.has(sniffed)) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (issued.content_type && issued.content_type !== sniffed) return NextResponse.json({ error: "content_type_mismatch" }, { status: 415 });
  await saveLocalFile(key, buf);
  return NextResponse.json({ ok: true, url: publicUrlFor(key), key });
}
