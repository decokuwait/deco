import type { SectionProps } from "../../types";
import { Container, Section, SectionHeading, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { Icon } from "../../ui/icons";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

function lgCols(n: number) {
  if (n <= 3) return "lg:grid-cols-3";
  if (n === 4) return "lg:grid-cols-4";
  if (n === 5) return "lg:grid-cols-5";
  return "lg:grid-cols-6";
}

/** Compact icon tiles: 2 columns on mobile, 3-6 on desktop, circular primary icons and minimal text. */
export function ServicesIconRow({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  return (
    <Section id="services" tone="bg" pattern>
      <Container>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <ul className={cx("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4", lgCols(s.items.length))}>
          {s.items.map((it) => (
            <li key={it.id} className="group flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-3 py-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-fg ring-4 ring-primary/15 transition duration-300 group-hover:ring-accent/40">
                <Icon name={it.icon} className="h-7 w-7" />
                <span aria-hidden className="absolute -end-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-surface" />
              </span>
              <h3 className="font-heading text-sm font-bold leading-snug sm:text-base">{ctx.text(it.title)}</h3>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "primary")}>
            <WhatsAppIcon />
            {ctx.ui("get_quote")}
          </WhatsAppLink>
        </div>
      </Container>
    </Section>
  );
}
