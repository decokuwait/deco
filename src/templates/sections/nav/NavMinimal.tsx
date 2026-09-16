import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, VisitorChip, WhatsAppIcon, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Ultra-slim bar: brand, a WhatsApp icon button and a hamburger drawer on every screen size. */
export function NavMinimal({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  return (
    <header id="top" className={cx("sticky z-50 bg-bg/95 backdrop-blur", CHROME_TOP)}>
      <Container wide className="flex h-14 items-center justify-between gap-3">
        <Brand ctx={ctx} size="sm" />
        <div className="flex items-center gap-1.5">
          <VisitorChip ctx={ctx} className="max-sm:hidden" />
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass({ slim: true })} />}
          <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className={cx("flex h-10 w-10 items-center justify-center rounded-card bg-primary text-primary-fg transition hover:opacity-90")}>
            <WhatsAppIcon />
          </WhatsAppLink>
          <MobileMenu
            links={links}
            label={ctx.ui("menu")}
            closeLabel={ctx.ui("close")}
            buttonClassName={chromeButtonClass({ icon: true, slim: true })}
            cta={
              <WhatsAppLink href={ctx.whatsappHref} className="flex w-full items-center justify-center gap-2 rounded-card bg-primary px-4 py-3 font-bold text-primary-fg">
                <WhatsAppIcon />
                {ctx.ui("whatsapp")}
              </WhatsAppLink>
            }
          />
        </div>
      </Container>
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-line to-transparent" />
    </header>
  );
}
