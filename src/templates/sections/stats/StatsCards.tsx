import type { SectionProps } from "../../types";
import { Container } from "../../ui/primitives";
import { Icon } from "../../ui/icons";

const STAT_ICONS = ["star", "check", "crown", "shield", "gem", "sparkle"];

/** Surface cards with an accent top border, icon medallion and large value. */
export function StatsCards({ ctx }: SectionProps) {
  const stats = ctx.site.content.stats;
  return (
    <section className="relative bg-bg text-fg">
      <Container className="grid grid-cols-2 gap-4 py-12 sm:gap-6 sm:py-16 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.id} className="group relative overflow-hidden rounded-card border border-line border-t-4 border-t-accent bg-surface p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-7">
            <span aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-30" />
            <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition duration-300 group-hover:bg-primary group-hover:text-primary-fg">
              <Icon name={STAT_ICONS[i % STAT_ICONS.length]} className="h-6 w-6" />
            </span>
            <div className="relative mt-4 font-heading text-3xl font-black tabular-nums sm:text-4xl">{s.value}</div>
            <div className="relative mt-1 text-sm font-semibold text-muted">{ctx.text(s.label)}</div>
          </div>
        ))}
      </Container>
    </section>
  );
}
