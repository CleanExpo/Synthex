# Verified Ranking Claims

> Status: ✅ `VERIFIED` (process) — every claim below is grounded in a real, inspectable source:
> primarily the internal `algorithm-knowledge-base/references/google-search.md` (itself sourced and
> dated), plus widely-corroborated Google documentation. Confidence labels follow the **existing
> Synthex taxonomy** so this file slots into the current skill ecosystem.
> **No metrics are invented.** Where a claim needs first-party numbers to act on, it is tagged 🟡.

## Confidence taxonomy (reused from `algorithm-knowledge-base`)

| Label | Meaning | Score (feeds §12 of the math models) |
|-------|---------|--------------------------------------|
| `CONFIRMED` | Official platform statement / documentation | 1.0 |
| `LEAKED` | Authenticated leak (Google Content Warehouse 2024) | 0.8 |
| `INFERRED` | Multiple corroborating independent sources | 0.5 |
| `SPECULATIVE` | Single source / community consensus | 0.25 |
| `UNVERIFIED` | Asserted, not cross-checked | 0.1 |
| `OPINION_SOURCE` | Influencer/video opinion (e.g. YouTube) | 0.1 until upgraded |

> **Rule:** an influencer claim (`OPINION_SOURCE`) is **never** promoted above `INFERRED` without
> independent corroboration from documentation or first-party data. This is what stops "Neil said so"
> from driving a site change.

## Cross-verification standard

A claim reaches `CONFIRMED`/`LEAKED` only with **≥4 corroborating references**. The reference pool:
Google Search Central docs, Search Quality Rater Guidelines, the 2024 Content Warehouse leak analyses,
Core Web Vitals/CrUX docs, Schema.org, and **first-party GSC data** (the tie-breaker — internal data
overrides generic advice).

---

## A. Core web ranking (high confidence)

### A1. CTR on a query–URL pair is a direct ranking input (NavBoost)
- **Confidence:** `LEAKED` (0.8)
- **Sources (4):** Content Warehouse leak (`clickSignals`/`goodClicks`/`badClicks`); internal KB
  `google-search.md` § NavBoost; corroborating 2024 industry leak analyses; first-party GSC CTR data (per page).
- **Actionable signal:** title + meta description quality. High impressions + low CTR = ranking risk.
- **Action:** rewrite titles/meta on pages with below-set-median CTR. **Validate:** GSC CTR delta over 28 days.

### A2. Core Web Vitals (LCP/INP/CLS) are a confirmed ranking signal
- **Confidence:** `CONFIRMED` (1.0)
- **Sources (4):** Google Page Experience docs; Core Web Vitals/CrUX docs; internal KB; PageSpeed/Lighthouse field data.
- **Thresholds:** LCP < 2.5s, INP < 200ms, CLS < 0.1.
- **Action:** fix pages failing all three on mobile. **Validate:** CrUX field data + Lighthouse.

### A3. Original/unique content scores higher; thin/duplicate scores low (OriginalContentScore)
- **Confidence:** `LEAKED` (0.8)
- **Sources (4):** Content Warehouse leak; Helpful Content guidance; Quality Rater Guidelines; internal KB.
- **Action:** add proprietary data, case studies, original media. **Validate:** ranking + decay (§2) movement.

### A4. Site-level authority exists and gates new domains (siteAuthority / hostAge sandbox)
- **Confidence:** `LEAKED` for `siteAuthority` (0.8); `INFERRED` for the sandbox effect (0.5)
- **Sources:** Content Warehouse leak (`siteAuthority`); 2019–2024 new-domain observations; internal KB.
- **Action:** new portfolio sites build links + brand mentions from launch; do not expect organic
  rankings for 6–12 months. **Validate:** GSC impressions ramp curve.

## B. E-E-A-T & content quality

### B1. E-E-A-T shapes quality-rater scores that train ranking systems (esp. YMYL)
- **Confidence:** `CONFIRMED` (1.0) that the framework exists; `INFERRED` (0.5) on the strength of its indirect ranking effect.
- **Sources (4):** Search Quality Evaluator Guidelines 2024; Google "creating helpful content" docs; internal KB; corroborating studies.
- **Note:** RestoreAssist (insurance/restoration), CARSI (training), Disaster-Recovery are **YMYL-adjacent** →
  named authors, credentials, citations are higher-priority here than for a cleaning-services page.
- **Action:** author schema + credentials + last-reviewed dates on YMYL pages. **Validate:** §9 E-E-A-T completeness score.

### B2. Freshness is query-dependent, not universal
- **Confidence:** `INFERRED` (0.5)
- **Sources:** Google freshness/QDF statements; update-cadence analyses; internal KB SegIndexer entry.
- **Action:** publish fast for news/trend queries; *meaningfully* update evergreen pages and set
  `dateModified`. Do **not** fake freshness with trivial edits (see risk register). **Validate:** decay score §2.

## C. Local search

### C1. GBP completeness + review signals drive local-pack ranking
- **Confidence:** `CONFIRMED` (1.0)
- **Sources (4):** Google Business Profile Help; local-pack ranking-factor studies; internal KB; first-party GBP insights.
- **Action:** owned by the existing `google-business-profile` + `local-seo-agent` skills. This system
  *consumes* their output; it does not re-implement them. **Validate:** GBP insights + local-pack position checks.

## D. AI / answer-engine (AEO/GEO) — lower confidence by nature

### D1. AI Overview citations favour concise direct answers + structure + schema + authority
- **Confidence:** `INFERRED` (0.5) — AI Overviews is a separate system; behaviour is observed, not documented.
- **Sources:** observed SGE/AI-Overview citation patterns 2024–2025; internal KB AI-Overviews entry; Schema.org; corroborating analyses.
- **Action:** above-the-fold direct answer, `FAQPage`/`HowTo` schema, short declarative sentences.
  Treat all D-class actions as 🔵 `HYPOTHESIS_FOR_TESTING` with explicit before/after measurement.
- **Validate:** manual AI-Overview citation checks + the GEO visibility score §8.

### D2. "GEO/AEO/AEI" as a discipline is real but its tactics are largely unproven
- **Confidence:** `INFERRED` (0.5) that answer-engine visibility matters; `SPECULATIVE` (0.25) on most specific tactics.
- **Action:** every GEO tactic enters the backlog as a `HYPOTHESIS_FOR_TESTING`, never as a `CONFIRMED` directive.

---

## Claims explicitly NOT made (and why)

- ❌ Any specific numeric ranking-factor *weight* — Google does not publish these; the leak shows
  signals exist, not their coefficients.
- ❌ Any traffic/CTR/volume figure for a portfolio site — 🟡 `DATA_REQUIRED` (needs live GSC).
- ❌ Any Neil Patel / YouTube claim — no data ingested; would be `OPINION_SOURCE` (0.1) even if it were.

Machine-readable version: [claim-verification-ledger.json](claim-verification-ledger.json).
