# Spec — Runtime brand-voice / scoring enforcement in the AI content pipeline

> Fable-engine spec. **Proposal only — no code until the human approves.**
> Evidence tags per `.claude/rules/fabel-evidence-standard.md`.

## 1. Finish line

**Done when** every piece the AI content pipeline returns carries a **real score
from the existing scorer** (no `Math.random()` or hardcoded score constants in
any `app/api/ai/**` product surface), the brand-voice score is surfaced when the
org has a brand profile, and it's proven by green unit + route tests.

## 2. Decision up front

Use the **existing** `contentScorer.score(content, platform)` — `[VERIFIED]`
pure, synchronous, **no AI calls** (`lib/ai/content-scorer.ts:603-667`) — to
score each variation and the primary content, replacing the mock
`score: 75 + Math.random() * 25` (`app/api/ai/generate-content/route.ts:198`) and
the hardcoded `estimatedEngagement: 45` / `viralScore: 60` (lines 204-205).
Surface the **brand-voice** score via the existing
`QualityScorer.scoreContent()` (`lib/brand-voice/quality-scorer.ts`) **only when
a brand profile exists**, advisory in v1 (no hard reject on the hot path). No new
deps, no new models, no provider changes — wire what already exists
(dependency-discipline).

## 3. Goals & non-goals

**Goals**

- Remove all mock/stub scoring from `app/api/ai/**` (CLAUDE.md: "No mock/stub
  data in product surfaces").
- Real, deterministic content score on every generated piece + variation.
- Real brand-voice score surfaced when a `BrandVoiceProfile` is available.

**Non-goals**

- Rebuilding scorers — both already exist and are tested. `[VERIFIED]`
  `tests/unit/intelligence/content-scorer.test.ts`,
  `tests/unit/lib/brand-voice/quality-scorer.test.ts`.
- Hard-blocking/rejecting generation on low score (deferred to Phase 3, separate
  gate — it's a behaviour change).
- AI-provider, model-registry, or BYOK changes.
- The deferred live-browser phase.

## 4. Approach (plain language)

The skill docs now _say_ "score via the real scorer / route through
brand-voice-enforce." The live `generate-content` route doesn't — its
`ClientBrandedContentService` branch fabricates scores. We make the runtime match
the docs by calling the real, zero-cost `contentScorer` on each variation and the
primary content, and attaching a real brand-voice score when the org has a
profile. Enforcement (rejecting low scores) is a later, separately-gated phase.

## 5. Phased plan (smallest first)

**Phase 1 — Kill the mock (smallest, highest value).**
Replace the random variation score + hardcoded engagement/viral constants in the
`ClientBrandedContentService` branch with values derived from
`contentScorer.score(variationContent, platform)`. Map `'reel' → 'post'` already
done upstream; `contentScorer` defaults unknown platforms to `linkedin`
`[VERIFIED] content-scorer.ts:613`.
_DoD:_ `grep -rn "Math.random" app/api/ai/` returns nothing for scores; a new
route-level unit test asserts a deterministic, in-range score; gauntlet green.

**Phase 2 — Surface brand-voice score (advisory).**
When the caller's org has a `BrandDNA`/`BrandVoiceProfile`, call
`QualityScorer.scoreContent()` and attach `brandVoiceScore` + `autoApprove` to the
response. Guarded by the scorer's existing graceful-disable (no key → disabled,
does not throw) `[VERIFIED] quality-scorer.ts:8-15`.
_DoD:_ response includes a real `brandVoiceScore` when a profile exists, omitted
otherwise; test covers both; no added mandatory AI cost on the hot path.

**Phase 3 — Enforcement (separate human gate, optional).**
Configurable threshold; flag/route (not silently drop) sub-threshold variations.
_DoD:_ threshold configurable, tests for 401 → 403 → below-threshold → 200; explicit
founder approval before this phase ships (it changes product behaviour).

## 6. Data model

None. No new columns/models. (If Phase 3 later persists thresholds, that's a
backward-compatible, defaulted column via Supabase `apply_migration` — **never
`prisma db push`** — and its own gate.)

## 7. Security & cost guardrails

- `contentScorer` is pure → **zero AI cost / latency** on the hot path.
- `QualityScorer` may call AI → kept advisory + behind the existing
  graceful-disable so there's no new _mandatory_ spend; org-scoped via the
  existing `organizationId`/`clientId`. No secrets touched.
- Route keeps its current auth (`getUserIdFromRequestOrCookies`) and rate limit
  (`withRateLimit`) `[VERIFIED] generate-content/route.ts:15-16`.

## 8. Risk & assumption register

- `[UNCONFIRMED]` `estimatedEngagement`/`viralScore` (45/60) may be consumed by
  UI/DB expecting a specific shape — verify consumers before changing/removing.
- `[UNCONFIRMED]` `QualityScorer` latency on hot path → mitigated by advisory +
  graceful-disable; measure before Phase 2 ship.
- `[INFERENCE]` `contentScorer` covers all platforms used here (defaults to
  linkedin) — inferred from its signature, confirm per platform in tests.

## 9. Open questions (≤5)

1. Phase 2: brand-voice score **advisory** in v1 (recommended), or block?
2. Phase 3 threshold value (skills use ≥80 for content, ≥0.85 autoApprove for
   brand-voice) — which governs the gate?
3. Are `estimatedEngagement`/`viralScore` read by any UI/DB consumer today?
4. Should the primary content (not just variations) also carry the score in the
   response shape, or only variations?

## 10. Verification plan

- `grep -rn "Math.random" app/api/ai/` → no score hits.
- `npm run type-check && npm run lint && npm test` (incl. the two existing scorer
  tests + the new route test) — paste the real `Tests:` line.
- `npm run build:vercel` green.
- Manual: POST `/api/ai/generate-content`, assert variations carry varied,
  content-derived scores (not a uniform random band).

---

`[STATUS] gate: awaiting approval` — nothing builds until you approve. On approval
I'd ship Phase 1 first (the mock-data fix) as one PR for your merge.
