import type { Locale } from "@/lib/types";

/**
 * The holding page a tenant host serves when the database cannot be reached.
 *
 * It is a whole document, not a fragment: the tenant root layout returns it *instead of* its own
 * `<html>`, because the site record that normally supplies the language, direction and theme is exactly
 * what could not be loaded. Everything here is therefore static — no database, no template tokens, no
 * fonts to fetch, no Tailwind class that depends on a build — and bilingual, so a visitor gets an answer
 * in their own language whichever way the site was configured.
 *
 * Not a Client Component and not an error boundary: this is a *handled* outage. `getRequestSite` caught
 * the failure and reported it, so nothing throws and Next's unbranded English fallback never appears.
 */
export function TenantUnavailable({ locale = "ar" }: { locale?: Locale }) {
  const rtl = locale !== "en";
  return (
    <html lang={rtl ? "ar" : "en"} dir={rtl ? "rtl" : "ltr"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* An outage must never be indexed or cached as if it were the site. */}
        <meta name="robots" content="noindex, noarchive" />
        {/* The failure is usually a blip of tens of seconds, so the page retries on the visitor's behalf. */}
        <meta httpEquiv="refresh" content="30" />
        <title>نعود قريباً · We’ll be right back</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="wrap">
          <div className="mark" aria-hidden="true" />
          <h1 lang="ar" dir="rtl">
            نعود قريباً
          </h1>
          <p lang="ar" dir="rtl">
            الموقع غير متاح مؤقتاً بسبب عطل فني. نعمل على إصلاحه الآن — يرجى المحاولة بعد قليل.
          </p>
          <hr />
          <h2 lang="en" dir="ltr">
            We’ll be right back
          </h2>
          <p lang="en" dir="ltr">
            This site is temporarily unavailable. We are working on it — please try again in a moment.
          </p>
        </main>
      </body>
    </html>
  );
}

/* Plain CSS, inline, using logical properties only so the one stylesheet serves both directions. Tailwind
   is not used here on purpose: this page has to render when as little as possible is working. */
const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;
  font-size:16px;line-height:1.7}
.wrap{max-width:32rem;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;
  padding:40px 28px;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.mark{inline-size:44px;block-size:44px;margin:0 auto 20px;border-radius:999px;
  border:3px solid #e2e8f0;border-block-start-color:#0f766e}
h1{margin:0 0 10px;font-size:1.6rem;font-weight:800;letter-spacing:0}
h2{margin:0 0 10px;font-size:1.15rem;font-weight:700}
p{margin:0;color:#475569}
hr{border:0;border-block-start:1px solid #e2e8f0;margin:24px 0}
@media (prefers-reduced-motion:no-preference){
  .mark{animation:spin 1.4s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
}
@media (prefers-color-scheme:dark){
  body{background:#0b1220;color:#e2e8f0}
  .wrap{background:#111c33;border-color:#1e293b;box-shadow:none}
  .mark{border-color:#1e293b;border-block-start-color:#2dd4bf}
  p{color:#94a3b8}
  hr{border-block-start-color:#1e293b}
}
`;
