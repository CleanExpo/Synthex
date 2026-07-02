# Examples

> Worked examples showing the **placeholder → real-data** transition. Numbers below are illustrative
> *inputs* a caller would pass; the system never sources them itself.

## Example 1 — a page with NO live data (the honest default)

```ts
import { rankingOpportunity, confidenceAdjustedAction } from './scoring-models';

const page = { url: 'https://restoreassist.au/water-damage', project: 'RestoreAssist' };

const ro = rankingOpportunity(page, /* demandMax */ 1000);
// => { value: 0, dataStatus: 'DATA_REQUIRED', confidenceFactor: 0.1,
//      inputsMissing: ['search_demand ...', 'intent_match', 'authority_gap', 'funnel_stage'] }
```

The score is **0 / DATA_REQUIRED** — exactly right. With no GSC/Semrush data, the system refuses to
pretend it knows the opportunity. The backlog will mark this `blocked_reason: 'inputs are placeholders'`.

## Example 2 — same page once GSC + a content audit exist

```ts
const page = {
  url: 'https://restoreassist.au/water-damage',
  project: 'RestoreAssist',
  impressions: 820,        // from GSC (real)
  intentMatch: 0.8,        // rubric: page answers "water damage" intent well
  authorityGap: 0.6,       // competitors are thin
  funnelStage: 'transactional',
  marginWeight: 0.9,
  conversionProximity: 0.8,
};

const ro = rankingOpportunity(page, 1000);
// => positive value, dataStatus: 'PARTIAL' (some real, some rubric), confidenceFactor ~0.6
```

## Example 3 — the master prioritiser, with a risk gate

```ts
const action = confidenceAdjustedAction({
  url: page.url,
  project: 'RestoreAssist',
  rankingOpportunity: 0.7,
  freshnessPriority: 0.4,
  geoVisibility: 0.5,
  claimConfidence: 'LEAKED',  // e.g. claim A1 (NavBoost CTR)
  riskScore: 0.2,             // low — a title/meta rewrite
  dataStatus: 'PARTIAL',
  effort: 'S',
});
// => high confidenceAdjustedAction, no blockedReason → eligible for the backlog top.
```

```ts
// A thin-suburb-page mass-generation action (risk R-SEO-01 = 0.85):
const risky = confidenceAdjustedAction({
  url: '...', project: 'DR', rankingOpportunity: 0.9, freshnessPriority: 0, geoVisibility: 0,
  claimConfidence: 'INFERRED', riskScore: 0.85, dataStatus: 'PARTIAL', effort: 'L',
});
// => blockedReason: 'risk_score 0.85 ≥ 0.7 — route to human gate'
// Even with high opportunity, it cannot auto-execute.
```

## Example 4 — a YouTube/Neil-Patel claim (why it can't drive a change)

A claim extracted from a video enters as `OPINION_SOURCE` (confidence 0.1). Plugged into the master
prioritiser, its `confidenceScore = 0.1` collapses the action score. It will sit far below any
`CONFIRMED`/`LEAKED` action — exactly the intended behaviour. It can only rise if Agent 3 finds ≥4
independent corroborating sources, at which point it is no longer "just an opinion".
