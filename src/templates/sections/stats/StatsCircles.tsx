import type { SectionProps } from "../../types";
import { Container } from "../../ui/primitives";

const R = 52;
const CIRC = 2 * Math.PI * R;

/** Ring fill: a real percentage when the value is one (e.g. "98%"), otherwise a pleasing decorative sweep. */
function ringPct(value: string, i: number): number {
  const n = parseFloat(value.replace(/[^\d.]/g, ""));
  if (value.includes("%") && Number.isFinite(n) && n >= 0 && n <= 100) return n;
  return 68 + ((i * 11) % 27);
}

/** Primary band with each value inside an SVG progress ring stroked in the accent colour. */
export function StatsCircles({ ctx }: SectionProps) {
  const stats = ctx.site.content.stats;
  return (
    <section className="relative overflow-hidden bg-primary text-primary-fg">
      <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-25" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -end-20 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -start-20 -top-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
      <Container className="relative grid grid-cols-2 gap-x-4 gap-y-10 py-14 sm:py-20 lg:grid-cols-4">
        {stats.map((s, i) => {
          const pct = ringPct(s.value, i);
          return (
            <div key={s.id} className="flex flex-col items-center text-center">
              <div className="relative h-32 w-32 sm:h-40 sm:w-40">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="6" />
                  <circle
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    stroke="var(--t-accent)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - pct / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center px-4 font-heading text-2xl font-black tabular-nums sm:text-3xl">{s.value}</div>
              </div>
              <div className="mt-3 max-w-[10rem] text-sm font-semibold opacity-90 sm:text-base">{ctx.text(s.label)}</div>
            </div>
          );
        })}
      </Container>
    </section>
  );
}
