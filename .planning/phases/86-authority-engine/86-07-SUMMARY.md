# 86-07 Summary: Design Audit UI + API Route + GEO Recommendations

## Completed

- Created `app/api/authority/design-audit/route.ts` — POST, auth + addon gated, calls `analyseDesign()`
- Created `components/authority/DesignAuditCard.tsx` — design quality breakdown with coloured bars (6 dimensions)
- Created `components/authority/CROScoreCard.tsx` — CRO readiness 5-factor breakdown with priority improvement hints
- Created `components/authority/LLMCitationFitnessCard.tsx` — CITABLE framework 7-dimension display with letter chip row
- Added Design Audit tab to authority dashboard (4th tab: Analyse | Citations | Sources | Design Audit)
- Extended `lib/geo/types.ts` to add `'design'` to `GEORecommendation.category` union
- Extended `lib/geo/recommendations.ts` with 5 design-aware `'design'` category recommendations

## Commits

- d75ab98a feat(86-07): add design audit API route and 3 score card components
- fae229e9 feat(86-07): add Design Audit tab to authority dashboard
- f26d1eac feat(86-07): extend GEO recommendations with 5 design-aware insights

## Notes

- Design Audit tab wrapped in `AuthorityFeatureGate` (requires addon)
- API route returns `{ error, upgrade: true, addon: 'authority' }` with HTTP 403 if addon not active
- GEO design recommendations do NOT require addon (based on content analysis already in the GEO pipeline)
- CITABLE acronym visualised as coloured letter chips (C-I-T-A-B-L-E) with per-letter scores
- Five design recommendations cover: long paragraphs, lacking structure, no FAQ, heading hierarchy, no inline citations
- Deduplication guards prevent double-recommending items already covered by the structure category
- `npm run type-check` — zero errors
- `npm test -- --testPathPattern="geo|authority|design"` — 14/14 passed
