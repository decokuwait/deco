import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, PhoneIcon, VisitorChip, WhatsAppIcon, buttonClass, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { formatPhone, navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Two rows: a thin secondary-colour utility bar (phone, hours, language, visitor id) and the main bar. */
export function NavSplit({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <header id="top" className={cx("sticky z-50 bg-bg shadow-sm", CHROME_TOP)}>
      <div className="bg-secondary text-secondary-fg">
        <Container className="flex h-9 items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            {c.contact.phone && (
              <WhatsAppLink href={ctx.telHref} kind="call_click" className="inline-flex min-h-6 items-center gap-1.5 font-bold hover:text-accent">
                <PhoneIcon className="h-3.5 w-3.5" />
                <span dir="ltr">{formatPhone(c.contact.phone)}</span>
              </WhatsAppLink>
            )}
            {ctx.text(c.contact.hours) && <span className="hidden opacity-80 sm:inline">{ctx.text(c.contact.hours)}</span>}
          </div>
          <div className="flex items-center gap-3">
            <VisitorChip ctx={ctx} className="border-white/20 bg-white/10 text-white [&_span]:text-white" />
            {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="inline-flex min-h-6 items-center font-bold hover:text-accent" />}
          </div>
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-4 border-b border-line sm:h-20">
        <Brand ctx={ctx} />
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center border-b-2 border-transparent px-3 py-2 text-sm font-bold text-muted transition hover:border-accent hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
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
