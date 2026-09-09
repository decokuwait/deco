import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import { contentTypeFor, localPathFor } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves locally stored uploads (development fallback when R2 is not configured). */
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
  const data = fs.readFileSync(p);
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": contentTypeFor(joined), "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
