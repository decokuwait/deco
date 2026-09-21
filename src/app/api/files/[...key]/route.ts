import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import { ALLOWED_TYPES, localPathFor } from "@/lib/storage";
import { one } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves locally stored uploads (development fallback when R2 is not configured).
 *
 * The content type comes from the `media_assets` row that issued the key — the type `/api/upload`
 * validated against ALLOWED_TYPES — and not from the file extension. Guessing from the extension meant a
 * file uploaded as `image/png` but named `logo.svg` was served back as `image/svg+xml`, which a browser
 * executes as a document: stored XSS on the tenant's own origin.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  if (joined.includes("..")) return new NextResponse("Bad key", { status: 400 });
  let p: string;
  try {
    p = localPathFor(joined);
  } catch {
    return new NextResponse("Bad key", { status: 400 });
  }
  if (!fs.existsSync(p)) return new NextResponse("Not found", { status: 404 });
  const asset = await one<{ content_type: string | null }>(`select content_type from media_assets where key = $1`, [joined]).catch(() => null);
  const declared = asset?.content_type ?? "";
  const contentType = ALLOWED_TYPES.has(declared) ? declared : "application/octet-stream";
  const data = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
