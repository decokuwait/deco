import type { SectionProps } from "../../types";
import { Arrow, Container, Section, SectionHeading } from "../../ui/primitives";
import { Icon } from "../../ui/icons";

/** Editorial vertical list: oversized index number, icon medallion, title/description, hairline dividers and a hover slide. */
export function ServicesList({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  return (
    <Section id="services" tone="bg" className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -end-24 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -start-24 bottom-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <Container>
        <SectionHeading align="start" title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <ol className="border-t border-line">
          {s.items.map((it, i) => (
            <li key={it.id} className="border-b border-line">
              <article className="group grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 py-6 transition-all duration-300 hover:ps-3 sm:grid-cols-[4.5rem_auto_1fr_auto] sm:gap-x-6 sm:py-7">
                <span className="font-heading text-3xl font-black leading-none text-primary-text/25 tabular-nums transition-colors duration-300 group-hover:text-accent sm:text-5xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary-text ring-1 ring-primary/15 transition duration-300 group-hover:bg-primary group-hover:text-primary-fg sm:h-14 sm:w-14">
                  <Icon name={it.icon} className="h-6 w-6" />
                </span>
                <div className="col-span-2 sm:col-span-1">
                  <h3 className="font-heading text-xl font-bold sm:text-2xl">{ctx.text(it.title)}</h3>
                  <p className="mt-1.5 max-w-2xl leading-relaxed text-muted">{ctx.text(it.description)}</p>
                </div>
                <span className="hidden h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg sm:flex">
                  <Arrow dir={ctx.dir} className="h-5 w-5" />
                </span>
              </article>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
