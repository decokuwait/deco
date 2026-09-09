import type { SectionProps } from "../../types";
import { WhatsAppIcon } from "../../ui/primitives";
import { WhatsAppLink } from "../../ui/client/WhatsAppLink";

/** Fixed WhatsApp bubble (bottom start) with a pulse ring. */
export function FloatingWhatsApp({ ctx }: SectionProps) {
  if (!ctx.site.content.settings.floatingWhatsapp) return null;
  return (
    <div className="fixed bottom-5 start-4 z-40 sm:bottom-6 sm:start-6">
      <span aria-hidden className="absolute inset-0 rounded-full bg-[#25D366] animate-pulse-ring" />
      <WhatsAppLink href={ctx.whatsappHref} ariaLabel={ctx.ui("whatsapp")} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105">
        <WhatsAppIcon className="h-7 w-7" />
      </WhatsAppLink>
    </div>
  );
}
