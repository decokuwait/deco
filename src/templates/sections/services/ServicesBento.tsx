import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, WhatsAppIcon } from "../../ui/primitives";
import { Icon } from "../../ui/icons";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Asymmetric bento grid: a large image tile for the first service, compact tiles for the rest and a closing WhatsApp tile. */
export function ServicesBento({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  const [first, ...rest] = s.items;
  if (!first) return null;
  const heroImg = first.imageUrl || ctx.site.content.hero.imageUrl;
  return (
    <Section id="services" tone="surface" pattern>
      <Container wide>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <div className="grid auto-rows-[minmax(11rem,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="group relative min-h-[22rem] overflow-hidden rounded-card bg-secondary text-secondary-fg sm:col-span-2 lg:row-span-2">
            <Img src={heroImg} alt={ctx.text(first.title)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-secondary/10" />
            <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative flex h-full flex-col justify-end p-6 sm:p-8">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg">
                <Icon name={first.icon} className="h-6 w-6" />
              </span>
              <h3 className="font-heading text-2xl font-black sm:text-3xl">{ctx.text(first.title)}</h3>
              <p className="mt-2 max-w-md leading-relaxed opacity-85">{ctx.text(first.description)}</p>
            </div>
          </article>
          {rest.map((it) => (
            <article key={it.id} className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-bg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              {it.imageUrl ? (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Img src={it.imageUrl} alt={ctx.text(it.title)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute bottom-3 start-3 flex h-10 w-10 items-center justify-center rounded-full bg-bg text-primary shadow">
                    <Icon name={it.icon} className="h-5 w-5" />
                  </span>
                </div>
              ) : (
                <span className="mx-5 mt-5 flex h-11 w-11 items-center justify-center rounded-card bg-primary/10 text-primary transition duration-300 group-hover:bg-primary group-hover:text-primary-fg">
                  <Icon name={it.icon} className="h-6 w-6" />
                </span>
              )}
              <div className="p-5">
                <h3 className="font-heading text-lg font-bold">{ctx.text(it.title)}</h3>
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">{ctx.text(it.description)}</p>
              </div>
            </article>
          ))}
          <WhatsAppLink href={ctx.whatsappHref} className="group relative flex min-h-[11rem] flex-col justify-between overflow-hidden rounded-card bg-primary p-5 text-primary-fg transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div aria-hidden className="pattern-bg pointer-events-none absolute inset-0 opacity-30" />
            <div aria-hidden className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-accent/30 blur-2xl" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg">
              <WhatsAppIcon />
            </span>
            <div className="relative">
              <div className="font-heading text-xl font-black">{ctx.ui("get_quote")}</div>
              <div className="mt-1 text-sm opacity-85">{ctx.ui("free_visit")}</div>
            </div>
          </WhatsAppLink>
        </div>
      </Container>
    </Section>
  );
}
