import type { SectionProps } from "../../types";
import { Container } from "../../ui/primitives";

/** Dark band with large numbers. */
export function StatsBand({ ctx }: SectionProps) {
  const stats = ctx.site.content.stats;
  return (
    <section className="tone-dark relative bg-secondary text-secondary-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-30" />
      <Container className="relative grid grid-cols-2 gap-6 py-12 sm:py-16 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.id} className="text-center">
            <div className="font-heading text-4xl font-black text-accent-text sm:text-5xl">{s.value}</div>
            <div className="mt-2 text-sm font-semibold opacity-85 sm:text-base">{ctx.text(s.label)}</div>
          </div>
        ))}
      </Container>
    </section>
  );
}
