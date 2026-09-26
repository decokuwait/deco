import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES } from "@/templates/registry";
import { buildCtx } from "@/templates/ctx";
import { HeroSplit } from "@/templates/sections/hero/HeroSplit";
import { previewSiteData } from "@/lib/preview";
import { LOCALES } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => "/" }));

const SPLIT = TEMPLATES.filter((t) => t.layout.hero === "split");

/**
 * The split hero on a phone.
 *
 * Stacked as-is, the desktop composition put the photograph 555px down a 390px screen and 642px down a
 * 320px one, behind four full-width proof rows — so the first screen of a decor site was flat text and
 * the picture that sells the job was below the fold. The phone therefore gets its own arrangement, and
 * these are the parts of it that are load-bearing rather than decorative.
 */
describe("the split hero is composed for a phone, not narrowed from a desktop", () => {
  it("has templates to check", () => expect(SPLIT.length).toBeGreaterThan(0));

  it.each(SPLIT.map((t) => [t.code, t] as const))("template %s", (_code, def) => {
    for (const locale of LOCALES) {
      const site = previewSiteData(def);
      const ctx = buildCtx({ site, def, locale, visitorCode: "654321", preview: false });
      const html = renderToStaticMarkup(<HeroSplit ctx={ctx} />);
      const where = `${def.code}/${locale}`;

      // The picture comes before the proof points in the document, which is the order a phone shows.
      const pic = html.search(/<img|<picture/);
      const list = html.indexOf("<ul");
      expect(pic, `${where}: no hero picture`).toBeGreaterThan(-1);
      expect(list, `${where}: no proof list`).toBeGreaterThan(-1);
      expect(list, `${where}: the proof list is back above the photograph, which pushes it off the first screen`).toBeGreaterThan(pic);

      // Desktop is unchanged, and that is explicit placement rather than source order: copy and list
      // stacked in the first column, the photograph spanning both rows of the second.
      for (const cls of ["lg:col-start-1 lg:row-start-1", "lg:col-start-2 lg:row-start-1 lg:row-span-2", "lg:col-start-1 lg:row-start-2"]) {
        expect(html, `${where}: lost the desktop placement "${cls}"`).toContain(cls);
      }

      // Full bleed on a phone: the negative margin has to cancel the container's own gutter exactly
      // (`px-4`, then `sm:px-6`), or the picture hangs past the screen and the page scrolls sideways.
      expect(html, `${where}: the photograph is not full-bleed on a phone`).toContain("-mx-4");
      expect(html, `${where}: full bleed is not given back at the sm gutter`).toContain("sm:mx-0");

      // The stat sits at the top of the picture on a phone. Both fixed buttons live along the bottom edge
      // of the viewport — the WhatsApp bubble on the start side — and a full-bleed picture reaches them,
      // so at 320px the bubble covered the number and left the card reading only its label.
      const card = html.match(/<div class="absolute[^"]*animate-float[^"]*"/)?.[0];
      if (card) {
        expect(card, `${where}: the stat card starts at the bottom, under the floating WhatsApp button`).toContain("top-3");
        expect(card, `${where}: the stat card does not return to the bottom corner on a wider screen`).toContain("sm:bottom-5");
      }

      // One full-width column of calls to action on a phone. `whitespace-nowrap` means each button takes
      // its own content width, so laid out inline they wrapped into two unequal right-aligned boxes.
      expect(html, `${where}: the calls to action are not a single column on a phone`).toContain("w-full sm:w-auto");
    }
  });
});
