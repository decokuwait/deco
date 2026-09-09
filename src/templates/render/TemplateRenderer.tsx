import type { ComponentType } from "react";
import type { RenderCtx, SectionKey, SectionProps } from "../types";
import { DEFAULT_ORDER } from "../types";
import { effectiveTokens, fontKeysOf, tokensToStyle } from "../ctx";
import { googleFontsHref } from "../fonts";
import { sectionEnabled } from "../sections/shared/helpers";
import { NAV } from "../sections/nav";
import { HERO } from "../sections/hero";
import { SERVICES } from "../sections/services";
import { ABOUT } from "../sections/about";
import { STATS } from "../sections/stats";
import { PROCESS } from "../sections/process";
import { FINISHED, BEFORE_AFTER, PROGRESS } from "../sections/projects";
import { TESTIMONIALS } from "../sections/testimonials";
import { FAQ } from "../sections/faq";
import { CTA } from "../sections/cta";
import { CONTACT } from "../sections/contact";
import { FOOTER } from "../sections/footer";
import { FloatingWhatsApp } from "../sections/shared/FloatingWhatsApp";
import { ScrollTop } from "../ui/client/ScrollTop";
import { HtmlLang } from "../ui/client/HtmlLang";

function pick(ctx: RenderCtx, key: SectionKey): ComponentType<SectionProps> {
  const l = ctx.def.layout;
  switch (key) {
    case "hero":
      return HERO[l.hero];
    case "about":
      return ABOUT[l.about];
    case "services":
      return SERVICES[l.services];
    case "stats":
      return STATS[l.stats];
    case "process":
      return PROCESS[l.process];
    case "finished":
      return FINISHED[l.finished];
    case "beforeAfter":
      return BEFORE_AFTER[l.beforeAfter];
    case "progress":
      return PROGRESS[l.progress];
    case "testimonials":
      return TESTIMONIALS[l.testimonials];
    case "faq":
      return FAQ[l.faq];
    case "cta":
      return CTA[l.cta];
    case "contact":
      return CONTACT[l.contact];
  }
}

/** Composes a full site page from the template layout, tokens and site content. Pure. */
export function TemplateRenderer({ ctx }: { ctx: RenderCtx }) {
  const tokens = effectiveTokens(ctx.def, ctx.site);
  const order = ctx.def.layout.order ?? DEFAULT_ORDER;
  const Nav = NAV[ctx.def.layout.nav];
  const Footer = FOOTER[ctx.def.layout.footer];
  return (
    <div className="tpl min-h-dvh" style={tokensToStyle(tokens)} dir={ctx.dir} lang={ctx.locale} data-template={ctx.def.code}>
      <link rel="stylesheet" href={googleFontsHref(fontKeysOf(tokens))} precedence="fonts" />
      <HtmlLang locale={ctx.locale} />
      <Nav ctx={ctx} />
      <main>
        {order.map((key) => {
          if (!sectionEnabled(ctx, key)) return null;
          const C = pick(ctx, key);
          return <C key={key} ctx={ctx} />;
        })}
      </main>
      <Footer ctx={ctx} />
      <FloatingWhatsApp ctx={ctx} />
      <ScrollTop label={ctx.ui("back_to_top")} />
    </div>
  );
}
