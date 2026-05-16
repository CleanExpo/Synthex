# Rate-Limit Audit — LLM-touching routes — 2026-05-16

**Mandate:** `a4aae2cf-6a05-4426-9019-3f38137a9b7b` (Synthex Phase 2)
**Scope:** Every route under `app/api/` that imports an LLM SDK.
**Predecessor work:** PRs #229 and #231 covered the user-facing LLM endpoints under RA-3024.

## Method

```bash
grep -rln "from ['\"]openai['\"]\|from ['\"]@anthropic\|@anthropic-ai/sdk\|from ['\"]@google/generative-ai" --include="*.ts" --include="*.tsx" app/api/
```

Returns 5 routes. Each was manually inspected for either rate-limit
middleware OR cron-secret authentication.

## Findings

| Route                                                       | LLM provider     | Trigger      | Guard                                  | Verdict |
|-------------------------------------------------------------|------------------|--------------|----------------------------------------|---------|
| `app/api/ask-synthex/route.ts`                              | Anthropic Claude | User-facing  | `withRateLimit` (line 572) — PR #229   | OK      |
| `app/api/brand-iq/next-steps/route.ts`                      | Anthropic Claude | User-facing  | `withRateLimit` (line 90) — PR #229    | OK      |
| `app/api/internal/algorithm-freshness-monitor/route.ts`     | Anthropic Claude | Cron         | `verifyCronRequest` (line 453)         | OK      |
| `app/api/internal/generate-advisor-brief/route.ts`          | Anthropic Claude | Cron         | `verifyCronRequest` (line 699)         | OK      |
| `app/api/internal/generate-review-responses/route.ts`       | Anthropic Claude | Cron         | `verifyCronRequest` (line 201)         | OK      |

## Verdict

**No gaps.** All 5 LLM-touching routes have appropriate token-spend
protection:

- 2 user-facing routes are wrapped in `withRateLimit` — a compromised
  authenticated session cannot issue unbounded Claude calls.
- 3 internal routes are gated by `verifyCronRequest` with a per-route
  `CRON_SECRET`. They are not callable from user origin, so per-user
  rate-limiting is not the right control — the secret-gate is.

## Follow-on (not blocking)

- Add a CI lint rule that fails any new `app/api/**` route importing
  `openai`, `@anthropic-ai/sdk`, or `@google/generative-ai` without
  ALSO importing `withRateLimit` or `verifyCronRequest`. The grep at
  the top of this doc is the linter prototype.
- Add a daily Sentinel summary of LLM token spend by route + by tenant.
  Surfaces unusual spikes before they hit a Claude rate limit.
