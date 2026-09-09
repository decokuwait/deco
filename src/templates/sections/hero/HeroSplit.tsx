import type { SectionProps } from "../../types";
import { Badge, Btn, Container, Img, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";
import { projectsAnchor } from "../shared/helpers";

/** Text on one side, large image with a floating stat card on the other. */
export function HeroSplit({ ctx }: SectionProps) {
  const c = ctx.site.content;
  const h = c.hero;
  const stat = c.stats[0];
  return (
    <section className="relative overflow-hidden bg-bg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-50" />
      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div className="animate-fade-up">
          {ctx.text(h.badge) && <Badge>{ctx.text(h.badge)}</Badge>}
          <h1 className="mt-5 font-heading text-4xl font-black leading-[1.15] sm:text-5xl lg:text-6xl">{ctx.text(h.title)}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{ctx.text(h.subtitle)}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "primary", "lg")}>
              <WhatsAppIcon />
              {ctx.text(h.primaryCta) || ctx.ui("whatsapp")}
            </WhatsAppLink>
            {ctx.text(h.secondaryCta) && (
              <Btn ctx={ctx} href={projectsAnchor(ctx)} variant="ghost" size="lg">
                {ctx.text(h.secondaryCta)}
              </Btn>
            )}
          </div>
          {c.about.points.length > 0 && (
            <ul className="mt-8 grid gap-2 text-sm text-muted sm:grid-cols-2">
              {c.about.points.slice(0, 4).map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  {ctx.text(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <div className={cx("relative aspect-[4/5] overflow-hidden rounded-card shadow-2xl sm:aspect-[5/4] lg:aspect-[4/5]")}>
            <Img src={h.imageUrl} alt={ctx.text(h.title)} className="h-full w-full object-cover" eager />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/40 to-transparent" />
          </div>
          <div aria-hidden className="absolute -end-6 -top-6 -z-10 h-40 w-40 rounded-card bg-accent/30" />
          <div aria-hidden className="absolute -bottom-6 -start-6 -z-10 h-56 w-56 rounded-card bg-primary/15" />
          {stat && (
            <div className="absolute bottom-5 start-5 flex items-center gap-3 rounded-card bg-surface/95 px-4 py-3 shadow-xl backdrop-blur animate-float">
              <span className="font-heading text-3xl font-black text-primary">{stat.value}</span>
              <span className="text-sm font-semibold text-muted">{ctx.text(stat.label)}</span>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
