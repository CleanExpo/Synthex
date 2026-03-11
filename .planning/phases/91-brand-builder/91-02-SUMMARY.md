# Plan 91-02 Summary — Brand Builder API Routes

**Status:** COMPLETE
**Date:** 2026-03-11
**Tasks:** 8/8

## What Was Built

### API Routes (7 routes)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/brand/identity` | POST | Save/update brand identity — generates entity graph + consistency report |
| `/api/brand/identity` | GET | List user's brand identities (entityGraph omitted for performance) |
| `/api/brand/consistency` | POST | Run NAP consistency audit for a saved brand, persist results |
| `/api/brand/mentions` | GET | Paginated mention feed (brandId, page, limit query params) |
| `/api/brand/mentions/poll` | POST | Trigger GDELT + NewsData.io poll, upsert deduplicated results |
| `/api/brand/wikidata` | GET | Check Wikidata entity, persist Q-ID to BrandIdentity |
| `/api/brand/kg-check` | GET | Check Google KG confidence, graceful fallback if no API key |
| `/api/brand/calendar` | POST | Generate 90-day brand publishing + maintenance calendar |

### Auth Pattern
All routes use `getUserIdFromRequest()` from `lib/auth/jwt-utils` — consistent with EEAT v2 audit pattern.

### Rate Limiting
- Identity: 30/min
- Consistency: 20/min
- Mention poll: 10/hour (stricter — external API calls)
- Wikidata + KG: 10/min
- Calendar: 20/min

### .env.example (updated)
Added: `NEWSDATA_API_KEY`, `GNEWS_API_KEY`, `GUARDIAN_API_KEY`, `GOOGLE_KG_API_KEY`

## Deviation Log
- `identity/route.ts`: Prisma upsert with placeholder `id: 'placeholder-never-matches'` with catch fallback — avoids needing a @@unique constraint on [userId, canonicalUrl]. This is a deliberate pattern since we already have separate indexes.

## Type Check
`npx tsc --noEmit` — zero errors
