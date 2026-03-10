# 86-04 Summary: API Routes + Subscription Gating + GEO Integration

## Completed

- Created 4 authority API routes: analyze, citations, sources, validate-claim
- Added hasAuthorityAddon() to SubscriptionService with 5-min cache
- Extended .env.example with STRIPE_AUTHORITY_ADDON_PRICE_ID + SEMANTIC_SCHOLAR_API_KEY
- Wired deep authority analysis into GEO pipeline for addon users

## Commits

- e32bccc1 feat(86-04): add authority API routes with auth, Zod validation, and addon gating
- bc28d000 feat(86-04): add hasAuthorityAddon with 5-min cache and owner bypass
- edc94f81 feat(86-04): wire deep authority analysis into GEO pipeline for addon users

## Files Changed

### New files
- app/api/authority/analyze/route.ts — POST, Zod validated, deepValidation addon gate
- app/api/authority/citations/route.ts — GET, ownership verification before returning citations
- app/api/authority/sources/route.ts — GET, returns connector status array
- app/api/authority/validate-claim/route.ts — POST, addon-gated, returns sources + validated bool

### Modified files
- lib/stripe/subscription-service.ts — added addonCache map, hasAuthorityAddon() method, standalone export
- lib/stripe/config.ts — added AUTHORITY_ADDON_PRICE_ID export
- lib/geo/types.ts — added userId/orgId to GEOAnalysisInput; authorityAnalysis? to GEOAnalysisResult; imported AuthorityAnalysisResult
- lib/geo/geo-analyzer.ts — imported analyzeAuthorityDeep + hasAuthorityAddon; added post-result deep analysis block
- .env.example — added STRIPE_AUTHORITY_ADDON_PRICE_ID and SEMANTIC_SCHOLAR_API_KEY entries

## Notes

- Auth pattern: all routes use getUserIdFromRequest(req: NextRequest) matching GEO analyzer convention — not getSession()
- Deep validation routes return { error, upgrade: true, addon: 'authority' } for ungated access (403)
- hasAuthorityAddon caches per-userId for 5 minutes to avoid Stripe API hammering
- Owner bypass: isOwnerEmail() check returns true immediately (cached) for platform owners
- GEO pipeline blends: 30% heuristic + 70% deep score when addon active; recalculates overall
- Falls back to heuristic on deep analysis failure (try/catch + logger.warn)
- type-check: zero errors; tests: 32 pre-existing failures unchanged (no regressions)
