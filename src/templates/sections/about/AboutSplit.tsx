import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { aboutAlt } from "../shared/helpers";

/** Image with offset accent frame beside the story text and highlight points. */
export function AboutSplit({ ctx }: SectionProps) {
  const a = ctx.site.content.about;
  const brand = ctx.site.content.brand;
  return (
    <Section id="about" tone="bg">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <div aria-hidden className="absolute -start-4 -top-4 h-full w-full rounded-card border-2 border-accent" />
          <div className="relative overflow-hidden rounded-card">
            <Img src={a.imageUrl || ctx.site.content.hero.imageUrl} alt={aboutAlt(ctx)} slot="about" sizes={SIZES.half} />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <SectionHeading align="start" eyebrow={ctx.text(brand.name)} title={ctx.text(a.title)} className="mb-6" />
          <p className="text-lg leading-relaxed text-muted">{ctx.text(a.body)}</p>
          {a.points.length > 0 && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {a.points.map((p, i) => (
                <li key={i} className="flex items-start gap-3 rounded-card bg-surface p-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                  <span className="font-semibold">{ctx.text(p)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
