# DecoKuwait — multi-site platform for Kuwaiti decor businesses

A SaaS-style platform (Next.js 16 + Supabase Postgres + Cloudflare R2, deployed on Vercel) that serves
**60 ready website templates** (15 each for gypsum board decor, aluminum, partitions, ceramic), each with a
mobile-first admin panel, 6-digit visitor IDs that travel into the first WhatsApp message, lead-stage
marking, and server-side conversion signals to Meta, TikTok, Snapchat, Google and X (Twitter).

## What is inside

| Area | Where |
| --- | --- |
| Platform home, template gallery, previews | `/`, `/templates`, `/template/<code>` (codes 101–115, 201–215, 301–315, 401–415) |
| Super admin (sites, domains, users) | `/super` on the root domain |
| Tenant sites | `<slug>.<ROOT_DOMAIN>` or any custom domain assigned in super admin |
| Tenant admin panel | `<site host>/admin` |
| Tracking APIs | `POST /api/track` (visit), `POST /api/track/event` (WhatsApp / call click) |
| Uploads | `POST /api/upload` → presigned R2 PUT (local-disk fallback in development) |
| Legal | `<site host>/privacy` (editable privacy policy, linked from every footer) |

### Visitor ID and WhatsApp
Every visitor to a tenant host receives a 6-digit ID (`dk_vid` cookie, set by `src/proxy.ts`). The ID is
embedded in every WhatsApp link (`https://wa.me/<number>?text=...{id}...`), so the first message the visitor
sends contains it. Attribution (fbclid / ttclid / sc_click_id / gclid, utm_source, referrer) is stored with
the visitor.

### Lead stages and signals
In the admin panel the owner searches a visitor ID and marks it **contacted → called for visit → ordered →
first payment → order complete**. Each mark creates an event and sends it server-side:
* **Smart mode (default):** if the visitor's source platform is known and that platform has an active
  pixel, only that platform receives the signal. Otherwise every active pixel receives it.
* **All mode:** every active pixel always receives it.
Delivery results (HTTP status / API response) are stored per event and shown in the admin panel.
Browser pixels fire the same events with a shared `event_id` for deduplication.

Providers: Meta Conversions API, TikTok Events API, Snapchat Conversions API v3, Google Analytics 4
Measurement Protocol (mark the events as conversions in GA4 and import them into Google Ads), and the
X (Twitter) Conversion API (OAuth 1.0a; each stage maps to an Event ID created in X Events Manager).

### What the site admin can change
Every visible part of a site is editable from `/admin` on a phone: brand (name, tagline, logo, favicon),
hero (variant content, images), services, about, stats, process steps, testimonials, FAQ, CTA, contact
details (WhatsApp number, phone, address, map, hours, social links), SEO (title, description, OG image),
theme (primary/accent/background/surface/text colours, fonts, corner radius, button style, background
pattern), the order of sections, every UI label and button text (`labels` section), the privacy policy
(`legal` section), the WhatsApp message template, the floating WhatsApp button and language toggle
(`settings`), plus the three project types. The super admin can switch a site to any template of its
category at any time; content is template-independent.

### Project types
Finished projects (images + videos), before/after (draggable comparison, side-by-side, tabs, hover),
in-progress (per step/day/hour media as a slideshow, timeline, stepper or filmstrip). Each type has an
enable switch; a type only renders on the site when it is enabled and has published projects.

## Local development (no Supabase / R2 needed)

```bash
npm install
cp .env.example .env          # keep DATABASE_URL and R2_* empty for local mode; set SUPER_ADMIN_EMAILS + SUPER_ADMIN_PASSWORD
npm run db:seed:demo          # creates the super admin + 4 demo sites in ./.data/pglite (prints the demo admin password once)
npm run dev
```

* Platform: http://localhost:3000 — templates at http://localhost:3000/templates
* Super admin: http://localhost:3000/super (login with `SUPER_ADMIN_EMAILS[0]` / `SUPER_ADMIN_PASSWORD`)
* Demo tenant: http://demo-gypsum.localhost:3000 (admin at `/admin`, login `admin@example.com` with the password printed by the seed, or set `DEMO_ADMIN_PASSWORD`)

Local mode uses an embedded PGlite Postgres in `./.data/pglite` and stores uploads in `./.data/uploads`.

## Tests

```bash
npm run typecheck   # tsc
npm test            # vitest: routing, attribution, marketing payloads, database (PGlite), registry, rendering of all 60 templates
npm run build && npm run smoke   # boots the production build and exercises pages, tenant routing, tracking APIs, robots/sitemap, auth guards, admin pages
npm run e2e         # Playwright: real browser flows (visitor id + WhatsApp click, admin login, stage marking with signal delivery, content/list editors, project + media upload, pixels, settings, super admin site creation, template switch, domains, users)
npm run shots       # Playwright: screenshots of all 60 templates (mobile/desktop/en) and admin pages into .qa/shots for visual review; `tsx scripts/contact-sheet.ts` builds per-category contact sheets
npm run qa          # typecheck + unit + build + smoke + e2e (same gate as .github/workflows/ci.yml)
```

## Production setup

### 1. Supabase (database)
1. Create a project. Copy the **Transaction pooler** connection string (port 6543) into `DATABASE_URL`.
2. Apply the schema: `DATABASE_URL=... npm run db:migrate`. This applies every file in
   `supabase/migrations` in order and records them; re-run it after every update that adds a migration.
   (If you must use the SQL editor instead, paste every file in order.) Setting `AUTO_MIGRATE=true` on
   Vercel runs pending migrations on boot under an advisory lock, but running them at deploy time is preferred.
3. Seed the owner account: `DATABASE_URL=... SUPER_ADMIN_EMAILS=you@x.com SUPER_ADMIN_PASSWORD=... npm run db:seed`
   (or open `/super/login` on the first deploy: while the users table is empty, the first login with an
   address listed in `SUPER_ADMIN_EMAILS` and the password from `SUPER_ADMIN_PASSWORD` creates the owner).
   Demo sites (`npm run db:seed:demo`) are for local evaluation; in production they are refused unless
   `DEMO_ADMIN_PASSWORD` is set explicitly.

### 2. Cloudflare R2 (media)
1. Create a bucket, an API token (Object Read & Write) and enable public access (custom domain or r2.dev).
2. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
3. Add a CORS rule on the bucket so browsers can upload directly with presigned URLs:
```json
[{"AllowedOrigins":["*"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
```

### 3. Vercel
1. Import the repo, framework Next.js. Add all variables from `.env.example`.
2. Set `NEXT_PUBLIC_ROOT_DOMAIN` to your platform domain (e.g. `decokuwait.com`) and add both
   `decokuwait.com` and the wildcard `*.decokuwait.com` to the project's domains.
3. **Subdomains (automatic):** point the root domain's DNS to Vercel (nameservers, or `A 76.76.21.21`
   plus `CNAME * cname.vercel-dns.com`). With the wildcard domain on the project, every site slug created
   in super admin resolves immediately. When `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` (/ `VERCEL_TEAM_ID`) are
   set, the platform also registers each subdomain and custom domain with the Vercel project through the API.
4. **Custom domains (manual DNS):** add the domain in super admin → site → domains. The panel shows the
   records the owner must configure (`A 76.76.21.21` for apex, `CNAME cname.vercel-dns.com` for subdomains)
   and a "check status" button.

### Environment variables
See `.env.example`. Authentication is self-contained: passwords are scrypt-hashed and sessions are
revocable tokens stored in the database, so no external auth provider is required.

### Security notes
* Login is throttled (10 failed attempts per 15 minutes per email and per IP) and the password check is
  timing-safe; sessions are revocable database rows with an absolute expiry.
* Ad-platform tokens (Meta/TikTok/Snapchat access tokens, GA4 API secret, X consumer/access secrets) are
  encrypted at rest with `PIXEL_SECRET_KEY` (AES-256-GCM) and never rendered back to the browser.
* Tracking endpoints only honour the visitor's own cookie (a code supplied in the request body is
  ignored), are rate limited per IP, and deduplicate repeated clicks.
* Uploads are restricted to images/videos (SVG refused), size-capped, and keys are validated; the local
  disk fallback is disabled on Vercel.
* Admin and super admin pages send `X-Frame-Options: DENY` / `frame-ancestors 'none'` (clickjacking); public sites stay embeddable for the platform preview.

### Marketing credentials per platform
| Platform | Needed in admin → marketing |
| --- | --- |
| Meta | Pixel ID, Conversions API access token (optional test event code) |
| TikTok | Pixel code, Events API access token |
| Snapchat | Pixel ID, Conversions API token |
| Google | GA4 Measurement ID (G-…), API secret; optionally Google Ads ID (AW-…) and the conversion label of the contact action |
| X (Twitter) | Pixel ID, Consumer key/secret and Access token/secret (OAuth 1.0a); one Event ID per stage from Events Manager |

## Project structure

```
src/proxy.ts                     host → tenant rewrite + visitor cookie
src/app/(platform)/              root domain pages (home, /templates, /template/[code], /super/**)
src/app/tenant/[host]/           tenant site page and /admin/** panel
src/app/api/                     track, track/event, upload, files
src/lib/db/                      SQL data layer (postgres.js on Supabase, PGlite locally)
src/lib/marketing/               event mapping, target selection, Meta/TikTok/Snapchat/Google/X providers, dispatcher
src/lib/visitor/                 6-digit code + attribution detection
src/templates/                   design engine: tokens, fonts, patterns, section variants, 60 template definitions
supabase/migrations/             schema
scripts/                         migrate, seed, smoke, e2e, shots, contact sheets, thumbnails
tests/                           vitest suites
```
