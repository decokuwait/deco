import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, VisitorChip, WhatsAppIcon, chromeButtonClass, cx } from "../../ui/primitives";
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
  const linkCls = "inline-flex min-h-6 items-center px-3 text-sm font-semibold text-muted transition hover:text-primary-text";
  return (
    <header id="top" className={cx("sticky z-50 border-b border-line bg-bg/90 backdrop-blur", CHROME_TOP)}>
      <Container className="flex items-center justify-between py-3 lg:hidden">
        <Brand ctx={ctx} />
        <div className="flex items-center gap-2">
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass({ round: true })} />}
          <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg">
            <WhatsAppIcon />
          </WhatsAppLink>
          <MobileMenu links={links} label={ctx.ui("menu")} closeLabel={ctx.ui("close")} buttonClassName={chromeButtonClass({ round: true, icon: true })} />
        </div>
      </Container>
      <Container className="hidden lg:block">
        <div className="flex items-center justify-between py-3">
          <VisitorChip ctx={ctx} />
          <Brand ctx={ctx} size="lg" />
          {c.settings.showLangToggle ? <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass({ round: true })} /> : <span className="w-16" />}
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
