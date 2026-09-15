import type { SectionProps } from "../../types";
import { Container, Img, SocialIcon, VisitorChip, socialLinks } from "../../ui/primitives";
import { formatPhone, legalLinks, navLinks } from "../shared/helpers";

/** Four-column footer on the secondary colour. */
export function FooterColumns({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const socials = socialLinks(ctx);
  const year = new Date().getFullYear();
  return (
    <footer className="tone-dark relative bg-secondary text-secondary-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-30" />
      <Container className="relative grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {c.brand.logoUrl ? <Img src={c.brand.logoUrl} alt="" className="h-10 w-auto object-contain" /> : null}
            <span className="font-heading text-xl font-extrabold">{ctx.text(c.brand.name)}</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed opacity-80">{ctx.text(c.brand.tagline)}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-2">
              {socials.map((s) => (
                <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-accent hover:text-accent-fg">
                  <SocialIcon name={s.key} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="font-heading text-base font-bold">{ctx.ui("quick_links")}</h4>
          <ul className="mt-4 space-y-2 text-sm opacity-85">
            {navLinks(ctx).map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-accent">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-heading text-base font-bold">{ctx.ui("nav_services")}</h4>
          <ul className="mt-4 space-y-2 text-sm opacity-85">
            {c.services.items.slice(0, 6).map((s) => (
              <li key={s.id}>
                <a href="#services" className="hover:text-accent">
                  {ctx.text(s.title)}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-heading text-base font-bold">{ctx.ui("nav_contact")}</h4>
          <ul className="mt-4 space-y-2 text-sm opacity-85">
            {ctx.text(c.contact.address) && <li>{ctx.text(c.contact.address)}</li>}
            {c.contact.phone && (
              <li>
                <a href={ctx.telHref} dir="ltr" className="inline-block hover:text-accent">
                  {formatPhone(c.contact.phone)}
                </a>
              </li>
            )}
            {c.contact.email && (
              <li>
                <a href={`mailto:${c.contact.email}`} className="hover:text-accent">
                  {c.contact.email}
                </a>
              </li>
            )}
            {ctx.text(c.contact.hours) && <li>{ctx.text(c.contact.hours)}</li>}
          </ul>
        </div>
      </Container>
      <div className="relative border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-3 py-5 text-xs opacity-75 sm:flex-row">
          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>
              © {year} {ctx.text(c.brand.name)} — {ctx.ui("rights")}
            </span>
            {legalLinks(ctx).map((l) => (
              <a key={l.href} href={l.href} className="underline underline-offset-2 hover:text-accent">
                {l.label}
              </a>
            ))}
          </span>
          <VisitorChip ctx={ctx} className="border-white/20 bg-white/10 text-white [&_span]:text-white" />
        </Container>
      </div>
    </footer>
  );
}
