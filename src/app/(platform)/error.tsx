"use client";

import { useEffect } from "react";

/**
 * Errors thrown in the platform tree below its root layout: the home page, the template gallery and
 * previews, and the super admin. Same rule as the tenant boundary — it is in the same segment as
 * `(platform)/layout.tsx`, so a throw in that layout goes to `global-error.tsx`, not here.
 *
 * The platform's own surfaces are Arabic-first and dark, matching `(platform)/not-found.tsx`. The English
 * line stays because the people who see this most are the operator and the super admin.
 */
export default function PlatformError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[dk:error] source=platform-boundary digest=" + (error.digest ?? "-"), error);
  }, [error]);

  return (
    <div dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0b1220] px-6 text-center text-white">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-amber-400/15 text-3xl font-black text-amber-400">
        !
      </span>
      <h1 className="text-2xl font-extrabold">تعذّر تحميل الصفحة</h1>
      <p className="text-white/60">حدث خطأ مؤقت. جرّب إعادة المحاولة.</p>
      <p dir="ltr" lang="en" className="text-white/40">
        Something went wrong. Please try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-2 inline-flex min-h-11 items-center rounded-full bg-white/10 px-5 font-bold hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        إعادة المحاولة · Try again
      </button>
      {/* Quote this to support: it matches the `digest=` field on the server log line. */}
      <p dir="ltr" className="text-xs text-white/30">
        reference <code className="font-mono">{error.digest ?? "n/a"}</code>
      </p>
    </div>
  );
}
