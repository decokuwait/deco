import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSiteMember } from "@/lib/db/members";
import { one } from "@/lib/db/client";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, r2Configured, saveLocalFile, publicUrlFor, contentTypeFor } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local-disk upload endpoint used only when Cloudflare R2 is not configured (development).
 * The key must have been issued by /api/upload (media_assets row) for a site the user administers.
 */
export async function POST(req: NextRequest) {
  if (r2Configured() || process.env.VERCEL) return NextResponse.json({ error: "use_presigned_upload" }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key") || "";
  const m = key.match(/^sites\/([0-9a-f-]{36})\/\d{4}\/\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]{1,80}$/);
  if (!m || key.includes("..")) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const siteId = m[1];
  if (!user.isSuper && !(await isSiteMember(siteId, user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const issued = await one<{ key: string; size: unknown }>(`select key, size from media_assets where key = $1 and site_id = $2`, [key, siteId]);
  if (!issued) return NextResponse.json({ error: "key_not_issued" }, { status: 400 });
  const limit = contentTypeFor(key).startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > limit) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.byteLength) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > limit) return NextResponse.json({ error: "too_large" }, { status: 413 });
  await saveLocalFile(key, buf);
  return NextResponse.json({ ok: true, url: publicUrlFor(key), key });
}
