import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, WhatsAppIcon, buttonClass } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { Icon } from "../../ui/icons";
import { Carousel } from "../../ui/client/Carousel";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Autoplaying swipe carousel of tall image cards with gradient captions. */
export function ServicesCarousel({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  return (
    <Section id="services" tone="surface2" className="overflow-hidden">
      <Container>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
      </Container>
      <Carousel prevLabel={ctx.ui("prev_slide")} nextLabel={ctx.ui("next_slide")} dotLabelTemplate={`${ctx.ui("go_to_slide")} {n} ${ctx.ui("of")} {total}`} dir={ctx.dir} autoplay={4500} itemClassName="w-[82%] sm:w-[52%] lg:w-[32%]">
        {s.items.map((it, i) => (
          <article key={it.id} className="group relative aspect-[4/5] overflow-hidden rounded-card bg-secondary text-secondary-fg shadow-lg">
            {it.imageUrl ? (
              <Img src={it.imageUrl} alt={ctx.text(it.title)} sizes={SIZES.third} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <>
                <div aria-hidden className="pattern-bg absolute inset-0 opacity-30" />
                <span aria-hidden className="absolute inset-0 flex items-center justify-center text-secondary-fg/15">
                  <Icon name={it.icon} className="h-32 w-32" />
                </span>
              </>
            )}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/50 to-transparent" />
            <span className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow">
              <Icon name={it.icon} className="h-5 w-5" />
            </span>
            <span className="absolute end-4 top-4 font-heading text-sm font-black tabular-nums opacity-70">{String(i + 1).padStart(2, "0")}</span>
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <h3 className="font-heading text-xl font-bold sm:text-2xl">{ctx.text(it.title)}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed opacity-85">{ctx.text(it.description)}</p>
            </div>
          </article>
        ))}
      </Carousel>
      <Container className="mt-8 text-center">
        <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "primary")}>
          <WhatsAppIcon />
          {ctx.ui("get_quote")}
        </WhatsAppLink>
      </Container>
    </Section>
  );
}
