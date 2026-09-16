import type { SectionProps } from "../../types";
import { CHROME_TOP, Container, VisitorChip, WhatsAppIcon, buttonClass, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Bar framed in a bordered box with a thick accent base line; links behave like underlined tabs. */
export function NavBoxed({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  const btn = buttonClass(ctx.def.tokens.buttonStyle, "primary", "md");
  return (
    <header id="top" className={cx("sticky z-50 bg-bg pt-2 sm:pt-3", CHROME_TOP)}>
      <Container wide>
        <div className="flex h-16 items-center justify-between gap-4 rounded-card border border-line border-b-4 border-b-accent bg-surface px-3 shadow-sm sm:h-20 sm:px-5">
          <Brand ctx={ctx} />
          <nav className="hidden h-full items-stretch lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="flex items-center border-b-4 border-transparent px-4 text-sm font-bold text-muted transition hover:border-primary hover:text-fg">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <VisitorChip ctx={ctx} className="max-xl:hidden" />
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
        </div>
      </Container>
    </header>
  );
}
