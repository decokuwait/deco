import type { SectionProps } from "../../types";
import { VisitorChip, WhatsAppIcon, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand } from "./shared";

/** Floating pill-shaped bar with a blurred surface, detached from the page edge. */
export function NavPill({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  return (
    <header id="top" className="sticky top-3 z-50 px-3 sm:top-4 sm:px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-surface/85 pe-2 ps-4 shadow-lg shadow-black/5 backdrop-blur sm:h-16 sm:ps-6">
        <Brand ctx={ctx} size="sm" />
        <nav className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-1.5 text-sm font-bold text-muted transition hover:bg-bg hover:text-fg hover:shadow-sm">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <VisitorChip ctx={ctx} className="hidden xl:inline-flex" />
          {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="hidden rounded-full px-3 py-1.5 text-xs font-bold text-muted hover:text-fg sm:inline-flex" />}
          <WhatsAppLink href={ctx.whatsappHref} className={cx("flex h-10 items-center gap-2 rounded-full bg-primary px-3 text-sm font-bold text-primary-fg shadow-md transition hover:-translate-y-0.5 sm:h-11 sm:px-5")}>
            <WhatsAppIcon />
            <span className="hidden sm:inline">{ctx.ui("whatsapp")}</span>
          </WhatsAppLink>
          <MobileMenu
            className="lg:hidden"
            links={links}
            label={ctx.ui("menu")}
            closeLabel={ctx.ui("close")}
            buttonClassName="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-fg"
            cta={
              <div className="flex flex-col gap-2">
                {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="rounded-full border border-line px-4 py-2 text-sm font-bold" />}
                <WhatsAppLink href={ctx.whatsappHref} className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-bold text-primary-fg">
                  <WhatsAppIcon />
                  {ctx.ui("whatsapp")}
                </WhatsAppLink>
              </div>
            }
          />
        </div>
      </div>
    </header>
  );
}
