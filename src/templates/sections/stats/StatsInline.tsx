import type { SectionProps } from "../../types";
import { Container, cx } from "../../ui/primitives";

/** Compact single row on the page background, values and labels side by side, separated by vertical rules. */
export function StatsInline({ ctx }: SectionProps) {
  const stats = ctx.site.content.stats;
  const n = stats.length;
  return (
    <section className="bg-bg text-fg">
      <Container>
        <div className="grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:flex sm:flex-wrap sm:justify-center sm:gap-y-4 sm:py-7">
          {stats.map((s, i) => {
            const last = i === n - 1;
            return (
              <div
                key={s.id}
                className={cx(
                  "flex items-center justify-center gap-3 border-line px-3 sm:px-8 lg:px-12",
                  !last && "sm:border-e",
                  !last && i % 2 === 0 && "border-e",
                )}
              >
                <span className="font-heading text-2xl font-black tabular-nums text-primary-text sm:text-3xl">{s.value}</span>
                <span className="max-w-[8rem] text-xs font-semibold leading-tight text-muted sm:text-sm">{ctx.text(s.label)}</span>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
