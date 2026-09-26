import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, WhatsAppIcon, buttonClass, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand, NavDrawerBrand, NavDrawerCta, TopAnchor } from "./shared";

/** Sticky bar: logo start, links centre, WhatsApp button + language end. */
export function NavClassic({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <>
      <TopAnchor />
      <header className={cx("sticky z-50 border-b border-line bg-bg/85 backdrop-blur", CHROME_TOP)}>
        {/* gap-3 before gap-4: at 320px the brand, the language chip and the menu button share 288px. */}
        <Container className="flex h-16 items-center justify-between gap-3 sm:h-20 sm:gap-4">
          <Brand ctx={ctx} />
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center rounded-card px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={chromeButtonClass()} />}
            <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "max-sm:hidden")}>
              <WhatsAppIcon />
              {ctx.ui("whatsapp")}
            </WhatsAppLink>
            <MobileMenu
              className="lg:hidden"
              variant="drawer"
              mark="bars"
              buttonClassName={chromeButtonClass({ icon: true })}
              links={links}
              label={ctx.ui("menu")}
              closeLabel={ctx.ui("close")}
              header={<NavDrawerBrand ctx={ctx} />}
              cta={<NavDrawerCta ctx={ctx} />}
            />
          </div>
        </Container>
      </header>
    </>
  );
}
