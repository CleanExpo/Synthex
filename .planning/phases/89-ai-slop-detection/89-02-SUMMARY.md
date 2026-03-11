# Plan 89-02 Summary — API Route + Content Quality Gate

## Status: Complete

## Tasks Completed

### Task 1: app/api/quality/audit/route.ts
- Created POST handler: runs full quality audit (humanness + 6-dimension content score), optionally saves to DB
- Created GET handler: fetches user's saved audit history (last 50, ordered by date)
- Auth: `getUserIdFromRequest()` from `lib/auth/jwt-utils` — 401 if missing
- Rate limit: 30 req/min via `RateLimiter`
- Validation: Zod schema `{ text: string, save?: boolean }`
- POST response: `{ humanness: HumannessResult, contentScore: ScoreResult, auditId?: string }`
- GET response: `{ audits: [...] }` with id, humanessScore, slopDensity, passRate, slopMatchCount, createdAt, contentText
- DB save: `prisma.contentQualityAudit.create()` — orgId defaults to userId for solo users
- `export const runtime = 'nodejs'`

### Task 2: app/api/quality/gate/route.ts
- Created POST handler: lightweight gate check, no DB persistence
- Auth: same pattern as audit route
- Rate limit: 60 req/min (higher — called before every publish)
- Validation: Zod schema `{ text: string, threshold?: number }` (threshold: 0–100, default 60)
- Response: `{ passes: boolean, score: number, grade: string, blockingIssues: string[] }`
- `blockingIssues` = top 5 error-severity slop matches formatted as `"phrase" → suggestion`
- No feature gate — available on all plans (safety feature)

### Task 3: lib/geo/feature-limits.ts — qualityAudits key
- Added `qualityAudits: number` to `GEOFeatureLimits` interface
- Updated all 7 plan records:
  - free: 3
  - pro: 50
  - growth: -1 (unlimited)
  - scale: -1
  - professional (alias): 50
  - business (alias): -1
  - custom: -1
- Added to `FEATURE_INFO`: label `'Content Quality Audits'`, description `'Full humanness scoring and AI slop detection with saved audit history'`

## Commits

| Hash | Message |
|------|---------|
| `e8e74357` | feat(89-02): create quality API routes — audit and gate check |
| `6cc7e8ca` | feat(89-02): extend feature-limits with qualityAudits key |

## Key Decisions

- **GET handler in audit route**: Plan 89-03 needs a history tab that fetches saved audits. Including the GET in the same route file keeps it clean and follows Next.js App Router convention.
- **Gate route: no feature gate**: This is a safety feature — all users deserve to know if their content is AI-slop before publishing. Feature gating the full saved audit (with DB persistence) is sufficient differentiation.
- **orgId fallback to userId**: Matches the pattern used in `app/api/voice/analyze/route.ts` — solo users have no org, so userId serves as the org boundary.
- **Prisma InputJsonValue cast**: `humanness as unknown as Prisma.InputJsonValue` matches the existing pattern in voice/analyze/route.ts for JSON fields.

## Deviations from Plan

- GET handler for audit history was specified in Plan 89-03 Task 3 note ("Create a GET /api/quality/audit/route.ts that fetches user's ContentQualityAudit records as part of this task"). Built it here in 89-02 since the route file already existed, avoiding a separate modification pass.

## Files Created/Modified

- `app/api/quality/audit/route.ts` — NEW (POST + GET, 160 lines)
- `app/api/quality/gate/route.ts` — NEW (POST only, 110 lines)
- `lib/geo/feature-limits.ts` — MODIFIED (qualityAudits in interface, all plans, FEATURE_INFO)
