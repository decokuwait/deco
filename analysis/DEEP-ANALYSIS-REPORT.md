# DecoKuwait — Deep Analysis Report

**Date:** 22 September 2026
**Commit analysed:** `b3bf8de`
**Codebase:** ~24,000 LOC · Next.js 16.3.4 · React 19.2 · Supabase Postgres · Cloudflare R2 · Vercel
**Method:** 9 specialist agents (architecture, security, database, SEO, frontend/a11y, marketing/tracking,
QA/ops, business/market, product-completeness) plus a dedicated external SEO research pass. Every headline
claim was independently re-verified by the coordinator against the source. All quality gates were
executed, not assumed. Corrections made during verification are listed in §12.

---

# 0. پہلے یہ پڑھیں — Summary in Roman Urdu

**Code ki quality bohot achi hai. Business ka dhancha ghayab hai.**

Ye koi amateur project nahi hai. 278 tests pass hote hain, `npm audit` mein zero vulnerabilities hain,
60 templates waqai 60 alag designs hain (maine ginn kar khud check kiya), RTL/Arabic ka kaam zyadatar
RTL codebases se behtar hai, aur security ki soch pareepakv hai. Code ke comments mein purane bugs ki
wajah tak likhi hui hai — ye us developer ki nishani hai jo samajh kar kaam karta hai.

Lekin:

**1. Paisay lene ka koi tareeqa hi nahi hai.**
Na billing, na subscription, na KNET/MyFatoorah, na pricing page, na signup form. Customer paisay dena
band kar de to aap ko khud `/super` mein ja kar switch band karna parega. Teen alag agents ne — ek ne
code se, ek ne operations se, ek ne market se — bilkul alag raaston se yehi natija nikala. Ye sab se
bara sooraakh hai.

**2. Naye customer ki site par by default jhooti cheezein chali jaati hain.**
`seedDemo` ka default `true` hai. Matlab ek asli paying contractor ki site par ye sab chala jaata hai:
ghadi hui testimonials (farzi naamon ke saath, jaise "أبو محمد"), `info@example.com`, aur ek
**Big Buck Bunny test video** jo `test-videos.co.uk` se hotlink hai. Launch se pehle ye theek karna
zaroori hai — ye sirf bug nahi, legal masla bhi ban sakta hai. (WhatsApp number theek chala jaata hai —
wo aap ka apna number hota hai.)

**3. Jo feature sab se zyada "smart" hai, wo ussi jagah kaam nahi karta jahan zaroorat hai.**
Lead stages (ordered / first payment / order complete) Meta ko bheje jaate hain. Lekin Meta ki
attribution window sirf **7 din** hai, aur Kuwait mein jabs board ka kaam **hafton** chalta hai. Signal
pohanchta hai, admin mein hara nishan aata hai, magar kisi ad ko optimise nahi karta. Ye code ka bug
nahi hai — code bilkul theek chal raha hai — ye product ki **soch** ka masla hai.

**4. SEO ka dhancha hi adhoora hai.**
Har tenant ki site sirf **ek page** hai. Projects ka koi URL nahi. Services ka koi page nahi. Area
(Salmiya, Hawally, Jabriya) ka koi page nahi. Ek aisa business jiska asli sarmaya uski tasveeren hain,
uski ek bhi tasveer ka indexable URL nahi hai. Har tenant ka sitemap zyada se zyada **3 URLs** rakhta hai.

**5. Agar kuch toot jaye to aap ko pata nahi chalega.**
Koi Sentry nahi, koi error boundary nahi. Customer ki site tootegi to usay uske apne Arabic domain par
English mein "This page couldn't load" dikhega — aur aap ko uske phone call se pata chalega.

**6. Ek achi khabar bhi hai:** competitors bohot kamzor hain. Jo sites abhi Google par rank kar rahi
hain un mein se ek **12 mahine se bhi kam purani** hai, ek ke paas `<title>` tag hi nahi hai, aur ek to
**band hai (HTTP 000)** phir bhi rank kar rahi hai. Yani ranking mushkil nahi — asli rukawat aap ka apna
duplicate content hai, competitors nahi.

**Lekin ek zaroori baat:** Kuwait mein log in trades ko Google par dhoondte waqt **Instagram** dhoond
rahe hain — "انستقرام" teeno trades ke liye Google ka **doosra** suggestion hai. Iska matlab site ko
Instagram ka *muqabla* nahi, uska *saathi* bana kar bechna chahiye.

**Kamyabi ke chances (tafseel §9 mein):**

| Natija | Chance |
|---|---|
| Nakaam — 10 customers se aagay nahi barhta, 18 mahine mein band | **45%** |
| Side income — KD 300–800/mah, 15–40 customers | **33%** |
| Asli owner-operator business — KD 3,000–6,000/mah | **18%** |
| Bara platform — KD 25,000+/mah, multi-country | **4%** |

**Technical blockers jo §4 mein detail se hain (yahan sirf list):** visitor-code wala security hole
jisse koi bhi bahar se aap ke customer ki lead hijack kar sakta hai · database connections khatam hone
ka khatra (ek env var se theek hota hai) · customer ka data delete ho jaye to wapas laane ka koi
tareeqa nahi · CI kharab code ko rokti nahi · password reset nahi hai · do tabs khulay hon to content
khamoshi se mit sakta hai.

**Sab se zaroori teen kaam, isi tarteeb mein:**
1. **Do hafton mein billing banayein** aur saalana advance bechein (KNET link WhatsApp par).
2. **Demo content ka default band karein** aur pehli site is mahine cash mein bechein.
3. **Material supplier ke saath partnership karein** — gypsum board ka wholesaler har contractor ko
   mahine mein ek baar counter par dekhta hai. Ye akela channel hai jo ek aadmi ko leverage deta hai.

---

# 1. What this project is

A multi-tenant SaaS platform selling ready-made websites to Kuwaiti decor contractors across four
trades — gypsum board (جبس بورد), aluminum (ألمنيوم), partitions (قواطع) and ceramic (سيراميك).

- 60 templates (15 per category), Arabic-first with RTL, English at `?lang=en`
- Each customer gets `<slug>.decokuwait.com` or a custom domain, plus a phone-usable `/admin` panel
- Every visitor receives a 6-digit ID that travels into their first WhatsApp message
- The owner marks lead stages; each mark fires server-side conversions to Meta, TikTok, Snapchat,
  GA4 and X

**Business category:** a **productized web agency running on a SaaS substrate** — not vertical SaaS
(no self-serve signup, no billing, no product-led growth, no system-of-record lock-in) and not lead-gen
martech (you never generate or own a lead). This distinction drives most of §9.

---

# 2. Verdict at a glance

| Area | Grade | One line |
|---|---|---|
| Template engine | **A** | 60 genuinely distinct designs; adding #61 is one object literal |
| Test suite & quality gates | **A** | 278 tests, all gates pass, 0 vulns — tests assert behaviour, not status codes |
| Security posture | **B+** | No IDOR anywhere; one unauthenticated hole (§4.1) plus several hardening gaps |
| RTL / Arabic craft | **B+** | Logical properties throughout; line-height is the visible flaw |
| Database schema | **B+** | Every FK has ON DELETE, every timestamp is timestamptz, `prepare:false` set |
| Architecture | **B** | Idiomatic Next 16; zero caching and zero error boundaries |
| Accessibility | **C+** | A real WCAG engine, but its guard is dead code and content images ship `alt=""` — a Level A failure |
| Marketing / tracking | **C+** | Payloads are correct; the business promise is not delivered |
| SEO | **C−** | Technically clean, structurally capped at one page per tenant |
| Production operations | **D** | No error tracking, no restore path, nothing gates a bad deploy |
| Commercial layer | **F** | Does not exist |

**The pattern, stated once:** everything a test can verify is excellent. Everything that only shows up
in production — or in a customer's wallet — is missing or unfinished.

---

# 3. What is genuinely well built

Stated first and in full, because the rest of this report is critical and the balance matters. Each item
was verified. **Do not let a later section send you to rewrite any of these.** Where something praised
here is also criticised later — the session cookie (§5.10), the contrast engine (§8.4), `Tabs` (§8.4),
the provisioning flow (§4.7) — the later item is a specific, narrow gap in an otherwise sound piece of
work, not a reason to redo it.

### Verified by execution
- **All quality gates pass right now.** Run on this machine: lint (21 s), typecheck (6 s), **278 unit
  tests across 15 files** (27 s), production build (25 s), smoke (18 s), e2e (42 s).
  `npm audit` → **0 vulnerabilities** across 551 dependencies. Total QA wall time ~2 m 20 s.
- **The tests assert behaviour, not status codes.** `render.test.tsx` renders all 60 templates × 2
  locales and asserts the WhatsApp link contains the visitor id, `dir` is correct, 8 section anchors
  exist, and there is no `undefined` / `[object Object]` / Google Fonts request.
  `regressions.test.ts` encodes 12 named past bugs with their user-visible symptoms.
  `marketing.test.ts` injects HTTP and asserts payload shape field-by-field per provider, including
  X's OAuth 1.0a signature against the RFC 5849 reference vector.
- **`scripts/qa-lib.ts` clears `R2_*`, `VERCEL_*`, `AUTO_MIGRATE`** before every QA run, so production
  credentials cannot leak into a test.

### Verified by reading the code
- **60 templates are real.** Measured: 60/60 distinct layout signatures, 60/60 distinct palettes,
  60/60 distinct above-fold combinations. Variants: nav 7, hero 10, services 7, about 5, stats 4,
  process 4, finished 5, before/after 4, progress 4, testimonials 4, faq 3, cta 4, contact 4, footer 4 —
  plus 19 heading fonts, 11 body fonts, 11 patterns, 16 dark templates, 29 with custom section order.
- **`prepare: false` is set** (`src/lib/db/client.ts:66`) — the classic Supabase + postgres.js pgbouncer
  production outage is already avoided. Easy to get wrong; got right.
- **No N+1 on the tenant page** — 3 round trips, parallelised, with the host lookup wrapped in React
  `cache()` so layout, `generateMetadata`, `generateViewport` and the page share one query.
- **Every Server Action re-authorizes itself** with `requireSiteAdmin(host)`. **No IDOR was found
  anywhere**, across every id-taking action (project, media, visitor, domain, user, site).
- **`unstable_rethrow` used correctly** so `redirect()`/`notFound()` control-flow throws are not
  swallowed as save failures — a subtlety most codebases get wrong.
- **`after()` used correctly** for the ad-platform fan-out, so the classic Vercel frozen-function
  data-loss bug is avoided, with `maxDuration = 30` raised for it.
- **Async `params`/`searchParams`: 100% consistent.** Not one legacy synchronous access in the repo.
- **Session security:** 256-bit tokens, **SHA-256 hashed at rest**, expiry enforced in SQL, full
  revocation on password change, timing-safe comparison, opportunistic pruning, and a properly closed
  super-admin bootstrap (an empty database is not claimable by knowing the owner's email).
- **SQL is fully parameterised end to end**, including `sql.unsafe(text, params)` — that is postgres.js's
  bind-parameter API, not string SQL. The one dynamic `WHERE` builds only from a fixed whitelist.
- **No XSS sink on a tenant host.** Both `dangerouslySetInnerHTML` uses are JSON-LD with `<` escaped;
  pixel ids are reduced to `[A-Za-z0-9_\-.:]`; theme colours are re-validated with `HEX.test` at render
  time; the map iframe's src host is pinned to Google.
- **`safeUrl` runs at write time**, so `javascript:`/`data:` never reaches the database.
- **No SSRF and no open redirect** — every outbound host is a hardcoded literal; every redirect target
  is a relative literal.
- **Path traversal on `/api/files` is double-guarded** — `includes("..")` *and* `path.relative()`
  containment, with the `startsWith(root)` anti-pattern explicitly rejected in a comment.
- **Migration `0004` is careful** — `not valid` on the new CHECK constraint, exactly right.
- **RLS is correctly reasoned** — `enable row level security` with zero policies denies everything for
  non-owner roles, and `no force` keeps the app's owner role working. The comment explaining why `FORCE`
  would have locked the platform out is correct.

### Craft
- **A real WCAG contrast engine** in `src/templates/ctx.ts` — proper sRGB linearisation, and it floors
  `muted` at 4.5:1 against whichever of bg/surface/surface2 is hardest.
- **RTL discipline:** logical properties used 347 times in `src/templates`; physical direction utilities
  appear 14 times total, every one deliberate. `src/components` + `src/app` use them **zero** times.
  Direction-aware keyboard handling in `Tabs`, mirrored chevrons in `Carousel`, `dir="ltr"` isolation on
  phone numbers at 17 call sites.
- **Accessibility depth:** `Tabs` implements the WAI-ARIA tablist pattern properly — roving tabindex,
  `aria-controls`/`aria-labelledby`, Arrow/Home/End, direction-aware (with one focus-ring gap, §8.4);
  closed accordion panels are `inert` +
  `aria-hidden`; `MobileMenu` is portalled out of the backdrop-blur containing block with a focus trap
  and scroll lock; carousel dots are padded to a 28×28 hit area *citing WCAG 2.2 SC 2.5.8*; reduced
  motion handled in three places.
- **Fonts are exemplary:** 30 self-hosted families via `next/font`, correct `unicode-range` Arabic/Latin
  splits (a page fetches 2–4 woff2 files, not 30), variable weights, `display: swap`, and metric-matched
  `size-adjust` fallbacks for CLS. No visitor request ever reaches Google Fonts.
- **`'use client'` discipline:** 29 files, every one a genuine interactive leaf. All 60 templates, all 14
  section families and the entire admin render on the server.
- **TypeScript hygiene:** **0** `any` in all of `src/`, **0** `@ts-ignore`, **0 TODO/FIXME markers in
  the whole repo**, zero `console.log` in `src/`. (31 non-null assertions, several of which are
  environment assertions like `process.env.R2_ACCESS_KEY_ID!` — the one place the discipline relaxes.)
- **Dates:** `Intl.DateTimeFormat("ar-KW-u-nu-latn", { timeZone: "Asia/Kuwait" })` — Latin digits in an
  Arabic locale, correct timezone. Every column is `timestamptz`. **No timezone bug was found.**

### Cost architecture (quietly smart, and worth knowing)
- **R2 egress is free** and media is served direct from `R2_PUBLIC_URL`, bypassing Vercel entirely. The
  "viral site = surprise bandwidth bill" risk does not apply here.
- **`next/image` is unused**, so Vercel Image Optimization units are exactly **zero**. (This has a
  downside — see §6.8 — but the cost decision is sound.)
- **No `page_view` rows are ever written** to `visitor_events`; repeat visits increment a counter rather
  than inserting. Growth is one row per unique visitor per site, far healthier than the README implies.
- **Infrastructure is ~1.5% of revenue** at KD 25 ARPU — roughly KD 0.35/tenant/month at 50 tenants.
  Infrastructure is not a problem and should stop being thought about.

### Process
- **Onboarding is genuinely automated** — site + subdomain + Vercel registration + content + demo
  projects + admin account, all in one form submit.
- **Local dev needs no Supabase and no R2** (PGlite + local disk fallback). This is the single best
  bus-factor decision in the repo.
- **The comments are unusually good** — many document the specific bug the code replaced (the
  postgres.js microsecond truncation, the XHR header merge, the AWS SDK checksum regression, the
  containing-block drawer bug). That is institutional memory, and it is rare.
---

# 4. Blockers — fix before you take customers *at scale*

**One deliberate exception, because §10 says the opposite and both are right.** Sell **one** site this
month, by hand, to one contractor you can phone — that is how you find out whether any of this matters
(§9.8). What these ten items gate is **scale**: taking money from strangers, onboarding people you
cannot personally babysit, and running without the ability to notice or undo a failure. A single
hand-held pilot customer is a research instrument; ten unattended ones is a liability.

Ten items. Each was verified against the source by two independent passes.

### 4.1 — BLOCKER · Security: the visitor code is a bearer credential with a built-in existence oracle

**`src/app/api/track/route.ts:21,35-36,57` · `src/lib/request-origin.ts:21-23` · `src/lib/db/visitors.ts:102-157`**

`dk_vid` is a 6-digit code (900,000 values), `httpOnly: false`, unsigned, and it is the **sole**
identifier for both public write endpoints. The only origin gate is `isCrossSite()`, and
`requestSiteRelation` returns `"unknown"` — which is **allowed** — when neither `Sec-Fetch-Site` nor
`Origin` is present. That is exactly the curl/script case.

The attack needs no credentials:
1. `POST https://victim-site/api/track` with `Cookie: dk_vid=<guess>`.
2. The response returns `{ ok: true, created }`. `created: false` means that visitor **exists**. That is
   a clean enumeration oracle over a 900k space; a site with 5,000 visitors gives roughly a 1-in-180 hit
   per request.
3. On a hit, `touch()` merges the attacker's supplied `_fbp`/`_fbc`/`_ttp`/`_scid`/`_ga`/`_twclid`
   cookies and overwrites `ip`/`user_agent`. Supplying `url: "https://victim/?fbclid=<attacker's>"`
   makes `retouch` true, overwriting `source_platform`, `click_ids`, `utm`, `landing_url` and `referrer`.
4. When the tenant later marks that lead "ordered", the purchase is sent server-side to the ad platforms
   with the **attacker's** click id.
5. `POST /api/track/event` with the same cookie mints `whatsapp_click` conversions for a real lead.

The per-IP rate limiter is not a ceiling (see §4.2).

**And it is worse than an oracle — a miss *writes*.** `route.ts:47-56` never passes `fresh`, so
`input.fresh` is undefined. On a miss, control falls through `visitors.ts:102` into the insert loop at
`:107-116`, where `useOwnCode = attempt === 0 && input.code` is **true** — so **the guessed code is
inserted as a new visitor row**. An unauthenticated caller can therefore mint visitor rows at codes of
their choosing: exhausting the 900k space for that site, poisoning the owner's visitor list with junk,
and filling the same Supabase quota §5.14 already warns about.

**Note for whoever fixes this:** the docstring at `src/app/api/track/route.ts:16-18` says *"Only the
visitor's own cookie code is honoured (never a code chosen in the request body), so the endpoint cannot
be used to enumerate or hijack other visitors."* **That sentence is false as written.** It correctly
defends against a body-supplied code, but treats the cookie as trustworthy — and for a non-browser
client the cookie is exactly as attacker-controlled as the body. Fix the comment along with the code, or
the next auditor will be misled the same way.

**Fix:** stop treating the code as a bearer credential. Keep it as the human-readable id and add a
secret HttpOnly companion (HMAC of `siteId|code`, or a 128-bit `visitors.secret` column) that both
endpoints must present before touching an existing row. Immediately: stop returning `created`; never let
a request rewrite attribution fields on a row older than the current session.

### 4.2 — BLOCKER · Rate limiting is per-lambda and keyed on a spoofable IP

**`src/lib/rate-limit.ts:6-27` · `src/lib/site-request.ts:59-63`**

Two weaknesses compound. The limiter is a module-level `Map`, so on Vercel the effective limit is
`limit × instance_count` and it resets on every cold start. And `clientIp` takes the **first**
`X-Forwarded-For` entry, which is safe only if the immediate proxy overwrites the header.

The file's own comment concedes the first point and recommends pairing it with a Vercel WAF rule — but
**no WAF rule exists** (`vercel.json` contains only `{"regions":["bom1"]}`). The same value keys the
login IP throttle, so IP-based password spraying is unthrottled too.

This was independently flagged by four agents. It is the **multiplier** on §4.1, §4.3 and §4.10.

**Fix:** move to shared state (Vercel KV / Upstash / a Postgres counter — the `login_attempts` table is
already the pattern). Derive the IP from `x-vercel-forwarded-for`. Add the WAF rule.

**One open item:** confirm that the production edge *overwrites* rather than appends to a client-supplied
`X-Forwarded-For` / `X-Forwarded-Host`. On Vercel it does; on `next start` or any other proxy it does
not. Tenant resolution, the login throttle and all three public rate limits rest on this assumption, so
it should be asserted rather than inherited. (Even if `X-Forwarded-Host` were spoofable, the membership
check still blocks cross-tenant admin access — the defence in depth holds — but `/api/track` writes and
`robots.txt`/`sitemap.xml` would answer for the wrong tenant.)

### 4.3 — BLOCKER · Serverless connection exhaustion will take every tenant down at once

**`src/lib/db/client.ts:67` · `src/app/tenant/[host]/page.tsx:144`**

`max: Number(process.env.DATABASE_POOL_MAX || 3)`. A Vercel Node function serves one request at a time,
so `max: 3` buys no throughput — but the `Promise.all` issues three simultaneous queries, so postgres.js
opens **three** connections on the first tenant render of every instance. After the response the instance
is frozen; JS timers pause, so `idle_timeout: 20` never fires and the connections stay open to the
pooler until the instance is reaped.

A spike to ~50 concurrent instances means ~150 client connections against a Supabase transaction pooler
whose `max_client_conn` defaults to ~200. At ~70 instances new connections are refused with
`sorry, too many clients already` — **a total, correlated outage across all tenants**, which then looks
like a database failure rather than a config one.

**Fix:** set `DATABASE_POOL_MAX=1` in Vercel and change the default to 1; `idle_timeout: 5`;
`max_lifetime: 300`. In-region a round trip is ~2 ms, so serialising three queries costs ~4 ms. Keep the
`Promise.all`.

### 4.4 — BLOCKER · No error tracking and no error boundaries: you are blind, and the customer sees it

**Verified: `find src/app -name "error.tsx" -o -name "global-error.tsx" -o -name "loading.tsx"` → 0 results.**
**Verified: no Sentry/Bugsnag/Datadog/OpenTelemetry anywhere in `src/` or `package.json`.**
No `instrumentation.ts`, no `onRequestError`.

Trace the failure: `getSiteByHost` throws when Postgres is unreachable → `getRequestSite` does not catch
→ `src/app/tenant/layout.tsx:10` is the **root layout** of the tenant tree, so the throw is catchable
only by `global-error.tsx`, which does not exist. Result: Next 16's built-in fallback — an unbranded,
English, LTR page reading **"This page couldn't load / A server error occurred. Reload to try again."** —
on a paying Arabic customer's own domain.

Only 8 `console.*` call sites exist in `src/`, all `console.error`, none leaking secrets — that is good
discipline. But on Vercel Hobby those go to a function log with ~1 hour retention and no query. An
incident that self-resolves leaves no evidence at all.

**This is the compounding failure.** A tenant's site breaks, the customer sees a raw English error page,
and **you find out when they phone you.** For a one-person business, "the customer is your monitoring"
is the failure mode that loses the account.

**Fix (2–4 h, highest ROI in this report) — but note a trap in the obvious version of it.**
An `error.tsx` under `tenant/[host]/` **cannot catch this particular failure.** The Next 16 docs are
explicit: `error.js` does not wrap the layout above it in the same segment, and *"to handle errors in the
root layout, use `global-error.js`."* And `global-error` must be a **Client Component** that ships its
own `<html>` — so it cannot read the tenant's locale, direction or theme tokens from the database, which
is precisely what failed. `ComingSoon` is a server component and is not reusable here.

So, in order:
1. `src/instrumentation.ts` exporting `onRequestError` → Sentry. *(This is the part that actually ends
   the blindness, and it has no such caveat.)*
2. **Make `getRequestSite` non-throwing** — catch the DB failure and render a static, bilingual,
   RTL-safe holding page. This is the only thing that fixes the traced failure properly.
3. `src/app/global-error.tsx` as a last-resort static fallback (no DB access).
4. `error.tsx` under `admin/` and `super/`, which *do* sit below their layouts and work normally.

### 4.5 — BLOCKER · You cannot restore a customer

Three independent gaps that only matter together:

- **Delete is irreversible and untested.** `src/app/(platform)/super/sites/[id]/actions.ts:162-172`
  fetches the media keys, domains and orphan users **first** (so the list is in memory — that part is
  fine), then runs `deleteSite(id)` (FK cascade), then deletes every R2 object serially, then orphan
  users, then Vercel domains — each wrapped in a swallowing `.catch()` — and still redirects with
  `?saved=1`. The only guard is `window.confirm`.
  **The failure mode is a crash partway through the loop:** the database rows are already gone, so
  the remaining R2 objects are recorded nowhere and become unreachable forever, and the operator is
  told it worked. `deleteSiteAction` is the most destructive action in the product and **no test ever
  executes it.**
- **R2 has no object versioning.** Not enabled anywhere in the repo; the README's R2 section covers only
  the token and the CORS rule. If `deleteObject` ran, the photos are gone. The customer's phone is your
  backup.
- **Supabase Free has daily backups and no PITR.** Restoring takes *every other tenant* back with it.
  There is no per-tenant export anywhere in the codebase.

**Fix, in order:** (1) soft delete — `sites.deleted_at`, excluded from lookups, purged after 30 days;
ten lines and it removes the whole class of disaster. (2) Enable R2 object versioning + a 30-day
noncurrent lifecycle rule **before the first customer**. (3) `scripts/export-site.ts` called
automatically before any delete. (4) Supabase Pro for PITR. (5) **Rehearse one full restore and time
yourself** — an untested backup is not a backup.

### 4.6 — BLOCKER · CI cannot block a bad deploy

**Verified:** only `main` exists; `git log --graph` is a straight line of 24 direct commits; **no pull
request has ever been used.**

To be fair to the setup: the workflow triggers on `push: [main]` **and** `pull_request`, so the CI job
is already wired for the right workflow — what is missing is **branch protection**. Today every commit
goes straight to `main`, so CI starts *after* the code is on `main` while Vercel builds and promotes the
same push in parallel. A commit that fails the pipeline is already serving customers by the time the red
X appears.

The gate itself is excellent (§3). It is simply not enforced.

**Fix (30 min):** branch protection on `main` requiring the `qa` and `postgres` checks; work on
short-lived branches; merge via PR. Belt-and-braces: a Vercel *Ignored Build Step* that exits 0 only when
the commit's CI status is green.

### 4.7 — BLOCKER · Real customer sites are seeded with fabricated content by default

**`src/app/(platform)/super/sites/new/page.tsx:21` — `seedDemo` defaults to `true`.**
**`src/lib/provision.ts:78` — `input.seedProjects ?? true`.**

So a paying contractor's live site ships with:
- **Fabricated testimonials with invented customer names** ("أبو محمد", "أم عبدالله") and 5-star ratings
- `info@example.com` (`src/lib/demo/content.ts:391`)
*(Not on this list: the demo WhatsApp number. `provision.ts:74` deep-merges the operator's — required —
number over the demo content, so `96550000000` never reaches a provisioned site. It does still reach the
60 template previews, which is the separate §4.8.)*
- Unsplash stock photos identical across every tenant in the category
- **`DEMO_VIDEO` = `https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4`**
  (`:7`) — a **hotlink to a third-party test-asset site**, embedded in a customer's portfolio, with no
  fallback if it 404s or rate-limits.

To be fair to the author: the demo content is clearly built for *demos*, and there is a toggle. The
defect is that **the default is wrong on the production path.** But fabricated reviews on a live
commercial site are a trust problem and, in some readings, a consumer-protection one — independent of
SEO. And this is simultaneously the root of the platform's largest SEO risk (§6.2).

**Fix (S):** default `seedDemo` to false; never seed `testimonials.items` into a real site; self-host or
drop `DEMO_VIDEO`; gate publication on content completeness (§6.2).

### 4.8 — BLOCKER · Template previews send prospects to a dead WhatsApp number

The preview CTAs build `wa.me/96550000000` from the demo content. The platform's main sales surface —
the 60 template pages you show prospects — has a primary button that opens WhatsApp to a nonexistent
number. `ctx.preview` is already available to make them inert or point at the founder's real number.

### 4.9 — BLOCKER · No password reset, no email of any kind

**Verified absent:** no nodemailer/resend/sendgrid/postmark/mailgun/smtp in `package.json` or `src/`.
No `password_resets` table, no route, no "forgot password?" link on the admin login page.

A contractor who forgets his password must phone you, and you run `resetPasswordAction` from `/super`
and read the new password back over WhatsApp. That is your **first support ticket**, it happens at
2 a.m., and it does not scale past a handful of customers. One mail provider also unlocks lead
notifications, receipts, "your site is live" and domain-verified notices.

### 4.10 — BLOCKER · Lost update silently destroys customer content

**`src/lib/db/sites.ts:136-149` + `src/app/tenant/[host]/admin/content/_lib/spec.ts:294,343`**

**The mechanism matters, so it is worth being precise — an earlier draft of this report got it wrong in
a way that would have sent a developer to fix the wrong thing.**

`patchSiteContent`'s optimistic CAS is **not** the problem. The hash is read from the *same* row read
inside each attempt (`sites.ts:138`) and CASed microseconds later (`:143`), so the window is tiny and the
retry loop essentially never runs. The action also reads **fresh** content from the database
(`requireSiteAdmin` → `getRequestSite`), not a page-load snapshot.

The stale data is in the **submitted form**. `spec.ts:292,299` reads `rows.count` and `rows.N.id` from
hidden fields rendered when the page loaded; `:297-317` rebuilds the array from only those submitted
rows; `:342-343` sets it; and `deepMerge` (`content/defaults.ts:63`, where `isPlainObject` at `:52`
excludes arrays) **replaces the array wholesale**.

Scenario: the owner opens `/admin/content/services` in two tabs. Tab A adds a service and saves. Tab B —
rendered before that — edits a different service's price and saves. Tab B's form describes only the
services that existed at *its* page load, so the rebuilt array omits Tab A's addition and overwrites it.
**Tab A's new service is silently deleted and the UI says "saved."** There is no content version history
to recover from.

The CAS cannot detect this, because by the time Tab B submits, its own read is current. **Removing or
changing the retry loop would not help.**

**Fix:** render the content hash (or `updatedAt`) into a hidden input on the section form and compare it
in the action **before** building the patch; on mismatch, refuse and redirect with
`?error=changed_elsewhere`. The conflict lives at the form layer, so the check belongs there.

---

# 5. High-severity findings

### 5.1 The super-admin dashboard dies at scale
`src/lib/db/sites.ts:64-79`. `listSites()` runs an unfiltered `count(*) ... from visitors group by
site_id` over the **entire** visitors table, selects `s.*` (including the ~10 KB `content` blob the page
never reads), and has **no LIMIT**. `listUsers()` is the same shape.
500 tenants × 20k visitors = a 10M-row group-by plus a ~5 MB payload on every load of your only
site-management page. Fine at 5 tenants, ~100–300 ms at 50, **unusable at 500**.
*Fix:* explicit column list, `LIMIT/OFFSET`, and denormalised counters on `sites` maintained by trigger.

### 5.2 `AUTO_MIGRATE` can apply the same migration twice
`src/lib/db/client.ts:47-58`. `pendingMigrations()` is computed **before** the advisory lock is taken and
never re-checked after acquiring it, and `create table if not exists _migrations` runs **outside** the
lock (a known Postgres race that raises a duplicate-key error on concurrent DDL). Harmless today only
because every existing file happens to be idempotent. The first migration with a data backfill, a seed
insert, or an unguarded `alter` will corrupt data or hard-fail the deploy.
*Fix:* re-read `_migrations` inside the locked transaction, or guard each file body with a
`do $$ ... if not exists ... $$` block. Keep `AUTO_MIGRATE=false` in production.

### 5.3 The rollback trap
Migrations are strictly forward-only — no down files, no checksums, no way to detect a file edited after
it was applied. Vercel Instant Rollback swaps the deployment in seconds and does **nothing** to the
database. Deploy a migration that drops a column, hit rollback, and the previous build queries a column
that no longer exists → every tenant down, with rolling forward the only exit.
*Fix:* adopt expand/contract as a **written rule** in the README next to the migrate step — a migration
may only ever add; removals wait one full release after the code stops using them.

### 5.4 `revalidatePath("/", "layout")` is correct but maximally coarse
*(An earlier draft called this a bug — that was wrong, and the correction is worth stating clearly
because the wrong version is an easy mistake to repeat.)*

**31 calls** (plus 9 imports) all use `revalidatePath("/", "layout")`. This is **Next 16's documented
global purge**, not a mis-targeted path. Three confirmations:
- The Next 16 docs' own "Revalidating all data" section gives exactly this call and states it
  *"will purge the Client Cache, and invalidate **all cached data** for revalidation on the next page
  visit."*
- `revalidate.js` resolves it to the tag `_N_T_/layout`.
- `server/lib/implicit-tags.js` — `getDerivedTags` seeds **every** page's implicit tags with the literal
  `/layout`, unconditionally, before any pathname handling. So every cache entry in the app, including
  every `/tenant/<host>/…` entry, carries that tag.

So publishing works. **The real cost is blast radius:** once caching is enabled (§5.5), one tenant
tapping Save will invalidate **every other tenant's cache**, plus the platform's static pages. At 500
tenants that is a cache that never stays warm.
*Fix (for efficiency, not correctness):* `cacheTag('site:'+host)` on the data reads and
`revalidateTag('site:'+host)` in the actions.

### 5.5 Zero caching: 6 DB round trips per page view, forever
`force-dynamic` on every tenant route; no `use cache`, no `cacheLife`, no `cacheTag`, no `unstable_cache`,
no `revalidate`. One home-page view costs **2 serverless invocations and ~6 Postgres round trips** —
3 in the render, 3 more in the `/api/track` call that `SiteRuntime` fires on **every** page load.
Nothing is shared between two visitors to the same site in the same second, for marketing-brochure
content that changes when an owner taps Save. Compounding it: **zero `<Suspense>` boundaries and zero
`next/dynamic` in the entire repo** — nothing streams, so TTFB is proxy + cold start + full DB latency
with the visitor looking at a white screen.
*Fix:* enable `cacheComponents`, move the site+projects read into a `'use cache'` helper tagged
`site:<host>`, keep visitor tracking outside it, and `revalidateTag` from the admin actions. This is the
one change that alters the platform's cost curve. Pair it with per-site cache tags (§5.4), or every
tenant's save will flush every other tenant's cache.

### 5.6 A partial site deletion leaves orphans nothing can find
Covered in §4.5. The DB cascade itself is **complete and correct** — verified against `0001_init.sql` —
and the cleanup lists are correctly fetched before the delete. The problem is that the deletion is not
transactional and every failure is swallowed, so a crash partway through the R2 loop leaves objects
that no longer exist in any record, plus Vercel domain registrations that keep the hostname claimed and
block re-adding it. The operator still sees `?saved=1`.
*Fix:* write `deletion_queue` rows **in the same transaction** as the delete, then drain them (and
again from a cron); at minimum, count failures and redirect with `?error=partial_delete`.

### 5.7 Ad-platform token encryption fails open, and rotation destroys tokens
`src/lib/secrets.ts:9-39`. The AES-256-GCM implementation itself is **correct** — fresh 12-byte random
IV per call, auth tag verified, versioned `enc:v1:` prefix, idempotent. The policy around it is not:
- **No key, or a typo'd key → silent plaintext.** Meta CAPI tokens, GA4 API secrets and X OAuth secrets
  are written to the database in the clear with no warning surfaced anywhere. `.env.example` marks
  `PIXEL_SECRET_KEY` "Optional".
- **Rotation → permanent data loss.** `decryptSecret` returns `null`; `upsertPixel` then takes
  `existing?.accessToken = null`, so the next save of *any unrelated field* wipes the token. There is no
  key id in the envelope to support two keys during rotation. Every tenant's conversions stop silently.
*Fix:* make the key **required in production**; put a key id in the envelope (`enc:v2:<kid>:`); accept
`PIXEL_SECRET_KEY_PREVIOUS`; make decrypt failures loud instead of returning `null`.

### 5.8 Any known admin email can be locked out indefinitely
`src/lib/db/users.ts:104-157`. The email throttle key is not tied to the attacker's identity, so ten
deliberately-wrong logins lock **the real owner** out for 15 minutes, and a loop keeps them out forever.
Admin emails are discoverable from the site's own contact section. There is no unlock, no CAPTCHA
step-up. `changePassword` also calls `authenticate()` without catching `TooManyAttemptsError`, so a
throttled owner gets an unhandled 500.
**Read this together with §4.9, because the combination is worse than either item alone.** An anonymous
attacker can lock a paying customer out of their own admin panel indefinitely, and **there is no
self-service password reset to recover through** — the only path is phoning you. And the founder's own
rescue route is degraded too: `changePassword` calls `authenticate()` without catching the throttle
error, so it 500s while the lockout is active. **Jointly this is a blocker-grade availability problem for
a paying customer**, even though each half is filed below blocker.

*Fix:* scope the email counter per-IP, or make it a soft signal requiring a CAPTCHA; catch
`TooManyAttemptsError` in `changePassword`; and ship password reset (§4.9).

### 5.9 Missing HSTS and no real CSP
Present and correct: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options: DENY` +
`frame-ancestors 'none'` on `/admin*`, `/super*` **and** `/tenant/:host/admin*` — covering the path both
before and after the rewrite, which is a nice detail.
Missing: **`Strict-Transport-Security` anywhere**, and any CSP beyond `frame-ancestors`. Custom tenant
domains are the exposure. `/admin` and `/super` render no third-party script and can take a strict CSP
today.
*Fix:* add HSTS globally (one line); add `default-src 'self'; script-src 'self'; object-src 'none';
base-uri 'none'` to the admin/super header set.

### 5.10 Session cookie hardening
Done right: no `Domain` attribute (host-only), 256-bit token, SHA-256 at rest, full revocation.
Missing: the **`__Host-` prefix**, which is what makes the *browser* refuse a `Domain=`-scoped cookie of
the same name. Because every tenant lives under one registrable domain, any future script execution on
one tenant host could toss a `dk_session` cookie scoped to `.decokuwait.com`. No script-execution sink
was found today, so this is hardening rather than a live bug — but it becomes live the moment one
appears. Also: no idle timeout (30-day absolute only), so a stolen token is good for a month.
*Fix — and mind the order, because the obvious version breaks local development:* the `__Host-` prefix
requires `Secure` **unconditionally**, but `session.ts:23` sets `secure: IS_PROD`. Renaming first would
make the browser reject the cookie outright in dev, silently breaking admin login in exactly the
no-Supabase local setup §3 praises. So: set `secure: true` unconditionally (browsers allow Secure
cookies on `http://localhost`), *then* rename to `__Host-dk_session` — `Path=/` and the absent `Domain`
are already in place. Add `last_used_at` with a 7-day idle window.

### 5.11 `same-site` is treated as same-origin, and route handlers have no CSRF check
`src/lib/request-origin.ts:18` accepts `same-site`, so a page on `evil.decokuwait.com` counts as
same-origin against `victim.decokuwait.com`. Server Actions are covered by the framework's Origin/Host
check, but `/api/upload` and `/api/upload/local` are not — and `await req.json()` parses the body
regardless of `Content-Type`.

**The reachable attacker set is narrower than it first appears, but not empty.** `SameSite=Lax` keeps
`dk_session` off a genuinely cross-site POST, so this is not an "any website can do it" bug. It narrows
to a **sibling subdomain** — which is precisely the attacker the `same-site` acceptance above creates: a
page on `evil.decokuwait.com` reaches the upload routes carrying the victim admin's cookies, and must
also name a `siteId` that victim administers. The attacker cannot read the response, but each request
writes a `media_assets` row and mints a presigned PUT (§5.12). `/api/upload/local` is additionally
unreachable in production.
*Fix:* compare the full host (the `Origin` fallback already does this correctly); apply `isCrossSite()`
to the upload routes; require `Content-Type: application/json`.

### 5.12 `/api/upload` is unbounded
No rate limit. Each call inserts a `media_assets` row and returns a presigned PUT valid 10 minutes for up
to **300 MB**. The per-object ceiling is signed in, but nothing caps how many. One tenant — or a CSRF'd
admin — can loop it.
*Fix:* `rateLimit("upload:" + user.id, 60, 60_000)` plus a per-site quota (`media_assets.size` is
already recorded and never summed).

### 5.13 Bot traffic mints visitor rows and DB writes with no filtering
The proxy mints a code for **every cookieless request to a public path** with no bot detection, and
tenant `robots.txt` allows crawling. Every hit from GPTBot, AhrefsBot or any scraper creates a `visitors`
row carrying IP, UA, referrer and landing URL, plus a function invocation and ~4 queries.
`rateLimit` is never applied to the page render.
*Fix:* skip `trackVisit` and cookie-minting for known bot user-agents in the proxy — cheapest, biggest
win. Then a WAF rule per tenant host.

### 5.14 No data retention or purge policy
Nothing anywhere deletes old data. `login_attempts` is **never cleaned** — `clearFailures` only runs on
a *successful* login, so every failed attempt from a random scanner leaves a permanent row. Supabase
Free's 500 MB fills at roughly 500–650k lifetime unique visitors platform-wide. There is no per-visitor
erasure path and no expiry on IP/phone/name.
*Fix:* one migration plus a Vercel cron (`vercel.json` currently has **no** `crons` block) to prune
`login_attempts` and expired `sessions`, anonymise visitor PII at 18 months, and delete stale `new`
visitors at 24 months.

### 5.15 `select *` ships `users.password_hash` into the render path
`src/lib/db/users.ts:47,54,59` and — the one that runs on **every authenticated request** —
`getUserBySessionToken` at `:172`. `mapUser` (`:24-33`) drops it, but the scrypt hash crosses the wire and sits
in the function heap on **every authenticated request**. Same pattern costs bandwidth on the site and
visitor lookups.
*Fix:* explicit column lists; include `password_hash` only in `getUserByEmail`.
---

# 6. Google SEO — the full picture

This was your most important question, so it gets the most space. All external guidance below was
verified against current Google documentation in September 2026; where a popular claim turned out to be
false, that is stated explicitly.

**Market context (verified):** Google holds **95.22%** of Kuwait search (StatCounter, Aug 2026); Bing
3.64%; Yandex 0.48%. Internet penetration is **99.0%**. Instagram reaches **~59% of Kuwait's population**
(DataReportal, Digital 2026) — very high by world standards, though **not** the highest in the Arab world
(the UAE is ~71%). Google Business Profile is explicitly supported in Kuwait, including service-area
businesses.

## 6.1 The structural ceiling: every tenant site is one page

`src/app/tenant/[host]/` contains exactly: `/`, `/privacy`, `/icon`, `/admin/*`. There are no service
pages, no area pages, and — critically — **no URL for any project**. `projects` has no `slug` column
(`supabase/migrations/0001_init.sql:55`).

**Verified: a tenant sitemap contains at most three URLs** — home, `home?lang=en` and `/privacy` with
the language toggle on (the default), or just two with it off.
And `/privacy` is `noindex` (`privacy/page.tsx:18`), so one of the three submitted URLs contradicts
itself and will sit permanently in GSC as "Excluded by 'noindex' tag".

A visual trade business whose entire commercial asset is its photographs has **zero indexable
photographs**. The data is already there and already structured — `projects` rows carry `title`,
`description`, `location`, `type`, `published`, `updated_at`, and `project_media` carries
`role: gallery|before|after|step`, `caption`, `step_label`, `step_date`. Three project types exist,
including a genuinely differentiated day-by-day progress format.

**Give every project a URL and each tenant gains 10–40 indexable pages**, each with real photos, a real
Kuwaiti area name, and unique text. This is simultaneously the biggest SEO win available and the fastest
way out of the duplicate-content problem below. It is the single highest-impact SEO item in this report.

## 6.2 The duplicate-content engine, and the policies that actually apply

Every new tenant is seeded with byte-identical Arabic content (§4.7): same hero, same six services, same
four process steps, same three fabricated testimonials, same FAQ, same Unsplash photos, same seeded
projects with the same titles. At 50 tenants that is **50 near-identical sites on subdomains of one root
domain.**

**The applicable policies, verified verbatim against Google's spam policies page (last updated
2026-08-28). Note the sections have been renamed since most training data — it is now "Doorway abuse"
and "Site reputation policy":**

1. **Scaled content abuse** explicitly lists among its examples: *"Creating multiple sites with the
   intent of hiding the scaled nature of the content."* The saving clause is the policy's own wording —
   it targets content that is **"unoriginal"** and of **"little to no value."** The policy is not about
   the *number* of sites; it is about whether each carries genuinely distinct, useful content.
   **This is the live risk, and item 1 and 2 above are exactly what triggers it.**
2. **Doorway abuse** lists *"Having multiple websites with slight variations to the URL and home page"*
   and *"Having multiple domain names or pages targeted at specific regions or cities that **funnel
   users to one page**."* The second is the one to watch when area pages get built — **but note the
   funnel condition.** If each tenant is a genuinely separate business with its own WhatsApp number,
   prices and photos, that condition is *not* met. It would be met squarely if tenant leads ever routed
   to the platform's own number.
3. **The quality-presumption contagion — this is the actual mechanism, and it is documented.**
   Verbatim from the same page: *"Google generally applies a presumption that individual pages
   (including new pages) match the overall quality of other pages on the domain."* That is precisely how
   tenant #300's brand-new subdomain inherits an assumption formed from tenants #1–299. It is not a
   violation and not a penalty — it is a headwind that scales with every weak tenant you add.

**A correction to a claim you may encounter elsewhere — including in an earlier draft of this report.**
The **site reputation policy does *not* currently apply to this project**, by the policy's own
conditional. It reads: *"it's only inconsistent if the third-party content is published on a host site
**mainly because of that host site's already-established ranking signals**."* `decokuwait.com` is a new
domain with **no established ranking signals to borrow**, so the precondition is unmet. It could begin
to apply years from now, once the root domain has earned reputation from first-party content and tenants
are visibly free-riding on it. **Do not treat it as the year-one risk.** The documented 2024–2026
enforcement record for that policy is entirely about large publishers renting out subfolders — there is
**no documented enforcement example against a multi-tenant small-business site builder**, and no
official Google guidance addressing this model exists at all.

What *is* documented and relevant: subdomains are **not a firewall** against enforcement. Google's
Nov 2024 guidance states that moving content to a subdomain within the same domain *"doesn't resolve the
underlying issue and may be viewed as an attempt to circumvent our spam policy, which may lead to broader
actions against a site."* And John Mueller's framing of free-subdomain hosting is the right mental model
here — not "penalty" but **friction**: you are *"opening up shop on a site that's filled with —
potentially — problematic flatmates,"* which makes it harder for Google to judge whether any one tenant
*"stands out in a positive way."* His aside cuts in your favour, though: he notes the quality problem is
hard *"if nobody's getting paid to do that."* **A paid platform has both the revenue and the incentive to
enforce a quality bar that free hosts cannot.** That is the argument for gating publication on content
completeness.

**Be precise about the risk.** Selling websites to real, distinct local businesses is a legitimate
business — Wix and every agency do it. The risk is not the model; it is **four specific properties of
the current implementation**:

1. Every site ships with identical seeded text ← *the actual problem*
2. Every site ships with identical stock photos ← *the actual problem*
3. Every site sits on one root domain as a subdomain
4. Sites are published live before the owner personalises anything

**Fix 1, 2 and 4 and the risk drops to routine.** Fix 3 as well and it approaches zero.

**One trap when you do fix item 1:** switching `seedDemo` to false is *not* sufficient. `starterContent`
still seeds a category-identical hero, tagline, `seo.description` and CTA block (`provision.ts:33-43`),
so N tenants would still share one headline. Item 1 means **replacing the shared starter copy**, not
just turning the demo flag off.

## 6.3 Subdomain vs custom domain — the honest answer

Google representatives say subdomains and subfolders *can* be treated as the same site. The operative
word is **can** — Google decides per case, and this architecture is precisely what puts that decision at
risk. Compounding it: **`decokuwait.com` has no authority of its own yet**, so inheriting a share of
nothing is nothing.

**What a subdomain tenant can realistically rank for in 3–6 months:** their own brand name (near
certain); long-tail area+service combinations where they have real project pages; image search for their
own photos (once alt text exists); and **everything the GBP does** — Map Pack rankings are driven by
proximity, categories, reviews and profile completeness, and are largely independent of website
authority.

**What they cannot:** head terms (`جبس بورد الكويت`, `ألمنيوم الكويت`) on a subdomain, against the Map
Pack.

**But here the research produced genuinely good news, and it is the most actionable finding in this
section: the incumbents are weak.** Live checks of the currently-ranking Kuwaiti gypsum domains
(registration data and HTTP fetches, 2026-09-22):

| Domain | Registered | State |
|---|---|---|
| `gypsumdesigners.com` | **2025-10-01** | Ranks at **under 12 months old**. No `sitemap.xml` |
| `decoregypsumkw.com` | **2026-04-27** | Ranks with **no `<title>` tag at all** — the title is literally the domain |
| `alhudagypsum.com` | 2025-08-09 | Ranks **while returning HTTP 000 (down)** |
| `nizamgypsum.com` | 2020-01-21 | The one apparently real 50-year manufacturer — **broken/empty sitemap** |
| `gbsburd.com` | 2020-08-11 | Content leader at **283 pages** — a figure a competent operation reaches in weeks |
| `gypsumboard-kw.com` | 2023-01-13 | `<title>` reads *"جبس بورد الكويت **للإيجار** 01097206572"* — advertises itself **for rent**, with an **Egyptian** phone number |

**There is no age moat, no content moat, and nothing link-defended.** Several of these are domain-rental
lead-gen shells run from outside Kuwait, not businesses defending a market. **The barrier to ranking here
is genuinely low** — which means template quality and content completeness, not competitor displacement,
are the binding constraints. A tenant on their **own domain** with 10 real pages and an active GBP can
compete for mid-tail terms within 6–12 months, and head terms are on the table.

**Recommended product change:** make the subdomain an explicitly temporary trial link ("رابط تجريبي") and
**serve it `noindex`**. Push every customer to their own domain, bundling `.com` registration (~$12/yr)
into the first-year price. When a custom domain verifies, **301 the subdomain to it permanently.** This
single change eliminates the entire thin-subdomain-cluster risk and turns domain purchase into a natural
upgrade moment you can charge for.

*(Note on `.com.kw`: **2-year minimum and local presence are confirmed requirements**; pricing varies by
registrar (one quotes ~$249/yr) and the registration lead time is slow but could not be pinned to a
verified figure — treat both as estimates and check with a registrar. Never
bundle it — offer as pass-through at cost plus a handling fee, and steer everyone to `.com`.)*

## 6.4 Canonicals: two hosts, both self-canonical

`src/app/tenant/[host]/page.tsx:45` builds the canonical from the **request** host (via the `langUrl()`
helper at `:26-29`, returned at `:64`). So
`alfaisal.decokuwait.com/` and `alfaisal-decor.com/` serve byte-identical content and each declares
itself canonical, with no relationship stated. Google picks one arbitrarily and may show the subdomain
the customer didn't pay for.

Note the inconsistency: `robots.txt` and `sitemap.xml` **both** call `canonicalHost()`; the page metadata
does not. The helper exists and is applied in two of three places.

`site_domains.is_primary` is written at provision time and **never read anywhere**. Worse,
`super/sites/[id]/page.tsx:27` explicitly prefers the *subdomain* as primary.

*Fix:* resolve the primary hostname from `site_domains` (verified custom domain wins), use it for
`alternates.canonical`, `openGraph.url`, the JSON-LD `url`, the sitemap base and the robots `Sitemap:`
line — then **301 the non-primary host**. A canonical is a hint; a redirect is not.

## 6.5 `?lang=en` is the one structure Google labels "Not recommended"

**Verified verbatim** against Google's multi-regional guidance (updated 2025-12-10): of the four URL
structures, ccTLD, subdomain and subdirectory are all legitimate, and **URL parameters are the single
one marked "Not recommended."**

Worse than the structure is what it currently publishes. `src/lib/i18n/site.ts:59-65` falls back to the
*other* language when a field is empty, and `showLangToggle` defaults to **true**. So a typical tenant
publishes `?lang=en` containing **Arabic body text**, declared `<html lang="en" dir="ltr">`, submitted in
the sitemap with `hreflang="en"`, and self-canonical. That is a duplicate page, a false language
declaration, RTL text in an LTR document, and an hreflang cluster Google will discard.

Also: the canonical depends on a **cookie**. A visitor with `dk_lang=en` on the bare `/` renders English
*and* emits `canonical = ?lang=en` — the page declares a different URL as its canonical. Googlebot is
cookie-less so it sees Arabic, but this is a cloaking-shaped pattern and makes `/` unsafe to cache.

*Fix, in two parts:* (a) **only publish English when English is actually written** — gate the toggle, the
hreflang and the sitemap entry on real `en` values in hero/about/services/SEO; `noindex` otherwise. This
one rule removes an entire class of risk across every tenant at once. (b) Move to `/en/` path prefixes.
The cookie may drive a redirect, never the content or canonical at a given URL.

**Also broken:** template preview hreflang (`template/[code]/page.tsx:48-53`) points at `?lang=ar` /
`?lang=en` URLs that canonicalize elsewhere. Google requires hreflang annotations to be self-consistent
and reciprocal — *"if two pages don't both point to each other, the tags will be ignored"* — so this
cluster is discarded wholesale. Drop `alternates.languages` from the previews entirely.

## 6.6 The 60 template previews are thin duplicate content on the money domain

All 15 gypsum previews contain **literally the same Arabic body text** — only colours and layout differ.
`<title>` is `"101 · الديرة · Al Deera"` (a code and two design names, zero search intent); the
description is the *design* description; the H1 is the same demo hero on all 15. All 60 sit in the
platform sitemap at priority 0.6.

So `decokuwait.com` submits **60 URLs with 4 distinct bodies of text**, on the one domain that must rank
commercially.

Mitigations already present and correct: previews are CDN-cached (`s-maxage=3600, swr=86400`) so crawling
is cheap, and `FaqSchema` is correctly skipped in previews so you aren't emitting demo FAQ markup.

*Fix (preferred):* `noindex, follow` all 60, remove them from the sitemap, and make `/templates` plus the
4 category pages genuinely substantial (400–600 words each). Five strong pages beat 65 diluted ones.

## 6.7 Structured data — audit against current requirements

**Emitted today:** `HomeAndConstructionBusiness` (a correct LocalBusiness subtype) and `FAQPage`.
That is the complete inventory.

| Property | Status | Note |
|---|---|---|
| `name`, `url`, `telephone`, `logo`, `sameAs` | OK | `sameAs` is socials only — **the GBP link is missing** |
| `address` | Weak | Single free-text `streetAddress` + country. No locality, no region. Required properties are name + address only, so this passes — but it matches poorly. |
| `openingHours` | **Broken** | Free text passed straight through. A tenant types "من السبت إلى الخميس ٩ صباحاً"; schema.org expects `"Mo-Th 09:00-21:00"`. Worthless as emitted. |
| `areaServed` | Too coarse | `{ Country: Kuwait }` for a business that serves specific governorates |
| `geo` | **Absent** | No lat/lng anywhere in the content model. Google wants 5+ decimal places |
| `priceRange` | Absent | Documented property, max 100 chars |
| `image` | Weak | One URL; Google asks for 16x9 / 4x3 / 1x1 variants, min. 50,000 pixels (w × h) |

**Missing types that matter:** `Organization` and `WebSite` (the platform has **none** — this is how
Google builds the DecoKuwait entity), `BreadcrumbList` (nothing anywhere; requires ≥2 items),
`ImageObject` (the highest-value missing type for a photo-led trade), and `Service` — though note
**`Service` has no rich result**, so it is an entity signal only.

**Two explicit warnings:**

- **Do NOT emit `AggregateRating` or `Review` from the testimonials field.** Verified verbatim (review
  snippet docs, updated 2026-09-08): *"If the entity that's being reviewed controls the reviews about
  itself, their pages that use LocalBusiness or any other type of Organization structured data are
  ineligible for star review feature."* This applies to embedded third-party widgets too. Since the
  seeds are *fabricated* testimonials, marking them up would be markup of invented reviews — a
  manual-action-grade problem. The correct play is GBP reviews, which Google sources itself.
- **`FAQPage` rich results are fully dead.** Not "restricted" — removed. FAQ rich results stopped
  appearing 2026-05-07; the search-appearance filter, GSC report, Rich Results Test support and the
  documentation page were all removed in June 2026; FAQ data left the GSC API in August 2026.
  The existing markup is harmless — **leave it, invest nothing further, and never promise a customer
  "FAQ stars in Google."**
  Related: the popular advice to add FAQ schema "for AI Overviews" is contradicted by Google directly.
  Its AI optimization guide (updated 2026-07-10) states verbatim: *"Structured data isn't required for
  generative AI search, and there's no special schema.org markup you need to add."*
  **And do not build an `llms.txt`** — same guide: *"Google Search ignores them."*

## 6.8 Images — the biggest Core Web Vitals defect, and a wasted channel

**Core Web Vitals thresholds are unchanged:** LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at p75. *(The
circulating claim that "LCP tightened to 2.0 s in the March 2026 core update" is **false** — web.dev
still says 2.5 s and no such post exists. Do not act on it.)*

`next/image` is used **zero times**; `next.config.ts` has no `images` block. Everything goes through a
hand-rolled `Img`.

**The nuance matters here, because it is easy to overstate:** uploaded photos **are** downscaled on the
device before upload — `src/components/admin/Uploader.tsx:17-34` does `createImageBitmap` → canvas →
`toBlob` at 2000px max edge, JPEG q0.86. So this is not "raw 12-megapixel phone photos".

What remains true, and is still serious:
- **One single size is stored and served to every device.** `src/templates/ui/img.ts:10` returns `{}` for
  anything that isn't an Unsplash demo URL, so a 390px phone downloads the full **2000px, ~400–700 KB**
  file. A typical page is ~14 images ≈ **5–9 MB where ~800 KB would do.** The hero is `eager` +
  `fetchPriority="high"`, so LCP is paid at roughly 10× the necessary bytes on Kuwaiti mobile data.
- **This is invisible in preview**, because previews use Unsplash and *do* get a proper srcset. Your
  demos look great in Lighthouse and your customers' sites do not.
- **No `width`/`height` on any `<img>`** → CLS exposure, currently mitigated by aspect-ratio wrappers
  applied by convention rather than enforced by the component.
- **No automatic WebP/AVIF conversion.** `Uploader.tsx:33` *preserves* format — PNG stays PNG, WebP
  stays WebP, and GIF/SVG bypass re-encoding entirely. But nothing ever *converts* a JPEG to a modern
  format, so the common case (a phone photo) ships as JPEG.
- **`createImageBitmap(file)` is called with no options** (`Uploader.tsx:20`). The canvas re-encode drops
  EXIF, and `imageOrientation` defaults vary by engine — so on some browsers a portrait iPhone photo is
  re-encoded **permanently rotated 90°** with no metadata left to correct it. This is destructive and
  irreversible. **One-line fix:** `createImageBitmap(file, { imageOrientation: "from-image" })`.
- **HEIC is silently broken.** `accept="image/*"` matches `.heic`; `createImageBitmap` throws; the catch
  returns the original; the raw HEIC uploads and renders as a broken image everywhere except Safari. No
  user-visible error.
- **Alt text is not authorable and is often empty.** There is no `alt` field in `MediaItem` or
  `project_media`. Many images derive alt from adjacent titles (acceptable), but `alt=""` — i.e.
  *declared decorative* — appears on images that are the entire visual content of the section:
  `HeroFullscreen`, `HeroGallery`, `HeroCards`, `HeroCentered`, `HeroVideo`, `CtaCard`, all four footer
  logos, and `primitives.tsx:184`'s generic `Media` component, through which **every gallery image
  routes**. For a decor contractor, Google Images is a genuine discovery channel, and it is being
  forfeited.

*Fix:* generate 480/1080/2000 derivatives at upload and extend `responsiveSrc` to the R2 URL shape —
`img.ts` is already the right seam, it just has one hard-coded host. A Cloudflare-side pipeline is likely
cheaper than `next/image`, since Vercel bills per *source* image and every tenant upload is a new source.
Add `alt: LText`, auto-generated from `{service} {title} {area} — {brand}` and owner-editable.

**If you do go the `next/image` route, two Next 16 default changes will bite:** `images.qualities` now
defaults to `[75]`, and a `quality` prop outside the allowlist is **coerced to the nearest allowed value
— with a warning in development, but silently in production**; and `minimumCacheTTL` rose from 60 s to
4 hours. (`images.domains` is also deprecated in favour of `remotePatterns`, but that has been true
**since Next 14** — it is not a v16 change.)

## 6.9 Third-party pixels are a measurable CWV cost

`SiteRuntime.tsx:108-133` loads, per configured platform: Meta (~80–100 KB), TikTok (~100–140 KB),
Snapchat (~40–60 KB), GA4/Ads (~90–120 KB), X (~30–50 KB) — **~350–450 KB and ~500–900 ms of main-thread
time across 5 extra origins** if all five are on. All use `afterInteractive`, which is the correct *Next*
strategy but still executes right after hydration, competing with the very interactions INP measures.

*Fix:* the product already has a "smart mode" concept for *server* signals — extend it to the browser.
Load only the pixel matching the visitor's detected source platform, plus GA4. Switch to `lazyOnload` or
load on first interaction. Preconnect the one eager origin.

## 6.10 Smaller technical defects

| # | Issue | Evidence |
|---|---|---|
| 1 | Paused site: `Disallow: /` in robots **blocks Google from seeing the `noindex`** — the classic "why is my blocked page still indexed" failure | `robots.txt/route.ts:22` vs `page.tsx:41` |
| 2 | Paused site returns **200 with a "coming soon" body** — a soft 404. Should be 503 + `Retry-After` | `page.tsx:114` |
| 3 | **`*.vercel.app` is a fully indexable clone** of the platform | `tenant.ts:19`, `robots.txt/route.ts:24` |
| 4 | No `www`→apex redirect for the platform itself; the homepage has **no canonical at all** | `tenant.ts:18`, `proxy.ts:31` |
| 5 | Platform homepage has an **English description**, no OG, no canonical, no `metadataBase` | `(platform)/layout.tsx:5-9` |
| 6 | Platform sitemap has **no `lastmod`** (the one field Google actually uses); tenant `lastmod` ignores project updates | `sitemap.xml/route.ts:53-62` |
| 7 | `<meta name="keywords">` is emitted — ignored since 2009, and the admin field teaches the customer the wrong model | `page.tsx:50` |
| 8 | Brand-new tenant `<title>` is just the company name — no service, no city (true on **both** the demo path `:73` and the starter path `:43`) | `provision.ts:43,73` |
| 9 | No sitemap index; at 500 tenants nothing tells Google the subdomains exist | — |
| 10 | The map renders in only **2 of 4** contact layouts, so a tenant can enter a map and see nothing | `ContactMap.tsx:21`, `ContactSplit.tsx:73` |
| 11 | **No GSC verification field exists anywhere** — neither operator nor tenant can verify a property | checked admin spec + super site page |

**Genuinely absent and good:** no stray `noindex` on tenant homes, no redirect chains, no `nofollow` on
internal links, no blocked CSS/JS, exactly one `<h1>` per page across all 10 hero variants, clean heading
hierarchy, real `<a>` navigation, fully server-rendered Arabic in the initial HTML, correct `lang`/`dir`,
and FAQ answers present in the HTML (closed panels use `hidden`, not absent).

## 6.11 What is missing: the SEO programme this business actually needs

### Google Business Profile is the highest-ROI gap
GBP is the single biggest missing piece, for reasons that survive scrutiny — but **one popular
justification for it does not, and this report will not use it.**

*What I can defend:* Map Pack ranking is driven by **relevance, distance and prominence** (Google's own
documentation), and prominence counts reviews and links. Crucially, **Map Pack position is largely
independent of website authority** — which is exactly why it is the one channel a tenant on a weak or
brand-new domain can win immediately. Google's AI optimization guide also names Google Business Profile
as the lever for appearing in generative AI responses about local businesses, so it pays on the
AI-surface axis too. And Kuwait is explicitly supported, including service-area businesses.

*What I will not claim:* that the Map Pack out-clicks organic. **The widely circulated "44% of local
searchers click the local 3-pack" figure could not be traced to any methodologically described study** —
it propagates through 2025–2026 SEO blogs citing each other. The only primary source with a stated
methodology points the **other** way: BrightLocal's Local Services Ads click study (n≈5,500) found
organic at **50.8%** versus the local pack at **32.3%** on service-area-business SERPs. That study is
from **2018**, US-only, and pre-dates AI Overviews entirely, so it does not settle the question either.
**The honest conclusion is that both channels are material and neither can be skipped** — not a ratio.
Treat anyone quoting a precise 2026 map-pack percentage as unsourced.

**Two operational rules that are easy to get wrong:**
- **A contractor gets exactly ONE service-area profile.** He cannot create one per governorate. Service
  areas are set *within* the single profile.
- **There is a real tension between GBP and your JSON-LD.** `address` is a **required** property for
  LocalBusiness structured data, but GBP tells a service-area business to **hide** its address. Decide
  deliberately: publish a real workshop address in the schema, or accept that LocalBusiness markup is
  incomplete for storefront-less tenants. Do not publish a fake or virtual-office address — that
  violates GBP's eligibility rules and risks the profile.
- **Verification method is chosen by Google and cannot be changed.** Postcard is unreliable to Kuwaiti
  addresses; video verification is the practical path. One angle worth testing: **Search Console instant
  verification** is among the offered methods, so getting a tenant's site verified in GSC early may
  unlock instant GBP verification — but Google picks, so it cannot be relied on.

The product has **no GBP support at all**: no profile URL field, no structured NAP, no review flow, no
`sameAs` link to the listing.

Build: a `googleBusinessUrl` + `googlePlaceId` field emitted in `sameAs`; a single structured NAP source
of truth; an enforced onboarding checklist (claim the profile, correct primary category — *مقاول أسقف* /
*Drywall contractor* is the heaviest Map-Pack factor after proximity; **service-area business** config,
since most of these contractors have a workshop not a showroom; Sat–Thu hours with Friday closed; 20+
real photos); and a **review request automation** — when a lead hits `order_complete`, auto-send a
WhatsApp review request. The stages, the phone numbers and the WhatsApp channel all already exist; this
is wiring, not architecture.

**Sell it as "موقعك + نشاطك التجاري على جوجل"**, not "a website". It is worth more to the customer and
far easier to demonstrate results for.

### Content architecture that does not exist
```
/services/<slug>          × 6    700–1,000 Arabic words each + Service schema
/areas/<slug>             × 8–15 400–600 words, GATED on real projects in that area
/projects/                        portfolio index
/projects/<slug>          × 10–40  ← THE BIGGEST MISS
/before-after/<slug>              a strong, differentiated engagement asset
/pricing                          اسعار — high intent, but MUST carry الكويت/بالدينار (see below)
/faq                              20–30 questions
/blog/<slug>                      low priority per-tenant, HIGH for the platform domain
```

**The rule that keeps area pages out of doorway-abuse territory:** an area page may only exist when the
tenant has **≥1 real completed project in that area** (pull from `projects.location`), plus area-specific
practicalities and 400+ unique words. Generate nothing otherwise. A tenant with 30 projects might earn
12–18 combination pages; a brand-new tenant earns zero, which is correct. **Enforce this in code**, not
in a style guide.

### Arabic specifics
- Write service pages in clean MSA (the service noun is always MSA or a loanword: `جبس بورد`, `ألمنيوم`,
  `سيراميك`, `قواطع`), but include the **colloquial intent modifiers** verbatim in H2s and FAQs:
  `اسعار`, `ارخص`, `افضل`, `شركة`, `فني`, `معلم`, `تركيب`, `رقم`.
- **Orthographic variants** to cover in copy: `اسعار`/`أسعار`, `شركة`/`شركه`, `على`/`علي`. Never use
  diacritics in titles or slugs. `جبس بورد` (two words) vastly outweighs `جبسبورد`.
- **Seed terms.** Absolute volumes for Kuwait Arabic could not be obtained (Google Trends rate-limited;
  every keyword tool auth-gated) — so rather than invent numbers, these are ordered using **live Google
  Suggest output** (`hl=ar&gl=kw`, fetched 2026-09-22), which is ranked by real query popularity and is
  first-party Google data:
  *Gypsum:* `جبس بورد الكويت` · `معلم جبس بورد الكويت` · `تركيب جبس بورد` · `ديكورات جبس بورد` ·
  `جبس بورد فلات` · `جبس بورد اسقف` · `جبس بورد غرف نوم` · `جبس بورد ريسبشن`
  *Aluminum:* `المنيوم الكويت` · `المنيوم الشويخ` · `فني المنيوم` · `مطابخ ألمنيوم` · `شبابيك ألمنيوم` ·
  `مصنع المنيوم الكويت`
  *Partitions:* `قواطع جبس بورد` · `بارتيشن مكاتب الكويت` · `قواطع المنيوم مكاتب` · `فواصل زجاجية للمكاتب`
  *Ceramic:* `سيراميك الكويت` · `معلم سيراميك` · `تركيب سيراميك` · `سيراميك حمامات` · `فني سيراميك`
  *Area layer:* each × `السالمية` · `حولي` · `الجابرية` · `الفروانية` · `الأحمدي` · `الجهراء` ·
  `مبارك الكبير` · `الفنطاس` · `المنقف` · `سلوى`

- **Three corrections to the obvious keyword list, each from the autocomplete data:**
  1. **`قواطع الوميتال` is near-dead** — it returns a single suggestion. And bare **`قواطع` is
     ambiguous**: it is dominated by `قواطع كهرباء` (electrical breakers). Targeting the aluminium
     partition head term as usually written will mostly attract electricians' traffic. Use
     `قواطع جبس بورد` or `قواطع المنيوم مكاتب`.
  2. **`اسعار جبس بورد` is not a Kuwait-localised query.** Its suggestions are `في ليبيا` · `في الاردن` ·
     `في مصر` · `في السعودية` — price intent in this trade is pan-Arab and Egypt/Saudi-dominated. A
     pricing page is still worth building, but it must carry `الكويت` / `بالدينار` in the phrasing to
     localise, or it competes against far larger markets for nothing.
  3. **High-demand modifiers to build pages around:** `فلات` (apartments), `اسقف` / `اسقف بسيط`,
     `شاشات` (TV feature walls — and `شاشات 2026` shows year-stamped queries are live), `غرف نوم`,
     `ريسبشن`, `معلم`, `فني`, `تركيب`.

- **The most strategically important search finding in this report:** **"انستقرام" is the #2 autocomplete
  suggestion for all three trades** — `جبس بورد الكويت`, `المنيوم الكويت` and `سيراميك الكويت`.
  Kuwaitis searching these trades are explicitly looking for **Instagram accounts**. Similarweb
  corroborates: instagram.com is the **#3 site in Kuwait** and whatsapp.com **#4**. A web-only strategy
  fights the grain of this market. **The Instagram handle should arguably be a required field on every
  tenant site**, prominently linked — and the pitch should position the site as the durable, searchable
  archive that Instagram cannot be, not as a replacement for it.

- **Nationality is a live query qualifier.** `باكستاني` and `هندي` appear organically in suggestions for
  `معلم جبس`. This is real Gulf search behaviour and **no incumbent is serving it** — a content axis
  available for free.

- **The English version should not be a translation.** Probing `gypsum kuwait` returns a completely
  different intent set — factory, manufacturing, supplier, powder, procurement. **English here is a
  different audience (B2B/industrial/expat procurement), not a mirror of the Arabic consumer demand.**
  That reframes `?lang=en` from "the same page in English" to "a page for a different buyer" — and is
  another reason not to auto-publish a fallback translation.

- **Transliteration needs no dedicated pages.** Probing `jibs board` shows Google **auto-corrects it into
  the Arabic query space**; `jipsum kuwait` returns zero suggestions. Include Latin spellings as on-page
  synonyms; do not build pages for them.
- **Do NOT build pages for Arabizi spellings** ("jibs board", "jabs bord"). Arabizi is documented in
  Kuwaiti *messaging*, but there is no evidence of *search* demand — and building those pages would
  manufacture exactly the thin content the spam policy targets. Target Arabic script and clean English as
  the two real clusters, then validate with Keyword Planner geo-set to Kuwait and your own GSC data.
- **URL slugs — an operational choice, not an SEO one.** Google's URL-structure doc actually says
  *"use words in your audience's language in the URL (and, if applicable, transliterated words)"*, so
  Arabic slugs are fine and display as readable Arabic in the SERP (a real CTR advantage in a 95%-Google
  Arabic market). **But Latin slugs survive being pasted into WhatsApp**, which is this business's primary
  sharing channel, where `%D8%AC%D8%A8%D8%B3...` looks broken. **Lean Latin for that reason alone** — and
  whichever you pick, pick once, site-wide.

### Measurement
- **One GSC Domain property on `decokuwait.com` covers all 500 subdomains with a single DNS TXT record.**
  Do this today. Add each tenant as a URL-prefix property at provision time for per-tenant reporting.
- **Two hard limits to design around, both verified:**
  - **A Search Console account is capped at 1,000 properties.** At 500 tenants, subdomains plus custom
    domains plus www/non-www variants **will cross that ceiling.** Plan for Domain properties, or for
    multiple accounts, before it bites.
  - **URL Inspection is capped at 2,000 queries per day per site.** Fine for monitoring, not for bulk
    indexing workflows.
- **It is a two-API pipeline, not one.** Ownership is proved with the **Site Verification API**
  (`getToken`, then `insert`; methods `FILE`/`META` for sites, `DNS_CNAME`/`DNS_TXT` for domains), and
  only then is the property attached with the Search Console API (`PUT .../sites/{siteUrl}`, which accepts
  both URL-prefix and `sc-domain:` forms). `sites.add` runs at 20 QPS / 200 QPM, so onboarding 500
  tenants is ~3 minutes of calls — **the API rate is not the constraint; the property ceiling is.**
  (Note: the Site Verification API does not support IDN — punycode-normalise if any tenant ever wants an
  Arabic-script domain. Its own quotas are unpublished.)
- **One thing NOT to do:** adding `decokuwait.com` to the Public Suffix List looks like a clean way to
  make Google treat each tenant as a separate site — but Google states plainly that it **does not support
  domain-property verification of public suffixes**, so you would lose the single-Domain-property
  management story, and it does not clear the neighbourhood effect anyway.
- **Custom domains need a verification-token field** — add `seo.verification.{google,bing}` to the admin
  and emit via Next's metadata `verification` key. Bolt the GSC TXT record onto the existing DNS
  instructions screen. This does not exist today in any form.
- **Bing:** import from GSC, 10 minutes, done (3.64%). **Skip Yandex** (0.48% / negligible).
- **Measure AI exposure with first-party data** — GSC shipped generative-AI performance reports in June
  2026. Circulating third-party "% of queries with AI Overviews" estimates range from 7% to 80% and are
  unusable.
- **Separate organic as a channel in the admin.** Today `sourcePlatform` comes from paid-click
  attribution and organic falls into `direct`/`other`. Without an explicit organic bucket you cannot
  prove SEO ROI to the customer — which is the entire commercial point.

### Citations and links, ranked by evidence rather than by directory-list convention
1. **Google Business Profile** — the only one with documented ranking effect.
2. **Instagram** — not a citation in the classic sense; in Kuwait it is the primary discovery surface
   (autocomplete #2 for all three trades; Similarweb national rank #3).
3. **OpenSooq Kuwait** (`kw.opensooq.com`) — **verified as the #32 site in Kuwait**, the only classifieds
   site in the national top 50, with a Home Construction services category.
4. **4Sale / `q84sale.com`** — locally dominant by reputation, with a `/contracting` section. Worth
   noting it does **not** appear in Similarweb's web top-50, which likely reflects app-dominant usage
   rather than irrelevance.
5. **Apple Business Connect / Bing Places** — low cost, no Kuwait-specific data either way.
6. **Generic directory sites** (`kuwaityello.com`, `kuwaitlisting.com`, b2bmap and similar) — **no
   evidence was found that any of these carry ranking or referral weight.** They appear to be
   scraped-listing sites. **Do not spend money or time on them.**

NAP must be byte-identical everywhere, in both Arabic and English.

**Set link expectations honestly:** the Kuwaiti decor niche has almost no link economy. Expect
single-digit referring domains per tenant in year one — and note that **this is fine**, because every
competitor is in the same position and the Map Pack barely cares. **Do not buy links.** The realistic
sources are supplier/manufacturer "authorised installer" pages (the best genuine links in this niche),
the Chamber of Commerce, local directories, and the platform editorially linking to its own tenants.

### One small verification task
Next 16 **streams `generateMetadata` results and appends the tags to `<body>`** for bots it judges
JS-capable, rather than blocking on `<head>`. Next states it verified Googlebot handles this, and the
default improves TTFB — so don't disable it speculatively. But since
`src/app/tenant/[host]/page.tsx:31` does a **DB lookup inside `generateMetadata`**, curl a live tenant
page as Googlebot once and confirm the canonical, hreflang and OG tags land where expected.
`htmlLimitedBots` is the override if needed.
---

# 7. The attribution engine — what works and what is theatre

This is the product's headline differentiator, so it deserves a blunt verdict. **First, an important
correction to a common assumption:** this is *not* the most engineering-expensive part of the codebase.

```
src/templates        9,227 LOC
src/app/tenant       3,358
src/app/(platform)   1,505
src/lib/db           1,489
src/components         842
src/lib/marketing      756   <-- the "most sophisticated" feature
src/lib/visitor        124
```

Marketing + visitor together are **880 LOC — 3.7% of the codebase**. The template engine is **over 10×
larger** (9,227 vs 880).
This matters because it means **de-emphasising the attribution engine costs almost nothing.** Keep the
code; change the pitch.

## 7.1 What genuinely works

Verified against current provider specs:
- **Meta, TikTok and Snapchat payloads are correct** — endpoints, `action_source`, `event_time` units,
  hashing normalisation (SHA-256 of lowercase-trimmed; phone in E.164 with/without `+` as each provider
  requires), `test_event_code` placement, non-zero-code-on-HTTP-200 treated as failure.
- **`fbc` reconstruction is exactly right** — `fb.1.<ms>.<fbclid>`, with subdomainIndex 1 for
  server-side generation. Most implementations get this wrong.
- **Snapchat is fully migrated to v3**, with the token in an `Authorization: Bearer` header rather than
  the URL — the better choice given deliveries are stored and rendered.
- **X's OAuth 1.0a signing is correct** — base string, percent-encoding including leaving `~` alone,
  key construction, nonce, timestamp. Easy to get subtly wrong; got right.
- **Deduplication is done right.** Browser and server share an `event_id`, **and the event *name* matches
  because both call the same `resolveEventName()`** — that name mismatch is the classic silent
  double-count on Meta, and it is avoided. Per-provider dedup keys are all correct.
- **`after()` means the serverless dispatch actually completes**, with 8s per-provider timeouts,
  parallel execution, and per-target failure isolation.
- **The WhatsApp flow is the best-executed part of the system.** Kuwait number normalisation handles all
  three local formats; the message is capped at 900 chars; `sendBeacon` with a `fetch`+`keepalive`
  fallback means the click event survives navigation; and **clicks landing before hydration are queued
  in `window.__dkPending` and replayed** — a genuinely good detail, because on a 3G phone those first
  seconds are exactly when the floating button gets tapped.
- **Secret redaction** in stored delivery records is tested.
- **The test/debug path is better than most** — real test paths per provider (Meta/TikTok
  `test_event_code`, Snapchat `/events/validate`, GA4 `/debug/mp/collect` with `validationMessages`
  treated as failure).

## 7.2 CRITICAL — the conversion clock: deep-funnel stages land outside every Meta window

`src/lib/marketing/dispatch.ts:56` — `eventTime = input.eventTime || Math.floor(Date.now()/1000)`, and
`markStage` passes no `eventTime`. Events fire at the moment the owner taps the button.

**Meta's maximum attribution window is 7-day click.** Kuwaiti decor work runs weeks.

| Stage | Typical lag from ad click | Inside Meta's window? |
|---|---|---|
| `contacted` | hours–1 day | yes |
| `called_for_visit` | 1–4 days | usually |
| `ordered` | 1–3 weeks | **no** |
| `first_payment` | 2–5 weeks | **no** |
| `order_complete` | 4–12 weeks | **no** |

The two events the product is *sold on* are received by Meta, stored, shown **green** in the admin, and
attributed to **no ad**. They cannot train value optimisation. Meta's own `event_time` ceiling is 7 days
in the past, so back-dating is not a workaround. TikTok and Snapchat are more forgiving (28-day click),
but Meta is where Kuwaiti decor contractors actually spend.

**This is not a code bug.** The code does exactly what it was designed to do. It is a flaw in the product
thesis, and it needs an honest reframe: `contacted` and `called_for_visit` are the events Meta can
optimise on; the deep stages are **business reporting** — which is genuinely valuable and which the admin
already does well. Do not promise that marking "order complete" improves ad delivery, because on Meta it
does not.

## 7.3 The statistical problem underneath it

Even if the clock were fixed, the volume is wrong. At KD 50–200/month of ad spend and a realistic
KD 5–15 per WhatsApp click in Kuwait, a contractor generates **10–40 clicks and 1–3 closed jobs per
month**. Meta's optimiser needs roughly **50 conversions per ad set per week** to exit the learning
phase. He will produce **two per month.**

The signal is real, correct and well-engineered — and statistically inert. It is a feature designed for
an advertiser spending KD 3,000–10,000/month. Those advertisers exist in Kuwait (e-commerce, clinics,
developers) — but they are not gypsum contractors, and they would never accept one of 60 templates.

**And the prerequisite chain is brutal.** For any of this to pay off, five things must all be true:
(a) he runs paid ads, (b) he has a Business Manager, (c) he has generated and maintains a CAPI token,
(d) he keeps pixel credentials updated, (e) he faithfully marks stages **including typing a KD amount** —
`VALUE_REQUIRED = ["first_payment", "order_complete"]` enforces this. Realistically **under 10% of
customers clear all five, and under 5% sustain it past month two.**

## 7.4 Google is theatre

`gclid`/`gbraid`/`wbraid` are captured at `src/lib/visitor/attribution.ts` and **never read by any
provider**. The Google path uses GA4 Measurement Protocol, and:
- The `_ga` cookie is almost never present when needed — `SiteRuntime` posts `/api/track` from a
  `useEffect` at hydration, while gtag loads `afterInteractive`. The fetch always wins, so a **synthetic**
  `client_id` is used on first visits, which is when most WhatsApp clicks happen.
- MP events carry no `session_id` and no `gclid`. Without those, GA4 attributes the event to
  **Unassigned** — a conversion on a phantom user with no traffic source.

So the admin shows green for Google on `ordered`/`first_payment`/`order_complete` and **Google Ads
receives nothing usable.** The only Google conversion that lands is the browser-side gtag call on
WhatsApp click, and only if the owner filled in both the optional `adsId` and `adsLabel`.

*Fix:* this needs the **Google Ads API offline conversion import** (`ClickConversion` with
gclid/gbraid/wbraid), not GA4 MP. Short of that, **stop showing a green badge for Google on stage
events** — it is actively misleading the owner about where their money goes.

## 7.5 "Smart mode" fans out by default

`src/lib/marketing/select.ts` — when the source is `direct`/`other`/unknown, **or when the matching
platform's pixel isn't ready**, it returns *every* ready pixel. The function's own docstring states this
plainly, so the behaviour is deliberate. The problem is the **UI label**, which presents it as "only the
platform the visitor came from" with the fan-out reduced to a parenthetical.

Three common paths reach the fallback: ITP-truncated return visits, the Instagram-browser → Safari break,
and any tenant whose source platform lacks credentials. In this market `direct` will be a large slice.

Consequence: one real lead becomes N conversions across N ad accounts. Every ROAS number inflates and
budget flows to whichever platform is best at *claiming* credit. A single-platform advertiser is
unaffected; the moment a tenant runs two, it misleads.

*Fix:* make the fallback send **nothing**, or only to a designated primary. Show an amber warning in the
"will send to" card when more than one target appears because the source is unknown.

## 7.6 Match quality is at the floor, and the fix is one form away

What actually reaches Meta for a typical first-visit click: `external_id` (SHA-256 of a 6-digit number
Meta has never seen), IP, user-agent, and `fbc` only if the ad click carried `fbclid`. **`_fbp` is
absent** — same root cause as the `_ga` problem, and `/api/track/event` sends no cookies at all, so the
click beacon (fired at a moment when `_fbp` *does* exist) doesn't repair it.

Realistic EMQ: **~3–4/10 with `fbc`, ~2/10 without.** With a real phone number: **~6–8/10.**

**The phone field already exists** — `visitors/[code]/page.tsx:153` captures it, `saveVisitorInfo` stores
it, and every provider hashes it correctly. But it lives in a **separate form** further down the page
from the stage buttons, with no prompt and no explanation. `markStage` dispatches with whatever is
currently in the DB — usually nothing.

The owner has just been chatting with this person on WhatsApp. **The number is literally on their
screen.** This is free, first-party, consented-in-context data being left on the floor.

***This is the single highest-ROI change in the entire marketing section:*** put a phone input **inside**
the stage-mark form, prefilled, with a one-line Arabic hint. One afternoon of work.

## 7.7 Other marketing findings

- **CRITICAL (dated):** `providers/meta.ts:6` pins `GRAPH_VERSION = "v21.0"`, which **becomes
  unavailable 2027-01-21** — about four months from now. On that day every Meta CAPI call starts failing
  silently for every tenant at once. Move it to an env var and treat a version/auth failure as a
  distinguishable alarm.
- **X is configured as "ready" but skips every event by default.** `xReady()` passes on credentials
  alone, but the default event map is empty, so `send()` returns `skipped: "missing_event_id"` and
  `deliveryOutcome` counts it as a **failure**. An owner who connects X correctly sees "signal failed" on
  every stage mark forever, until they find a collapsed accordion. A non-technical contractor will
  conclude the product is broken.
- **No retries, no queue, no dead-letter.** A 5-second Meta blip and the conversion is gone permanently.
  For click events the failure happens inside `after()` and the visitor is long gone.
- **An expired token is nearly invisible.** Click-event failures are caught, `console.error`'d, and
  stored in a JSON column nobody reads. A tenant can lose every Meta conversion for weeks and find out
  only when their cost-per-lead climbs. *(Snapchat CAPI tokens don't expire — Snap is the one platform
  immune.)*
- **"Resend signal" mints a new `event_id` every time**, so an anxious owner clicking three times books
  three separate Purchases. Reuse the last id.
- **`markStage` has no server-side idempotency** — the click route passes a `dedupeKey`, this one
  doesn't. Two tabs or a stale page double-fires.
- **`VisitorCookie.tsx:13` rewrites `dk_vid` via `document.cookie`** after the proxy already set it via
  `Set-Cookie`. That re-marks it script-writable, which **Safari ITP caps at 7 days — or 24 hours for a
  link-decorated cross-site navigation, which is exactly what `?fbclid=` from Instagram is.** iOS Safari
  dominates in Kuwait, so the one-year cookie is fiction for a large share of visitors. Delete the JS
  write; return the reconciled code via `Set-Cookie`.
- **The Instagram in-app browser → Safari break is unmitigated and is the common case.** Ad tapped in
  Instagram → in-app WebView (own cookie jar) → taps WhatsApp and leaves → reopens later in Safari as a
  brand-new visitor with no click ID. **What partially saves this is genuinely clever:** the ID lives in
  the *message*, so the owner marks the original visitor row (the one that has `fbc`). It works — but
  only if the customer sends the prefilled message unedited and the owner searches by ID.
- **Meta's Click-to-WhatsApp ads pass `ctwa_clid`**, which would solve this break far better than the
  embedded ID. The product doesn't use that channel at all. Worth investigating.
- **No Kuwait-specific number validation.** `/^\d{8,15}$/` accepts a 9-digit typo, which becomes a
  `wa.me` link to a nonexistent number. The owner sees no error and **every lead silently dies at the
  link.** Validate `^965[569]\d{7}$` after normalisation.

## 7.8 Privacy and consent — a real exposure

**There is no consent mechanism anywhere.** No banner, no gate, no CMP, no consent state. Pixels load
unconditionally and `dk_vid` is set at the edge before a byte renders — including on the `/privacy` page
itself.

- **Kuwaiti law is not the binding constraint here — verified.** Kuwait has **no general data
  protection law** applying to companies at large. The Data Privacy Protection Regulation (CITRA
  Administrative Decision No. 26 of 2024, in force 19 Feb 2024, replacing No. 42 of 2021) started
  broader but was **narrowed to apply exclusively to CITRA-licensed telecom and internet providers**.
  A decor contractor's website and this platform both sit outside it. So the legal exposure in Kuwait
  today is low — which is genuinely reassuring, and is why the fix below is proportionate rather than
  urgent. It also means you should not expect Kuwaiti law to tell you when you have gone too far.
- **Platform business-tool terms are the real operative risk, not regulators.** Meta, TikTok and Snap
  all require the site operator to provide notice and obtain legally required consent, and to have the
  right to share what they send. Meta can and does **disable a CAPI dataset**, and losing one means
  losing the pixel's entire learning history — far more expensive, and far more likely, than any
  Kuwaiti fine. Uploading a hashed phone number that a customer gave over WhatsApp for a quote, to five
  ad platforms, with no notice naming that use, is squarely the risk case.
- **The default privacy policy doesn't disclose what actually happens.** It names the platforms (better
  than most) but never says cookies are set, that IP and user-agent are transmitted, that **a phone
  number given over WhatsApp may be hashed and uploaded**, the retention period, or how to withdraw. And
  it is owner-editable, so a contractor rewriting it will disclose less.

*Fix (proportionate):* a lightweight Arabic consent notice gating the pixel scripts and the server
dispatch (not `dk_vid`, which is arguable as functional); extend the default policy text and make the
tracking paragraph non-editable boilerplate with an editable section below it. And **make the contractor
the data controller in your terms** — you are a processor pushing *his* customers' data under *his*
pixel, and the platforms require *him* to have lawful basis.

*(The `wa.me?text=` prefill is **not** a WhatsApp policy problem — the user sends it from their own
account and can edit it. Standard click-to-chat.)*

---

# 8. Product completeness, UX and accessibility

## 8.1 README claims vs reality

**Every specific README claim was checked. None is false.** 60 templates, phone-editable sections,
5 conversion providers, lead stages, Vercel domain provisioning, site deletion cleanup, editable privacy
policy, per-site favicon, language toggle, project types, per-host sitemap/hreflang/JSON-LD, health
endpoint detail, and "`npm run qa` is the same gate as CI" — all verified true.

**The trust problem is what the README doesn't say.** It reads like a finished SaaS while never
mentioning that there is no billing, no signup, no email and no notifications.

## 8.2 Missing product surface (each verified absent, not assumed)

**Absent entirely:** billing/subscriptions/plans/trials/invoices/dunning/expiry · self-signup ·
transactional email of any kind · password reset · **lead notifications** · contact form / call-back
request / quote form · blog · per-project public pages · service detail pages · multi-branch ·
team members · certifications · price lists · review collection · site search · custom script injection ·
audit log · content version history / undo · data export · staging/preview · scheduled publishing ·
maintenance mode · in-admin help or support link.

**The sales surface is itself a hole.** `src/app/(platform)/page.tsx` is an *internal* page — its entire
nav is "القوالب" and "لوحة المشرف العام". No pricing, no "get your site", no contact, no phone number.
**A Kuwaiti contractor who finds decokuwait.com cannot buy, enquire, or even find a way to reach you.**

**Partially present:**
- *Tenant analytics* — 5 counters, a by-source chart, a by-stage chart and the last 20 events with
  delivery status. Honestly decent. Missing: **any time series** (`visitorStats` returns only scalars),
  conversion rate, date filter, CSV export.
- *The work queue doesn't exist.* A WhatsApp click does **not** advance the stage, and there is no
  `whatsapp_clicks > 0 AND stage = 'new'` filter — so **"people who messaged me and I haven't handled
  yet" is not a queryable view.** That query is the owner's daily to-do list.
- *Multi-user* — `site_members.role` defaults to `'admin'` and **nothing ever reads it**. Every member
  has identical full access, and there is no tenant-side team page.
- *Media* — client-side resize is good; server-side there is nothing. No transcoding, **no auto video
  poster** (it's a second manual upload, and a posterless video paints a **black rectangle** — visible in
  the template gallery a prospect is looking at), no watermarking, **no per-tenant quota** (`size` is
  recorded and never summed), **no bulk upload** (no `multiple` on the input — 20 photos = 20 upload
  cycles on a phone).

## 8.3 Empty states — what a new customer's site actually looks like

Good: `shared/helpers.ts` auto-hides about/services/stats/process/testimonials/FAQ and each project type
when empty, drops dead nav anchors, and degrades a missing WhatsApp number to `#contact`.

Bad, in order of visibility:
1. **The hero `<h1>` renders empty when `hero.title` is blank** — no fallback to brand name, in every
   hero variant. In practice this needs an owner to *clear* the title, since both provisioning paths
   seed one and the admin field is `required` — so it is a latent one-line fix rather than a day-one
   certainty.
2. **A real customer site created *without* demo content renders only `#top`, `#about`, `#contact`** —
   `starterContent` (`provision.ts:29-45`) seeds section titles **plus a category-identical hero
   (badge, title, subtitle, both CTAs), tagline, `seo.description` and the entire `cta` block** — and
   nothing else. Day one looks abandoned *and* the copy is still shared with every other tenant in the
   category.
3. **So both defaults are wrong in opposite directions:** demo-on publishes fake content (§4.7), demo-off
   publishes an empty shell. Neither is a good first impression. The answer is a guided setup that fills
   real content before the site goes live.
4. `FooterColumns` prints the "Our services" heading even with zero services.
5. A 404ing image gets the browser's broken-image icon — `Img` only shows a placeholder for a *falsy* src.

**Category parity is good:** all four categories have full bilingual copy, 6 services, 4 process steps,
FAQs, real Kuwaiti locations and category-correct technical vocabulary (thermal-break profiles, 45 dB
acoustic ratings, Calacatta porcelain). No category is a copy-paste of another.

## 8.4 Accessibility — a strong engine with a broken switch

The WCAG work is real (§3). Two findings undermine it:

- **HIGH — the theme editor's contrast warning is dead code.**
  `src/app/tenant/[host]/admin/content/[section]/ContrastCheck.tsx:43` does
  `document.querySelector<HTMLFormElement>("form")` — which returns the **first form in the document**,
  and that is the logout form in the sticky admin header (`src/components/admin/Shell.tsx:73`). So the
  colour inputs are never found and the listeners are bound to the logout form. **It has never worked.**
  Since owners pick arbitrary colours, this is the only guard the customer ever sees.
  *Fix:* `panelRef.current?.closest("form")`.
- **HIGH — an owner-set text colour bypasses the contrast engine.** `src/templates/ctx.ts` applies
  `tokens.text = th.text.toLowerCase()` **raw, with no floor**. The code immediately above it *does*
  floor text at 7:1 when only the background is customised — so the engine is right and the hole is
  specifically the explicit-`text` branch. White-on-white body text is publishable, and with
  ContrastCheck dead nothing warns.
  *Fix:* `tokens.text = readableOn(th.text, tokens.bg, 4.5)` — consistent with how every other token is
  already handled.

- **HIGH — content images ship `alt=""`, which is a WCAG 1.1.1 Level A failure.** This is listed in §6.8
  as an SEO loss, but it is first an accessibility one: declaring an image decorative when it *is* the
  content means a screen-reader user gets nothing at all. It affects `HeroFullscreen`, `HeroGallery`,
  `HeroCards`, `HeroCentered`, `HeroVideo`, `CtaCard`, all four footer logos, and
  `primitives.tsx:184`'s generic `Media` component — **through which every gallery image routes**. On a
  portfolio site whose entire content is photographs, this is the most consequential a11y defect here,
  and it is why the §2 grade is C+ rather than B.

Also: `ContrastCheck` never checks text-on-`surface` (every card and FAQ panel); no designed focus
indicator (`Tabs` sets `outline-none` on a focusable tabpanel, and the before/after slider's keyboard
affordance is an `opacity-0` range input — two WCAG 2.4.7 failures on flagship widgets); no skip link;
`Lightbox` has hardcoded English `aria-label`s and announces the dialog as "Close".

## 8.5 Arabic and RTL

The discipline is excellent (§3). Three real defects:

- **HIGH — Arabic headline line-height is too tight and glyphs collide.** `leading-[1.02]` on
  `HeroEditorial` at `lg:text-8xl`, `leading-[1.1]`–`leading-[1.15]` across seven more hero variants,
  plus `leading-tight` (1.25) on 14 headings including `SectionHeading`. Arabic needs ~1.4–1.6× where
  Latin display type takes 1.0–1.15, because of descenders (ج ح خ ع غ م ه ي ق). **This affects the
  single largest element on every page of every template, in the primary language.** Floor Arabic
  headings at 1.35 (1.5 for Naskh faces); gate tight Latin display with `:lang(en)`.
- **MEDIUM — the before/after comparison is mirrored for Arabic readers.** `BeforeAfterSlider` forces
  `dir="ltr"`, pinning "قبل" top-left and "بعد" top-right. An Arabic reader scanning right→left meets
  **after** first, so the قبل→بعد narrative runs backwards — on the product's most persuasive widget.
- **MEDIUM — project step dates print as raw ISO strings** (`2026-01-15`) in four progress components.
  The admin formats dates correctly with `Intl`; the customer-facing site does not.

## 8.6 Admin panel UX — the friction that causes support calls

It is genuinely Arabic-first, mobile-first, with a bottom tab bar on phones, sticky save bars with
safe-area insets, 16px inputs (no iOS zoom), and clear AR/EN field pairs. That is the right shape.

- **HIGH — zero unsaved-change protection.** Verified: `grep -rn "beforeunload\|isDirty\|unsaved"` → **0
  matches.** The bottom tab bar uses client navigation, so a contractor who has typed five bilingual
  fields and taps "المشاريع" loses everything **with no warning at all** — a client nav doesn't fire
  `beforeunload` either. This is the most likely reason someone gives up and calls you.
- **HIGH — competing Save buttons.** The project editor has a sticky "حفظ" *and* a "حفظ" on every media
  row. Three or four buttons labelled Save on one screen, each saving something different.
- **HIGH — every media operation is a full page round-trip.** Reordering is `↑`/`↓` form submits, so
  moving item 10 to position 1 is **nine page reloads**. Combined with no bulk upload, documenting a job
  on a phone is the difference between "I'll update it tonight" and "call the developer."
- **MEDIUM — no cropping or focal point.** Everything is `object-cover`. For a *decor* portfolio, where
  framing **is** the product, this is a real gap. Even a 3-position focal picker would cover 90% of cases.
- **MEDIUM — no preview-before-publish**, and `window.confirm` for deletes renders an unstyled native
  English dialog in the middle of an otherwise fully Arabic product.
- **MEDIUM — the raw upload URL is displayed** to a user who cannot act on it.

## 8.7 One confirmed code bug

`src/lib/demo/content.ts:6`:
```js
const sized = (url, w) => url.replace(/([?&])w=d+/, `$1w=${w}`);
```
`w=d+` is missing the backslash on `\d`, so the pattern never matches and **`sized()` is a silent
no-op** — every "smaller" demo image serves the 1400px original, on the hero and every service card.
The correct twin is right next door at `src/templates/ui/img.ts:11`. One character.

**Impact is smaller than it first looks, though.** Because `sized()` is a no-op the URL keeps `w=1400`,
which still matches the `UNSPLASH` pattern — so `responsiveSrc` emits a correct 480/768/1080/1400
`srcSet` and a phone rarely downloads the full file. Fix it because it is one character, not because it
is costing much.

## 8.8 Do NOT "fix" these — verified non-bugs

Recorded so a future pass doesn't churn on them:
- `.admin { font-family: "Cairo", "Tajawal" }` **works** — `next/font` emits the real family name and
  the chunk ships on every route.
- The template gallery is **not** half-empty — the blank cards in the screenshot are a Playwright
  lazy-loading artifact; all 120 thumbnails exist on disk.
- **No missing viewport meta** — Next 16 injects the default.
- Carousel prev/next **are** localized by all callers; only `Lightbox` is not.
- Phone numbers are **not** bidi-mangled — `dir="ltr"` is applied at all 17 relevant call sites.
- `viewport-fit` is deliberately unset, so `env(safe-area-inset-*)` is inert. That is correct — adding
  `viewportFit: "cover"` would *create* the bug it looks like it's avoiding.
- The `/template/:code` CDN cache header is **not** dead config — Next preserves a user-set
  `Cache-Control` rather than overriding it.

**One evidence caveat:** `.qa/shots/*` was captured 2026-09-16 15:32, and the two nav-fix commits landed
at 15:51. All screenshot-based mobile-overflow evidence **predates the fix**, so nav/drawer issues were
judged from code instead. Note that `globals.css` uses `overflow-x: hidden` on body and
`overflow-x: clip` on `.tpl`, which **mask** overflow rather than eliminate it — so a regression would be
invisible. **Re-run `npm run shots` and diff**, and consider a dev-only outline on any element wider than
`100vw`.
---

# 9. The business — what it is, and the honest odds

## 9.1 Four facts the code tells us before any market data

1. **There is no commercial layer.** `sites` is `id, slug, name, category, template_code,
   status('active'|'paused'), content, created_at, updated_at`. **No plan, no price, no `paid_until`, no
   invoice, no trial.** The only collection mechanism in the entire system is a human flipping `status`.
2. **There is no funnel.** Sites are provisioned by hand at `/super/sites/new` — the founder types the
   name, slug, WhatsApp number, admin email *and the admin's password*.
3. **The engineering weight is the opposite of the pitch** (§7) — the template engine is **over 10×**
   the attribution engine (9,227 LOC vs 880).
4. **Content entry is the real COGS, though less severely than it first appears.** Every text field is
   `LText = { ar, en }`, and the admin renders a paired AR/EN input for each one. *(An earlier draft said
   both halves were mandatory — that is wrong: `ui.tsx:161` marks only the **Arabic** input `required`,
   the English one is optional, and `lt()` falls back to the other language when a half is empty. An
   Arabic-only site is fully supported.)* So the labour is not strictly doubled — but someone still has
   to write the Arabic for every section of every site, and **the customer will not do it. You will**,
   for every customer, forever. That cost is on no spreadsheet. Note also the tension: the same fallback
   that saves labour here is what publishes Arabic text under `hreflang="en"` (§6.5). Fixing §6.5
   properly means gating the English version, not removing the fallback.

**Three agents — working from code, from operations, and from market data, with no knowledge of each
other's findings — independently concluded that the missing commercial layer is the biggest hole.** That
convergence is the strongest single signal in this analysis.

## 9.2 What the customer is actually buying

He *wants* leads. He will *pay for* proof. What a Kuwaiti decor contractor buys at KD 100–300 is
**legitimacy and a portfolio he can send on WhatsApp** — a link that makes an expat crew look like a
شركة when a Kuwaiti villa owner in Mutlaa is deciding whether to trust them with KD 3,000.

That is a real, narrow, defensible good. It is also a *website* business: low price, high churn, low
effort per unit once systematised. **Leads** is a completely different business — 5–10× the price, near-zero
churn while leads flow, catastrophic churn the month they stop, and it requires you to carry ad spend and
demand risk.

**The central contradiction:** the code is built for the lead-gen business. The revenue model implied by
the code is the agency business. The customer wants the agency deliverable.

## 9.3 Market (sources dated; estimates marked)

| Metric | Figure | Source |
|---|---|---|
| Kuwait population | 5.23m | PACI, end-2025 |
| Kuwaiti citizens | 1.562m (29.9%) | same |
| Private-sector workforce | 1.825m — of whom **only 66,416 are Kuwaiti** | same |
| Internet penetration | **99.0%** | DataReportal, Jan 2025 |
| Instagram reach | 3.00m — **59.4%** of population (high, though below UAE's ~71%) | DataReportal, Digital 2026 |
| TikTok ad reach | 3.99m — 102% of adults 18+ | same |
| Snapchat ad reach | 2.37m (47.4%) | same |
| Google search share | **95.22%** | StatCounter, Aug 2026 |
| Construction market | USD 15.40bn (2025), CAGR 5.7% | Mordor, H2 2025 |
| Al-Mutlaa residential plots | **28,288** | KEO / Sakan |
| Citizens with building permits (3 new cities) | **32,400** by end-2025 | Times Kuwait, 2026 |
| 10-year housing plan | 170,000 units | PAHW |

**That private-sector line is the most important number here:** 96% of Kuwait's private-sector workforce
is expatriate. Your customer is overwhelmingly an expat tradesman operating under a Kuwaiti's licence,
paid partly in cash, who may not have a bank account supporting recurring debit.

**Typical ticket:** published Kuwait rates vary widely by scope and source — one contractor lists
ceiling KD 4.0/m², wall KD 3.5/m² and finishing KD 2.0/m² as *component* rates, while other published
Kuwaiti quotes for a fully installed suspended ceiling run **KD 10–16/m²**. Treat the low figures as
labour-only line items, not turnkey prices. On the component rates, a villa floor ceiling ≈ KD 1,000
and a full villa KD 2,000–5,000. Job tickets KD 400–3,000; contractor
revenue KD 80,000–300,000/year *(estimate)*. Healthy enough to support KD 5–20 per lead. **Not**
automatically enough to support a KD 20/month SaaS, because his marginal job does not come from you.

**How Kuwaitis actually find a decor contractor**, ranked: (1) word of mouth / the diwaniya — dominant and
structurally unchallengeable by a website; (2) **Instagram**; (3) **the material supplier or main
contractor**; (4) Google — real but modest, and four incumbents already rank; (5) Snapchat/TikTok.
*Note what is fourth: the thing you are selling.*

### TAM / SAM / SOM

No official count of Kuwaiti decor contractors exists. Two independent triangulations both land at
**1,500–3,000 firms**, of which only **400–800** are formalised and marketing-minded enough to be
genuinely addressable.

| Layer | Arithmetic | Annual revenue |
|---|---|---|
| **TAM** | 2,500 × KD 25/mo × 12 | **≈ KD 750,000** |
| **SAM** | 600 × KD 25/mo × 12 | **≈ KD 180,000** |
| **SOM (3 yrs)** | 60–120 customers at KD 25 | **KD 1,500–3,000/month** |

**Verdict: the Kuwait-only market is not big enough to matter to an investor, and is exactly big enough
to matter to one person.** Total domination of every decor contractor in the country yields under
KD 1m/year.

**The uncomfortable implication of the housing boom:** 32,400 plot owners in the three new housing
cities — 98% of them — have taken the certificates required to complete a building permit, so a large
cohort is building or about to, against a
constrained supply of finishing crews. **A contractor with a six-month backlog does not buy lead
generation.** The boom that makes this vertical look attractive is precisely what destroys the urgency of
your pitch. You are selling a fire extinguisher during a flood.

## 9.4 Competition — Instagram is free and already won

| Competitor | Cost | Why him | Why you |
|---|---|---|---|
| **Instagram business account** | **KD 0** | Already has it; audience is there; free Reels reach; DM+WhatsApp built in | Looks like everyone else's; no domain; no before/after |
| Freelancer (Khamsat/Mostaql) | KD 50–150 one-off | Cheapest cash outlay | Disappears after delivery; no panel; often broken RTL |
| Local Kuwaiti agency | KD 250–800 one-off, "from KD 99" advertised | An office to visit, a Kuwaiti CR, a proper invoice | 3–8× your price; won't update his photos next month |
| Wix / Squarespace | KD 60–200/yr | Brand recognition | **Squarespace has no built-in RTL**; Wix RTL needs manual fixes. And he won't build it himself anyway |
| **Doing nothing** | **KD 0** | It's working; he has a backlog | — |

**You will never beat Instagram. You can only be the thing he links *from* Instagram.** The entire
positioning must be "الرابط في البايو" — the thing that turns an IG browser into a serious enquiry.

**And "doing nothing" is your biggest competitor**, not Wix.

**Your one defensible wedge:** vertical specificity + done-for-you + Arabic-first, at a price no agency
will match. He sends 20 photos on WhatsApp and gets a live site in 48 hours that already says the right
things about جبس بورد in Kuwaiti Arabic — no meeting, no brief, no revision rounds. **Nobody packages
that at KD 100.** But note what that wedge is: an *agency* wedge powered by *your labour*, not a SaaS
wedge powered by software.

## 9.5 Unit economics

**Proposed pricing** (anchored to local reality):

| Tier | Setup | Recurring |
|---|---|---|
| أساسي | KD 75 | KD 15/mo or **KD 150/yr prepaid** |
| **احترافي — sell this one** | KD 100 | KD 25/mo or **KD 250/yr prepaid** |
| Plus | KD 150 | KD 40/mo or KD 400/yr |

**Sell annual prepaid and discount it hard.** This is the most important pricing decision in this
document, for reasons that become clear below.

**Infrastructure:** ~KD 0.35/tenant/month at 50 tenants; ~98% gross margin on servers. **Not a problem.**

**The hidden costs are the actual business:**

| Cost | Time |
|---|---|
| Content entry — Arabic mandatory, English optional (§9.1) | **4–8 hrs first site** |
| Photo collection/cropping from his phone | 1–2 hrs |
| Domain + DNS handholding | 0.5–2 hrs |
| **Ongoing Arabic WhatsApp support** | **20–40 min/customer/month** |
| **Payment chasing (no billing system)** | **10–15 min/customer/month** |

At 50 customers that is **30–45 hrs/month before you sell anything.** At 150 it exceeds a full-time job
doing nothing but maintenance. **You hit a labour wall around 50–60 customers, well before KD 2,000 MRR.**

Loaded contribution at KD 25/mo: **KD 15–17**, not KD 24.6.

**Churn:** micro-SMB software under $50 ARPU runs 4–8%/month. For a busy contractor whose week doesn't
change if he buys, model **6%/month base**, 8% if billing is monthly and manual, **3% if annual prepaid**.
*Annual prepaid alone probably halves effective churn*, because most churn here is not a decision — it is
a contractor who didn't answer your payment message for three weeks.

**CAC and payback (LTV ≈ KD 267 at 6% churn on KD 16/mo contribution; the KD 100 setup fee is excluded,
since it is consumed by setup labour):**

| Channel | Blended CAC | LTV/CAC | Payback |
|---|---|---|---|
| Walk-in (Jleeb, Ardiya, Shuwaikh) | KD 300 | **0.89× — broken** | longer than lifetime |
| **Instagram DM outreach** | **KD 60** | **4.5× — works** | **~4 months** |
| Paid ads | KD 145 | 1.8× — marginal | ~9 months |
| **Referral** | **KD 22** | **12× — excellent** | ~1.5 months |
| Supplier rev-share | see below | **~2.0× — marginal** | ~8 months |

**The supplier channel needs modelling differently, and doing so changes the answer.** §9.7 proposes
25–30% **recurring** revenue share, not a one-off acquisition cost. At 27.5% recurring, contribution
drops from KD 16 to roughly **KD 9/month**, so LTV falls to ~KD 150 and the ratio lands near **2.0× —
marginal, not "works"**. It is still worth doing, because it is the only channel that gives a solo
founder *leverage instead of hours* and because it compounds — but price for it: either negotiate a
lower rate, or route supplier-referred customers to the Plus tier so the absolute contribution survives.

**The economics work only if CAC stays under ~KD 90** — Instagram DM and referral clear that
comfortably. Walk-ins are for learning and your first ten customers, not for building a business.

**One caveat that cuts in your favour:** every number above assumes **6% monthly churn**. §9.5's own
headline recommendation — annual prepaid — models at **3%**, which roughly doubles lifetime to ~33
months and LTV to **~KD 530**. At that level even walk-ins turn positive. The 6% column is the
conservative case; the 3% case is the one you should be trying to build.

**Customers needed (at KD 25 Pro):**

| Target MRR | Customers | New/month just to offset 6% churn |
|---|---|---|
| KD 1,000 | **40** | 2.4 |
| KD 3,000 | **120** | 7.2 |
| KD 10,000 | **400** | 24 |

Read against §9.3: KD 1,000/mo is ~6% of the addressable base — **achievable in 12–18 months**.
KD 3,000/mo is ~20% — **hard but possible in 2–3 years, and you must hire.**
KD 10,000/mo is **13–27% of every decor contractor in Kuwait** — **not plausible.** Say that to yourself
now rather than discovering it at customer 150.

## 9.6 Payment, legal, structure

**The product has no billing mechanism whatsoever — arguably *the* gap.**

- **KNET** is the dominant rail; **KFAST** provides card-on-file for recurring.
- **MyFatoorah** — 2.0–2.75% per transaction, **no setup or monthly fee**, KNET + cards + Apple Pay,
  recurring billing and webhooks. **This is the right choice.**
- **Cash** is normal in this trade. **Refuse cheques.**

**Minimum viable billing — one to two weeks, and it should precede any further feature work:**
1. Add to `sites`: `plan`, `price_kd`, `billing_cycle`, `paid_until`, `last_invoice_ref`.
2. A MyFatoorah invoice-link generator in super admin, one click, copied to WhatsApp.
3. A daily job flipping `status` → `paused` when `paid_until < now()`. **The pause machinery already
   works everywhere — it just needs to be wired to a date instead of a human.**
4. WhatsApp reminders at T−14 / T−7 / T−0 / T+3.
5. A `/pricing` page and an "اطلب موقعك" form.

**Legal:** a MOCI commercial licence is required to sell commercially, and **an expat cannot hold one
alone** — the standard structure is a WLL with a Kuwaiti partner at ≥51%. Three routes worth an hour with
a Kuwaiti lawyer: (a) WLL with a partner; (b) **Law No. 1 of 2024 amended Article 24 to allow a Kuwaiti
branch of a foreign entity without a sponsor** — the most interesting option; (c) invoice from abroad,
which is a grey area and will friction with your *best*, most formal customers. *(If the founder is
Kuwaiti, all of this collapses and the National Fund for SME Development becomes available.)*

**Tax: there is no VAT in Kuwait**, and the government's four-year plan rules it out before 2028. Budget
for it in 2028+; do not price for it now. 15% corporate income tax applies to the foreign-owned share of
profits. **Saudi expansion would introduce 15% VAT and ZATCA e-invoicing** — a real build, not a checkbox.

**Contracts:** one page in Arabic + English. He owns his content; you own the platform. **No numeric
uptime SLA** — you are one person on Vercel. Data export on termination (it costs nothing and kills the
"you're holding my site hostage" fight). Liability capped at 3 months' fees. And **explicitly disclaim any
guarantee of leads, rankings or ad performance** — the moment your pitch promises an outcome you don't
control, you will be blamed the first quiet month. That clause, and the matching discipline in the sales
pitch, is the difference between a business and a series of arguments.

## 9.7 Go-to-market for a solo founder

| Channel | Scales? | Verdict |
|---|---|---|
| Walk-ins — **Jleeb Al-Shuyoukh**, Ardiya, Shuwaikh | No | Brutal CAC, but **do it for your first 10** — the only way to hear the objections in his words |
| **Instagram DM outreach** | Semi | The workhorse. 50–80 DMs/day sustainable. **Open with a mockup using HIS photos** — nothing else earns a reply |
| Contractor WhatsApp groups | No | You get removed for spamming. Useful only as a referral amplifier later |
| **Material supplier partnership** | **YES — best channel** | The board/profile wholesalers see **every contractor in Kuwait, monthly, at the counter**. 25–30% recurring rev-share. **This is the highest-leverage unexplored move in this entire analysis, and nothing in the product supports it** |
| **Referral** | **YES** | The actual Kuwaiti mechanism — contractors all know each other. One free month per referral |
| Paid ads | With money | You compete on CPC against agencies with 5× your LTV. Last, if ever |

**Sequence:** 10 walk-ins (learn) → IG DM (scale) → one supplier signed by month 6 (leverage) → referral
loop (compound).

## 9.8 The verdict

| Tier | Definition | Probability |
|---|---|---|
| **T0 — Fails** | Never exceeds ~10 paying customers; abandoned within 18 months | **45%** |
| **T1 — Side income** | KD 300–800/mo net, 15–40 customers | **33%** |
| **T2 — Real owner-operator business** | KD 3,000–6,000/mo, 100–200 customers, 1–2 staff | **18%** |
| **T3 — Venture-scale** | KD 25,000+/mo, multi-country, self-serve | **4%** |

**Reasoning.** Build quality is clearly above average. **Execution risk on *building* is low — that is
not where this dies.** It dies on demand and distribution, and the repo is the evidence: no pricing, no
signup, no billing, no invoice, no customer-facing funnel. Effort went into the fifth ad platform and
none into the ability to take KD 25 from a human being.

**To be careful about what that proves:** the billing gap itself is one to two weeks of work (§9.6), so
it cannot on its own justify a 45% failure rate. What it is, is *evidence* — a codebase this carefully
built, with no way to charge anyone, indicates the product has not yet been tested against a paying
customer. **T0 sits at 45% because of demand and distribution risk** — a small market, a free incumbent,
and customers currently too busy to need you. The missing commercial layer is the symptom that makes
that risk visible, not the cause.

T3 at 4% is arithmetic, not pessimism: KD 25,000/mo at KD 25 ARPU needs **1,000 customers** — 33–67% of
every decor contractor in the country. (Even the KD 10,000/mo step needs 400, i.e. 13–27%.)
T3 requires abandoning either the country or the vertical.

### Top 5 reasons it fails
1. **No commercial layer.** The product cannot take money. This isn't a missing feature — it is evidence
   the business hypothesis has never met a real customer.
2. **Kuwait is too small.** You can win this market completely and still not have a company.
3. **Instagram is free and already won.** A website is a nice-to-have, and nice-to-haves churn at 6–8%/mo.
4. **The differentiated feature requires data entry he will never do** — and even when he does, two
   conversions a month cannot train any ad algorithm.
5. **Setup, content and support don't scale for one person.** The wall is at 50–60 customers, before
   KD 2,000 MRR.

### Top 5 things that most increase the odds
1. **Sell one site this month, for cash, before writing another line of code.** Walk into Jleeb with a
   laptop showing a template pre-loaded with *his* photos, scraped from *his* Instagram in 30 minutes.
   One paying customer teaches you more than this entire report.
2. **Ship billing in two weeks and sell annual prepaid.** It eliminates the worst operational cost, halves
   effective churn, and front-loads the cash you need for CAC.
3. **Sign one material supplier as a distribution partner by month 6.**
4. **Turn setup into a 30-minute assembly line** — a 5-question WhatsApp intake, a photo-drop link, and
   AI-drafted bilingual copy. **The `LText` shape is a perfect LLM target.** This is where your remaining
   engineering hours belong, not on a sixth ad platform.
5. **Re-pitch around the portfolio and bury the attribution engine.** Lead with the before/after slider on
   a phone: *"موقعك جاهز خلال ٤٨ ساعة — صورك، بالعربي، ورابط تحطه في البايو."* Never lead with an acronym.

### Three pivots worth serious consideration

**Pivot A — "Leads, not websites."** Build one consumer-facing property — a Kuwait decor marketplace —
rank it, run ads to it *yourself*, capture WhatsApp leads, and sell them at KD 5–15 per qualified lead or
KD 50–150 per closed job.
*This is the business the code was secretly built for:* the 60 templates become segmented landing pages;
the visitor-ID → stage → CAPI loop becomes **load-bearing**, because *you* are the advertiser, *you* mark
the stages, and you spend at a budget where Meta's optimiser can actually learn; churn stops mattering
because there is no subscription; the contractor understands the offer in one sentence with zero
onboarding. And **Mutlaa becomes a tailwind instead of a headwind** — 32,400 permit-holders are
*consumers looking for contractors*, and you'd be selling to the consumer side of that flood.
*Risks:* you become an ad buyer with working-capital exposure, and you must manage lead-quality disputes.

**Pivot B — "The template engine is the product; decor is one vertical."** 9,227 lines of a genuinely
good Arabic-first RTL engine with a phone-usable bilingual admin is a broader asset than 60 gypsum
templates. Clinics, nurseries, car workshops, catering, cleaning, gyms, tutoring centres, salons — same
shape: a portfolio, a WhatsApp button, an IG-bio link. **Ten verticals × 2,500 businesses turns a
KD 750k TAM into KD 7.5m without leaving Kuwait**, and makes Saudi/UAE a real T3 story.
*Cost:* you lose the "we understand gypsum" credibility. *Mitigation:* keep decor as the beachhead, prove
the playbook on 30 contractors, then clone it vertical by vertical.

**Pivot C — white-label to the Kuwaiti agencies.** They already charge KD 250–800 per site and have the
MOCI licence, the Arabic support staff and the collection relationships you lack. License the platform at
KD 5–8 per site per month. Lower ceiling, dramatically lower operational burden, monetises the engine
immediately — and it solves your legal-structure problem, because you'd be selling to three companies
rather than three hundred contractors.
---

# 10. Action plan

Ordered so that each phase unblocks the next. Effort: S = hours, M = days, L = weeks.

## Phase 0 — This week (before anything else)

| # | Action | Why | Effort |
|---|---|---|---|
| 0.1 | **Sell one site, for cash, to a real contractor** | Every item below is a guess until one person pays | M |
| 0.2 | `DATABASE_POOL_MAX=1` in Vercel | One env var; prevents a platform-wide outage (§4.3) | S |
| 0.3 | Default `seedDemo` to **false**; stop seeding testimonials; remove the Big Buck Bunny hotlink. *Note this alone does not clear §6.2 item 1 — `starterContent` still seeds a category-identical hero, tagline and CTA* | Fake reviews + a test video on a paying customer's site (§4.7) | S |
| 0.4 | Fix the `w=d+` regex typo | One character (§8.7) | S |
| 0.5 | Make template-preview CTAs inert or point at your real number | Your sales page links to a dead WhatsApp number (§4.8) | S |
| 0.6 | Branch protection on `main` + a promote-on-green step | CI currently cannot block a bad deploy (§4.6) | S |
| 0.7 | Enable **R2 object versioning** + 30-day noncurrent lifecycle | Do this before the first customer uploads a photo (§4.5) | S |

## Phase 1 — Before taking money (≈3–4 weeks)

| # | Action | Why | Effort |
|---|---|---|---|
| 1.1 | **Sentry via `src/instrumentation.ts` + `onRequestError`** | You are blind (§4.4) | S |
| 1.2 | **Make `getRequestSite` non-throwing** (static bilingual RTL holding page), plus a static `global-error.tsx` and `error.tsx` under `admin/` and `super/` | A customer's domain currently shows Next's unbranded English fallback — and note an `error.tsx` under `tenant/[host]/` cannot catch it (§4.4) | S |
| 1.3 | **Soft delete** — `sites.deleted_at`, excluded from lookups, 30-day purge | Removes an entire class of disaster (§4.5) | S |
| 1.4 | Fix the visitor-code oracle: HttpOnly companion secret; stop returning `created` | Unauthenticated lead hijack (§4.1) | M |
| 1.5 | Shared-state rate limiting + `x-vercel-forwarded-for` + a WAF rule | The multiplier on 1.4 (§4.2) | M |
| 1.6 | Content-version token on section forms, compared in the action **before** the patch is built; **leave the CAS retry loop alone** | Silent customer data loss (§4.10) | M |
| 1.7 | **Billing v1** — `paid_until` on `sites`, MyFatoorah KNET links, auto-pause on expiry, WhatsApp reminders | The pause machinery already works; wire it to a date (§9.6) | M |
| 1.8 | **`/pricing` page + "اطلب موقعك" form** on the platform home | Nobody can currently buy (§8.2) | M |
| 1.9 | Bot filtering in `src/proxy.ts` | Crawlers mint visitor rows and DB writes (§5.13) | S |
| 1.10 | HSTS header; strict CSP on `/admin` + `/super` | One line + one header (§5.9) | S |
| 1.11 | Make `PIXEL_SECRET_KEY` required in production | One missing env var = plaintext ad credentials (§5.7) | S |
| 1.12 | Uptime monitor on `/api/health` **and each customer domain** → **WhatsApp/SMS**, not email | You are the on-call rotation (§4.4) | S |
| 1.13 | Password reset (email, or a super-admin one-time link) | Your first support ticket (§4.9) | M |
| 1.14 | Write the **additive-only migration rule** into the README | Rollback trap (§5.3) | S |
| 1.15 | **Rehearse one full restore** and write down the elapsed time | An untested backup is not a backup | S |

## Phase 2 — Make the product sell itself (2–4 weeks)

| # | Action | Why | Effort |
|---|---|---|---|
| 2.1 | **Phone input inside the stage-mark form** | Highest-ROI marketing change; doubles match quality (§7.6) | S |
| 2.2 | **Canonical from the primary domain + 301 the subdomain** | Duplicate content across two hosts (§6.4) | M |
| 2.3 | **`noindex` the subdomain tier; make it an explicit trial link** | Scaled-content exposure + the documented quality-presumption contagion (§6.2–6.3) | S |
| 2.4 | **Only publish `?lang=en` when English is actually written** | Removes a whole class of duplicate content at once (§6.5) | M |
| 2.5 | `noindex, follow` the 60 previews; drop from sitemap; drop their broken hreflang | Thin duplicate content on the money domain (§6.6) | S |
| 2.6 | Remove `/privacy` from the sitemap; paused site → 503; `Disallow` on `*.vercel.app`; `www`→apex 308 | Small, cheap, each actively costing you (§6.10) | S |
| 2.7 | Platform homepage: Arabic targeted title/description, `metadataBase`, absolute canonical, OG image, `Organization` + `WebSite` schema | The page that must acquire contractors is untargeted (§6.10) | S |
| 2.8 | **GSC Domain property on `decokuwait.com`** (one DNS TXT covers all subdomains) + verification fields in the admin for custom domains | Neither you nor tenants can verify anything today (§6.11) | M |
| 2.9 | **Unsaved-change guard** in the admin | The most likely reason someone gives up and calls you (§8.6) | S |
| 2.10 | Fix `ContrastCheck`'s form selector; floor owner-set `text` through `readableOn` | The only guard a customer sees, and it has never run (§8.4) | S |
| 2.11 | Arabic heading line-height floor ≥1.35 | The largest element on every page, in the primary language (§8.5) | S |
| 2.12 | `createImageBitmap(file, { imageOrientation: "from-image" })`; reject HEIC with an Arabic message; cap video size | One line prevents irreversible photo rotation (§6.8) | S |
| 2.13 | Meta Graph version → env var with a current default | **Hard deadline: 2027-01-21** (§7.7) | S |
| 2.14 | Smart-mode fallback sends **nothing**, not everything; amber warning in the UI | Inflates conversions across every ad account (§7.5) | S |
| 2.15 | Stop the green "sent" badge for Google on stage events; fix X's `xReady()` | Both actively mislead the owner (§7.4, §7.7) | S |
| 2.16 | Arabic consent notice gating the pixel scripts; extend the default privacy text | Platform terms + DPPR (§7.8) | M |
| 2.17 | Delete the `document.cookie` rewrite in `VisitorCookie` | Hands `dk_vid` to Safari ITP's 7-day/24-hour cap (§7.7) | S |

## Phase 3 — The SEO surface (4–8 weeks) — where the compounding is

| # | Action | Why | Effort |
|---|---|---|---|
| 3.1 | **Project detail pages** — `projects.slug`, `/projects/<slug>`, `ImageObject` + breadcrumbs, in sitemap with real `lastmod` | **The single biggest SEO win available** (§6.1) | M |
| 3.2 | **Image pipeline** — 480/1080/2000 derivatives in AVIF/WebP; extend `responsiveSrc` to R2; store intrinsic width/height | Largest CWV defect; invisible in preview (§6.8) | M |
| 3.3 | **Editable `alt` text** with a good auto-generated default | Google Images is a real channel here and it is forfeited | M |
| 3.4 | **GBP support** — profile URL + place id in `sameAs`, structured NAP, map rendered in all 4 contact layouts | Biggest missing piece; Map Pack rank is independent of site authority (§6.11) | M |
| 3.5 | **Structured hours → `openingHoursSpecification`**; split address; lat/lng → `geo`; `priceRange`; real `areaServed` | The current hours property is unparseable (§6.7) | M |
| 3.6 | **Service pages** from `services.items` + `Service` schema | 6 more indexable pages per tenant | M |
| 3.7 | **Area pages, gated on ≥1 real project in that area** | Ranks locally *and* stays out of doorway-abuse territory (§6.11) | M |
| 3.8 | **Cache tenant HTML** (`use cache` + `cacheTag('site:'+host)`), switching the 31 `revalidatePath` calls to `revalidateTag` | Changes the cost curve; per-site tags stop one save flushing every tenant (§5.4–5.5) | M |
| 3.9 | Move `?lang=en` → `/en/` path prefix | The one structure Google labels "Not recommended" (§6.5) | M |
| 3.10 | Reduce browser pixels to source-platform + GA4; `lazyOnload` | ~400 KB and ~500–900 ms of INP risk (§6.9) | M |
| 3.11 | **Review-request automation** on `order_complete` → WhatsApp | Stages, phones and WhatsApp all already exist; this is wiring | M |
| 3.12 | **Bulk upload + non-reloading reorder** | 20 photos currently = 20 cycles; reordering item 10 = 9 reloads (§8.6) | M |
| 3.13 | **Lead notification** when a WhatsApp click arrives; an "unhandled leads" filter | The core promise of a lead-gen product (§8.2) | M |

## Phase 4 — Scale (ongoing)

`listSites()` projection + pagination (§5.1) · migration double-apply fix (§5.2) · `deletion_queue`
(§5.6) · visitor-code width before 200k/site · retention cron (§5.14) · explicit column lists (§5.15) ·
`__Host-` cookie + idle expiry (§5.10) · CSRF on upload routes (§5.11) · upload quotas (§5.12) ·
full vitest suite in the Postgres CI job · `retention-days: 7` + `if: failure()` on the 515 MB shots
artifact · Dependabot/Renovate · the four env vars missing from `.env.example` · an `OPERATIONS.md`.

---

# 11. Answers to your specific questions

**"کون سی چیزیں مزید ہونی چاہئیں؟" (What more should there be?)**
In order: billing and a way to buy (§9.6, §8.2) · project/service/area pages (§6.11) · Google Business
Profile support (§6.11) · lead notifications · password reset and email · bulk upload · an image pipeline
· error tracking · a supplier-partnership mechanism.

**"کون سی مِس ہیں یا نامکمل ہیں؟" (What is missing or incomplete?)**
The README's claims are all true — nothing promised is undelivered. What is missing is everything
*around* the product: the commercial layer, the operations layer, and the SEO surface. Partially built:
tenant analytics (no time series), multi-user (role column never read), media handling (no server side),
the work queue (a WhatsApp click doesn't advance a stage and can't be filtered).

**"کون کون سے بگز ہیں؟" (What bugs are there?)**
**Live today, verified in the code:** the visitor-code oracle, which also *writes* rows at guessed codes
(§4.1) · lost-update on list sections (§4.10) · `ContrastCheck` has never run (§8.4) · owner text colour
bypasses the contrast engine (§8.4) · the `w=d+` regex typo (§8.7) · EXIF rotation loss (§6.8) · HEIC
silently broken with no error (§6.8) · content images ship `alt=""` (§8.4) · `/privacy` is `noindex` yet
submitted in the sitemap (§6.1) · paused sites are soft-404s whose `noindex` Google cannot read (§6.10) ·
broken preview hreflang (§6.5) · X reports failure on every event (§7.7) · unparseable `openingHours`
(§6.7) · the before/after slider runs backwards in Arabic (§8.5) · raw ISO dates on the public site
(§8.5) · indefinite admin lockout with no reset path (§5.8 + §4.9).

**Latent — correct today, breaks under a specific future condition:** connection exhaustion (§4.3, under
load, and see the caveat there) · migration double-apply (§5.2, the first non-idempotent migration) ·
cache-flush blast radius (§5.4, once caching is enabled) · `PIXEL_SECRET_KEY` rotation wiping tokens
(§5.7) · empty `<h1>` (§8.3 — reachable only if an owner clears a seeded title, since both provisioning
paths fill it and the field is `required`).

**"گوگل SEO کا انتظام کیسے ہو سکتا ہے؟" (How can Google SEO be arranged?)**
§6 in full. The short version: the technical hygiene is good and the *architecture* is the problem. One
page per tenant cannot rank. Fix the duplicate-content default, give projects URLs, push customers onto
their own domains, and build the Google Business Profile flow — because in this niche **GBP beats the
website**, and Google's own AI guidance now names GBP as the lever for local AI answers too.

**"یہ کیسا بزنس ہے؟" (What kind of business is this?)**
A productized web agency on a SaaS substrate (§9.2). The customer is buying legitimacy and a WhatsApp-able
portfolio, not leads — whatever the pitch says.

**"کامیابی کے کتنے چانسز ہیں؟" (What are the chances of success?)**
§9.8: 45% fails · 33% side income · 18% a real owner-operator business · 4% venture-scale.

**"اگر بہت کچھ برا ہے تو سب mention کرو" (If much is bad, mention all of it.)**
Done — §4 through §8 hold every finding, including the ones that are uncomfortable: the headline feature
does not do what it is sold as doing on the platform where your customers spend; there is no way to
charge anyone; a paying customer's site ships with invented reviews and a Big Buck Bunny video; and if
anything breaks you will learn about it from a phone call.

**But the counterweight is real and should not be lost:** the engineering is better than most funded
startups. 278 passing tests, zero dependency vulnerabilities, 60 genuinely distinct templates, RTL
discipline better than most RTL codebases, a real WCAG engine, correct conversion payloads, and a
security posture with no IDOR anywhere. **Nothing in this report requires a rewrite.** The hard part —
building it — is done and done well. What remains is mostly small, and it is the part that decides
whether the business exists.

---

# 12. Method, confidence, and corrections made

## How this was produced
Nine specialist agents audited in parallel with no knowledge of each other's findings, plus a dedicated
external-research pass to verify 2026 Google guidance and Kuwait market data. Every headline claim was
then **independently re-verified by the coordinator against the source** before entering this report.

## Corrections made during verification

Recorded in full because they affect how much weight to give this document.

1. **My own briefing error.** I told the marketing agent the attribution engine was "clearly the most
   engineering-expensive part". The business agent measured it and disproved it: 880 LOC, 3.7% of the
   codebase, against 9,227 for the template engine. **The criticism of that feature is therefore about
   product fit, not wasted effort** — and de-emphasising it costs almost nothing. This *softens* the
   criticism, and the report reflects that.
2. **An overstated image finding.** The architecture agent reported that customer photos ship at full
   resolution. They do not — `Uploader.tsx:17-34` downscales on the device to 2000px. The finding was
   rewritten around what is actually true: one size for all devices, no `width`/`height`, no modern
   format. The cost story for images is genuinely *good* (zero Vercel optimization units, free R2
   egress); only the mobile-performance story is bad.
3. **My own false positive.** I recorded `next/image` as "used once". The single grep hit was the proxy
   matcher string `_next/image`, not an import. **It is used zero times.**
4. **Two wrong file paths** in agent reports — `VisitorCookie.tsx` and `ContrastCheck.tsx` — corrected
   here. Both findings themselves were confirmed.
5. **Four agents independently reported the in-memory rate limiter**, and three reported the 900k visitor
   code space with different arithmetic. These are merged as single findings; the differing collision
   numbers measure different things (per-allocation probability vs. birthday collision) and are both
   correct.
6. **Two SEO recommendations were revised by the external research**, not by me: FAQPage rich results
   are fully dead rather than merely restricted (so: keep the markup, invest nothing more, never promise
   FAQ stars), and Arabic URL slugs are an *operational* trade-off rather than an SEO one — Google
   actually leans toward native-language slugs. The recommendation still favours Latin, but for a
   different and honest reason: WhatsApp.
7. **Common 2026 claims that are false and were kept out:** "LCP tightened to 2.0s in March 2026"
   (web.dev still says 2.5s, no such post exists) · "INP promoted to an equal ranking signal in March
   2026" (no such post) · "67% of Arabic product searches use dialect" (unsourced folklore) · "add
   FAQPage schema for AI Overviews" (contradicted by Google's own guide) · "70% of Gulf searches are in
   Arabic" (traces only to agency blogs with no methodology).
8. **A claim I got wrong and have retracted.** An earlier draft of §6.2 argued that Google's August 2026
   site-reputation policy change made the subdomain architecture more dangerous. **That was incorrect.**
   The policy applies only where third-party content trades on *"that host site's already-established
   ranking signals"* — and `decokuwait.com` has none yet, so the precondition is unmet. The real and
   documented risks are **scaled content abuse**, **doorway abuse**, and the **quality-presumption
   contagion**, which is a different and better-evidenced mechanism. The recommendation (noindex the
   subdomain tier, push customers to their own domains) is unchanged; the *reason* for it is now correct.
9. **An overstated claim, softened.** An earlier draft said GBP "outranks the website as a lead source
   and it is not close." **The evidence does not support that.** The widely-quoted map-pack click figures
   are untraceable, and the only primary study with a stated methodology points the other way (organic
   50.8% vs local pack 32.3%, though it is from 2018 and US-only). §6.11 now argues for GBP on grounds
   that hold — Map Pack position is largely independent of website authority — and explicitly declines to
   quote a ratio.
10. **Two keyword errors, corrected from live Google Suggest data.** `قواطع الوميتال` is near-dead and
    bare `قواطع` means electrical breakers; and `اسعار جبس بورد` is a pan-Arab query dominated by
    Egypt/Saudi, not a Kuwait-localised one.
11. **A finding that improves the outlook and was added, not removed.** Live checks showed the ranking
    incumbents are far weaker than assumed — one ranks at under 12 months old, one with no `<title>` tag,
    one while returning HTTP 000. The original framing ("four incumbents already rank") implied a
    difficulty that does not exist.

### Pass 3 — adversarial fact-check of §6 and §7

A dedicated checker was told to break these sections and verified 50+ citations. **§7 held completely**
— every named claim about the attribution engine survived, including the `eventTime` default, the
unread `gclid`, the smart-mode fallback, the separate phone form, the Meta v21.0 sunset date, and the X
empty-event-map failure. §6's code claims held at ~95%. Errors found and now fixed:

12. **A false claim about image formats.** I wrote *"No WebP/AVIF — photos are forced to JPEG."*
    **Wrong.** `Uploader.tsx:33` preserves format — PNG stays PNG and WebP stays WebP; GIF and SVG skip
    re-encoding entirely. Corrected to the accurate statement: nothing ever *converts* to a modern
    format, so a JPEG stays a JPEG.
13. **Two market numbers were wrong.** Kuwait does **not** have the highest Instagram penetration in the
    Arab world — it is ~59.4%, below the UAE's ~71%. And "Skip Yandex (3.64%)" cited **Bing's** share;
    Yandex is 0.48%. Both corrected.
14. **The policy changes I cited are not recent, and I had over-claimed their novelty.** "Doorway abuse"
    was renamed in Google's **September 2024** refresh, not in 2026 — the 2026-08-28 stamp is just the
    page's current last-updated date. §6.2 no longer presents any of this as a recent escalation.
15. **Smaller citation and precision fixes:** the canonical is assigned at `page.tsx:45`, not in the
    `:26-29` helper · the tenant `<title>` claim is true on both provisioning paths, so both are now
    cited · the three-URL sitemap is conditional on the language toggle (on by default) · `images.domains`
    has been deprecated since **Next 14**, not 16 · a bad `quality` value logs a warning in development
    and is only silently coerced in production · Google's LocalBusiness image guidance is "min. 50,000
    pixels", not the 696px figure from the Article docs · **`hasMap` is not a property Google documents
    for LocalBusiness**, so it was removed as a recommendation · the `.com.kw` price and lead time could
    not be verified and are now marked as estimates.

## Confidence levels

**High — verified by execution or by reading the code twice:** every §4 blocker · all §5 findings ·
the code-level half of §6 · §7.1–7.7 · §8 · the LOC distribution and the absence of billing/email/error
tracking.

**High — verified against current official documentation:** the Google policy, structured-data, CWV and
market-share claims in §6.

**Medium — reasoned estimates, not measurements:** §9's TAM/SAM/SOM · CAC and churn · unit economics ·
the probability tiers. Treat these as a framework to argue with, not a forecast. Two honest caveats:
the **KD 15–17 loaded contribution** that drives every downstream number is itself an estimate of your
own hourly cost, not a derived figure; and all headline economics are computed at **6% churn**, while
the report's own recommendation (annual prepaid) targets 3% — at which the numbers improve substantially.

**Low — informed guesses, labelled as such:** §7.3's "under 10% of customers clear all five
prerequisites" and §7.6's EMQ score ranges are judgement calls based on how this data flows, not
measured values. They are directionally sound and should not be quoted as data.

**Explicitly uncertain, flagged rather than hidden:**
- The Arabic-script vs Latin-script search split in Kuwait. Arabizi is documented in *messaging*, not
  demonstrably in *search*. **Do not build pages for Arabizi spellings** — validate with Keyword Planner
  and your own GSC data first.
- Social vs search as the lead source for decor. The direction is well supported; no rigorous study
  exists. The framing survives either way: Instagram is discovery, Google + GBP is high-intent capture.
- AI Overview prevalence on local service queries — third-party estimates range from 7% to 80% and are
  unusable. Measure your own via GSC's generative-AI reports.

## One open verification task
Confirm that the production edge **overwrites** rather than appends to client-supplied
`X-Forwarded-For` / `X-Forwarded-Host`. On Vercel it does; elsewhere it does not. Tenant resolution, the
login throttle and all three public rate limits rest on this assumption, so it should be asserted rather
than inherited.

### Pass 4 — adversarial fact-check of §3–§5, §8.7 (technical)

A checker verified 60+ citations, read the Next 16 docs *and* the compiled runtime, and re-ran the test
suite (278 pass, confirmed independently). It found errors that changed three findings:

16. **§5.4 was flatly wrong and has been rewritten.** I claimed `revalidatePath("/", "layout")` targeted
    the wrong route tree and named the tenant's route zero times. **It is Next 16's documented global
    purge.** The docs give exactly that call under "Revalidating all data", and
    `server/lib/implicit-tags.js` seeds **every** page's tags with the literal `/layout` unconditionally
    — so every tenant route carries it. Publishing works. The finding is now about *blast radius*, not
    correctness, and was downgraded accordingly. (The raw "40 references" was also a grep count: there
    are **31 calls** plus 9 imports.)
17. **§4.10's mechanism was wrong**, though the blocker itself is real. The CAS is not at fault — the
    hash is read and compared inside the same attempt, so the retry loop essentially never runs, and the
    action reads fresh content, not a page-load snapshot. The stale data is in the **submitted form's
    hidden row fields**. A reader following the old advice would have removed the retry loop and fixed
    nothing.
18. **§4.4's proposed fix could not catch the failure it traced.** An `error.tsx` under `tenant/[host]/`
    does not wrap the root layout above it; only `global-error.tsx` can, and that must be a Client
    Component with no DB access — so it cannot render the tenant's own branding. The fix now leads with
    making `getRequestSite` non-throwing. The quoted error string was also stale Next 14/15 text; Next
    16 renders "This page couldn't load".
19. **§4.1 was understated.** A missed guess does not merely answer — `input.fresh` is never passed, so
    the guessed code is **inserted as a new visitor row**. Added.
20. **Smaller technical fixes:** `users.ts` is 181 lines, so §5.15's cited line numbers were impossible
    (corrected to `:47,54,59,172`) · §4.7's WhatsApp-number bullet was wrong, since provisioning
    deep-merges the operator's required number over the demo one (the other four bullets stand, and
    §4.8's preview claim is unaffected) · §5.11's CSRF is blocked by `SameSite=Lax` from a true
    cross-site origin and narrows to a sibling-subdomain attacker · §8.7's regex bug is real but its
    impact was overstated, since `responsiveSrc` still emits a correct srcSet for those URLs · §3's
    TypeScript counts were wrong (0 `any` not 1; 31 non-null assertions not 7, several of them env
    assertions) and the TODO count is **0**, not 6 · §4.6 omitted that CI *does* already run on
    `pull_request`, so only branch protection is missing — "decorative" was harsher than the evidence.

### Pass 5 — adversarial check of §9–§11 and whole-report consistency

21. **§9.1's "both halves required" was false and contradicted §6.5.** `ui.tsx:161` marks only the
    Arabic input `required`; English is optional and `lt()` falls back. The report was simultaneously
    denying and relying on the same behaviour. The COGS argument is corrected and softened.
22. **Arithmetic errors, all corrected:** LTV is **KD 267**, not 287 (16 ÷ 0.06) · 400 customers is
    **13–27%** of a 1,500–3,000 universe, not 16–27% · T3 was justified with the 400-customer figure
    belonging to KD 10,000/mo, when KD 25,000/mo needs **1,000** · the template engine is **over 10×**
    the marketing engine, not 12× (12× silently compared against marketing alone) · SOM used KD 30 ARPU
    while §9.5 used KD 25.
23. **The supplier channel was mis-modelled** — booked as a one-off KD 75 CAC when §9.7 proposes 25–30%
    *recurring*. Rescored to ~2.0×, marginal rather than "works", with the implication stated.
24. **Consistency fixes:** §3's "none of these should be fixed" was too absolute and is now scoped ·
    §3's `Tabs` praise now acknowledges the §8.4 focus gap · a §3 cross-reference pointed at §7.3
    instead of §6.8 · §4's "do not take paying customers" header now reconciles explicitly with §10's
    "sell one site this month" · §11 filed latent issues as confirmed and now separates them.
25. **A finding that was too soft and has been raised:** empty `alt` on content images is a **WCAG 1.1.1
    Level A failure**, not just an SEO loss. It was filed only in §6.8; it is now in §8.4 as well, and
    the §2 accessibility grade moved **B → C+** to reflect it. The §5.8 lockout and §4.9 missing password
    reset also now state their **joint** outcome: a customer can be locked out indefinitely with no
    self-service recovery.
26. **Sourcing corrections:** Mordor's figure is USD **15.40**bn · the 32,400 are plot owners holding
    permit-completion certificates, not families mid-construction · the KD 4.0/m² gypsum rate is a
    component/labour rate, and published Kuwaiti turnkey quotes run KD 10–16/m² — both are now shown.

### Pass 6 — final verification of the corrections themselves

A final checker re-verified every Pass 4 and Pass 5 correction against source and the Next 16 docs.
**All of them held** — the substance was right. But it caught a **process failure worth naming: seven
corrections were recorded in §12 and never actually applied to the body**, so the report was asserting
retracted claims in one place while retracting them in another. Two of those were in the §10 action
plan — the part a developer actually works from — and would have caused real harm:

27. **§10 item 1.6 still said "stop retrying array patches"** — the exact advice §4.10 had retracted.
    Following it would have deleted a correct, well-commented concurrency guard and fixed nothing.
    Now: add the form-level version token, **leave the CAS alone**.
28. **§10 item 1.2 still prescribed a branded RTL `error.tsx` for the tenant tree** — the thing §4.4
    had just established cannot work, and it omitted the one step that does. Rewritten.
29. **Five other retracted claims were still live in the body** and are now fixed: §3's TypeScript
    counts (actually **0** `any`, **0** TODO markers, 31 non-null assertions) · §4.7 and §0 still listed
    the demo WhatsApp number, which provisioning overwrites with the operator's required one · §0 still
    quoted the stale "Application error" string · §6.2's heading still said "why it just got more
    dangerous" · §9.1 still said 12×.
30. **A new reader-harm item, verified in source:** turning `seedDemo` off does **not** clear the
    duplicate-content problem. `starterContent` (`provision.ts:33-43`) still seeds a
    category-identical hero, tagline, `seo.description` and the entire CTA block. §6.2, §8.3 and §10 0.3
    now say so explicitly — otherwise a reader would ship the fix and believe the risk was gone.
31. **A second reader-harm item:** §5.10's `__Host-` rename would have **broken local development**,
    because the prefix requires `Secure` unconditionally while `session.ts:23` sets `secure: IS_PROD`.
    The fix is now ordered correctly.
32. **Remaining precision fixes:** the supplier channel's payback was still on the old contribution
    (~8 months, not ~5) · §9.3's SAM used KD 30 ARPU while everything else used KD 25 · Phase 1 was
    labelled "≈1 week" while containing six multi-day items including billing, which §9.6 alone sizes at
    one to two weeks (now 3–4 weeks) · `img.ts` is 12 lines, so `:14` did not exist (`:11`) · §8.7's
    impact was overstated, since `responsiveSrc` still emits a correct srcSet · §4.6 omitted that CI
    already runs on `pull_request`, so only branch protection is missing · §5.11 now states that
    `SameSite=Lax` narrows the attack to a sibling subdomain · two sentence fragments left by earlier
    edits in §9.3.

### Pass 7 — coordinator's own verification of the least-checked material

I re-verified §5.1, §5.2, §5.3, §5.6, §5.12, §5.13, §5.14 and §8.8 directly against source, and swept
§12 against the body.

33. **§4.5 and §5.6 described the delete ordering imprecisely.** I wrote that the rows are deleted
    before the cleanup list exists. They are not — `listMediaKeys`, `listDomains` and
    `listOrphanMemberIds` all run *before* `deleteSite`, so the list is in memory. The real failure
    mode is a **crash partway through the loop**, after the rows are gone. Both sections now say that.
    The blocker is unchanged; its mechanism is now accurate.

34. **§7.8's Kuwait legal position was verified and sharpened.** Kuwait has **no general data protection
    law** at all; the DPPR (CITRA Administrative Decision No. 26 of 2024, replacing No. 42 of 2021)
    began broader and was narrowed to apply **exclusively to CITRA-licensed telecom and internet
    providers**. The original wording was right that this platform sits outside it, but understated how
    clear-cut that is — and the correct conclusion is that **the ad platforms' own terms, not Kuwaiti
    regulators, are the operative risk.** §7.8 now says so.

**Verified correct, no change needed:** the migration lock ordering (`_migrations` created outside the
lock, `pending` computed before it) · only four forward migrations with no down files · `clearFailures`
runs solely on successful login, so `login_attempts` is never pruned · `vercel.json` has no `crons` ·
no `rateLimit` anywhere in `/api/upload` and `MAX_VIDEO_BYTES` is 300 MB · no bot detection of any kind
in `src/proxy.ts` · and all seven entries of §8.8's "do not fix these" list, including that `next/font`
emits real family names (so the admin font resolves) and that all 120 gallery thumbnails exist on disk.

**§12-against-body sweep: all 32 prior corrections confirmed applied, and a residue search for every
retracted claim found zero hits outside this log.**

### Passes 8 and 9 — two consecutive clean passes, no changes

**Pass 8** re-verified every load-bearing code claim from scratch: zero `error.tsx`/`global-error.tsx`;
zero `next/image` imports; zero `beforeunload`; `prepare: false` present; `DATABASE_POOL_MAX || 3`;
`GRAPH_VERSION = "v21.0"`; 60 templates across the four registries; 15 test files; and no billing,
email or error-tracking dependency in `package.json`. *(One near-miss worth recording: a grep for
`resend` matches this codebase's "resend signal" feature, not the Resend email service — the absence
claim holds.)* **No changes.**

**Pass 9** checked structure and coherence: all **68** `§x.y` cross-references resolve to real
sections; the §2 grade table matches every section it summarises; §4 contains exactly the ten blockers
its header promises; the §10 plan's 52 items each cite a real finding. **No changes.**

**Two consecutive passes produced no change to any finding, severity, citation or recommendation.**
Verification is therefore complete. Nine passes were run in total; 34 corrections were made along the
way, including three findings of mine that were wrong and were deleted or rewritten.

*(The per-agent working notes and the raw checker findings have been deleted now that this report is
final, as instructed. Everything they established is carried above — every finding in this document
cites its own file:line or source, so nothing depends on them.)*
