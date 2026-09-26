import { describe, expect, it } from "vitest";
import { emptyContent, normalizeContent } from "@/lib/content/defaults";
import { contentVersion } from "@/app/tenant/[host]/admin/_lib/version";
import { parseSectionForm, rowSequence, SPECS } from "@/app/tenant/[host]/admin/content/_lib/spec";
import { readHoursSpec, spreadHours } from "@/app/tenant/[host]/admin/content/_lib/hours";
import { formSignature, interceptsNavigation } from "@/components/admin/dirty";
import { acceptFor, fileProblem, variantPlan, MAX_VIDEO_CLIENT_BYTES } from "@/components/admin/image-pipeline";

function fd(pairs: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(pairs)) f.append(k, v);
  return f;
}

describe("form-layer version check", () => {
  it("is stable across renders of the same content and independent of key order", () => {
    const a = normalizeContent({ brand: { name: { ar: "ديكور", en: "Decor" } } });
    const b = normalizeContent(JSON.parse(JSON.stringify({ brand: { name: { ar: "ديكور", en: "Decor" } } })));
    expect(contentVersion(a)).toBe(contentVersion(b));
    expect(contentVersion({ a: 1, b: 2 })).toBe(contentVersion({ b: 2, a: 1 }));
  });

  it("changes when another tab adds a list item — the save that would silently delete it", () => {
    const tabA = emptyContent();
    tabA.services.items = [{ id: "s1", title: { ar: "جبس", en: "Gypsum" }, description: { ar: "", en: "" } }];
    const rendered = contentVersion(tabA);
    // Someone else adds a service while this form is open.
    const current = emptyContent();
    current.services.items = [
      { id: "s1", title: { ar: "جبس", en: "Gypsum" }, description: { ar: "", en: "" } },
      { id: "s2", title: { ar: "ألمنيوم", en: "Aluminium" }, description: { ar: "", en: "" } },
    ];
    expect(contentVersion(current)).not.toBe(rendered);
    // And the save really would have destroyed it: the patch is rebuilt from the rows on the stale page.
    const patch = parseSectionForm(
      fd({ "rows.count": "1", "rows.0.id": "s1", "rows.0.title.ar": "جبس", "rows.0.title.en": "Gypsum" }),
      SPECS.services,
      current,
    ) as { services: { items: { id: string }[] } };
    expect(patch.services.items.map((r) => r.id)).toEqual(["s1"]);
  });

  it("ignores a template switch, which bumps updated_at without touching content", () => {
    const content = normalizeContent({ brand: { name: { ar: "x", en: "x" } } });
    expect(contentVersion(content)).toBe(contentVersion(normalizeContent(JSON.parse(JSON.stringify(content)))));
  });
});

describe("client reorder and removal", () => {
  it("applies the submitted order", () => {
    expect(rowSequence("2,0,1", "", 3)).toEqual([2, 0, 1]);
  });
  it("drops only what rows.removed names", () => {
    expect(rowSequence("0,1,2", "1", 3)).toEqual([0, 2]);
  });
  it("appends an index the order forgot rather than deleting it", () => {
    expect(rowSequence("2,0", "", 3)).toEqual([2, 0, 1]);
    expect(rowSequence("", "", 3)).toEqual([0, 1, 2]);
  });
  it("ignores out-of-range, repeated and non-numeric entries", () => {
    expect(rowSequence("9,-1,abc,1,1", "", 2)).toEqual([1, 0]);
    expect(rowSequence("0,1", "99,abc", 2)).toEqual([0, 1]);
  });
  it("reorders a real list section in one save", () => {
    const current = emptyContent();
    const patch = parseSectionForm(
      fd({
        "rows.count": "2",
        "rows.order": "1,0",
        "rows.0.id": "s1",
        "rows.0.title.ar": "أ",
        "rows.0.title.en": "A",
        "rows.1.id": "s2",
        "rows.1.title.ar": "ب",
        "rows.1.title.en": "B",
      }),
      SPECS.services,
      current,
    ) as { services: { items: { id: string }[] } };
    expect(patch.services.items.map((r) => r.id)).toEqual(["s2", "s1"]);
  });
  it("removes a row without a page reload", () => {
    const current = emptyContent();
    const patch = parseSectionForm(
      fd({ "rows.count": "2", "rows.removed": "0", "rows.0.id": "s1", "rows.0.title.ar": "أ", "rows.1.id": "s2", "rows.1.title.ar": "ب" }),
      SPECS.services,
      current,
    ) as { services: { items: { id: string }[] } };
    expect(patch.services.items.map((r) => r.id)).toEqual(["s2"]);
  });
});

describe("unsaved-change guard", () => {
  it("a signature only changes when a submitted value changes", () => {
    const base = formSignature([
      ["hero.title.ar", "عنوان"],
      ["hero.title.en", "Title"],
    ]);
    expect(
      formSignature([
        ["hero.title.ar", "عنوان"],
        ["hero.title.en", "Title"],
      ]),
    ).toBe(base);
    expect(
      formSignature([
        ["hero.title.ar", "عنوان جديد"],
        ["hero.title.en", "Title"],
      ]),
    ).not.toBe(base);
  });

  it("typing and undoing leaves the form clean, so the warning is never cried wolf", () => {
    const before = formSignature([["a", "x"]]);
    const typed = formSignature([["a", "xy"]]);
    const undone = formSignature([["a", "x"]]);
    expect(typed).not.toBe(before);
    expect(undone).toBe(before);
  });

  it("ignores React's own progressive-enhancement fields and file entries", () => {
    const withInternals = formSignature([
      ["a", "x"],
      ["$ACTION_ID_abc", "1"],
      ["$ACTION_REF_1", ""],
      ["photo", new File([], "p.jpg") as unknown as FormDataEntryValue],
    ]);
    expect(withInternals).toBe(formSignature([["a", "x"]]));
  });

  it("holds back a same-origin tab-bar tap", () => {
    const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    const link = { href: "/admin/projects", target: "", hasDownload: false };
    expect(interceptsNavigation(link, plain, "https://demo.example.com/admin/content/hero")).toBe(true);
  });

  it("never interferes with a new tab, a download, a modified click or an in-page anchor", () => {
    const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    const here = "https://demo.example.com/admin/projects/1";
    expect(interceptsNavigation({ href: "https://demo.example.com/", target: "_blank", hasDownload: false }, plain, here)).toBe(false);
    expect(interceptsNavigation({ href: "/export.csv", target: "", hasDownload: true }, plain, here)).toBe(false);
    expect(interceptsNavigation({ href: "/admin", target: "", hasDownload: false }, { ...plain, metaKey: true }, here)).toBe(false);
    expect(interceptsNavigation({ href: "/admin", target: "", hasDownload: false }, { ...plain, button: 1 }, here)).toBe(false);
    expect(interceptsNavigation({ href: "#media", target: "", hasDownload: false }, plain, here)).toBe(false);
    expect(interceptsNavigation({ href: "https://other.example.com/", target: "", hasDownload: false }, plain, here)).toBe(false);
  });
});

describe("upload pipeline", () => {
  it("HEIC is refused on the device instead of uploading a file nothing but Safari can show", () => {
    expect(fileProblem({ name: "IMG_0001.HEIC", type: "", size: 100 }, "image")).toBe("heic");
    expect(fileProblem({ name: "x.jpg", type: "image/heic", size: 100 }, "image")).toBe("heic");
    expect(acceptFor("image")).not.toContain("image/*");
    expect(acceptFor("image")).toContain("image/jpeg");
  });

  it("only the types the bucket accepts get through", () => {
    expect(fileProblem({ name: "a.jpg", type: "image/jpeg", size: 100 }, "image")).toBeNull();
    expect(fileProblem({ name: "a.svg", type: "image/svg+xml", size: 100 }, "image")).toBe("unsupported_type");
    expect(fileProblem({ name: "a.mkv", type: "video/x-matroska", size: 100 }, "video")).toBe("unsupported_type");
  });

  it("a phone's 4K clip is stopped before it starts, not after ten minutes of upload", () => {
    expect(fileProblem({ name: "c.mp4", type: "video/mp4", size: MAX_VIDEO_CLIENT_BYTES + 1 }, "video")).toBe("video_too_large");
    expect(fileProblem({ name: "c.mp4", type: "video/mp4", size: MAX_VIDEO_CLIENT_BYTES - 1 }, "video")).toBeNull();
  });

  it("derivative widths match the renderer's ladder and the marker is the real width", () => {
    // Landscape phone photo.
    const wide = variantPlan(4032, 3024);
    expect(wide.base).toEqual({ width: 2000, height: 1500 });
    expect(wide.variants.map((v) => v.width)).toEqual([480, 1080]);
    // Portrait: capped on the longest edge, so the marker is 1500 and only smaller widths are generated.
    const tall = variantPlan(3024, 4032);
    expect(tall.base).toEqual({ width: 1500, height: 2000 });
    expect(tall.variants.map((v) => v.width)).toEqual([480, 1080]);
    // Already small: nothing below it exists, so no candidate can 404.
    expect(variantPlan(400, 300).variants).toEqual([]);
    expect(variantPlan(800, 600).variants.map((v) => v.width)).toEqual([480]);
  });
});

describe("opening hours", () => {
  it("groups days that share a shift and keeps both shifts", () => {
    const spec = readHoursSpec(
      fd({
        "hours.Saturday.open": "on",
        "hours.Saturday.a.from": "09:00",
        "hours.Saturday.a.to": "13:00",
        "hours.Saturday.b.from": "16:00",
        "hours.Saturday.b.to": "20:00",
        "hours.Sunday.open": "on",
        "hours.Sunday.a.from": "09:00",
        "hours.Sunday.a.to": "13:00",
        "hours.Sunday.b.from": "",
        "hours.Sunday.b.to": "",
      }),
    );
    expect(spec).toEqual([
      { days: ["Saturday", "Sunday"], opens: "09:00", closes: "13:00" },
      { days: ["Saturday"], opens: "16:00", closes: "20:00" },
    ]);
  });

  it("a day that is not ticked publishes nothing, and Friday off is the default", () => {
    expect(readHoursSpec(fd({ "hours.Friday.a.from": "09:00", "hours.Friday.a.to": "13:00" }))).toEqual([]);
    expect(readHoursSpec(new FormData())).toEqual([]);
    expect(spreadHours([]).Friday.open).toBe(false);
    expect(spreadHours(undefined).Saturday.open).toBe(false);
  });

  it("refuses a range that ends before it starts rather than telling Google the shop is shut", () => {
    expect(readHoursSpec(fd({ "hours.Monday.open": "on", "hours.Monday.a.from": "20:00", "hours.Monday.a.to": "09:00" }))).toEqual([]);
    expect(readHoursSpec(fd({ "hours.Monday.open": "on", "hours.Monday.a.from": "9am", "hours.Monday.a.to": "13:00" }))).toEqual([]);
  });

  it("round-trips a stored spec back into the editor", () => {
    const stored = [
      { days: ["Saturday", "Sunday"], opens: "09:00", closes: "13:00" },
      { days: ["Saturday"], opens: "16:00", closes: "20:00" },
    ];
    const week = spreadHours(stored);
    expect(week.Saturday).toEqual({ open: true, a: { from: "09:00", to: "13:00" }, b: { from: "16:00", to: "20:00" } });
    expect(week.Sunday.open).toBe(true);
    expect(week.Sunday.b).toEqual({ from: "", to: "" });
    expect(week.Friday.open).toBe(false);
  });
});

describe("new admin fields reach the content", () => {
  it("stores the Search Console tokens, the price range and the structured address", () => {
    const patch = parseSectionForm(
      fd({ "seo.verification.google": "abc123", "seo.priceRange": "KD 15 - KD 40", "seo.title.ar": "", "seo.title.en": "" }),
      SPECS.seo,
      emptyContent(),
    ) as { seo: { verification: { google: string }; priceRange: string } };
    expect(patch.seo.verification.google).toBe("abc123");
    expect(patch.seo.priceRange).toBe("KD 15 - KD 40");
  });

  it("keeps the areas served as an editable bilingual list", () => {
    const patch = parseSectionForm(
      fd({
        "contact.whatsapp": "96550000000",
        "rows.count": "1",
        "rows.0.ar": "حولي",
        "rows.0.en": "Hawalli",
        "rows.new.ar": "السالمية",
        "rows.new.en": "Salmiya",
      }),
      SPECS.general,
      emptyContent(),
    ) as { contact: { areasServed: { ar: string }[] } };
    expect(patch.contact.areasServed.map((a) => a.ar)).toEqual(["حولي", "السالمية"]);
  });
});
