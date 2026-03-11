# Phase 102-01 SUMMARY — GEO Weight Optimisation Surfaces

**Phase**: 102 — GEO Weight Optimisation Surfaces
**Status**: COMPLETE
**Completed**: 11/03/2026
**Commits**: 5

---

## What Was Delivered

Wired Bayesian Optimisation (BO) into both primary GEO scoring surfaces.
Fixed weights replaced with dynamic per-org BO-optimised weights.
All infrastructure was pre-built in Phase 101; this phase is pure wiring.

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/bayesian/surfaces/geo-weights.ts` | Surface adapter — `geo_score_weights` dimension bounds, defaults, `getGeoScoreWeights()` |
| `lib/bayesian/surfaces/tactic-weights.ts` | Surface adapter — `tactic_weights` dimension bounds, defaults, `getTacticWeights()` |
| `app/api/bayesian/spaces/route.ts` | GET list spaces / POST create space with plan-limit checks |
| `app/api/bayesian/observe/route.ts` | POST register observation (org-scoped, DB + BO service) |
| `app/api/bayesian/suggest/route.ts` | POST get next suggested parameters |
| `app/api/bayesian/run/route.ts` | POST trigger async maximise run via BullMQ |
| `app/api/bayesian/status/[jobId]/route.ts` | GET poll job status (DB authoritative + live service merge) |
| `app/api/internal/bo-callback/route.ts` | POST async completion webhook (X-Service-Key auth) |

## Files Modified

| File | Change |
|------|--------|
| `lib/geo/geo-analyzer.ts` | `WEIGHTS` const replaced with `getGeoScoreWeights(orgId)` call; `analyzeGEO` gains optional `orgId?` param |
| `lib/geo/tactic-scorer.ts` | `COMPOSITE_WEIGHTS` replaced with `TACTIC_DEFAULTS` reference; `scoreTactics` converted to async, gains optional `orgId?` param |
| `app/api/geo/analyze/route.ts` | Fetches `user.organizationId`, passes to `analyzeGEO`, fires `registerObservationSilently()` via `void` |
| `app/api/geo/tactic-score/route.ts` | Added `await` to `scoreTactics()` (only caller — non-breaking) |

---

## Fallback Guarantee

Every call to BO weights routes through `getOptimisedWeightsOrFallback()`.
When `BAYESIAN_SERVICE_URL` is unset or the service is unreachable:
- `analyzeGEO()` uses `GEO_SCORE_DEFAULTS` (unchanged from pre-Phase 102 behaviour)
- `scoreTactics()` uses `TACTIC_DEFAULTS` (unchanged from pre-Phase 102 behaviour)
- Zero user-visible impact

---

## Breaking Change Handling

`scoreTactics()` was synchronous with one caller: `app/api/geo/tactic-score/route.ts`.
That route already used `async/await` for auth. The call site was updated with `await`.
No other callers exist in the codebase.

`analyzeGEO()` gained an optional `orgId?` parameter (non-breaking — existing callers
pass no org context and receive heuristic weights).

---

## Verification

- `npm run type-check`: PASS (zero errors after `prisma generate` and type fixes)
- ESLint on all changed files: PASS (zero warnings)
- Prisma client regenerated (`npx prisma generate`) — no schema push required
  (BO models were already in schema.prisma from Phase 101)

---

## Commit History

| Hash | Message |
|------|---------|
| `0d8e48e3` | feat(bayesian): add surface adapters for geo_score_weights and tactic_weights (102-01 T1+T2) |
| `a4af3989` | feat(geo): wire BO-optimised weights into geo-analyzer and tactic-scorer (102-01 T3+T4) |
| `b4622803` | feat(geo): auto-register BO observations after GEO analysis (102-01 T5) |
| `1fe325e7` | feat(api): add Bayesian Optimisation API routes (102-01 T6-T11) |
| `ffe90615` | fix(bayesian): resolve TypeScript errors in surfaces and observe route (102-01) |

---

## Notes

- `prisma generate` was run locally to regenerate the Prisma client with BO model types.
  This is required before deploying — the BO models exist in schema but the generated
  client was stale. No `prisma db push` was performed.
- The `npm run lint` command ran out of heap memory on the full codebase (pre-existing
  issue with ESLint on 91-model project). Lint was verified on all 12 changed files
  individually with zero warnings.
