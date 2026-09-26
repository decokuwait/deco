import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { uploadErrorLabels } from "@/lib/i18n/admin";
import { ADMIN_UI } from "@/lib/i18n/admin";
import { LOCALES } from "@/lib/types";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/**
 * The panel renders an upload failure as `errorLabels[code] ?? code`, so a code nobody wrote a sentence
 * for is shown to the site owner verbatim. That is how an owner whose site had merely run out of storage
 * was shown the word `quota_exceeded`, and how three unrelated faults all read as "connection lost".
 *
 * These read the codes out of the code that emits them rather than repeating a list, so a new refusal
 * added to an upload route fails here until someone writes the sentence that goes with it.
 */
describe("every upload failure says something a site owner can act on", () => {
  const labels = uploadErrorLabels((k) => ADMIN_UI[k].en);

  it("labels every code the upload routes can refuse with", () => {
    const sources = ["src/app/api/upload/route.ts", "src/app/api/upload/local/route.ts", "src/app/api/upload/diagnose/route.ts"].map(read).join("\n");
    // `{ error: "..." }` / `{ reason: "..." }` is the single shape both routes answer failures in.
    const codes = new Set([...sources.matchAll(/\{\s*(?:error|reason):\s*"([a-z_]+)"/g)].map((m) => m[1]));
    // Emitted through a variable rather than a literal, so the regex above cannot see them.
    for (const c of ["cross_site", "bad_content_type", "unsupported_type", "too_large", "size_required", "storage_cors", "storage_public_url", "storage_not_configured"]) codes.add(c);
    expect(codes.size).toBeGreaterThan(10);
    const unlabelled = [...codes].filter((c) => !labels[c]);
    expect(unlabelled, `these upload refusals would be shown to the owner as a bare code: ${unlabelled.join(", ")}`).toEqual([]);
  });

  it("labels every code the uploader itself raises", () => {
    const client = read("src/components/admin/Uploader.tsx") + read("src/components/admin/image-pipeline.ts");
    // `new Error("code")` and the literals the diagnosis can return.
    const codes = new Set([...client.matchAll(/new Error\("([a-z_]+)"\)/g)].map((m) => m[1]));
    for (const c of ["cors_blocked", "bucket_unreachable", "network"]) codes.add(c);
    const unlabelled = [...codes].filter((c) => !labels[c]);
    expect(unlabelled, `the uploader can raise these with no message: ${unlabelled.join(", ")}`).toEqual([]);
  });

  // A half-translated panel is worse than an English one: the owner reads Arabic everywhere else and then
  // hits a sentence they cannot read at the one moment something has gone wrong.
  it("says it in both languages, and says something different in each", () => {
    for (const [code, en] of Object.entries(labels)) {
      const key = Object.keys(ADMIN_UI).find((k) => ADMIN_UI[k as keyof typeof ADMIN_UI].en === en);
      expect(key, `no entry behind ${code}`).toBeTruthy();
      const entry = ADMIN_UI[key as keyof typeof ADMIN_UI];
      for (const locale of LOCALES) expect(entry[locale].trim().length, `${code}/${locale} is empty`).toBeGreaterThan(8);
      expect(/[؀-ۿ]/.test(entry.ar), `${code} is not actually in Arabic`).toBe(true);
    }
  });

  // The three that are a deployment fault must not read as though the owner's phone or Wi-Fi is at fault:
  // that wording is what sent everyone looking at the wrong thing for hours.
  it("does not blame the owner's device for a fault in the deployment", () => {
    for (const code of ["cors_blocked", "blocked_by_policy", "storage_cors"]) {
      expect(labels[code], `${code} has no message`).toBeTruthy();
      expect(labels[code].toLowerCase()).not.toContain("connection lost");
    }
    // And the one that really is the connection still says so.
    expect(labels.network.toLowerCase()).toContain("connection");
  });
});
