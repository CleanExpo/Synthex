# Vercel Production Deploy State — 2026-05-16

## Last 5 Deploy workflow runs on main

```
2026-05-16T07:53:55Z db=25956663254 sha=f2ac8d8 failure   <-- Phase 2 (#245)
2026-05-16T07:35:36Z db=25956300929 sha=b334bb0 failure   <-- Phase 1 (#238)
2026-05-16T07:21:05Z db=25956019889 sha=6c579c3 success   <-- SYN-824 (#244)
2026-05-16T07:20:33Z db=25956008282 sha=db0ad84 failure   <-- SYN-831 (#254)
2026-05-16T07:20:24Z db=25956004786 sha=b51cc4e success   <-- SYN-825 (#249)
```

## Failure root cause (f2ac8d8 deploy)

GH Actions step "Deploy Production" hit `Error: Upload aborted` repeatedly from Vercel CLI (chunk-X775BOSL.js:44942). Exit code 1. This is a transient Vercel CLI artifact upload issue, NOT a build failure.

## Reconciliation against live production

`GET /api/health` returns `buildId: f2ac8d8` (Phase 2 commit). Production IS serving f2ac8d8. Vercel's native git integration deployed it; the GH Actions workflow's `vercel deploy` upload step failed independently.

## CI status for Phase 2 commit f2ac8d8

| Workflow | Conclusion |
|---|---|
| CI | success |
| Security | success |
| DESIGN.md lint | success |
| CodeQL | success |
| Deploy | **failure** (upload aborted — production deployed anyway via Vercel git integration) |
| Lighthouse Audit | skipped |

## Recommended follow-up

- Investigate why `vercel deploy` upload fails repeatedly (suspect: deprecated Node 20 runner warning in same job, or oversized artifact).
- Either fix the GH Actions deploy step or remove it and rely solely on Vercel git integration.

## Verdict: PASS (production serving correct commit) with CONDITIONAL note on CI deploy workflow health
