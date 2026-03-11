# Phase 105-01 SUMMARY — Six Scale-Tier BO Surface Adapters

**Completed:** 2026-03-11
**Branch:** main
**Status:** DONE

---

## Objective

Implement six new Scale-tier Bayesian Optimisation (BO) surface adapters and integrate each one into the corresponding service file and API route, enabling the BO engine to adaptively tune feature behaviour for users on the `scale` plan.

---

## Deliverables

### Surface Adapter Files Created (Tasks 1–6)

| File | Surface Key | Dimensions |
|------|-------------|-----------|
| `lib/bayesian/surfaces/content-scheduling.ts` | `content_scheduling` | historicalWeight, industryWeight, recencyBonus, peakHourMultiplier, weekendDiscount |
| `lib/bayesian/surfaces/backlink-scoring.ts` | `backlink_scoring` | resourcePageWeight, guestPostWeight, brokenLinkWeight, competitorLinkWeight, journalistMentionWeight |
| `lib/bayesian/surfaces/authority-validation.ts` | `authority_validation` | regulatoryPriority, statisticalPriority, temporalPriority, causalPriority, comparativePriority, factualPriority |
| `lib/bayesian/surfaces/psychology-levers.ts` | `psychology_levers` | socialProofWeight, scarcityWeight, authorityWeight, reciprocityWeight, lossAversionWeight, commitmentWeight, likingWeight, anchoringWeight |
| `lib/bayesian/surfaces/self-healing-priority.ts` | `self_healing_priority` | missingMetaPriority, brokenSchemaPriority, lowGeoScorePriority, lowQualityScorePriority, missingEntityPriority, shortTitlePriority, missingH1Priority, weakMetaDescPriority |
| `lib/bayesian/surfaces/campaign-roi.ts` | `campaign_roi` | youtubeAllocation, instagramAllocation, tiktokAllocation, twitterAllocation, facebookAllocation, linkedinAllocation, pinterestAllocation, redditAllocation |

All adapters follow the established pattern from `lib/bayesian/surfaces/geo-weights.ts`.

### Service + Route Integrations (Tasks 7–12)

| Surface | Service File Modified | Route File Modified |
|---------|----------------------|---------------------|
| `content_scheduling` | `lib/ml/posting-time-predictor.ts` | `app/api/optimize/auto-schedule/route.ts` |
| `backlink_scoring` | `lib/backlinks/backlink-analyzer.ts` | `app/api/backlinks/analyze/route.ts` |
| `authority_validation` | `lib/authority/claim-extractor.ts` + `lib/authority/authority-analyzer.ts` | `app/api/authority/analyze/route.ts` |
| `psychology_levers` | `lib/ai/psychology-analyzer.ts` | `app/api/psychology/analyze/route.ts` |
| `self_healing_priority` | `lib/experiments/self-healer.ts` | `app/api/experiments/healing/analyze/route.ts` |
| `campaign_roi` | `lib/roi/roi-service.ts` | `app/api/roi/route.ts` |

---

## Integration Pattern (Per Surface)

Each route follows this pattern:

```typescript
// 1. Resolve orgId + plan via nested Organization select
const userRecord = await prisma.user.findUnique({
  where: { id: userId },
  select: { organizationId: true, organization: { select: { plan: true } } },
});
const orgId = userRecord?.organizationId ?? userId;
const plan  = (userRecord?.organization?.plan ?? 'free').toLowerCase();

// 2. Gate on plan — only fetch BO weights for scale-tier users
const weightsResult = isSurfaceAvailable(plan, 'surface_key')
  ? await getSurfaceWeights(orgId)
  : undefined;

// 3. Pass optional weights to service
const result = await service.method(input, weightsResult?.weights);

// 4. Register BO observation (fire-and-forget) when source is 'bo'
if (weightsResult?.source === 'bo') {
  void registerObservationSilently('surface_key', orgId, params, target, metadata);
}
```

All integrations are **purely additive**: weights parameters are optional, and service methods fall back to original heuristic behaviour when weights are undefined.

---

## Bug Fix Applied

All 6 routes initially used `select: { organizationId: true, plan: true }` — incorrect because `plan` lives on `Organization`, not `User`. The fix:

```typescript
// Before (broken)
select: { organizationId: true, plan: true }
const plan = (userRecord?.plan ?? 'free').toLowerCase();

// After (correct)
select: { organizationId: true, organization: { select: { plan: true } } }
const plan = (userRecord?.organization?.plan ?? 'free').toLowerCase();
```

---

## Verification

- `npm run type-check` — PASSED (zero errors)

---

## Commits

All tasks committed individually with identifiers `feat(105-01): ...`:

1. `feat(105-01): add content_scheduling BO surface adapter`
2. `feat(105-01): add backlink_scoring BO surface adapter`
3. `feat(105-01): add authority_validation BO surface adapter`
4. `feat(105-01): add psychology_levers BO surface adapter`
5. `feat(105-01): add self_healing_priority BO surface adapter`
6. `feat(105-01): add campaign_roi BO surface adapter`
7. `feat(105-01): integrate content_scheduling BO surface into posting-time predictor`
8. `feat(105-01): integrate backlink_scoring BO surface into backlink analyser`
9. `feat(105-01): integrate authority_validation BO surface into claim extractor`
10. `feat(105-01): integrate psychology_levers BO surface into psychology analyser`
11. `feat(105-01): integrate self_healing_priority BO surface into self-healer`
12. `feat(105-01): integrate campaign_roi BO surface into ROI service`
