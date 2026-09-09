# DecoKuwait — multi-site platform for Kuwaiti decor businesses

A SaaS-style platform (Next.js 16 + Supabase Postgres + Cloudflare R2, deployed on Vercel) that serves
**60 ready website templates** (15 each for gypsum board decor, aluminum, partitions, ceramic), each with a
mobile-first admin panel, 6-digit visitor IDs that travel into the first WhatsApp message, lead-stage
marking, and server-side conversion signals to Meta, TikTok, Snapchat and Google.

## What is inside

| Area | Where |
| --- | --- |
| Platform home, template gallery, previews | `/`, `/templates`, `/template/<code>` (codes 101–115, 201–215, 301–315, 401–415) |
| Super admin (sites, domains, users) | `/super` on the root domain |
| Tenant sites | `<slug>.<ROOT_DOMAIN>` or any custom domain assigned in super admin |
| Tenant admin panel | `<site host>/admin` |
| Tracking APIs | `POST /api/track` (visit), `POST /api/track/event` (WhatsApp / call click) |
| Uploads | `POST /api/upload` → presigned R2 PUT (local-disk fallback in development) |

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

### Project types
Finished projects (images + videos), before/after (draggable comparison, side-by-side, tabs, hover),
in-progress (per step/day/hour media as a slideshow, timeline, stepper or filmstrip). Each type has an
enable switch; a type only renders on the site when it is enabled and has published projects.

## Local development (no Supabase / R2 needed)

```bash
npm install
cp .env.example .env          # keep DATABASE_URL and R2_* empty for local mode
npm run db:seed               # creates the super admin + 4 demo sites in ./.data/pglite
npm run dev
```

* Platform: http://localhost:3000 — templates at http://localhost:3000/templates
* Super admin: http://localhost:3000/super (login with `SUPER_ADMIN_EMAILS[0]` / `SUPER_ADMIN_PASSWORD`)
* Demo tenant: http://demo-gypsum.localhost:3000 (admin at `/admin`, login `admin@example.com` / `Admin123!`)

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
2. Apply the schema: `DATABASE_URL=... npm run db:migrate` (or paste `supabase/migrations/0001_init.sql`
   into the SQL editor). Set `AUTO_MIGRATE=true` on Vercel if you prefer migrations to run on boot.
3. Seed the owner account: `DATABASE_URL=... SUPER_ADMIN_EMAILS=you@x.com SUPER_ADMIN_PASSWORD=... npm run db:seed`
   (or simply open `/super/login` on the first deploy — the first login with an address listed in
   `SUPER_ADMIN_EMAILS` creates the owner account).

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

## Project structure

```
src/proxy.ts                     host → tenant rewrite + visitor cookie
src/app/(platform)/              root domain pages (home, /templates, /template/[code], /super/**)
src/app/tenant/[host]/           tenant site page and /admin/** panel
src/app/api/                     track, track/event, upload, files
src/lib/db/                      SQL data layer (postgres.js on Supabase, PGlite locally)
src/lib/marketing/               event mapping, target selection, Meta/TikTok/Snapchat/Google providers, dispatcher
src/lib/visitor/                 6-digit code + attribution detection
src/templates/                   design engine: tokens, fonts, patterns, section variants, 60 template definitions
supabase/migrations/             schema
scripts/                         migrate, seed, smoke
tests/                           vitest suites
```
