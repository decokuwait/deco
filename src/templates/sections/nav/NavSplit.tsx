import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, PhoneIcon, WhatsAppIcon, buttonClass, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone, navLinks } from "../shared/helpers";
import { AR_LEADING } from "../../leading";
import { Brand, NavDrawerBrand, NavDrawerCta, TopAnchor } from "./shared";

/** Two rows: a thin secondary-colour utility bar (phone, hours, language) and the main bar. */
export function NavSplit({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  const hours = ctx.text(c.contact.hours);
  return (
    <>
      <TopAnchor />
      {/* The one nav that is two stacked bars (utility strip + main row), so it covers 100px/116px rather
          than the 68px/84px every other variant does. `scroll-padding-top` is resolved on <html> and cannot
          read a value set down here, so this marker lets globals.css lift the offset for this variant only —
          the same trick the preview toolbar uses. Without it every in-page anchor lands ~32px behind the bar. */}
      <header data-dk-nav="split" className={cx("sticky z-50 bg-bg shadow-sm", CHROME_TOP)}>
        <div className="bg-secondary text-secondary-fg">
          <Container className="flex h-9 items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              {c.contact.phone && (
                <WhatsAppLink href={ctx.telHref} kind="call_click" className="inline-flex min-h-6 items-center gap-1.5 font-bold hover:text-accent">
                  <PhoneIcon className="h-3.5 w-3.5" />
                  <span dir="ltr">{formatPhone(c.contact.phone)}</span>
                </WhatsAppLink>
              )}
              {hours && <span className="hidden opacity-80 sm:inline">{hours}</span>}
            </div>
            <div className="flex items-center gap-3">
              {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="inline-flex min-h-6 items-center font-bold hover:text-accent" />}
            </div>
          </Container>
        </div>
        <Container className="flex h-16 items-center justify-between gap-3 border-b border-line sm:h-20 sm:gap-4">
          <Brand ctx={ctx} />
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center border-b-2 border-transparent px-3 py-2 text-sm font-bold text-muted transition hover:border-accent hover:text-fg">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <WhatsAppLink href={ctx.whatsappHref} className={cx(btn, "max-sm:hidden")}>
              <WhatsAppIcon />
              {ctx.ui("whatsapp")}
            </WhatsAppLink>
            <MobileMenu
              className="lg:hidden"
              variant="drawer"
              mark="dot"
              buttonClassName={chromeButtonClass({ icon: true })}
              links={links}
              label={ctx.ui("menu")}
              closeLabel={ctx.ui("close")}
              header={
                <NavDrawerBrand ctx={ctx}>
                  {/* The utility bar is this nav's signature, and its hours are the part a phone never sees. */}
                  {hours && <span className={cx("mt-1 block text-xs font-bold text-accent-text", AR_LEADING)}>{hours}</span>}
                </NavDrawerBrand>
              }
              cta={<NavDrawerCta ctx={ctx} />}
            />
          </div>
        </Container>
      </header>
    </>
  );
}
