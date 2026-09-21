import type { ReactNode } from "react";
import thumbs from "./thumbs.json";
import type { TemplateDef } from "./types";
import { FONTS } from "./fonts";

const HAS = new Set<string>(thumbs.codes);

export function hasThumb(code: string) {
  return HAS.has(code);
}

/**
 * Template preview card: a real screenshot when `npm run thumbs` has generated one
 * (public/templates/<code>.jpg), otherwise a colour/font swatch built from the design tokens.
 */
export function TemplateThumb({ def, className = "", mobile = false, children }: { def: TemplateDef; className?: string; mobile?: boolean; children?: ReactNode }) {
  if (HAS.has(def.code)) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: mobile ? "1/2" : "683/430", background: def.tokens.bg }}>
        <img src={`/templates/${def.code}${mobile ? "-mobile" : ""}.jpg`} alt={`${def.code} ${def.name.en}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top" />
        {children}
      </div>
    );
  }
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: mobile ? "1/2" : "683/430", background: def.tokens.bg, color: def.tokens.text, fontFamily: FONTS[def.tokens.headingFont].css }}>
      <div className="absolute inset-0 p-4">
        <div className="flex items-center justify-between">
          <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: def.tokens.primary, color: def.tokens.primaryFg }}>
            {def.code}
          </span>
          <div className="flex gap-1">
            {[def.tokens.primary, def.tokens.secondary, def.tokens.accent, def.tokens.surface2].map((c, i) => (
              <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="mt-4 text-2xl font-black leading-tight">{def.name.ar}</div>
        <div className="text-xs opacity-70" style={{ fontFamily: FONTS[def.tokens.bodyFont].css }}>
          {def.name.en} · {FONTS[def.tokens.headingFont].family}
        </div>
        <div className="absolute inset-x-4 bottom-3 flex gap-2">
          <span className="h-6 flex-1 rounded" style={{ background: def.tokens.secondary }} />
          <span className="h-6 w-16 rounded" style={{ background: def.tokens.accent }} />
        </div>
      </div>
      {children}
    </div>
  );
}
