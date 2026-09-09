import type { SectionProps } from "../../types";
import { Container, Img, SocialIcon, VisitorChip, socialLinks } from "../../ui/primitives";
import { navLinks } from "../shared/helpers";

/** One-row footer on the page background with a top border: brand, links, socials, copyright + visitor chip. */
export function FooterMinimal({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const socials = socialLinks(ctx);
  const year = new Date().getFullYear();
  const name = ctx.text(c.brand.name);
  return (
    <footer className="border-t border-line bg-bg text-fg">
      <Container className="flex flex-col items-center gap-5 py-8 text-center lg:flex-row lg:justify-between lg:gap-6 lg:text-start">
        <a href="#top" className="flex items-center gap-2.5">
          {c.brand.logoUrl ? (
            <Img src={c.brand.logoUrl} alt="" className="h-8 w-auto object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-black text-primary-fg">{name.trim().charAt(0)}</span>
          )}
          <span className="font-heading text-lg font-extrabold">{name}</span>
        </a>
        <nav aria-label={ctx.ui("quick_links")}>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-muted">
            {navLinks(ctx).map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition hover:text-primary">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {socials.length > 0 && (
          <div className="flex gap-1">
            {socials.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-primary"
              >
                <SocialIcon name={s.key} className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center gap-2 text-xs text-muted sm:flex-row sm:gap-3">
          <span>
            © {year} {name} — {ctx.ui("rights")}
          </span>
          <VisitorChip ctx={ctx} />
        </div>
      </Container>
    </footer>
  );
}
