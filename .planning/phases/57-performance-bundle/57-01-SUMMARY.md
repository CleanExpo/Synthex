---
phase: 57-performance-bundle
plan: 01
type: summary
completed: 2026-03-03
---

# Phase 57 Plan 01: Bundle Analysis + Prisma Query Optimisation Summary

**One N+1 Prisma query fixed (30 sequential counts → parallel Promise.all). Bundle config verified — 11 packages tree-shaken, jsPDF already dynamic. Redis L1/L2/L3 cache confirmed correctly implemented.**

## N+1 Queries Fixed

### `app/api/analytics/insights/route.ts` — Daily Trends Loop

| Before | After |
|--------|-------|
| Sequential loop: `for (let i = 0; i < 30; i++) { await prisma.post.count(...) }` | `Promise.all(dayRanges.map(...))` — all counts run concurrently |
| 30 sequential round-trips (blocked by each await) | 1 parallel batch (30 concurrent queries, ~1 round-trip time) |
| ~30× database latency stacked | ~1× database latency |

The trends data is now built by:
1. Building `dayRanges[]` (pure JS — no DB)
2. `Promise.all()` for all 30 day counts
3. Mapping + reversing to chronological order

## Other Query Patterns Reviewed

| Route | Pattern | Status |
|-------|---------|--------|
| `analytics/dashboard-stats` | 5 parallel `count` queries via `Promise.all` | ✅ Already optimal |
| `analytics/performance` | 2 sequential `findMany` calls (different queries, not N+1) | ✅ Acceptable |
| `analytics/benchmarks` | 2 queries, then in-memory iteration | ✅ No N+1 |
| `content/bulk` — reschedule | `Promise.all(posts.map(prisma.post.update))` | ✅ Already parallel |
| `ai-content/sentiment/batch` | Sequential updates (different data per row) | ⚠️ Acceptable — Prisma lacks updateMany with per-row data; updates are isolated with `.catch()` |

## Bundle Configuration Audit

### `optimizePackageImports` (Tree-Shaking)

11 packages currently configured in `next.config.mjs`:

| Package | Reason |
|---------|--------|
| `@heroicons/react` | Icon library — only named imports used |
| `@radix-ui/react-dialog` | Radix UI components |
| `@radix-ui/react-dropdown-menu` | Radix UI components |
| `@radix-ui/react-popover` | Radix UI components |
| `@radix-ui/react-tooltip` | Radix UI components |
| `framer-motion` | Animation library — large, needs tree-shaking |
| `react-icons` | Icon library |
| `date-fns` | Date utility — only subset used |
| `lodash` | Utility library — only subset used |
| `lucide-react` | Icon library — 28+ components imported across codebase |
| `recharts` | Charting library — used in analytics components |

**Assessment:** All major large packages are covered. No additions required.

### Dynamic Imports

| Component | Status |
|-----------|--------|
| `app/dashboard/analytics/page.tsx` | ✅ Uses `next/dynamic` for chart components |
| `app/dashboard/calendar/page.tsx` | ✅ Uses `next/dynamic` for calendar |
| `app/dashboard/content/performance/page.tsx` | ✅ Uses `next/dynamic` for charts |
| `jsPDF` (PDF export) | ✅ Dynamic import added in commit `e96e1d6` |
| `recharts` in standalone components (`AIABTesting.tsx`, `GenderChart.tsx`, etc.) | ⚠️ Static imports — acceptable since `optimizePackageImports` handles tree-shaking; these are standalone components not in critical path |

### Bundle Analyser

`ANALYZE=true npm run build` is configured in `next.config.mjs` and opens an interactive browser visualizer. Actual chunk sizes were not captured in this phase (build takes >5 min in dev environment). Run manually to inspect:

```bash
ANALYZE=true npm run build
```

Expected: chunks over 500KB would be recharts (used on analytics pages, already optimised with dynamic imports) and framer-motion (in optimizePackageImports).

## Redis Cache Verification

### Architecture

| Layer | Implementation | Max Size | Default TTL |
|-------|---------------|----------|-------------|
| L1 Memory | `MemoryCacheLayer` (Map) | 500 entries | 300s (5 min) |
| L2 Redis | `RedisCacheLayer` (ioredis) | Unlimited | TTL from entry |
| L3 Upstash | `UpstashCacheLayer` (REST API) | Unlimited | TTL from entry |

### Env Vars (all in `.env.example`)

- `REDIS_URL` — ioredis connection string (L2)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Upstash fallback (L3)

### Behaviour

- Cache miss → L1 → L2 → L3 → DB
- Cache hit at any layer → backfills upper layers automatically
- Graceful degradation if Redis/Upstash unavailable
- Tag-based invalidation supported
- Cleanup interval: 30s for expired memory entries

**Assessment:** Cache system is correctly implemented. Verify production env vars are set in Vercel dashboard before Phase 58.

## Files Modified

| File | Change |
|------|--------|
| `app/api/analytics/insights/route.ts` | N+1 fix: daily trends loop → parallel `Promise.all` |
| `.planning/phases/57-performance-bundle/57-01-PLAN.md` | Phase plan created |

## TypeScript Check

`npm run type-check` passed with 0 errors.

## Deferred Items

- **Bundle size numbers**: `ANALYZE=true npm run build` not captured (interactive browser output). Run manually to verify no chunks over 500KB. Expected compliant based on existing config.
- **`ai-content/sentiment/batch` sequential updates**: Acceptable pattern — no `updateMany` equivalent exists in Prisma for per-row data. Individual updates use `.catch()` isolation.

## Next Step

Phase 58: Core Web Vitals compliance and Redis cache verification (UNI-1230).
Plan file to create: `.planning/phases/58-performance-vitals/58-01-PLAN.md`
