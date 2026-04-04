---
phase: 91-brand-builder
plan: 03
subsystem: ui
tags: [react, tailwind, swr, usemutation, radix, brand-builder, dashboard]

# Dependency graph
requires:
  - phase: 91-02
    provides: 7 API routes in app/api/brand/ (identity, consistency, mentions, poll, wikidata, kg-check, calendar)
  - phase: 91-01
    provides: BrandIdentity/BrandCredential/BrandMention Prisma models + lib/brand/ service layer (types, scorer, poller, checker, calendar)
provides:
  - 6 React components in components/brand/
  - /dashboard/brand page with 4 tabs
  - Sidebar entry (SEO & RESEARCH group)
  - 3 command palette commands
affects: [future brand phases, sidebar navigation, command palette]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSWR for GET data fetching in client components"
    - "useMutation (hooks/use-api.ts) for POST mutations in client components"
    - "4-tab dashboard pattern with Radix UI Tabs + useSWR + inline forms"
    - "BrandCalendarView uses useMutation (not useSWR) since calendar is generated on demand"

key-files:
  created:
    - components/brand/BrandIdentityCard.tsx
    - components/brand/ConsistencyAuditPanel.tsx
    - components/brand/BrandMentionsFeed.tsx
    - components/brand/WikidataStatusCard.tsx
    - components/brand/KnowledgePanelStatus.tsx
    - components/brand/BrandCalendarView.tsx
    - app/dashboard/brand/page.tsx
  modified:
    - components/icons/index.ts
    - app/dashboard/layout.tsx
    - components/command-palette/commands.ts

key-decisions:
  - "Building2 sourced from components/icons/index.ts (BuildingOffice2Icon adapter) — not imported directly from lucide-react"
  - "BrandMentionsFeed uses useSWR for GET + useMutation for POST poll (not useApi GET hook)"
  - "BrandCalendarView uses useMutation for on-demand POST calendar generation"
  - "Brand Builder added to seo-research sidebar group (after E-E-A-T Builder)"

patterns-established:
  - "Brand component props typed inline (no shared props file) — keeps components self-contained"
  - "Sentiment/event-type metadata defined as Record<K,V> constants at top of component file"

issues-created: []

# Metrics
duration: ~30 min
completed: 2026-03-11
---

# Phase 91 Plan 03: Brand Builder Dashboard UI + Navigation Summary

**6 brand components + /dashboard/brand 4-tab page + sidebar entry + 3 command palette commands wired to 7 API routes**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-11T13:30:00Z
- **Completed:** 2026-03-11T14:00:00Z
- **Tasks:** 8 (tasks 1-7 from prior session, task 8 this session)
- **Files modified:** 10

## Accomplishments

- Created 6 production-ready brand components (BrandIdentityCard, ConsistencyAuditPanel, BrandMentionsFeed, WikidataStatusCard, KnowledgePanelStatus, BrandCalendarView) — all fully typed, zero mock data
- Created /dashboard/brand page with 4 tabs (Identity, Consistency, Mentions, Calendar) using correct SWR + useMutation patterns
- Brand Builder is now accessible from sidebar (SEO & RESEARCH group, after E-E-A-T Builder) and command palette (3 commands: Identity, Consistency Audit, Mentions)
- npx tsc --noEmit passes with zero errors across all new files

## Task Commits

Each task was committed atomically:

1. **Tasks 1-7: 6 brand components + dashboard page + icons** - `5c317427` (feat)
2. **Task 8: Sidebar + command palette** - `a603bec2` (feat)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `components/brand/BrandIdentityCard.tsx` — entity type badge, score row (KG confidence/Wikidata/consistency), sameAs platform grid (8 platforms), JSON-LD expander, action buttons (Re-audit/Check Wikidata/Check Knowledge Graph)
- `components/brand/ConsistencyAuditPanel.tsx` — overall score with colour-coding, platform table (declared name + match status badge + score), critical issues list, amber recommendations
- `components/brand/BrandMentionsFeed.tsx` — useSWR paginated feed + useMutation poll button, sentiment badges (positive/neutral/negative), relative date formatting, API source chips (NewsData.io/GDELT/Guardian), load-more pagination
- `components/brand/WikidataStatusCard.tsx` — found/not-found status with Q-ID, required property checklist (P31/P856/P571) + recommended (P159/P112/P18/P2671), reference count strength (weak/moderate/strong), amber recommendations
- `components/brand/KnowledgePanelStatus.tsx` — KG confidence % with colour coding, KGMID display, entity types list, no-API-key graceful state, not-found explanation
- `components/brand/BrandCalendarView.tsx` — useMutation on-demand calendar generation, summary chips (total/high-priority/publishing/maintenance), events grouped by week, 6 event type colour badges
- `app/dashboard/brand/page.tsx` — 4-tab page with brand selector, inline BrandIdentityForm (entityType/canonicalName/canonicalUrl + 8 sameAs platform fields), all components wired to selectedBrandId
- `components/icons/index.ts` — added Building2 (BuildingOffice2Icon alias)
- `app/dashboard/layout.tsx` — imported Building2; added Brand Builder to seo-research sidebar group after E-E-A-T Builder
- `components/command-palette/commands.ts` — imported Building2; added 3 brand navigation commands (brand-identity, brand-consistency, brand-mentions)

## Decisions Made

- **Building2 icon**: Sourced from `@/components/icons` adapter (BuildingOffice2Icon) — not imported directly from lucide-react, consistent with project icon abstraction layer
- **Hook choice**: BrandMentionsFeed uses `useSWR` for GET and `useMutation` from `hooks/use-api.ts` for POST poll trigger — not raw fetch or useApi GET hook
- **BrandCalendarView**: Uses `useMutation` (not useSWR) since calendar is generated on demand via POST, not a persistent GET resource
- **Sidebar placement**: Added to `seo-research` group after E-E-A-T Builder — logical grouping since Brand Builder is a brand authority/entity tool
- **Command palette**: 3 commands (Identity, Consistency Audit, Mentions) — Calendar omitted as it is surfaced inside the Mentions tab context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Icon import pattern — Building2 from icons adapter, not lucide-react**

- **Found during:** Task 8 (sidebar navigation update)
- **Issue:** Plan specified `import Building2 from 'lucide-react'` but project uses a custom heroicons adapter at `components/icons/index.ts` — importing from lucide-react would break build consistency and introduce a duplicate icon dependency
- **Fix:** Added `BuildingOffice2Icon as Building2` to `components/icons/index.ts` and imported from `@/components/icons` in layout.tsx and commands.ts
- **Files modified:** components/icons/index.ts, app/dashboard/layout.tsx, components/command-palette/commands.ts
- **Verification:** tsc --noEmit passes, no import errors

---

**Total deviations:** 1 auto-fixed (1 blocking — icon import pattern)
**Impact on plan:** Necessary for build consistency. No scope creep.

## Issues Encountered

None — type check passed on first run with zero errors.

## Next Phase Readiness

- Phase 91 is fully complete — all 3 plans executed and committed
- /dashboard/brand is live with real data fetching (no mock data)
- All 7 API routes wired to real Prisma queries and service functions
- Ready to advance to Phase 92 (next in ROADMAP)

---
*Phase: 91-brand-builder*
*Completed: 2026-03-11*
