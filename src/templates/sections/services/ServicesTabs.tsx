import type { SectionProps } from "../../types";
import { Container, Img, Section, SectionHeading, WhatsAppIcon, buttonClass, cx } from "../../ui/primitives";
import { SIZES } from "../../ui/img";
import { AR_LEADING } from "../../leading";
import { Icon } from "../../ui/icons";
import { Tabs } from "../../ui/client/Tabs";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** One tab per service; the panel shows the image, description and a WhatsApp call to action. */
export function ServicesTabs({ ctx }: SectionProps) {
  const s = ctx.site.content.services;
  const total = String(s.items.length).padStart(2, "0");
  const tabs = s.items.map((it, i) => {
    const title = ctx.text(it.title);
    return {
      id: it.id || String(i),
      label: title || String(i + 1),
      content: (
        <div className="grid overflow-hidden rounded-card border border-line bg-surface shadow-sm lg:grid-cols-[1.1fr_1fr]">
          {/* The panel stood a fixed 24rem tall whatever was in it, so a service with a short description
              — or none of its own picture, where this cell is only an icon — left most of the card empty.
              The image now drives the height and the text column sets the floor. */}
          <div className="relative aspect-[4/3] bg-surface-2 lg:aspect-[5/4] lg:min-h-full">
            <Img src={it.imageUrl} alt={title} sizes={SIZES.half} className="absolute inset-0 h-full w-full object-cover" />
            {!it.imageUrl && (
              <span className="absolute inset-0 flex items-center justify-center text-primary-text/30">
                <div aria-hidden className="pattern-bg absolute inset-0 opacity-60" />
                <Icon name={it.icon} className="relative h-24 w-24" />
              </span>
            )}
            <span className="absolute bottom-4 start-4 rounded-full bg-bg/90 px-3 py-1 font-heading text-xs font-black tabular-nums text-primary-text shadow backdrop-blur">
              {String(i + 1).padStart(2, "0")} / {total}
            </span>
          </div>
          <div className="flex min-h-[18rem] flex-col justify-center p-6 sm:p-8 lg:p-10">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-primary/10 text-primary-text">
              <Icon name={it.icon} className="h-6 w-6" />
            </span>
            <h3 className={cx("font-heading text-2xl font-extrabold leading-tight sm:text-3xl", AR_LEADING)}>{title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{ctx.text(it.description)}</p>
            <div className="mt-6">
              <WhatsAppLink href={ctx.whatsappHref} className={buttonClass(ctx.def.tokens.buttonStyle, "primary")}>
                <WhatsAppIcon />
                {ctx.ui("get_quote")}
              </WhatsAppLink>
            </div>
          </div>
        </div>
      ),
    };
  });
  return (
    <Section id="services" tone="bg">
      <Container>
        <SectionHeading title={ctx.text(s.title)} subtitle={ctx.text(s.subtitle)} />
        <Tabs dir={ctx.dir} label={ctx.ui("nav_services")} tabs={tabs} listClassName="pb-1 sm:justify-center" tabClassName="px-5 py-2.5 sm:text-base" />
      </Container>
    </Section>
  );
}
