import type { SectionProps } from "../../types";
import { CHROME_TOP_FLOAT, WhatsAppIcon, chromeButtonClass, cx } from "../../ui/primitives";
import { MobileMenu } from "../../ui/client/MobileMenu";
import { LangToggle } from "../../ui/client/LangToggle";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { navLinks } from "../shared/helpers";
import { Brand, NavDrawerBrand, NavDrawerCta, TopAnchor } from "./shared";

/** Floating pill-shaped bar with a blurred surface, detached from the page edge. */
export function NavPill({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const links = navLinks(ctx);
  return (
    <>
      <TopAnchor />
      <header className={cx("sticky z-50 px-3 sm:px-6", CHROME_TOP_FLOAT)}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-surface/85 pe-2 ps-4 shadow-lg shadow-black/5 backdrop-blur sm:h-16 sm:ps-6">
          <Brand ctx={ctx} size="sm" />
          <nav className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center rounded-full px-4 py-1.5 text-sm font-bold text-muted transition hover:bg-bg hover:text-fg hover:shadow-sm">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {c.settings.showLangToggle && <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className={cx(chromeButtonClass({ round: true, slim: true }), "max-sm:hidden")} />}
            <WhatsAppLink href={ctx.whatsappHref} className={cx("flex h-11 items-center gap-2 rounded-full bg-primary px-3 text-sm font-bold text-primary-fg shadow-md transition hover:-translate-y-0.5 sm:px-5")}>
              <WhatsAppIcon />
              <span className="hidden sm:inline">{ctx.ui("whatsapp")}</span>
            </WhatsAppLink>
            <MobileMenu
              className="lg:hidden"
              variant="sheet"
              mark="pill"
              links={links}
              label={ctx.ui("menu")}
              closeLabel={ctx.ui("close")}
              buttonClassName={chromeButtonClass({ round: true, icon: true, slim: true })}
              header={<NavDrawerBrand ctx={ctx} size="sm" />}
              cta={
                <NavDrawerCta
                  ctx={ctx}
                  extra={
                    c.settings.showLangToggle ? (
                      <LangToggle locale={ctx.locale} label={ctx.ui("lang_switch")} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-bg px-4 text-sm font-bold sm:hidden" />
                    ) : undefined
                  }
                />
              }
            />
          </div>
        </div>
      </header>
    </>
  );
}
