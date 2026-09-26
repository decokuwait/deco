import type { SectionProps } from "../../types";
import { Arrow, Container, Img, Section, SectionHeading, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { Icon } from "../../ui/icons";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Alternating image/text rows with numbered accent labels and offset frames. */
export function ServicesZigzag({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  return (
    <Section id="services" tone="bg" className="overflow-hidden">
      <Container>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <div className="flex flex-col gap-14 sm:gap-20">
          {s.items.map((it, i) => {
            const flip = i % 2 === 1;
            return (
              <article key={it.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <div className={cx("relative", flip && "lg:order-2")}>
                  <div aria-hidden className={cx("absolute -top-3 h-full w-full rounded-card border-2 border-accent", flip ? "-end-3" : "-start-3")} />
                  <div aria-hidden className={cx("absolute -bottom-8 h-36 w-36 rounded-full bg-primary/15 blur-2xl", flip ? "-start-8" : "-end-8")} />
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-2">
                    <Img src={it.imageUrl} alt={ctx.text(it.title)} sizes={SIZES.half} className="h-full w-full object-cover" />
                    {!it.imageUrl && (
                      <span className="absolute inset-0 flex items-center justify-center text-primary-text/30">
                        <div aria-hidden className="pattern-bg absolute inset-0 opacity-60" />
                        <Icon name={it.icon} className="relative h-20 w-20" />
                      </span>
                    )}
                    <span className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-bg/90 text-primary-text shadow backdrop-blur">
                      <Icon name={it.icon} className="h-5 w-5" />
                    </span>
                  </div>
                </div>
                <div className={cx(flip && "lg:order-1")}>
                  <div className="flex items-center gap-3 text-accent">
                    <span aria-hidden className="h-px w-8 bg-accent" />
                    <span className="font-heading text-sm font-black tracking-widest tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-3 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">{ctx.text(it.title)}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-muted">{ctx.text(it.description)}</p>
                  <WhatsAppLink href={ctx.whatsappHref} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-primary-text transition-all hover:gap-3 hover:text-accent">
                    {ctx.ui("get_quote")}
                    <Arrow dir={ctx.dir} className="h-4 w-4" />
                  </WhatsAppLink>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
