import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createUploadTarget, keyFromUrl, localPathFor, safeFilename, buildKey, ALLOWED_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/storage";

const SITE = "11111111-2222-3333-4444-555555555555";

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
