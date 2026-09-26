"use client";

import Link from "next/link";
import type { ConsentMode, Locale } from "@/lib/types";
import { t } from "@/lib/i18n/site";
import type { ConsentChoice } from "./consent";

/**
 * The tracking notice. One line, dismissible, pinned to the bottom above the floating WhatsApp button.
 *
 * In `notice` mode the only control is "Got it" — the pixels are already running and pretending
 * otherwise would be the dishonest version. In `explicit` mode nothing has loaded yet and both answers
 * are real, so both are offered with equal weight: no pre-checked box, no greyed-out decline.
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
  return (
    <div
      role="region"
      aria-label={t(locale, "consent_text")}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          {t(locale, "consent_text")}{" "}
          <Link href="/privacy" className="font-bold text-slate-900 underline underline-offset-2">
            {t(locale, "consent_more")}
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {explicit && (
            <button
              type="button"
              onClick={() => onChoice("declined")}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {t(locale, "consent_decline")}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChoice("granted")}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            {t(locale, explicit ? "consent_accept" : "consent_dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
