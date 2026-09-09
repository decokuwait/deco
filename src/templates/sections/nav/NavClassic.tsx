import type { SectionProps } from "../../types";
import { Container, Img, VisitorChip, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";

/** Sticky bar: logo start, links centre, WhatsApp button + language end. */
export function NavClassic({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <header id="top" className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-20">
        <a href="#top" className="flex items-center gap-3">
          {c.brand.logoUrl ? (
            <Img src={c.brand.logoUrl} alt={ctx.text(c.brand.name)} className="h-10 w-auto object-contain sm:h-12" eager />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-card bg-primary font-heading text-lg font-black text-primary-fg">{ctx.text(c.brand.name).slice(0, 1)}</span>
          )}
          <span className="font-heading text-lg font-extrabold leading-tight sm:text-xl">{ctx.text(c.brand.name)}</span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-card px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <VisitorChip ctx={ctx} className="hidden md:inline-flex" />
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="rounded-card border border-line px-3 py-2 text-xs font-bold hover:bg-surface-2" />}
          <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "hidden sm:inline-flex")}>
            <WhatsAppIcon />
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
          <MobileMenu
            className="lg:hidden"
            links={links}
            label={ctx.ui("menu")}
            closeLabel={ctx.ui("close")}
            cta={
              <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "w-full")}>
                <WhatsAppIcon />
                {ctx.ui("whatsapp")}
              </WhatsAppLink>
            }
          />
        </div>
      </Container>
    </header>
  );
}
