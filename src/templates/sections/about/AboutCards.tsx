import type { SectionProps } from "../../types";
import { Container, Img, Section, cx } from "../../ui/primitives";
import { longTextFont } from "../shared/helpers";
import { Icon } from "../../ui/icons";

const POINT_ICONS = ["check", "star", "shield", "gem", "sparkle", "crown", "ruler", "tools"];

/** Centred title and story followed by the highlight points as an icon card grid (optional wide image banner). */
export function AboutCards({ ctx }: SectionProps) {
  const a = ctx.site.content.about;
  const brand = ctx.site.content.brand;
  return (
    <Section id="about" tone="surface" pattern>
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          {ctx.text(brand.name) && <span className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-primary">{ctx.text(brand.name)}</span>}
          <h2 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">{ctx.text(a.title)}</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{ctx.text(a.body)}</p>
        </div>
        {a.imageUrl && (
          <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-card sm:aspect-[21/9]">
            <Img src={a.imageUrl} alt={ctx.text(a.title)} className="h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary/50 to-transparent" />
          </div>
        )}
        {a.points.length > 0 && (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {a.points.map((p, i) => (
              <li key={i} className="group relative overflow-hidden rounded-card border border-line bg-bg p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl">
                <span aria-hidden className="absolute -end-6 -top-6 h-20 w-20 rounded-full bg-accent/10 transition-transform duration-500 group-hover:scale-150" />
                <div className="relative flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-primary text-primary-fg shadow-md">
                    <Icon name={POINT_ICONS[i % POINT_ICONS.length]} className="h-6 w-6" />
                  </span>
                  <div>
                    <span className="text-xs font-black tracking-widest text-accent-text tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <p className={cx("mt-1 text-lg font-bold leading-snug", longTextFont(ctx))}>{ctx.text(p)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
