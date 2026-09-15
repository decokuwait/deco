import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createUploadTarget, keyFromUrl, localPathFor, safeFilename, buildKey, storageStatus, resetStorageChecks, ALLOWED_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/storage";

const SITE = "11111111-2222-3333-4444-555555555555";

describe("storage readiness", () => {
  const R2 = { R2_ACCOUNT_ID: "acc", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket" };
  afterEach(() => {
    for (const k of [...Object.keys(R2), "VERCEL", "R2_PUBLIC_URL"]) delete process.env[k];
    resetStorageChecks();
  });

  it("accepts the local-disk fallback in development and refuses it on Vercel", async () => {
    expect(await storageStatus(null)).toMatchObject({ backend: "local", ok: true, problem: null });
    process.env.VERCEL = "1";
    const onVercel = await storageStatus(null);
    expect(onVercel.ok).toBe(false);
    expect(onVercel.problem).toContain("R2 is not configured");
  });

  // The public URL is what gets written into the database with every uploaded file: without it the admin
  // panel appears to work and every saved image 404s afterwards, which is worse than refusing the upload.
  it("refuses an R2 bucket with no public URL", async () => {
    Object.assign(process.env, R2);
    const s = await storageStatus(null);
    expect(s).toMatchObject({ backend: "r2", ok: false, cors: null });
    expect(s.problem).toContain("R2_PUBLIC_URL");
  });

  it("reports the CORS verdict for the origin the admin panel runs on", async () => {
    Object.assign(process.env, R2, { R2_PUBLIC_URL: "https://pub-x.r2.dev" });
    const calls: { url: string; init: RequestInit }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200, headers: allow ? { "access-control-allow-origin": "*" } : {} });
    }) as typeof fetch;
    let allow = true;
    try {
      expect(await storageStatus("https://demo.example.com")).toMatchObject({ backend: "r2", ok: true, cors: "ok", problem: null });
      expect(calls[0].url).toBe("https://acc.r2.cloudflarestorage.com/bucket/cors-preflight-probe");
      expect(calls[0].init.method).toBe("OPTIONS");
      expect((calls[0].init.headers as Record<string, string>).origin).toBe("https://demo.example.com");
      allow = false;
      resetStorageChecks();
      const blocked = await storageStatus("https://demo.example.com");
      expect(blocked).toMatchObject({ ok: false, cors: "missing" });
      expect(blocked.problem).toContain("https://demo.example.com");
      globalThis.fetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
      resetStorageChecks();
      expect(await storageStatus("https://demo.example.com")).toMatchObject({ ok: true, cors: "unreachable" });
      // A transient failure is never cached as the bucket policy: the next call probes again.
      expect(calls.length).toBe(2);
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("upload validation", () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.R2_PUBLIC_URL;
    delete process.env.LOCAL_UPLOADS_DIR;
  });

  it("refuses SVG and other non media types", async () => {
    expect(ALLOWED_TYPES.has("image/svg+xml")).toBe(false);
    await expect(createUploadTarget({ siteId: SITE, filename: "logo.svg", contentType: "image/svg+xml", size: 100 })).rejects.toThrow("unsupported_type");
    await expect(createUploadTarget({ siteId: SITE, filename: "x.html", contentType: "text/html", size: 100 })).rejects.toThrow("unsupported_type");
  });

  it("requires a positive size and enforces the caps per kind", async () => {
    await expect(createUploadTarget({ siteId: SITE, filename: "a.png", contentType: "image/png" })).rejects.toThrow("size_required");
    await expect(createUploadTarget({ siteId: SITE, filename: "a.png", contentType: "image/png", size: 0 })).rejects.toThrow("size_required");
    await expect(createUploadTarget({ siteId: SITE, filename: "a.png", contentType: "image/png", size: MAX_IMAGE_BYTES + 1 })).rejects.toThrow("too_large");
    await expect(createUploadTarget({ siteId: SITE, filename: "a.mp4", contentType: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).rejects.toThrow("too_large");
    const ok = await createUploadTarget({ siteId: SITE, filename: "a.mp4", contentType: "video/mp4", size: MAX_IMAGE_BYTES + 1 });
    expect(ok.key).toMatch(new RegExp(`^sites/${SITE}/\\d{4}/\\d{2}/[0-9a-f-]{36}-a\\.mp4$`));
  });

  it("issues local targets without R2 and refuses local disk on Vercel", async () => {
    const t = await createUploadTarget({ siteId: SITE, filename: "photo.jpg", contentType: "image/jpeg", size: 1000 });
    expect(t.mode).toBe("post");
    expect(t.uploadUrl.startsWith("/api/upload/local?key=")).toBe(true);
    expect(t.publicUrl).toBe(`/api/files/${t.key}`);
    process.env.VERCEL = "1";
    await expect(createUploadTarget({ siteId: SITE, filename: "photo.jpg", contentType: "image/jpeg", size: 1000 })).rejects.toThrow("storage_not_configured");
  });

  it("sanitises file names and keys", () => {
    expect(safeFilename("../x y.PNG")).toBe("x_y.PNG");
    expect(safeFilename("C:\\Users\\me\\صورة.jpg")).toBe("____.jpg");
    expect(safeFilename("")).toBe("file");
    expect(buildKey(SITE, "a/b/../c.png")).toMatch(/-c\.png$/);
  });

  it("keeps local paths inside the uploads directory", () => {
    process.env.LOCAL_UPLOADS_DIR = path.join(process.cwd(), ".data", "uploads-test");
    expect(localPathFor("sites/a/b.jpg")).toBe(path.join(process.cwd(), ".data", "uploads-test", "sites", "a", "b.jpg"));
    expect(() => localPathFor("../../etc/passwd")).toThrow("bad_key");
    expect(() => localPathFor("sites/../../x")).toThrow("bad_key");
  });

  it("maps public URLs back to storage keys for both backends", () => {
    expect(keyFromUrl("/api/files/sites/a/2025/01/x.jpg")).toBe("sites/a/2025/01/x.jpg");
    expect(keyFromUrl("/api/files/other/x.jpg")).toBeNull();
    expect(keyFromUrl("https://images.unsplash.com/photo-1")).toBeNull();
    process.env.R2_PUBLIC_URL = "https://media.decokuwait.com/";
    expect(keyFromUrl("https://media.decokuwait.com/sites/a/x.jpg")).toBe("sites/a/x.jpg");
    expect(keyFromUrl("https://evil.com/sites/a/x.jpg")).toBeNull();
    expect(keyFromUrl(null)).toBeNull();
  });
});
