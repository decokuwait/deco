# Fix programme — what was done

Companion to `DEEP-ANALYSIS-REPORT.md`. That document said what was wrong; this one says what changed.

**Method:** 10 specialist agents working in parallel on strictly partitioned file sets, against a schema
and type contract fixed up front (`analysis/fixes/CONTRACT.md`) so they could not collide. Every agent
kept a progress log in `analysis/fixes/` so a context limit could never lose work. The coordinator then
ran an integration pass and fixed what fell between owners.

## Gate — all green

| Gate | Before | After |
|---|---|---|
| Lint | 0 errors | **0 errors, 0 warnings** |
| Typecheck | 0 errors | **0 errors** |
| Unit tests | 278 | **627, all passing (27 files)** |
| Build | passes | **passes** |
| Smoke | passes | **passes** |
| E2E | passes | **passes** |
| Migrations | 4 | **9, chain verified idempotent** |

## The blockers, closed

1. **Visitor-code hijack.** The 6-digit code was the sole credential for both public write endpoints,
   guessable in a 900k space, and `/api/track` returned `created` — an oracle telling an attacker whether
   a code existed. A hit let them overwrite a real lead's ad attribution with their own click id, and a
   *miss* inserted a row at the guessed code. Now: an HttpOnly `dk_vsec` companion (128 bits, stored in
   `visitors.secret`) must be presented before any existing row is read or mutated; `created` is gone so
   a hit and a miss are indistinguishable; a public caller can never create a row at a code it chose; and
   attribution may only be rewritten on a genuinely new visit, from a landing URL on the request's own
   host. The docstring that falsely claimed the endpoint "cannot be used to enumerate or hijack" was
   rewritten to describe what actually stops each abuse.
2. **Rate limiting was per-lambda and keyed on a spoofable IP.** Now a durable counter in a `rate_limits`
   table, with the client IP derived from the platform edge rather than the first `X-Forwarded-For` entry
   (which any client could forge).
3. **Connection exhaustion.** `DATABASE_POOL_MAX` defaulted to 3, so each frozen lambda held three pooler
   connections; ~70 concurrent instances would have exhausted Supabase's pooler and taken every tenant
   down at once. Default is now 1, with a shorter idle timeout and a max lifetime.
4. **No error tracking, no error boundaries.** `getRequestSite` no longer throws — a database outage now
   renders a branded, RTL holding page instead of Next's unbranded English fallback on a customer's own
   domain. `instrumentation.ts` + `onRequestError` report every server error, with Sentry optional behind
   `SENTRY_DSN` (no hard dependency, so the build works without credentials).
5. **You could not restore a customer.** Sites are now soft-deleted and restorable for 30 days, with a
   recycle bin in the panel. The purge queues R2 objects, Vercel domains and orphaned admin accounts in
   the *same transaction* as the delete, so a crash mid-cleanup can no longer orphan files nothing records.
6. **Fabricated content on real sites.** `seedDemo` defaulted on, so a paying contractor's site shipped
   with invented testimonials, `info@example.com` and a **Big Buck Bunny video hotlinked from a
   third-party test site**. The video is gone entirely, the default is off, new sites provision *paused*,
   and a `stripFabricated()` guard on the single content-write path makes invented material structurally
   impossible on any site not explicitly flagged as a demo.
7. **Template previews linked to a dead WhatsApp number** — the platform's own sales pages.
8. **No password reset** — now available, and the throttle can no longer lock a customer out indefinitely.
9. **Silent lost update.** Two tabs editing a list destroyed data while the UI said "saved". Fixed at the
   form layer with a content-version token; the `patchSiteContent` CAS was deliberately left alone, because
   removing it would have deleted a correct guard against a different race and fixed nothing.
10. **CI could not block a bad deploy** — the workflow already ran on `pull_request`; what is missing is
    branch protection, which is a GitHub setting, not code. **Still outstanding — see below.**

## The commercial layer, built from nothing

There was no way to charge anyone. Now: plans (Basic KD 15/mo, **Pro KD 25/mo**, Plus KD 40/mo), annual
prepay at ten months for twelve with the setup fee waived entirely — the lever that makes annual the
obvious choice, which matters because annual prepay roughly halves effective churn. Money is integer
**fils** throughout. A daily cron pauses sites past `paid_until` and the existing pause machinery does the
rest. MyFatoorah/KNET sits behind an interface with **manual/offline as the default**, so it works today
with no credentials. `/pricing` and a rebuilt home page with an "اطلب موقعك" form feed a lead inbox in the
panel — chosen over email because there is no mail provider and a database row is more reliable anyway.

## SEO — from one page per tenant to a real site

- **Project and service pages.** Every project now has a URL (`/projects/<slug>`), with breadcrumbs and
  `ImageObject` markup. Each tenant goes from 1 indexable page to 10–40, each with real photos, a real
  Kuwaiti area name and unique text. This is the single biggest win in the programme.
- **Canonicals now resolve to the site's primary domain** and the non-primary host 308s to it, so a
  subdomain and a custom domain stop competing. `site_domains.is_primary` had been written since day one
  and read nowhere; it finally has a reader.
- **`htmlLimitedBots: /.*/`** — Next 16 streams `generateMetadata` into `<body>` for any bot not on its
  HTML-limited list, and **plain `Googlebot` is not on it**. Every tenant canonical was landing where
  Google does not honour it.
- **The English variant is gated on English actually being written.** It used to publish Arabic body text
  under `lang="en"`, self-canonical, submitted in the sitemap with `hreflang="en"`.
- Previews are `noindex`; `/privacy` left the sitemap; paused sites serve `Allow: /` so their `noindex` is
  readable; `*.vercel.app` is closed; the platform sitemap is a proper index; structured data now emits
  parseable opening hours, `geo`, real `areaServed` and the Google Business Profile URL in `sameAs`.
- **No `AggregateRating`** — self-serving review markup makes a page ineligible for the star feature.

## Craft

Arabic headlines no longer collide (`:lang(ar)` leading floor, Latin display type untouched). `alt` is now
a **required prop**, so the compiler rejects any new content image without one — the old `alt=""` on every
gallery image was a WCAG 1.1.1 Level A failure. The before/after slider reads right-to-left in Arabic
instead of backwards. The theme editor's contrast warning — which had **never worked**, because it queried
the first form on the page and found the logout form — now works, and an owner-set text colour can no
longer be published at unreadable contrast. The admin got unsaved-change protection (previously absent
entirely), bulk upload, non-reloading reorder, EXIF-safe uploads and a HEIC rejection message.

## Bugs found during integration, not in the original report

These were caught by agents reviewing each other's work, or by the coordinator during integration:

- **Visit registration was silently lost.** `SiteRuntime`'s registration effect depended on the `pixels`
  array, whose identity changes every render. The consent store swaps its server snapshot for the client
  one within the 150 ms before the first poll fires — so the effect re-ran, its cleanup cleared the pending
  timer, and the `registered` guard then returned early without re-arming it. **The visit was never
  registered.** This was the cause of the non-deterministic visitor counts and it would have lost real
  leads in production. Fixed with a stable dependency key.
- **The visitor secret was never forwarded** from the server render, so the row's secret disagreed with the
  browser's cookie and every first visit created a *second* visitor row. Fixed in both render paths.
- **The proxy's visitor code was discarded on every first visit** — `fresh` was being read as "never adopt
  this code" when it means "if it collides, re-roll instead of merging into a stranger's row". The obvious
  fix would have reintroduced exactly the bug `fresh` exists to prevent, so the collision path is guarded
  separately.
- **Consent had no effect**: `SiteRuntime` accepted `consentMode` and `locale` but neither render path
  passed them.
- **Visitor PII was never anonymised** — the retention helpers existed but the cron never called them.
- **Orphaned admin accounts were never cleaned up** after the immediate deletion was (correctly) removed.

## Still outstanding — deliberate, and not code

- **Branch protection on `main`.** A GitHub repository setting. The CI workflow already runs on
  `pull_request`; nothing enforces it.
- **R2 object versioning + a 30-day lifecycle rule.** A Cloudflare bucket setting. Do it before the first
  customer uploads a photo — soft delete protects the database rows, not the files.
- **Supabase Pro.** Removes free-tier pausing and enables point-in-time recovery.
- **Google Ads offline conversion import.** Assessed and deliberately deferred: it needs a developer token,
  a manager customer id and per-tenant OAuth with refresh and revocation — roughly the size of the rest of
  the marketing module. The click ids are still captured, the requirement is written up in
  `providers/google.ts`, and **the UI is now honest**: no green "sent" badge for Google on stage events.
- **`/en/` path prefixes.** `?lang=en` is gated and safe now, but a query parameter is the one multilingual
  structure Google marks "not recommended". The migration path is recorded; `langPath()` is the single
  choke point.
- **The attribution-window problem cannot be fixed in code.** Meta's maximum window is 7-day click and
  Kuwaiti decor jobs run weeks, so the deep stages will never optimise ad delivery. The product now says so
  instead of showing a green badge: stage buttons are split into "ad optimisation" and "internal reporting".

## Business items the code cannot decide

Unchanged from the report: sell one site for cash this month before building anything else; sign a material
supplier as a distribution partner; and lead the pitch with the portfolio, not the tracking.
