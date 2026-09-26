import type { Service } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { Container, FOCUS_RING, Img, Section, cx } from "@/templates/ui/primitives";
import { headingLeading } from "@/templates/sections/shared/helpers";
import { SIZES } from "@/templates/ui/img";
import { Icon } from "@/templates/ui/icons";
import { Breadcrumbs, EmptyState, HOME_HREF, LeadCta, PROJECTS_HREF, SERVICES_HREF, serviceHref } from "../../projects/_components/shared";

export interface ServiceEntry {
  service: Service;
  slug: string;
}

/** Alt text for a service picture. Never "": it illustrates the service, so it says what the service is. */
export function serviceAlt(ctx: RenderCtx, service: Service): string {
  return ctx.text(service.title) || ctx.text(ctx.site.content.brand.name) || ctx.ui("photo");
}

/** Card linking to one service's page. */
export function ServiceCard({ ctx, entry, eager = false }: { ctx: RenderCtx; entry: ServiceEntry; eager?: boolean }) {
  const { service, slug } = entry;
  return (
    <article className="group overflow-hidden rounded-card border border-line bg-surface transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
      <a href={serviceHref(slug)} className={cx("block text-start", FOCUS_RING)}>
        {service.imageUrl && (
          <Img src={service.imageUrl} alt={serviceAlt(ctx, service)} sizes={SIZES.third} eager={eager} className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105" />
        )}
        <div className="p-6">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-primary/10 text-primary-text transition group-hover:bg-primary group-hover:text-primary-fg">
            <Icon name={service.icon} className="h-6 w-6" />
          </span>
          <h3 className={cx("font-heading text-xl font-bold group-hover:text-primary-text", headingLeading(ctx))}>{ctx.text(service.title)}</h3>
          {ctx.text(service.description) && <p className="mt-2 line-clamp-3 leading-relaxed text-muted">{ctx.text(service.description)}</p>}
        </div>
      </a>
    </article>
  );
}

/**
 * The services index.
 *
 * Until now the six services existed only as an anchor on the home page, and the footer's six "service"
 * links all pointed at `/#services` — six anchor texts, one destination. Each one is a page from here.
 */
export function ServicesIndex({ ctx, entries }: { ctx: RenderCtx; entries: ServiceEntry[] }) {
  const c = ctx.site.content;
  const heading = ctx.text(c.services.title) || ctx.ui("nav_services");
  const crumbs = [{ label: ctx.ui("nav_home"), href: HOME_HREF }, { label: heading }];

  if (!entries.length) {
    return (
      <>
        <Section tone="surface" className="py-10 sm:py-12">
          <Container>
            <Breadcrumbs crumbs={crumbs} />
            <h1 className={cx("mt-4 font-heading text-3xl font-extrabold sm:text-4xl", headingLeading(ctx))}>{heading}</h1>
          </Container>
        </Section>
        <EmptyState ctx={ctx} title={ctx.ui("no_projects_title")} text={ctx.ui("no_projects_text")} />
      </>
    );
  }

  return (
    <>
      <Section tone="surface" className="py-10 sm:py-12" pattern>
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <h1 className={cx("mt-4 font-heading text-3xl font-extrabold sm:text-4xl", headingLeading(ctx))}>{heading}</h1>
          {ctx.text(c.services.subtitle) && <p className="mt-3 max-w-2xl text-lg text-muted">{ctx.text(c.services.subtitle)}</p>}
        </Container>
      </Section>

      <Section tone="bg">
        <Container wide>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e, i) => (
              <ServiceCard key={e.service.id} ctx={ctx} entry={e} eager={i < 3} />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container className="grid gap-6">
          <LeadCta ctx={ctx} subject={heading} />
          <p className="text-center text-muted">
            <a href={PROJECTS_HREF} className={cx("font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
              {ctx.ui("all_projects")}
            </a>
          </p>
        </Container>
      </Section>
    </>
  );
}

/** "Our other services" strip for the bottom of a single service's page. */
export function ServiceStrip({ ctx, entries, title }: { ctx: RenderCtx; entries: ServiceEntry[]; title: string }) {
  if (!entries.length) return null;
  return (
    <Section tone="surface">
      <Container wide>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={cx("font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{title}</h2>
          <a href={SERVICES_HREF} className={cx("text-sm font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
            {ctx.ui("view_all")}
          </a>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <ServiceCard key={e.service.id} ctx={ctx} entry={e} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
