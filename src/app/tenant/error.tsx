"use client";

import { useEffect } from "react";

/**
 * Errors thrown anywhere in the tenant tree BELOW the root layout — a page, the admin panel, a server
 * action, `generateMetadata` of a route segment.
 *
 * It sits in the same segment as `src/app/tenant/layout.tsx` and therefore does **not** wrap it: a throw
 * in the root layout itself goes to `global-error.tsx` instead. That is why host resolution was moved out
 * of "throwing" entirely — see `resolveRequestSite`.
 *
 * Because the root layout is still rendering above this, the document already has the right `lang`/`dir`
 * and the global stylesheet, so this can be a little richer than `global-error`. It still cannot know
 * which language the visitor reads (a Client Component has no headers), so it stays bilingual, and it
 * uses neutral colours rather than the template tokens, which the failing render may never have set.
 */
export default function TenantError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[dk:error] source=tenant-boundary digest=" + (error.digest ?? "-"), error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 py-16 text-center text-neutral-800">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm sm:p-10">
        <div aria-hidden="true" className="mx-auto mb-5 flex size-11 items-center justify-center rounded-full bg-amber-100 text-2xl font-black text-amber-700">
          !
        </div>
        <h1 lang="ar" dir="rtl" className="text-2xl font-extrabold">
          تعذّر تحميل هذه الصفحة
        </h1>
        <p lang="ar" dir="rtl" className="mt-2 text-neutral-500">
          حدث خطأ مؤقت. جرّب إعادة المحاولة بعد لحظات.
        </p>
        <hr className="my-6 border-neutral-200" />
        <h2 lang="en" dir="ltr" className="text-lg font-bold">
          This page could not be loaded
        </h2>
        <p lang="en" dir="ltr" className="mt-2 text-neutral-500">
          Something went wrong on our side. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-900 px-6 font-bold text-white hover:bg-neutral-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          إعادة المحاولة · Try again
        </button>
        {/* The digest is what support needs to find the matching line in the server log. */}
        <p dir="ltr" className="mt-4 text-xs text-neutral-400">
          reference <code className="font-mono">{error.digest ?? "n/a"}</code>
        </p>
      </div>
    </main>
  );
}
