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
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

/**
 * Total bytes one site may hold in the bucket.
 *
 * `/api/upload` records `media_assets.size` for every target it issues and nothing ever summed it, so a
 * single authenticated site admin could mint presigned PUTs for 300 MB each, without limit, and the bill
 * lands on the platform. Counted from what was *issued* rather than from the bucket: an issued URL is a
 * promise of that many bytes, and counting only completed uploads would let a burst of 10,000 outstanding
 * URLs overshoot the quota before any of them finished.
 */
export const SITE_STORAGE_QUOTA_BYTES = Math.max(1, Number(process.env.SITE_STORAGE_QUOTA_MB) || 5120) * 1024 * 1024;

/** Upload targets one user may request per hour, across all their sites. */
export const UPLOADS_PER_HOUR = 120;

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
    // Since v3.729 the SDK signs a CRC32 of the request body into every PutObject by default. A presigned
    // URL is signed with no body, so it carries the checksum of *nothing* (x-amz-checksum-crc32=AAAAAA==)
    // and the real upload is rejected by the bucket. Only send checksums when an operation requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export interface StorageStatus {
  backend: "r2" | "local";
  /** Whether a site admin could actually upload a file in this deployment. */
  ok: boolean;
  /** What an operator has to fix, when uploads cannot work. */
  problem: string | null;
  /** Whether the bucket lets a browser on `origin` run the presigned PUT (R2 only). */
  cors: CorsVerdict | null;
  /** What the bucket actually answered, for when the verdict alone is not enough to act on. */
  corsDetail: CorsProbe | null;
}

type CorsVerdict = "ok" | "missing" | "unreachable";

export interface CorsProbe {
  verdict: CorsVerdict;
  status: number | null;
  allowOrigin: string | null;
  allowMethods: string | null;
  allowHeaders: string | null;
  /** The browser requirement that is not met, in the browser's own terms. */
  blocked: string | null;
}

// A bucket policy changes rarely, and the upload route consults it on every request: remember the
// verdict per origin for a few minutes so an upload never waits on a second round trip to Cloudflare.
const corsCache = new Map<string, { probe: CorsProbe; at: number }>();
const CORS_TTL_MS = 5 * 60_000;
// Keyed by the request's own origin, which a client influences, so the map needs a ceiling. A deployment
// has a handful of real origins; anything past that is noise and the oldest entry can go.
const CORS_CACHE_MAX = 64;

/** Test helper: forget the cached CORS verdicts. */
export function resetStorageChecks() {
  corsCache.clear();
}

/** Does the bucket answer a browser preflight for a presigned PUT from `origin`? */
async function corsCheck(origin: string): Promise<CorsProbe> {
  const hit = corsCache.get(origin);
  if (hit && Date.now() - hit.at < CORS_TTL_MS) return hit.probe;
  const probe = await probeCors(origin);
  // Only a working policy is worth remembering. Caching a failure would keep refusing uploads for minutes
  // after the operator fixes the bucket, and a transient probe error is not evidence about the policy.
  if (probe.verdict === "ok") {
    if (corsCache.size >= CORS_CACHE_MAX) corsCache.delete(corsCache.keys().next().value!);
    corsCache.set(origin, { probe, at: Date.now() });
  }
  return probe;
}

/** True when a comma-separated allow-list header covers `want` (or is the `*` wildcard). */
function allows(header: string | null, want: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header.split(",").some((v) => v.trim().toLowerCase() === want);
}

async function probeCors(origin: string): Promise<CorsProbe> {
  try {
    // Preflight the very URL a browser would be handed. The SDK addresses the bucket as a subdomain, so
    // guessing a path-style URL here would test a different host than the upload actually uses.
    const target = await presignPut("health/cors-preflight-probe", "image/png", 1);
    const res = await fetch(target.uploadUrl, {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": "PUT", "access-control-request-headers": "content-type" },
      signal: AbortSignal.timeout(6000),
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowMethods = res.headers.get("access-control-allow-methods");
    const allowHeaders = res.headers.get("access-control-allow-headers");
    // A browser checks all three; answering only the first still ends in a blocked request and an opaque
    // network error, which is exactly the failure this probe exists to name.
    const blocked = !allowOrigin
      ? "no access-control-allow-origin: the policy does not cover this origin"
      : allowOrigin.trim() !== "*" && allowOrigin.trim().toLowerCase() !== origin.toLowerCase()
        ? `access-control-allow-origin is ${allowOrigin}, not ${origin}`
        : !allows(allowMethods, "put")
          ? `access-control-allow-methods is ${allowMethods ?? "absent"}: PUT is not allowed`
          : !allows(allowHeaders, "content-type")
            ? `access-control-allow-headers is ${allowHeaders ?? "absent"}: content-type is not allowed`
            : null;
    return { verdict: blocked ? "missing" : "ok", status: res.status, allowOrigin, allowMethods, allowHeaders, blocked };
  } catch {
    return { verdict: "unreachable", status: null, allowOrigin: null, allowMethods: null, allowHeaders: null, blocked: null };
  }
}

/**
 * Whether media uploads can work here, checked the way the browser performs them. The ways this breaks in
 * production all look identical in the admin panel (an opaque network error), so each one is named here
 * instead: no bucket at all, a bucket whose public URL is missing (uploaded files would be stored with a
 * URL that 404s), and a bucket whose CORS policy blocks the presigned PUT.
 */
export async function storageStatus(origin: string | null): Promise<StorageStatus> {
  if (!r2Configured()) {
    // Serverless file systems are read-only, so the local-disk fallback cannot stand in on Vercel.
    const onVercel = !!process.env.VERCEL;
    return { backend: "local", ok: !onVercel, problem: onVercel ? "R2 is not configured, and the local-disk fallback is disabled on Vercel: uploads are refused" : null, cors: null, corsDetail: null };
  }
  if (!process.env.R2_PUBLIC_URL?.trim()) {
    return { backend: "r2", ok: false, problem: "R2_PUBLIC_URL is not set: uploads would be stored with an /api/files/ URL that 404s in production", cors: null, corsDetail: null };
  }
  const probe = origin ? await corsCheck(origin) : null;
  return {
    backend: "r2",
    ok: probe?.verdict !== "missing",
    problem: probe?.verdict === "missing" ? `the bucket blocks browser uploads from ${origin}: ${probe.blocked}` : null,
    cors: probe?.verdict ?? null,
    corsDetail: probe,
  };
}

/** Why a browser upload that was already issued a valid target then failed to reach the bucket. */
export type UploadFailure = "cors_blocked" | "bucket_unreachable" | "network";

/**
 * Names the cause of an upload the browser could not complete.
 *
 * A cross-origin PUT that never gets a response is reported to JavaScript as one undifferentiated error,
 * on purpose: the browser will not tell a page why a foreign server refused it. So the three causes — the
 * bucket's CORS policy rejecting this origin, the bucket being unreachable, and the visitor's connection
 * actually being down — all arrived in the panel as "connection lost", which sent the owner (and the
 * person reading the report) looking at the wrong thing. The server is not subject to CORS, so it can ask
 * the bucket the same question the browser just asked and say which of the three it was.
 *
 * Deliberately uncached: `storageStatus` remembers a working policy for minutes, which is right on the hot
 * path and wrong here. This runs only after an upload has already failed, and the whole point is to learn
 * what the bucket says now rather than what it said before the policy was last edited.
 */
export async function diagnoseUploadFailure(origin: string | null): Promise<UploadFailure> {
  // No bucket means the browser was uploading to our own origin, where none of this applies.
  if (!origin || !r2Configured()) return "network";
  const probe = await probeCors(origin);
  if (probe.verdict === "missing") return "cors_blocked";
  if (probe.verdict === "unreachable") return "bucket_unreachable";
  // The bucket answers, and answers correctly, for this exact origin: whatever stopped the upload was
  // between this visitor and Cloudflare, so "connection lost" is the honest message after all.
  return "network";
}

/** Presigned PUT for one object; the browser sends exactly these headers, which are part of the signature. */
async function presignPut(key: string, contentType: string, size: number): Promise<Extract<UploadTarget, { mode: "put" }>> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await s3();
  // ContentLength is part of the signature, so R2 rejects uploads larger than what was approved.
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 60 * 10, signableHeaders: new Set(["content-type", "content-length"]) });
  return { mode: "put", uploadUrl, publicUrl: publicUrlFor(key), key, headers: { "Content-Type": contentType, "Content-Length": String(size) } };
}

export interface UploadProbe {
  ok: boolean;
  status: number | null;
  /** First line of the bucket error, or the network error, when the upload failed. */
  error: string | null;
  /** access-control-allow-origin on the PUT response; a browser drops the response without it. */
  allowOrigin: string | null;
}

/**
 * Performs one real presigned PUT and deletes the object again, sending the browser's Origin so the
 * response is judged the way a browser judges it. A failure here is the bucket rejecting what our own code
 * signs (credentials, bucket name, signature, checksum parameters) or withholding the CORS header from the
 * response - either one reaches a site admin as nothing but "connection lost".
 */
export async function uploadProbe(origin: string | null): Promise<UploadProbe> {
  if (!r2Configured()) return { ok: false, status: null, error: "r2_not_configured", allowOrigin: null };
  const body = Buffer.from("ok");
  const key = `health/probe-${randomUUID()}.png`;
  try {
    const target = await presignPut(key, "image/png", body.length);
    const res = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { ...target.headers, ...(origin ? { origin } : {}) },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = res.ok ? "" : (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    if (res.ok) await deleteObject(key).catch(() => undefined);
    const allowOrigin = res.headers.get("access-control-allow-origin");
    return { ok: res.ok, status: res.status, error: res.ok ? null : text || res.statusText, allowOrigin };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e), allowOrigin: null };
  }
}

export async function createUploadTarget(input: { siteId: string; filename: string; contentType: string; size?: number }): Promise<UploadTarget> {
  if (!ALLOWED_TYPES.has(input.contentType)) throw new Error("unsupported_type");
  const isVideo = input.contentType.startsWith("video/");
  const size = Number(input.size);
  if (!Number.isInteger(size) || size <= 0) throw new Error("size_required");
  if (size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw new Error("too_large");
  const key = buildKey(input.siteId, input.filename);
  if (r2Configured()) return presignPut(key, input.contentType, size);
  // Local disk is only a development convenience; serverless file systems are ephemeral and read-only.
  if (process.env.VERCEL) throw new Error("storage_not_configured");
  return { mode: "post", uploadUrl: `/api/upload/local?key=${encodeURIComponent(key)}`, publicUrl: publicUrlFor(key), key };
}

export function localPathFor(key: string): string {
  const root = path.resolve(/*turbopackIgnore: true*/ localUploadsDir());
  const p = path.resolve(/*turbopackIgnore: true*/ root, key);
  // `startsWith(root)` also accepts a sibling directory whose name merely begins with the root's
  // (".../uploads" vs ".../uploads-elsewhere"). Ask for the relative path instead: a key that stays
  // inside the directory never starts with ".." and is never absolute.
  const rel = path.relative(root, p);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("bad_key");
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

/** Storage key for a URL served by us (R2 public URL or local /api/files path); null for foreign URLs. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const local = url.match(/^\/api\/files\/(sites\/.+)$/);
  if (local) return local[1];
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (base && url.startsWith(`${base}/sites/`)) return url.slice(base.length + 1);
  return null;
}

/**
 * Storage key for a URL, but only when the object belongs to `siteId`.
 *
 * Media rows store whatever URL the admin submitted, and every site's uploads are served from one public
 * bucket, so the URLs of another tenant's files are visible in the HTML of its own website. Deleting by
 * `keyFromUrl` alone therefore let any site admin delete any other site's media by pasting its URL into
 * their own project and pressing delete. The site prefix is the only thing that makes a key ours.
 */
export function siteKeyFromUrl(siteId: string, url: string | null | undefined): string | null {
  const key = keyFromUrl(url);
  if (!key) return null;
  return key.startsWith(`sites/${siteId}/`) ? key : null;
}

/** ISO base-media brands we accept, by the container they identify. */
const FTYP_BRANDS: Record<string, string> = {
  avif: "image/avif",
  avis: "image/avif",
  mif1: "image/avif",
  isom: "video/mp4",
  iso2: "video/mp4",
  iso4: "video/mp4",
  iso5: "video/mp4",
  iso6: "video/mp4",
  mp41: "video/mp4",
  mp42: "video/mp4",
  avc1: "video/mp4",
  dash: "video/mp4",
  mmp4: "video/mp4",
  "qt  ": "video/quicktime",
};

function ascii(b: Uint8Array, from: number, length: number): string {
  let s = "";
  for (let i = from; i < from + length && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

function startsWith(b: Uint8Array, bytes: number[]): boolean {
  if (b.length < bytes.length) return false;
  return bytes.every((v, i) => b[i] === v);
}

/**
 * The content type the bytes actually are, or null when they are nothing we accept.
 *
 * The declared `Content-Type` is a claim by the uploader and was never verified: a file announced as
 * `image/png` was written to disk and then served back with the type the `media_assets` row recorded —
 * so "png" could be an HTML document, and on the tenant's own origin that is stored XSS. The sniff is not
 * a full format parse; it only has to agree with what was declared, and disagreement is the answer.
 *
 * SVG has no magic number, is XML, and executes script when a browser renders it. It is not in
 * ALLOWED_TYPES and nothing here can produce it, which is deliberate.
 */
export function sniffContentType(b: Uint8Array): string | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  // EBML header: Matroska and WebM share it, and WebM is the only one we accept.
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(b, 4, 4) === "ftyp") return FTYP_BRANDS[ascii(b, 8, 4).toLowerCase()] ?? null;
  return null;
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
