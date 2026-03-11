# Phase 104-01 SUMMARY — Experiment + Prompt BO Surfaces

**Completed**: 11/03/2026
**Status**: DONE
**Commits**: 6

---

## What Was Done

Wired Bayesian Optimisation into two existing Growth-tier surfaces:
`experiment_sampling` (A/B experiment designer) and `prompt_testing`
(AI prompt tester). Both follow the established surface adapter pattern
from `geo-weights.ts`.

---

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create `lib/bayesian/surfaces/experiment-sampling.ts` | Done | 97758722 |
| 2 | Create `lib/bayesian/surfaces/prompt-testing.ts` | Done | 97758722 |
| 3 | Modify `lib/experiments/experiment-designer.ts` | Done | e9a3e77e |
| 4 | Modify `lib/prompts/prompt-tester.ts` | Done | 2d08c7be |
| 5 | Modify `app/api/prompts/test/route.ts` | Done | efd20a9d |
| 6 | Create `app/api/experiments/suggest/route.ts` + wire complete route | Done | d467d49a |
| 7 | Update BO dashboard empty-state description | Done | cfb41a21 |

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/bayesian/surfaces/experiment-sampling.ts` | Surface adapter — 6-dimension experiment type priority weights |
| `lib/bayesian/surfaces/prompt-testing.ts` | Surface adapter — temperature, maxTokens, positivityBias |
| `app/api/experiments/suggest/route.ts` | New POST endpoint — generates BO-informed experiment suggestions |

## Files Modified

| File | Change |
|------|--------|
| `lib/experiments/experiment-designer.ts` | Added optional `samplingWeights` parameter to `suggestExperiments()` |
| `lib/prompts/prompt-tester.ts` | Added optional `boParams` to `testPrompt()`, `positivityBias` to `parseResponse()` and `scoreResponseQuality()` |
| `app/api/prompts/test/route.ts` | Fetches BO params before test, registers observation after (fire-and-forget) |
| `app/api/experiments/experiments/[id]/complete/route.ts` | Registers BO observation on experiment completion (fire-and-forget) |
| `app/dashboard/optimisation/page.tsx` | Updated empty-state description to mention experiments and prompt tests |

---

## Design Decisions

### suggestExperiments() had no existing caller
Grep found zero call sites. Created `app/api/experiments/suggest/route.ts`
as the integration point. `ExperimentWizard.tsx` is a client component that
manually creates experiments — BO weight fetch stays server-side in the API
route (per the critical context instructions: no BO lookups in client components).

### BO observation parameters in complete route
The `SEOExperiment` record does not store the sampling weights that were used
when suggestions were generated. The complete route uses `EXPERIMENT_SAMPLING_DEFAULTS`
as the parameter snapshot. This gives BO a conservative prior. A future phase
can add a `samplingWeightsUsed` JSON column to `SEOExperiment` to record
the actual weights and provide richer observations.

### plan field comes from organisation.plan
Following the existing pattern in `app/api/bayesian/spaces/route.ts`:
`user.organization.plan` (Organisation model), not a user-level field.
`isSurfaceAvailable()` receives the raw plan string; the function falls back
to `free` limits for unrecognised plan names.

### positivityBias default preserves original behaviour
`scoreResponseQuality()` previously used `positiveHits * 0.03`.
The new formula is `positiveHits * 0.06 * positivityBias`.
At default `positivityBias = 0.5`: `0.06 * 0.5 = 0.03` — identical output.

---

## Verification

- `npm run type-check`: PASS (zero errors)
- `npx eslint [changed files]`: PASS (zero warnings)
- `npm test`: 11 pre-existing failures in `stripe-routes.test.ts` (unrelated
  to this phase — PRODUCTS.business/custom undefined); all other 1514 tests pass
- No new npm packages installed
- No schema changes
- No .env modifications
- No deployment actions

---

## Growth-Tier Behaviour

| Plan | prompt_testing BO | experiment_sampling BO |
|------|-------------------|------------------------|
| free | Hardcoded defaults | Hardcoded defaults |
| starter | Hardcoded defaults | Hardcoded defaults |
| pro | Hardcoded defaults | Hardcoded defaults |
| growth | BO-optimised (when available) | BO-optimised (when available) |
| scale | BO-optimised (when available) | BO-optimised (when available) |

Fallback: when `BAYESIAN_SERVICE_URL` is unreachable, `getOptimisedWeightsOrFallback()`
returns heuristic defaults — both features degrade silently.
