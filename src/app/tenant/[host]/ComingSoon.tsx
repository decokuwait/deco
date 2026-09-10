import type { Locale, SiteRecord } from "@/lib/types";
import { lt } from "@/lib/i18n/site";
import { whatsappLink } from "@/lib/content/defaults";
import { getTemplate, defaultTemplateFor } from "@/templates/registry";

/** Shown instead of a 404 while a site is paused: brand, tagline and a WhatsApp contact button. */
export function ComingSoon({ site, locale }: { site: SiteRecord; locale: Locale }) {
  const c = site.content;
  const def = getTemplate(site.templateCode) ?? defaultTemplateFor(site.category);
  const name = lt(locale, c.brand.name) || site.name;
  const wa = whatsappLink(c.contact.whatsapp, lt(locale, c.contact.whatsappMessage), null);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <main dir={dir} lang={locale} className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" style={{ background: def.tokens.secondary, color: def.tokens.secondaryFg }}>
      <span className="rounded-full border px-4 py-1 text-xs font-bold tracking-widest" style={{ borderColor: def.tokens.accent, color: def.tokens.accent }}>
        {locale === "ar" ? "قريباً" : "Coming soon"}
      </span>
      <h1 className="mt-6 text-4xl font-black sm:text-6xl">{name}</h1>
      {lt(locale, c.brand.tagline) && <p className="mt-4 max-w-xl text-lg opacity-80">{lt(locale, c.brand.tagline)}</p>}
      {wa !== "#contact" && (
        <a href={wa} className="mt-8 rounded-full px-6 py-3 font-bold" style={{ background: def.tokens.accent, color: def.tokens.accentFg }}>
          {locale === "ar" ? "تواصل واتساب" : "WhatsApp us"}
        </a>
      )}
    </main>
  );
}
