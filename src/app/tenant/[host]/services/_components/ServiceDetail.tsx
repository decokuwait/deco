import type { Faq, Project } from "@/lib/types";
import type { RenderCtx } from "@/templates/types";
import { Container, FOCUS_RING, Img, Section, cx } from "@/templates/ui/primitives";
import { headingLeading } from "@/templates/sections/shared/helpers";
import { SIZES } from "@/templates/ui/img";
import { Icon } from "@/templates/ui/icons";
import { Breadcrumbs, HOME_FAQ_HREF, HOME_HREF, LeadCta, SERVICES_HREF } from "../../projects/_components/shared";
import { ProjectStrip } from "../../projects/_components/ProjectsIndex";
import { ServiceStrip, serviceAlt, type ServiceEntry } from "./ServicesIndex";

/**
 * One service's page: what it is, the work that proves it, the questions people ask about it and a way
 * to start a conversation.
 *
 * The FAQ block is rendered as plain `<details>`-free markup on purpose — the answers are the text a
 * search engine should read, and an accordion that hides them behind a click on a page this short buys
 * nothing. The home page's `FAQPage` JSON-LD already covers the full list; this page does not re-emit it,
 * because the same questions marked up on two URLs is the duplication these pages exist to undo.
 */
export function ServiceDetail({
  ctx,
  entry,
  projects,
  faqs,
  others,
}: {
  ctx: RenderCtx;
  entry: ServiceEntry;
  projects: Project[];
  faqs: Faq[];
  others: ServiceEntry[];
}) {
  const { service } = entry;
  const c = ctx.site.content;
  const title = ctx.text(service.title);
  const description = ctx.text(service.description);
  const heading = ctx.text(c.services.title) || ctx.ui("nav_services");
  const crumbs = [
    { label: ctx.ui("nav_home"), href: HOME_HREF },
    { label: heading, href: SERVICES_HREF },
    { label: title },
  ];
  return (
    <>
      <Section tone="surface" className="py-10 sm:py-12" pattern>
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-primary/10 text-primary-text">
                <Icon name={service.icon} className="h-7 w-7" />
              </span>
              <h1 className={cx("font-heading text-3xl font-extrabold sm:text-4xl lg:text-5xl", headingLeading(ctx))}>{title}</h1>
              {description && (
                <div className="mt-5 max-w-3xl space-y-4 text-lg leading-relaxed text-muted">
                  {description
                    .split(/\n{2,}|\n/)
                    .filter(Boolean)
                    .map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                </div>
              )}
            </div>
            {service.imageUrl && (
              <Img
                src={service.imageUrl}
                alt={serviceAlt(ctx, service)}
                sizes={SIZES.half}
                eager
                className="aspect-[4/3] w-full rounded-card object-cover lg:w-96"
              />
            )}
          </div>
        </Container>
      </Section>

      <Section tone="bg">
        <Container className="grid gap-10">
          <LeadCta ctx={ctx} subject={title} />
          {faqs.length > 0 && (
            <div>
              <h2 className={cx("mb-6 font-heading text-2xl font-extrabold sm:text-3xl", headingLeading(ctx))}>{ctx.text(c.faq.title) || ctx.ui("nav_faq")}</h2>
              <dl className="grid gap-5">
                {faqs.map((f) => (
                  <div key={f.id} className="rounded-card border border-line bg-surface p-5">
                    <dt className={cx("font-heading text-lg font-bold", headingLeading(ctx))}>{ctx.text(f.q)}</dt>
                    <dd className="mt-2 leading-relaxed text-muted">{ctx.text(f.a)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm">
                <a href={HOME_FAQ_HREF} className={cx("font-bold text-primary-text underline underline-offset-4", FOCUS_RING)}>
                  {ctx.ui("view_all")}
                </a>
              </p>
            </div>
          )}
        </Container>
      </Section>

      <ProjectStrip ctx={ctx} projects={projects} title={ctx.text(c.projects.title) || ctx.ui("related_projects")} />
      <ServiceStrip ctx={ctx} entries={others} title={ctx.ui("related_services")} />
    </>
  );
}
