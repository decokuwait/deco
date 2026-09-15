import type { SectionProps } from "../../types";
import { Container, VisitorChip, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { NavScrollState } from "../../ui/client/NavScrollState";
import { navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Fixed bar that floats transparently over the hero and turns into a solid blurred bar once scrolled. */
export function NavTransparent({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <NavScrollState
      className="fixed inset-x-0 top-0 z-50 text-fg transition-all duration-300"
      topClassName="bg-gradient-to-b from-bg/95 via-bg/60 to-transparent"
      scrolledClassName="bg-bg/90 shadow-sm backdrop-blur border-b border-line"
    >
      <Container wide className="flex h-16 items-center justify-between gap-4 transition-all group-data-[scrolled]:h-14 sm:h-20 sm:group-data-[scrolled]:h-16">
        <Brand ctx={ctx} />
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-2 text-sm font-bold transition hover:bg-fg/5">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <VisitorChip ctx={ctx} className="max-md:hidden" />
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="rounded-full border border-fg/20 px-3 py-1.5 text-xs font-bold hover:bg-fg/5" />}
          <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "max-sm:hidden")}>
            <WhatsAppIcon />
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
          <MobileMenu
            className="lg:hidden"
            links={links}
            label={ctx.ui("menu")}
            closeLabel={ctx.ui("close")}
            buttonClassName="inline-flex h-11 w-11 items-center justify-center rounded-full border border-fg/20"
            cta={
              <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "w-full")}>
                <WhatsAppIcon />
                {ctx.ui("whatsapp")}
              </WhatsAppLink>
            }
          />
        </div>
      </Container>
    </NavScrollState>
  );
}
