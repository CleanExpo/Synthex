# Vercel CFR (Change Failure Rate) Baseline — 2026-05-16

**Mandate:** `450be04c-504d-4824-bd3f-f62178721c0b` (Synthex Phase 1, Deliverable 3)
**Window:** 30 days (2026-04-16 → 2026-05-16)
**Tool:** `scripts/cfr-baseline.ts`
**Project:** `prj_gbQmHn6quoHgG3AswRrDoUlYaF40` (`synthex.social`)

## TL;DR

| metric                         | value             |
|--------------------------------|-------------------|
| production deployments (30d)   | 291               |
| failed deployments             | 64                |
| **Change Failure Rate**        | **21.99%**        |
| **DORA classification**        | **Low**           |
| Margot research baseline       | 4–5% (Elite)      |
| Variance vs Margot baseline    | **~5× worse**     |

Synthex is deploying to production ~9.7×/day. About **1 in every 5 deploys
fails outright** in Vercel's build/runtime, producing an ERROR-state
deployment that does not serve traffic. That's better than serving broken
output (the broken builds simply don't promote) but it's the strongest
single signal in this audit: **the test/CI suite isn't catching what's
breaking in Vercel's build environment.**

## Methodology

For each production deployment to `synthex.social` in the last 30 days:

1. State === `ERROR` → counted as failure (failure mode classified by
   commit-message keywords; see breakdown below).
2. Revert/hotfix commit landing within 24h of the deploy's `createdAt` →
   counted as failure (would catch silently-bad-but-built deploys).

Source: Vercel API `/v6/deployments` paginated with `until` cursor until
the window boundary is crossed.

## Results

- All 64 failures: state `ERROR` directly from Vercel.
- 0 failures: revert/hotfix within 24h on a READY deploy. (Synthex does
  not use `Revert: ` commit prefixes — likely because failed builds never
  reach prod, so a "revert" is unnecessary; the next green build supersedes
  the failed one within minutes.)
- 62 unique failing SHAs across 64 failed deploys (= almost no
  retry-on-same-SHA pattern, so each is an independent breakage).

## Failure mode breakdown

| classifier         | count | description                                            |
|--------------------|-------|--------------------------------------------------------|
| `unclassified`     |    42 | commit message didn't match build/webhook/pool keywords |
| `build`            |    13 | explicit build/Next/lockfile errors                    |
| `stripe-webhook`   |     4 | webhook/Stripe wiring issues                           |
| `supabase-pool`    |     4 | connection-pool / Supabase init issues                 |
| `security-headers` |     1 | CSP / headers regressions                              |

The `unclassified` 42 is most of the failure surface and almost certainly
includes TypeScript build errors that crept past CI's
`next build --webpack` step — `tsconfig` exclude rules + the long-standing
`SYN-877: skip Next build-time TypeScript check` workaround mean type
errors don't fail PR CI but DO fail Vercel's parallel build.

## DORA reference (Accelerate / 2023-DORA-Report numerics)

| class  | CFR range  | Synthex |
|--------|------------|---------|
| Elite  | 0–5%       |         |
| High   | 5–10%      |         |
| Medium | 10–15%     |         |
| Low    | >15%       | ✓ 21.99% |

## Recommendations

1. **Highest leverage:** turn `next build --webpack` back on in CI as a
   blocking check. Removing the `--skip-typescript-check` shortcut (or
   adding `tsc --noEmit` to the PR gate that already exists but is allowed
   to fail) would catch the ~42 unclassified failures before they hit
   Vercel. Estimate this alone drops CFR by 65%+ → 7% → DORA High.
2. **Second:** add a "production-build" job to the PR matrix that runs
   `npm run build:vercel` against the actual Lambda-targeting webpack
   config. This catches the lockfile-corruption / esm-export-condition /
   Prisma-browser-vs-node bugs that only surface in the Vercel container.
3. **Third:** alert on consecutive ERROR-state deploys (≥3 in 1h to same
   branch). Today there's no rate-limit on bad deploys — the cycle is
   "push → fail → fix → push → fail → fix" without any signal to stop.

## How to re-run

```bash
cd /Users/phill-mac/Synthex-phase1
VERCEL_TOKEN=$VERCEL_TOKEN npx tsx scripts/cfr-baseline.ts > docs/ops/cfr-baseline-$(date +%Y-%m-%d).json
```

The script paginates the Vercel API until the 30-day boundary is crossed —
no hardcoded limit.

## Contradictions surfaced vs Board memo

| Board memo claim                              | Reality                                       |
|-----------------------------------------------|-----------------------------------------------|
| "~4-5% empirical CFR for mature serverless"   | Synthex sits at 21.99%, ~5× worse than baseline. |
| "Specific failure modes: Supabase pool / Stripe webhook drift / cold-start tails / lockfile corruption" | The dominant mode is actually **unclassified build failures (42/64 = 66%)**, almost certainly TypeScript errors slipping through the skip-typescript-check workaround. Pool + webhook account for only 8/64 (12.5%). |
