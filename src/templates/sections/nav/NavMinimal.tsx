import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, WhatsAppIcon, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand, NavDrawerBrand, NavDrawerCta, TopAnchor } from "./shared";

/** Ultra-slim bar: brand, a WhatsApp icon button and a hamburger drawer on every screen size. */
export function NavMinimal({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  return (
    <>
      <TopAnchor />
      <header className={cx("sticky z-50 bg-bg/95 backdrop-blur", CHROME_TOP)}>
        <Container wide className="flex h-14 items-center justify-between gap-3">
          <Brand ctx={ctx} size="sm" />
          <div className="flex items-center gap-1.5">
            {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass({ slim: true })} />}
            <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className={cx("flex h-11 w-11 items-center justify-center rounded-card bg-primary text-primary-fg transition hover:opacity-90")}>
              <WhatsAppIcon />
            </WhatsAppLink>
            <MobileMenu
              variant="quiet"
              mark="thin"
              links={links}
              label={ctx.ui("menu")}
              closeLabel={ctx.ui("close")}
              buttonClassName={chromeButtonClass({ icon: true, slim: true })}
              header={<NavDrawerBrand ctx={ctx} size="sm" />}
              cta={<NavDrawerCta ctx={ctx} />}
            />
          </div>
        </Container>
        <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-line to-transparent" />
      </header>
    </>
  );
}
