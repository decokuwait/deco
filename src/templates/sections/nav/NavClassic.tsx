import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, Img, VisitorChip, WhatsAppIcon, buttonClass, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { AR_LEADING } from "../../leading";

/** Sticky bar: logo start, links centre, WhatsApp button + language end. */
export function NavClassic({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <header id="top" className={cx("sticky z-50 border-b border-line bg-bg/85 backdrop-blur", CHROME_TOP)}>
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-20">
        <a href="/#top" className="flex min-w-0 items-center gap-3">
          {c.brand.logoUrl ? (
            <Img src={c.brand.logoUrl} alt={ctx.text(c.brand.name)} ratio={null} className="h-10 w-auto shrink-0 object-contain sm:h-12" eager />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-primary font-heading text-lg font-black text-primary-fg">{ctx.text(c.brand.name).slice(0, 1)}</span>
          )}
          <span className={cx("line-clamp-2 font-heading text-base font-extrabold leading-tight sm:text-xl", AR_LEADING)}>{ctx.text(c.brand.name)}</span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center rounded-card px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <VisitorChip ctx={ctx} className="max-md:hidden" />
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass()} />}
          <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "max-sm:hidden")}>
            <WhatsAppIcon />
            {ctx.ui("whatsapp")}
          </WhatsAppLink>
          <MobileMenu
            className="lg:hidden"
            buttonClassName={chromeButtonClass({ icon: true })}
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
