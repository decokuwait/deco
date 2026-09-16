import { describe, expect, it } from "vitest";
import { uploadRequestHeaders } from "@/components/admin/upload-headers";

describe("browser upload headers", () => {
  // XHR merges repeated header names into one comma-joined value, so a Content-Type set twice is sent as
  // "image/png, image/png". SigV4 signs the value, the bucket rebuilds the signature from what arrived and
  // rejects the upload — which the panel could only report as an opaque network error. Every name once.
  it("sends each signed header exactly once and never Content-Length", () => {
    const headers = uploadRequestHeaders({ "Content-Type": "image/png", "Content-Length": "12345" }, "image/png");
    expect(headers).toEqual([["Content-Type", "image/png"]]);
    const names = headers.map(([n]) => n.toLowerCase());
    expect(new Set(names).size, "a repeated name would be merged by XHR").toBe(names.length);
  });

  it("ignores a repeated name whatever its casing", () => {
    const headers = uploadRequestHeaders({ "Content-Type": "image/png", "content-type": "image/jpeg" }, "image/png");
    expect(headers).toEqual([["Content-Type", "image/png"]]);
  });

  // The local-disk fallback issues no headers; the file's own type still has to be declared.
  it("falls back to the file type when the target carries no headers", () => {
    expect(uploadRequestHeaders(undefined, "video/mp4")).toEqual([["Content-Type", "video/mp4"]]);
    expect(uploadRequestHeaders(undefined, "")).toEqual([["Content-Type", "application/octet-stream"]]);
  });

  it("keeps any other signed header the target asks for", () => {
    expect(uploadRequestHeaders({ "Content-Type": "image/webp", "x-amz-meta-site": "abc", "Content-Length": "9" }, "image/webp")).toEqual([
      ["Content-Type", "image/webp"],
      ["x-amz-meta-site", "abc"],
    ]);
  });
});
