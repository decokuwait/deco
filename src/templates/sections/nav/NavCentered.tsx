import type { SectionProps } from "../../types";
import { Container, VisitorChip, WhatsAppIcon, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Logo centered on its own row; links split left/right beneath it with a round WhatsApp button. */
export function NavCentered({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const half = Math.ceil(links.length / 2);
  const first = links.slice(0, half);
  const second = links.slice(half);
  const linkCls = "px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-primary";
  return (
    <header id="top" className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur">
      <Container className="flex items-center justify-between py-3 lg:hidden">
        <Brand ctx={ctx} />
        <div className="flex items-center gap-2">
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold" />}
          <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg">
            <WhatsAppIcon />
          </WhatsAppLink>
          <MobileMenu links={links} label={ctx.ui("menu")} closeLabel={ctx.ui("close")} />
        </div>
      </Container>
      <Container className="hidden lg:block">
        <div className="flex items-center justify-between py-3">
          <VisitorChip ctx={ctx} />
          <Brand ctx={ctx} size="lg" />
          {c.settings.showLangToggle ? <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface-2" /> : <span className="w-16" />}
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-line py-2">
          <nav className="flex items-center">
            {first.map((l) => (
              <a key={l.href} href={l.href} className={linkCls}>
                {l.label}
              </a>
            ))}
          </nav>
          <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className={cx("mx-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg transition hover:scale-105")}>
            <WhatsAppIcon />
          </WhatsAppLink>
          <nav className="flex items-center">
            {second.map((l) => (
              <a key={l.href} href={l.href} className={linkCls}>
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </Container>
    </header>
  );
}
