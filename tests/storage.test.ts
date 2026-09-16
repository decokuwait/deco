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

  // A browser only sends the upload once the preflight answers all three questions: is this origin
  // allowed, is PUT allowed, is the content-type header allowed. Answering the first alone still ends in
  // a blocked request that reaches the panel as nothing but "connection lost".
  it("reports the CORS verdict the way a browser decides it", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_ACCESS_KEY_ID: "AKIAFAKEFAKEFAKEFAKE", R2_SECRET_ACCESS_KEY: "fakefakefakefakefakefakefakefakefakefake", R2_BUCKET: "bucket", R2_PUBLIC_URL: "https://pub-x.r2.dev" });
    const calls: { url: string; init: RequestInit }[] = [];
    const real = globalThis.fetch;
    let headers: Record<string, string> = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "PUT, GET",
      "access-control-allow-headers": "content-type",
    };
    globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200, headers });
    }) as typeof fetch;
    try {
      expect(await storageStatus("https://demo.example.com")).toMatchObject({ backend: "r2", ok: true, cors: "ok", problem: null });
      // The preflight must go to the host the browser will PUT to, which the SDK addresses as a subdomain.
      expect(new URL(calls[0].url).host).toBe("bucket.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
      expect(new URL(calls[0].url).pathname).toBe("/health/cors-preflight-probe");
      expect(calls[0].init.method).toBe("OPTIONS");
      expect((calls[0].init.headers as Record<string, string>).origin).toBe("https://demo.example.com");

      // Each missing piece is reported as itself, so the operator knows which line of the policy to add.
      for (const [drop, expected] of [
        ["access-control-allow-origin", "does not cover this origin"],
        ["access-control-allow-methods", "PUT is not allowed"],
        ["access-control-allow-headers", "content-type is not allowed"],
      ] as [string, string][]) {
        resetStorageChecks();
        const full: Record<string, string> = {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "PUT, GET",
          "access-control-allow-headers": "content-type",
        };
        delete full[drop];
        headers = full;
        const blocked = await storageStatus("https://demo.example.com");
        expect(blocked, drop).toMatchObject({ ok: false, cors: "missing" });
        expect(blocked.problem, drop).toContain(expected);
        expect(blocked.corsDetail?.blocked, drop).toContain(expected);
      }

      // An origin the policy does not list is named rather than guessed at.
      resetStorageChecks();
      headers = {
        "access-control-allow-origin": "https://other.example.com",
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": "content-type",
      };
      expect((await storageStatus("https://demo.example.com")).problem).toContain("https://other.example.com");

      // A failure is never cached, so a bucket fixed in Cloudflare starts working on the very next upload.
      const before = calls.length;
      await storageStatus("https://demo.example.com");
      expect(calls.length).toBe(before + 1);

      globalThis.fetch = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
      resetStorageChecks();
      // A probe that cannot run is not evidence about the policy, so uploads stay allowed and nothing is cached.
      expect(await storageStatus("https://demo.example.com")).toMatchObject({ ok: true, cors: "unreachable" });
      expect(await storageStatus("https://demo.example.com")).toMatchObject({ ok: true, cors: "unreachable" });
    } finally {
      globalThis.fetch = real;
    }
  });
});

describe("presigned R2 uploads", () => {
  afterEach(() => {
    for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) delete process.env[k];
  });

  // Signing is offline, so fake credentials are enough to see exactly what the browser would send.
  it("signs only the headers the browser sends, with no SDK checksum parameters", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_ACCESS_KEY_ID: "AKIAFAKEFAKEFAKEFAKE", R2_SECRET_ACCESS_KEY: "fakefakefakefakefakefakefakefakefakefake", R2_BUCKET: "decokuwait", R2_PUBLIC_URL: "https://pub-x.r2.dev" });
    const t = await createUploadTarget({ siteId: SITE, filename: "logo.png", contentType: "image/png", size: 12345 });
    expect(t.mode).toBe("put");
    const u = new URL(t.uploadUrl);
    expect(u.host).toBe("decokuwait.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    // The SDK default since v3.729 adds a body checksum to PutObject; for a presigned URL that is the CRC32
    // of an empty body, and the bucket rejects the real file against it. Any such parameter is a regression.
    for (const k of u.searchParams.keys()) expect(k.toLowerCase(), `unexpected query parameter ${k}`).not.toMatch(/checksum/);
    expect(t.publicUrl).toBe(`https://pub-x.r2.dev/${t.key}`);
    expect(t.mode === "put" && t.headers).toEqual({ "Content-Type": "image/png", "Content-Length": "12345" });
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
