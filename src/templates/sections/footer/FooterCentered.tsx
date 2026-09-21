import type { SectionProps } from "../../types";
import { Container, Img, SocialIcon, VisitorChip, socialLinks } from "../../ui/primitives";
import { legalLinks, navLinks } from "../shared/helpers";

/** Centred footer on surface-2 with pattern: logo/brand, tagline, links row, socials, copyright. */
export function FooterCentered({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const socials = socialLinks(ctx);
  const year = new Date().getFullYear();
  const name = ctx.text(c.brand.name);
  const tagline = ctx.text(c.brand.tagline);
  return (
    <footer className="relative overflow-hidden bg-surface-2 text-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <Container className="relative flex flex-col items-center py-14 text-center">
        <a href="/#top" className="flex flex-col items-center gap-3">
          {c.brand.logoUrl ? (
            <Img src={c.brand.logoUrl} alt="" className="h-14 w-auto object-contain" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary font-heading text-2xl font-black text-primary-fg ring-4 ring-accent/30">
              {name.trim().charAt(0)}
            </span>
          )}
          <span className="font-heading text-2xl font-extrabold">{name}</span>
        </a>
        {tagline && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{tagline}</p>}
        <span aria-hidden className="my-7 h-px w-12 bg-accent" />
        <nav aria-label={ctx.ui("quick_links")}>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold">
            {navLinks(ctx).map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex min-h-6 items-center transition hover:text-primary-text">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {socials.length > 0 && (
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {socials.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-fg ring-1 ring-line transition hover:bg-primary hover:text-primary-fg hover:ring-primary"
              >
                <SocialIcon name={s.key} />
              </a>
            ))}
          </div>
        )}
        <div className="mt-10 flex flex-col items-center gap-3 text-xs text-muted">
          <span>
            © {year} {name} — {ctx.ui("rights")}
            {legalLinks(ctx).map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-6 items-center ms-3 underline underline-offset-2 hover:text-primary-text">
                {l.label}
              </a>
            ))}
          </span>
          <VisitorChip ctx={ctx} />
        </div>
      </Container>
    </footer>
  );
}
