# Type-check Regression on main — 2026-05-16

## Command

```bash
npm install --no-audit --no-fund
npm run type-check   # tsc --noEmit
```

## Result

**EXIT CODE: 1**
**Errors: 15** (all `TS2304: Cannot find name 'withRateLimit'`)

## Files with errors

```
app/api/admin/vault/import-doc/confirm/route.ts:312
app/api/admin/vault/seed-all/route.ts:253
app/api/ai-content/hashtags/route.ts:379
app/api/ai-content/optimize/route.ts:613
app/api/ai-content/sentiment/batch/route.ts:402
app/api/ai-content/sentiment/route.ts:608
app/api/ai-content/translate/route.ts:517
app/api/ai/pm/suggestions/route.ts:74
app/api/analytics/predict-engagement/route.ts:788
app/api/content/variations/route.ts:183
app/api/demo/caption/route.ts:265
app/api/media/generate/image/route.ts:419
app/api/pr/press-releases/generate/route.ts:76
app/api/psychology/analyze/route.ts:211
app/api/workflows/intelligence/route.ts:170
```

All 15 routes call `withRateLimit(request, ...)` inside an exported POST handler but **never import `withRateLimit`** — the symbol is undefined at type-check time.

Sample (from `app/api/admin/vault/import-doc/confirm/route.ts`):

```ts
// RA-3024 — rate-limited wrapper around the existing handler.
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _handlePost(request));
}
```

## How did this reach main?

The CI workflow on main reports `success` for the "CI" run on f2ac8d8c. Either:
1. The `type-check` step is skipped/silent-failing in CI, OR
2. CI runs against a different tsconfig (e.g. excluding these routes), OR
3. CI was passing at merge but a dependency or path-alias change broke it post-merge.

Worth investigating in a follow-up — type-check should be a blocking gate.

## Production impact

**At runtime these routes would throw `ReferenceError: withRateLimit is not defined` on every POST.** This is a high-severity production defect across 15 endpoints touching AI content, admin vault, analytics, demo, media, PR, psychology, and workflows.

## Verdict: FAIL — blocking type-check regression on main, 15 routes broken
