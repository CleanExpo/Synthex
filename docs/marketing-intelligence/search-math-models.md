# Search Mathematics & Scoring Models

> Status: ✅ `VERIFIED` — the formulas are fully specified here and implemented as pure functions in
> [`src/skills/agentic-marketing-intelligence/scoring-models.ts`](../../src/skills/agentic-marketing-intelligence/scoring-models.ts).
> **Caveat:** the *formulas* are real and deterministic. Their *inputs* (search volume, impressions,
> CTR, position) are 🟡 `DATA_REQUIRED` until wired to live GSC / Semrush data. A score computed on
> placeholder inputs is itself a placeholder — every score carries a `confidence_factor` so the
> system never treats a guess as a measurement.

## Design principles

1. **Every input is normalised to `0..1`** before weighting, so scores are comparable across pages.
2. **Confidence is a first-class multiplier**, not an afterthought — a high-impact action built on
   weak evidence scores *low*, by construction.
3. **Effort divides, never adds** — high-effort work must clear a higher impact bar.
4. **No magic constants without a comment** explaining the choice; weights are tunable and live in
   one `WEIGHTS` object so calibration is auditable.

## Normalisation helpers

- `clamp01(x)` → bounds to `[0,1]`.
- `norm(x, max)` → `clamp01(x / max)` for unbounded counts (impressions, volume).
- `invNorm(x, max)` → `1 - norm(x, max)` for "lower is better" (position, effort).
- `posScore(avgPosition)` → `clamp01((11 - avgPosition) / 10)` maps SERP position 1→1.0, 10→0.1, >10→0.

---

## 1. Ranking Opportunity Score

```
ranking_opportunity =
  (search_demand · intent_match · authority_gap · commercial_value · confidence_factor)
  / max(implementation_effort, ε)
```

| Input | Source | Normalisation |
|-------|--------|---------------|
| `search_demand` | GSC impressions OR Semrush volume | `norm(value, max_in_set)` |
| `intent_match` | manual/LLM rubric: does the page answer the query intent? | `0..1` direct |
| `authority_gap` | competitor weakness (low DA, thin content) where we could win | `0..1` direct |
| `commercial_value` | funnel stage → {info 0.3, consideration 0.6, transactional 1.0} | mapped |
| `confidence_factor` | evidence confidence (see §12) | `0..1` |
| `implementation_effort` | t-shirt size → {XS 0.1, S 0.25, M 0.5, L 0.75, XL 1.0} | mapped, `ε=0.1` floor |

Multiplicative because a zero on *any* factor should zero the opportunity (no demand = no opportunity,
no confidence = don't act).

---

## 2. Content Decay Score

```
content_decay =
  w_imp·drop(impressions) + w_clk·drop(clicks) + w_ctr·drop(ctr)
  + w_pos·worsening(avg_position) + w_age·age_factor + w_comp·competitor_gain
```

- `drop(metric)` = `clamp01((prev - curr) / max(prev, ε))` — fractional decline over the comparison window.
- `worsening(pos)` = `clamp01((curr_pos - prev_pos) / 10)` — positions lost (capped at 10).
- `age_factor` = `clamp01(months_since_update / 18)` — 18-month soft horizon for evergreen.
- `competitor_gain` = `0..1` from competitive-local-strategy benchmark deltas.
- Requires GSC period-over-period data → 🟡 `DATA_REQUIRED`.

A page scoring high here is a **refresh candidate**, ordered by Freshness Priority (§3).

---

## 3. Freshness Priority Score

```
freshness_priority =
  (traffic_value + ranking_drop + content_age + ai_search_relevance) · business_importance
```

- `traffic_value` = `norm(clicks · commercial_value, max)` — protect pages that earn.
- `ranking_drop` = `worsening(avg_position)` from §2.
- `content_age` = `age_factor` from §2.
- `ai_search_relevance` = `0..1`: is this a query type now answered by AI Overviews? (citation-eligible content gets priority).
- `business_importance` = `0..1` per-project weight (a money page > a glossary page).

Sum-then-scale (not product) because a page can deserve a refresh on age alone even with steady traffic.

---

## 4. Topical Authority Score

```
topical_authority = covered_subtopics / required_subtopics   (per topic cluster)
```

- `required_subtopics` = union of subtopics covered by top-ranking competitors + the business's own
  service taxonomy.
- Drives the content-cluster gap list. Low score = build supporting articles + internal links.

---

## 5. Entity Coverage Score

```
entity_coverage = covered_entities / required_entities
```

- `required_entities` extracted from: current SERP, competitor pages, Google NLP-style entity review
  (when available), Semrush topic data, internal service taxonomy.
- 🟡 `DATA_REQUIRED` for the SERP/NLP inputs; the service-taxonomy half is buildable now from each
  brand's persona/charter.

---

## 6. Internal Link Strength Score

```
internal_link_strength =
  clamp01( w_in·norm(inbound_internal_links, target)
         + w_anchor·anchor_relevance
         + w_depth·invNorm(click_depth_from_home, 5) )
```

- `anchor_relevance` = `0..1`: do inbound anchors contain the target topic?
- `click_depth_from_home` capped at 5; deeper = weaker.
- Computable from an internal crawl (no third-party data needed) → buildable once a crawl runs.

---

## 7. Search Intent Alignment Score

```
intent_alignment = match(serp_dominant_intent, page_type)
```

- Classify SERP dominant intent {informational, commercial, transactional, navigational, local}.
- Score 1.0 if page type matches dominant intent, 0.5 partial, 0 mismatch.
- A transactional query served by a blog post = 0 → rebuild as a service page.

---

## 8. GEO / AI-Answer Visibility Score

```
geo_visibility =
  w1·citation_likelihood + w2·answer_completeness + w3·structured_clarity
  + w4·entity_authority + w5·source_trust
```

All terms `0..1`:
- `citation_likelihood` — does the page give a concise, directly-quotable answer above the fold?
- `answer_completeness` — does it fully resolve the question (no "it depends" hedging)?
- `structured_clarity` — headings, lists, FAQ/HowTo schema present?
- `entity_authority` — is the brand a recognised entity for this topic?
- `source_trust` — E-E-A-T signals: named author, citations, accuracy.

Grounded in the `algorithm-knowledge-base` "AI Overviews / Citation Eligibility [INFERRED]" entry —
so this score is explicitly `INFERRED`, never `CONFIRMED`.

---

## 9. E-E-A-T Completeness Score

```
eeat_completeness = present_eeat_signals / total_eeat_signals
```

Checklist signals (binary present/absent): named author, author credentials/schema, About page,
external citations, first-person experience signals, original media, last-reviewed date,
contact/NAP, editorial policy (YMYL). YMYL pages weight this higher.

---

## 10. Commercial Value Score

```
commercial_value = funnel_stage_weight · margin_weight · conversion_proximity
```

- `funnel_stage_weight` {info 0.3, consideration 0.6, transactional 1.0}.
- `margin_weight` `0..1` per service line (set by the business).
- `conversion_proximity` `0..1`: how close the page sits to a booking/quote/call action.

---

## 11. Implementation Effort Score

```
implementation_effort = t_shirt_size → {XS:0.1, S:0.25, M:0.5, L:0.75, XL:1.0}
```

Used as the denominator in §1 and §12. Deliberately coarse — precision here is false comfort.

---

## 12. Confidence-Adjusted Action Score (the master prioritiser)

```
confidence_adjusted_action = (impact_score · confidence_score) / max(risk_score, ε)
```

- `impact_score` = blended, e.g. `0.5·ranking_opportunity + 0.3·freshness_priority + 0.2·geo_visibility` (weights tunable).
- `confidence_score` = `0..1` from the evidence tier of the *claims* the action relies on:
  - `CONFIRMED` → 1.0, `LEAKED` → 0.8, `INFERRED` → 0.5, `SPECULATIVE` → 0.25, `UNVERIFIED` → 0.1.
- `risk_score` = `0..1` from [risk-register-seo-aeo-geo.md](risk-register-seo-aeo-geo.md): could this
  action trigger a penalty/spam classifier? Higher risk drives the score down.

**This is the single number the backlog sorts by.** An action ranks high only when impact is real,
the evidence is strong, *and* the risk is low. Influencer-only advice (`confidence ≤ 0.25`) can never
out-rank a `CONFIRMED`-backed action of similar impact.

---

## Calibration & honesty rules

- Weights live in one `WEIGHTS` object in `scoring-models.ts`; changing them is a logged decision.
- Any score computed with a placeholder input **must** be returned with `confidence_factor ≤ 0.1` and
  flagged `DATA_REQUIRED` — see the `ScoreResult.dataStatus` field in `types.ts`.
- The system **never** reports a ranking, traffic, CTR, or volume number it did not receive from a
  real source. Scores are *relative priorities*, not predictions of traffic.
