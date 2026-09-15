import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isSiteMember } from "@/lib/db/members";
import { createUploadTarget, storageStatus } from "@/lib/storage";
import { q } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns an upload target (R2 presigned PUT or local POST) for an authorised site admin. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { siteId?: unknown; filename?: unknown; contentType?: unknown; size?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const siteId = typeof body.siteId === "string" ? body.siteId : "";
  if (!siteId) return NextResponse.json({ error: "site_required" }, { status: 400 });
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
  try {
    const target = await createUploadTarget({ siteId, filename, contentType, size });
    await q(
      `insert into media_assets (site_id, key, url, kind, content_type, size) values ($1, $2, $3, $4, $5, $6) on conflict (key) do nothing`,
      [siteId, target.key, target.publicUrl, contentType.startsWith("video/") ? "video" : "image", contentType, size ?? null],
    );
    return NextResponse.json(target);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    const status = msg === "unsupported_type" || msg === "too_large" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
