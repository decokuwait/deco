"use client";

import { useEffect } from "react";

/**
 * The last-resort boundary: the only thing that can catch a throw from a ROOT layout.
 *
 * `error.tsx` deliberately does not wrap the `layout.tsx` of its own segment, so neither
 * `src/app/tenant/error.tsx` nor anything under `[host]/` can catch a failure in the tenant root layout —
 * which is exactly where host resolution happens. Without this file Next served its own unbranded English
 * LTR fallback ("A server error occurred") on a paying customer's Arabic domain.
 *
 * `global-error` replaces the root layout when it renders, so it must ship its own `<html>` and `<body>`
 * and cannot inherit global styles, fonts or theme tokens. It is also a Client Component, which means it
 * can reach neither the database nor the request headers: it cannot know whose site this is or what
 * language they speak. Hence: bilingual, RTL-first, every style inline, and no import that could itself
 * fail. Anything richer than this belongs in `getRequestSite`'s holding page, which runs before the throw.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Server-side throws already went through `onRequestError`; this covers the ones thrown on the client.
    console.error("[dk:error] source=global-error digest=" + (error.digest ?? "-"), error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, noarchive" />
        {/* Client Components cannot export `metadata`, so the title is a React <title>. */}
        <title>حدث خطأ · Something went wrong</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="wrap">
          <div className="mark" aria-hidden="true">
            !
          </div>
          <h1 lang="ar" dir="rtl">
            حدث خطأ غير متوقع
          </h1>
          <p lang="ar" dir="rtl">
            تعذّر عرض الصفحة. جرّب إعادة المحاولة، وإذا استمرت المشكلة تواصل معنا واذكر الرمز أدناه.
          </p>
          <hr />
          <h2 lang="en" dir="ltr">
            Something went wrong
          </h2>
          <p lang="en" dir="ltr">
            This page could not be displayed. Try again — and if it keeps happening, contact us and quote the code below.
          </p>
          <button type="button" onClick={() => retry()}>
            إعادة المحاولة · Try again
          </button>
          {/* The digest is the only handle support has on the matching server log line. Always show it. */}
          <p className="digest" dir="ltr">
            <span>reference</span> <code>{error.digest ?? "n/a"}</code>
          </p>
        </main>
      </body>
    </html>
  );
}

/* Inline and logical-property only: this document has no stylesheet, no font and no theme to inherit. */
const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;
  font-size:16px;line-height:1.7}
.wrap{max-width:34rem;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;
  padding:40px 28px;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.mark{inline-size:44px;block-size:44px;margin:0 auto 20px;border-radius:999px;background:#fef3c7;color:#b45309;
  font-size:24px;font-weight:800;line-height:44px}
h1{margin:0 0 10px;font-size:1.6rem;font-weight:800}
h2{margin:0 0 10px;font-size:1.15rem;font-weight:700}
p{margin:0;color:#475569}
hr{border:0;border-block-start:1px solid #e2e8f0;margin:24px 0}
button{margin-block-start:28px;min-block-size:44px;padding-inline:24px;border:0;border-radius:999px;
  background:#0f766e;color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:hover{background:#115e56}
button:focus-visible{outline:3px solid #99f6e4;outline-offset:2px}
.digest{margin-block-start:16px;font-size:.8rem;color:#94a3b8}
.digest code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){
  body{background:#0b1220;color:#e2e8f0}
  .wrap{background:#111c33;border-color:#1e293b;box-shadow:none}
  .mark{background:#422006;color:#fbbf24}
  p{color:#94a3b8}
  hr{border-block-start-color:#1e293b}
  button{background:#0d9488}
  button:hover{background:#14b8a6}
}
`;
