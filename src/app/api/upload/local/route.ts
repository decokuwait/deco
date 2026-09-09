import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { r2Configured, saveLocalFile, publicUrlFor } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local-disk upload endpoint used only when Cloudflare R2 is not configured (development). */
export async function POST(req: NextRequest) {
  if (r2Configured()) return NextResponse.json({ error: "use_presigned_upload" }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!key.startsWith("sites/") || key.includes("..")) return NextResponse.json({ error: "bad_key" }, { status: 400 });
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.byteLength) return NextResponse.json({ error: "empty" }, { status: 400 });
  await saveLocalFile(key, buf);
  return NextResponse.json({ ok: true, url: publicUrlFor(key), key });
}
