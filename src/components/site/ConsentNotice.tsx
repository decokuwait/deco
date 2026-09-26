"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ConsentMode, Locale } from "@/lib/types";
import { t } from "@/lib/i18n/site";
import type { ConsentChoice } from "./consent";

/**
 * The tracking notice, pinned to the bottom of the page.
 *
 * In `notice` mode the only control is "Got it" — the pixels are already running and pretending
 * otherwise would be the dishonest version. In `explicit` mode nothing has loaded yet and both answers
 * are real, so both are offered with equal weight: no pre-checked box, no greyed-out decline.
 *
 * Three things here are corrections to a measured problem, not styling preferences:
 *
 *  - **It no longer buries the WhatsApp button.** The bar was `z-[60]` over a `z-40` floating bubble, so
 *    the single conversion action on the page sat underneath it. The bar now publishes its own height as
 *    `--dk-consent-h`, which the bubble adds to its offset, and drops to `z-30` so that even before that
 *    variable is read the bubble wins. A consent notice that hides the call to action costs real leads.
 *  - **It is short.** At 320 px the old two-row layout stood 129 px tall — 23% of the screen — on top of
 *    a hero that has to fit a headline and a button. The text is one line that wraps at most to two, the
 *    row never stacks, and the whole bar is ~56 px on a phone.
 *  - **It uses the template's own tokens.** It was the only thing on the page painted in hard-coded
 *    slate and white, which on the dark templates (102, 106, 109, 113) was a white slab across the foot
 *    of an otherwise charcoal design.
 */
export function ConsentNotice({
  mode,
  locale,
  onChoice,
}: {
  mode: ConsentMode;
  locale: Locale;
  onChoice: (choice: Exclude<ConsentChoice, "unset">) => void;
}) {
  const explicit = mode === "explicit";
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Publish this bar's real height on the document root, so the floating WhatsApp bubble can lift clear.
   *
   * It has to be the root: a custom property inherits *down* the tree, and the bubble is this bar's
   * sibling, not its child — setting the variable on the bar itself left the bubble reading the 0px
   * fallback and still buried underneath, which a browser check caught. Measured rather than assumed
   * because the text wraps to two lines on a narrow phone. Cleared on unmount so dismissing the bar drops
   * the bubble straight back to its resting place.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--dk-consent-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--dk-consent-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={t(locale, "consent_text")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.10)] backdrop-blur sm:px-4 sm:pt-3"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 sm:gap-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted sm:text-sm">
          <span className="line-clamp-2 sm:line-clamp-none">
            {t(locale, "consent_text")}{" "}
            <Link href="/privacy" className="font-bold text-fg underline underline-offset-2">
              {t(locale, "consent_more")}
            </Link>
          </span>
        </p>
        {/* 44px minimum on both: these are the only controls on the bar, and the dismiss measured 66x36. */}
        <div className="flex shrink-0 items-center gap-2">
          {explicit && (
            <button
              type="button"
              onClick={() => onChoice("declined")}
              className="inline-flex min-h-11 items-center rounded-card border border-line px-3 text-[13px] font-bold text-fg transition hover:bg-surface-2 sm:px-4 sm:text-sm"
            >
              {t(locale, "consent_decline")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChoice("granted")}
            className="inline-flex min-h-11 items-center rounded-card bg-primary px-4 text-[13px] font-bold text-primary-fg transition hover:opacity-90 sm:px-5 sm:text-sm"
          >
            {t(locale, explicit ? "consent_accept" : "consent_dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
