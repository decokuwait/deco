# Template 101 — the eight reported problems

Five specialist agents worked in parallel against a fixed contract; the coordinator closed the gaps
between them. Everything below was verified in a real browser, not inferred from the code.

## Gate

| | |
|---|---|
| Lint · Typecheck | 0 errors, 0 warnings |
| Tests | **911 passing / 31 files** (was 627) |
| Build · Smoke · E2E | all pass |
| Strict screenshot sweep (101) | 0 browser errors, 0 overflow, 0 controls off-viewport |
| Mobile gate, 8 device widths × 2 locales | **0 failures** |

---

## 1. Home did not scroll to the top

`id="top"` was on the **sticky** header. A sticky element is permanently in the viewport, so the browser
treated the anchor as already in view and did nothing — and a *cold* load of `/#top` landed at **8586px,
near the bottom of the page**, because the browser chases a target that moves down with every scroll step.

Fixed with a zero-height, static anchor before the bar (no JavaScript, so smooth scrolling, reduced
motion, the back button and RTL all keep working). Two further causes were found and fixed:

- Inside a template preview, `/#top` is root-relative and navigated **away** to the platform home page.
- A root-relative `/#about` resolves against the origin, so from a URL carrying a query — **every Meta and
  TikTok ad click, which all arrive with UTM parameters** — it names a different document and the browser
  did a **full page reload instead of scrolling**. Section links are now bare fragments on the home page
  and absolute only on the inner pages, where the section genuinely is elsewhere.

Also: `scroll-behavior: smooth` was set with no `scroll-padding-top`, so every other anchor landed
*underneath* the sticky header. Now offset correctly — including for `NavSplit`, the one variant with two
stacked bars (100px/116px), which lifts the offset for itself on the 9 templates that use it.

## 2. Too much space between the badge and the navbar

Top padding was tied to bottom padding, so the badge sat under a nav that already has its own height.
Decoupled in every hero whose first child is a badge. Measured: **60px → 24px** at 320/360/390/430,
while desktop keeps its breathing room.

## 3. Not mobile-first or Arabic-first

Audited by driving a real browser at **320, 360, 375, 390, 412, 430, 768 and 1280**, in Arabic and then
English, measuring rather than reading.

- Headline **36px → 25.6px** on phones, so an Arabic headline wraps to two lines instead of four.
- **The WhatsApp CTA moved above the fold** (y≈390 at 320–430; it was below it at 360).
- Tap targets: the `md` button was **40px** — under the 44px minimum, and the size the WhatsApp and call
  buttons use. Floored at the source rather than at each call site. Phone and e-mail links went 24px → 44px.
- Three headings were still set at a Latin 1.2 (1.111 above `sm:`) against the 1.4 Arabic floor, where the
  descenders in جاهز collide with the line beneath.
- `ProgressStepper` **overflowed its container on a phone** (a 650px rail inside a 320px viewport), hidden
  by `overflow-x: clip`.
- A permanent gate now guards all of this: `tests/mobile-viewports.ts` fails on overflow, a CTA below the
  fold, sub-44px conversion controls and Arabic headings under the floor.

**Worth knowing:** on this codebase any `scrollWidth === clientWidth` overflow check proves nothing —
`globals.css` clips on both `body` and `.tpl`, so overflow is masked, not prevented.

## 4. Multiple hero images now rotate every 3 seconds, and hold pauses

New `HeroRotator`: 3000ms per slide with a 700ms cross-fade.

**A hold is distinguished from a scroll** by dwell, not by capture: `pointerdown` only *arms* a 120ms
timer, and >10px of travel — or a `pointercancel`, which is the browser saying it has taken the gesture to
pan the page — disarms it. It never calls `preventDefault` or `setPointerCapture`, so **scrolling always
belongs to the page**. Verified in a browser: a 4.2s hold froze the slide through a full tick, release
resumed it, and a drag scrolled the page while rotation continued.

Also pauses on hover, on focus, in a background tab, and under `prefers-reduced-motion` (which shows the
first picture and never moves). A real pause button and one dot per slide, keyboard reachable — auto-moving
content with no way to stop it is a WCAG 2.2.2 failure. Slide 0 remains the only image in the server
markup, so the LCP is unchanged.

A bug found only by testing the gesture: **every hero paints a gradient over its picture**, and none had
`pointer-events-none` — so the press landed on the gradient and never reached the rotator. Fixed in seven
heroes.

## 5. The mobile navbar

Rebuilt per nav variant rather than one design imposed on all seven: **six panel geometries** — end-edge
drawer, inset framed card, floating sheet, top curtain, quiet full-screen, frosted glass — each painted in
its own template's pattern, radius and tokens, so 101 is ivory + Sadu + bronze and 106 is charcoal + gold.
It animates out as well as in, compacts its rows on short screens so an iPhone SE shows every link plus
the CTA without scrolling, and the WhatsApp button went **40px → 52px**. `NavCentered` had no drawer CTA
at all. The existing focus trap, scroll lock, Esc handling and portalling were kept and re-verified.

## 6. The visitor ID is gone from the front end

`VisitorChip` deleted and removed from all **15** places (7 navs, 4 footers, 2 heroes), along with the
`showVisitorId` setting, its admin toggle and its strings. **The ID still travels inside the WhatsApp
message** — that is the product's core feature and is asserted by a test.

## 7. Hero images did not appear on desktop

`HeroSplit` read `hero.imageUrl` and **never looked at `hero.images`** — so for an owner who only used
"add images", the hero was an empty grey box. The problem was wider than reported: six other heroes used a
helper that falls back to the *first* image and **silently dropped the rest**, so "add multiple images"
was broken in seven of ten heroes. All ten now honour it, asserted per variant by a test.

## 8. Image ratios for every slot, on every device

A ratio contract (`src/templates/ui/ratios.ts`) replaces the hand-written `aspect-[…]` each component used
to invent. Every slot declares one shape, mobile-first, with a **`max-[380px]:` band** for the 320–380px
phones where a tall box first pushes the CTA below the fold. **22 image slots across 40 components** were
converted.

Two of these matter for correctness rather than looks:
- **Before/after halves must share one ratio**, or the slider reveals a mismatch as it wipes.
- They must also share one **focal point**, or the same room is cropped from the top on one side and the
  bottom on the other.

**A broken chain was found and fixed at its source:** migration 0008 added the `focal` column and the admin
had been saving to it, but the database mapper never read it back — so the 3-position focal picker was
**dead end to end**, and no amount of template work would have fixed it.

Verified against deliberately mismatched images: in the before/after section, sources of **608×413,
608×342, 608×912 and 608×810** — four different orientations — all render in identical **594×396** boxes,
subjects intact, grid rows dead even.

---

## Found along the way, outside the eight

- **The consent bar was painted over the floating WhatsApp button** (`z-60` over `z-40`) and ate **129px —
  23% of a 320px screen**. Its dismiss button was 66×36, it had no safe-area padding, and it was the one
  element ignoring design tokens: a white slab across the foot of the dark templates. Now ~56px, tokenised,
  44px targets, and it lifts the bubble clear.
  *(The first version of that fix was wrong: it published the height as a CSS variable on the bar itself,
  but custom properties inherit **down** the tree and the bubble is a sibling — so it still overlapped. A
  browser check caught it; it is now set on the document root.)*
- The floating WhatsApp button sat at `bottom-5`, putting the lower 14px of a 56px conversion button
  **under the iOS home indicator**.
- `HeroSplit`'s decorative blocks carried `-z-10` with no stacking context, so they painted **behind the
  page background** — invisible in all six templates using that hero.
- `HeroArch`'s half-circle frame was **eating two of the rotator's control dots**.

## Deliberately not changed

The collage heroes (cards, centred, gallery) do not rotate: all their pictures are on screen at once, and
cross-fading one cell of a mosaic reads as a glitch. Footer nav and legal links stay at 24px — the WCAG 2.2
floor — since they are not conversion actions. The long one-column project grid on phones is recorded as a
warning with measurements rather than restructured.
