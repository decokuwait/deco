import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Media storage: Cloudflare R2 (S3 API, presigned PUT uploads straight from the browser)
 * with a local-disk fallback for development when R2 is not configured.
 */
export type UploadTarget =
  | { mode: "put"; uploadUrl: string; publicUrl: string; key: string; headers: Record<string, string> }
  | { mode: "post"; uploadUrl: string; publicUrl: string; key: string };

export const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function localUploadsDir() {
  return process.env.LOCAL_UPLOADS_DIR || path.join(process.cwd(), ".data", "uploads");
}

export function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

export function buildKey(siteId: string, filename: string) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `sites/${siteId}/${yyyy}/${mm}/${randomUUID()}-${safeFilename(filename)}`;
}

export function publicUrlFor(key: string): string {
  if (r2Configured() && process.env.R2_PUBLIC_URL) return `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return `/api/files/${key}`;
}

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}

export async function createUploadTarget(input: { siteId: string; filename: string; contentType: string; size?: number }): Promise<UploadTarget> {
  if (!ALLOWED_TYPES.has(input.contentType)) throw new Error("unsupported_type");
  const isVideo = input.contentType.startsWith("video/");
  if (input.size && input.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new Error("too_large");
  const key = buildKey(input.siteId, input.filename);
  if (r2Configured()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await s3();
    const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: input.contentType });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 60 * 10 });
    return { mode: "put", uploadUrl, publicUrl: publicUrlFor(key), key, headers: { "Content-Type": input.contentType } };
  }
  return { mode: "post", uploadUrl: `/api/upload/local?key=${encodeURIComponent(key)}`, publicUrl: publicUrlFor(key), key };
}

export function localPathFor(key: string): string {
  const root = localUploadsDir();
  const p = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!p.startsWith(path.resolve(/*turbopackIgnore: true*/ root))) throw new Error("bad_key");
  return p;
}

export async function saveLocalFile(key: string, data: Uint8Array) {
  const p = localPathFor(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
}

export async function deleteObject(key: string) {
  if (r2Configured()) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    return;
  }
  try {
    fs.unlinkSync(localPathFor(key));
  } catch {
    /* ignore */
  }
}

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}
