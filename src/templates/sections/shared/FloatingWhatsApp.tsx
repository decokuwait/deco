import type { SectionProps } from "../../types";
import { WhatsAppIcon } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Fixed WhatsApp bubble (bottom start) with a pulse ring. */
export function FloatingWhatsApp({ ctx }: SectionProps) {
  if (!ctx.site.content.settings.floatingWhatsapp) return null;
  return (
    // Two measured problems, one offset. `bottom-5` put the lower 14px of a 56px conversion button under
    // the iOS home indicator (34px), and the consent bar — which spans the full width at the foot of the
    // page — covered the bubble outright. `--dk-consent-h` is published by the notice while it is up and
    // resolves to 0px once dismissed, so the bubble lifts only for as long as the bar is actually there.
    <div className="fixed start-4 z-40 bottom-[max(calc(var(--dk-consent-h,0px)+1.25rem),calc(env(safe-area-inset-bottom)+1.25rem))] sm:start-6 sm:bottom-[max(calc(var(--dk-consent-h,0px)+1.5rem),calc(env(safe-area-inset-bottom)+1.5rem))]">
      <span aria-hidden className="absolute inset-0 rounded-full bg-[#25D366] animate-pulse-ring" />
      <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105">
        <WhatsAppIcon className="h-7 w-7" />
      </WhatsAppLink>
    </div>
  );
}
