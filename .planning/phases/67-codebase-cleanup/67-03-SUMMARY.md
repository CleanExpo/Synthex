# Phase 67 Plan 03: Fetch Pattern Standardisation Summary

**4 raw-fetch 'use client' components migrated to SWR; canonical fetch pattern documented in CLAUDE.md.**

## Accomplishments

- Audited all 'use client' components in components/ for raw fetch() data-loading calls
- Identified 5 high-value migration candidates; migrated 4, skipped 1 (NotificationBell — too complex)
- CLAUDE.md updated with canonical Data Fetching Pattern reference table
- All 4 migrations use `credentials: 'include'` fetcher and `revalidateOnFocus: false` per standard

## Files Created/Modified

- `components/real-stats.tsx` — migrated 5 export components (RealStats, UserCount, EngagementBoost, CampaignCount, PostCount) to share a single SWR key `/api/stats` with `refreshInterval`
- `components/content/content-stats.tsx` — migrated to SWR `/api/analytics/dashboard-stats`
- `components/referral/ReferralCard.tsx` — data-loading fetch migrated to SWR; POST mutation uses `mutate()` for cache revalidation; fetchWithCSRF retained for the mutation
- `components/schedule/optimal-times.tsx` — migrated to SWR with dynamic timezone URL; fallback-to-industry-defaults logic preserved via null data check
- `CLAUDE.md` — Data Fetching Pattern section added (after PROJECT STANDARDS, before Conventions)

## Decisions Made

- Three-pattern canonical standard enforced: `useApi()`/`useMutation()` for `hooks/`, `useSWR` for standalone components, native `fetch()` for server-side
- `credentials: 'include'` is mandatory in all SWR fetchers (httpOnly auth-token cookie)
- `revalidateOnFocus: false` used for all dashboard widgets (data does not need real-time updates)
- `NotificationBell.tsx` skipped — has two interdependent fetch paths (full load + unread poll) plus mark-as-read mutation; migrating this pattern without breaking the polling interval would require useSWR with `refreshInterval` AND manual `mutate()` calls, which is higher risk pre-launch
- `app/dashboard/page.tsx` intentionally excluded (SSR, complex multi-source fetch with legacy token fallback)
- `app/dashboard/` page-level components (competitors, billing, etc.) excluded — these are page-level route fetches, not standalone widgets

## Issues Encountered

None. Type-check passed with 0 errors after all 4 migrations. Test suite: 1506 passing, 22 failing (all pre-existing Stripe/BullMQ/Prisma mock failures — no regressions).

## Next Step

Phase 67 complete (3/3 plans). Ready for Phase 68 (Stripe Activation).
