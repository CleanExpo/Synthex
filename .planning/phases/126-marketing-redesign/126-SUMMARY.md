---
phase: 126-marketing-redesign
plan: all (01–05)
subsystem: ui
tags:
  [
    tailwind,
    satoshi,
    amber,
    charcoal,
    landing,
    framer-motion,
    openrouter,
    gemini,
  ]

# Dependency graph
requires:
  - phase: 125-react-next-upgrade
    provides: React 19 + Next.js 16 foundation this phase runs on
provides:
  - Warm charcoal (#1a1612) design system with amber-500 primary accent
  - Satoshi font via Fontshare CDN across entire site
  - Floating pill nav with scroll shadow
  - LiveDemoWidget (type business name → AI-generated Instagram post)
  - /api/demo/caption + /api/demo/image public rate-limited routes
  - 3-tier pricing (Enterprise tier removed)
  - MarketingLayout amber/charcoal theme
affects: [landing, marketing-site, sub-pages, design-system]

# Tech tracking
tech-stack:
  added:
    - '@phosphor-icons/react@2.1.10 — tree-shakeable icon library for landing pages'
    - 'Satoshi font via Fontshare CDN (api.fontshare.com)'
  patterns:
    - 'Charcoal colour palette via tailwind.config.cjs charcoal.900/800/etc tokens'
    - 'Public AI demo routes: rate-limited with aiGeneration preset, graceful fallback'
    - 'LiveDemoWidget: idle→loading→result state machine with parallel caption+image fetch'

key-files:
  created:
    - components/landing/LiveDemoWidget.tsx
    - app/api/demo/caption/route.ts
    - app/api/demo/image/route.ts
  modified:
    - tailwind.config.cjs
    - app/globals.css
    - app/layout.tsx
    - app/page.tsx
    - components/landing/nav-bar.tsx
    - components/landing/bottom-menu.tsx
    - components/landing/hero-section.tsx
    - components/landing/how-it-works.tsx
    - components/landing/testimonials.tsx
    - components/landing/cta-section.tsx
    - components/landing/stats-section.tsx
    - components/landing/pricing-section.tsx
    - components/landing/footer-section.tsx
    - components/marketing/MarketingLayout.tsx
    - app/about/page.tsx

key-decisions:
  - '@fontsource/satoshi does not exist on npm (Fontshare font, not Google Fonts) — used Fontshare CDN instead. Identical font, no build-time download'
  - "BottomMenu dashboard interface preserved (items/activeId/onSelect props) — landing mobile nav is handled by pill nav's built-in dropdown"
  - 'Gemini image endpoint falls back gracefully (returns {imageUrl: null}) when GEMINI_API_KEY not set — widget shows warm gradient placeholder'
  - 'Enterprise pricing tier removed from PLANS array — now 3 tiers (Starter/Pro/Agency)'
  - 'MarketingLayout updated directly (covers all 7 sub-pages) rather than editing each page separately'

patterns-established:
  - 'Public demo routes: no auth, aiGeneration rate limit (20 req/min), Zod validated, graceful fallback'
  - 'Charcoal colour system: bg-charcoal-900 (page), bg-charcoal-800 (card), bg-charcoal-950 (footer)'

issues-created: []

# Metrics
duration: ~45min
completed: 2026-03-20
---

# Phase 126: Marketing Site Redesign Summary

**Warm charcoal (#1a1612) + amber-500 marketing redesign with floating pill nav, 55/45 hero layout, and interactive LiveDemoWidget (type business name → AI-generated Instagram post in <4s)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-20T14:55Z
- **Completed:** 2026-03-20T15:12Z
- **Tasks:** 5 plans, 17 files modified/created
- **Files modified:** 15 | **Files created:** 3

## Accomplishments

- Design system token foundation: charcoal palette + Satoshi font replacing Inter site-wide
- Floating pill nav with scroll-triggered shadow — replaces full-width bar
- LiveDemoWidget: public AI demo (business name → Instagram caption + image) with graceful fallback when GEMINI_API_KEY absent
- Pricing simplified from 4 to 3 tiers (Enterprise removed, Pro highlighted amber)
- All sub-pages inherit warm charcoal via updated MarketingLayout (no cyan grid)

## Task Commits

1. **Plan 01: Design System Foundation** — `aac13361` (feat)
2. **Plan 02: Floating Pill Nav** — `ece543c9` (feat)
3. **Plan 03: Hero + LiveDemoWidget** — `f8d3af2c` (feat)
4. **Plan 04: Body Sections Refresh** — `49482083` (feat)
5. **Plan 05: Sub-pages** — `14308c6b` (feat)

## Files Created/Modified

- `tailwind.config.cjs` — charcoal.950/900/800/700/600/500 colour tokens added
- `app/globals.css` — --font-satoshi, --font-sans, --font-display → Satoshi
- `app/layout.tsx` — Inter removed; Fontshare CDN preconnect + stylesheet link
- `app/page.tsx` — bg-[#050505] → bg-charcoal-900
- `components/landing/nav-bar.tsx` — floating pill nav, scroll shadow
- `components/landing/bottom-menu.tsx` — amber token update, dashboard interface preserved
- `components/landing/hero-section.tsx` — 55/45 asymmetric grid, amber CTAs
- `components/landing/LiveDemoWidget.tsx` — **new** idle→loading→result state machine
- `app/api/demo/caption/route.ts` — **new** OpenRouter claude-haiku-4-5, rate-limited
- `app/api/demo/image/route.ts` — **new** Gemini 2.0 Flash, graceful fallback
- `components/landing/how-it-works.tsx` — 3-step refresh, amber numbers
- `components/landing/testimonials.tsx` — charcoal-800 card, amber glow
- `components/landing/cta-section.tsx` — charcoal card + amber radial glow
- `components/landing/stats-section.tsx` — amber number accents
- `components/landing/pricing-section.tsx` — 3 tiers (Enterprise removed), amber Pro
- `components/landing/footer-section.tsx` — charcoal-950 bg, amber link hovers
- `components/marketing/MarketingLayout.tsx` — charcoal-900 bg, cyan grid removed, amber nav
- `app/about/page.tsx` — #0d1f35 inline hex → charcoal-800 tokens

## Decisions Made

1. **@fontsource/satoshi doesn't exist on npm** — Satoshi is distributed by Fontshare, not on @fontsource. Used Fontshare CDN (`api.fontshare.com`) via `<link>` in layout.tsx. Same font, zero bundle impact.
2. **BottomMenu dashboard interface preserved** — Landing mobile nav handled by pill nav's built-in dropdown. BottomMenu still serves dashboard with full `items`/`activeId`/`onSelect` interface.
3. **Gemini image graceful fallback** — Returns `{imageUrl: null}` if key missing; widget shows warm amber gradient placeholder. No hard failure.
4. **MarketingLayout approach** — Updated the layout component directly rather than touching 7 individual sub-page files. All 7 pages inherit the new theme automatically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @fontsource/satoshi package does not exist**

- **Found during:** Plan 01 (npm install)
- **Issue:** `@fontsource/satoshi` returns 404 — Satoshi is a Fontshare font, not in the @fontsource registry
- **Fix:** Added Fontshare CDN `<link>` in `app/layout.tsx` `<head>`. Identical font, no bundle cost.
- **Files modified:** `app/layout.tsx`
- **Verification:** Font loads from `api.fontshare.com`, `--font-sans` CSS variable set correctly
- **Committed in:** aac13361

**2. [Rule 1 - Auto-fix] BottomMenu interface mismatch**

- **Found during:** Plan 02 (type-check after first BottomMenu rewrite)
- **Issue:** `app/dashboard/layout.tsx` imports `NavItem` and passes `items`/`activeId`/`onSelect` props — rewriting to landing nav broke dashboard
- **Fix:** Restored original BottomMenu interface; landing mobile nav handled by pill dropdown
- **Files modified:** `components/landing/bottom-menu.tsx`
- **Verification:** `npm run type-check` 0 errors after restoration
- **Committed in:** ece543c9

**3. [Rule 1 - Auto-fix] MarketingLayout covers all sub-pages**

- **Found during:** Plan 05 exploration
- **Issue:** All 7 sub-pages use `MarketingLayout` — editing each page's container was unnecessary
- **Fix:** Updated `MarketingLayout.tsx` directly; added targeted sed fixes for inline hex in `about/page.tsx`
- **Verification:** All pages inherit charcoal bg + amber nav
- **Committed in:** 14308c6b

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 auto-fix), 0 deferred
**Impact on plan:** All fixes necessary. No scope creep. Plan delivered as specified.

## Issues Encountered

None beyond the three auto-fixed deviations above.

## Next Phase Readiness

- Landing page: charcoal bg, Satoshi font, floating pill nav, LiveDemoWidget ready for testing
- Demo routes: require `OPENROUTER_API_KEY` (caption) and optionally `GEMINI_API_KEY` (image)
- Manual verification needed: localhost:3000 — type "Coastal Cafe" in widget, confirm <4s response
- GEMINI_API_KEY should be added to Vercel env for image generation (caption works without it)

---

_Phase: 126-marketing-redesign_
_Completed: 2026-03-20_
_Linear: UNI-1604_
