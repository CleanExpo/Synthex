# Route Safety Backlog — heuristic candidates for team triage

> **These are heuristic candidates for team triage — NOT confirmed bugs.**
>
> They are produced by the conservative file-level scanner
> `scripts/security/route-safety-scan.mjs` and snapshotted in
> `scripts/security/route-safety-baseline.json`. The scanner does not parse the
> AST or trace helpers across files, so a route can appear here while actually
> being safe (e.g. validation done in an imported helper, ownership enforced in a
> service layer the heuristic didn't recognise, or a route that is intentionally
> public / cron-protected). Each entry needs a human to confirm or dismiss.

The purpose of this file is so the **lower-severity hardening backlog is tracked,
not lost**. The CI guard (`.github/workflows/route-safety.yml`) only fails on
**NEW** violations — these existing candidates are baselined and do not block CI.

Regenerate after triage / fixes:

```bash
node scripts/security/route-safety-scan.mjs --baseline
```

Snapshot taken: see `generatedAt` in `route-safety-baseline.json`.
Counts at snapshot: **[A] 21 · [B] 5 · [C] 23** (670 routes scanned).

---

## [A] missing-Zod candidates (21)

Route exports a mutation handler and reads the request body (`.json()` /
`.formData()` / `.text()`) but the file contains no Zod `safeParse` / `parse`.

Triage notes: webhooks (`stripe`, `[platform]`, `video-published`) verify a
signature rather than a Zod schema and may be acceptable as-is; health/cron
endpoints often take trivial or no meaningful body. Confirm per-route.

- [ ] app/api/admin/health/route.ts — POST
- [ ] app/api/admin/test-nrpg-event/route.ts — POST
- [ ] app/api/admin/vault/import-doc/route.ts — POST
- [ ] app/api/analytics/post-performance-sync/route.ts — POST
- [ ] app/api/auth/verify-token/route.ts — POST
- [ ] app/api/cron/insights/route.ts — POST
- [ ] app/api/google-business/photos/route.ts — POST
- [ ] app/api/health/redis/route.ts — POST, DELETE
- [ ] app/api/health/scaling/route.ts — POST
- [ ] app/api/integrations/ga4/connect/route.ts — POST
- [ ] app/api/internal/advisor-weekly-metrics/route.ts — POST
- [ ] app/api/internal/compute-content-scores/route.ts — POST
- [ ] app/api/internal/deliver-advisor-brief/route.ts — POST
- [ ] app/api/internal/deliver-monthly-story/route.ts — POST
- [ ] app/api/internal/generate-monthly-story/route.ts — POST
- [ ] app/api/internal/update-seasonal-signals/route.ts — POST
- [ ] app/api/rate-limit/route.ts — POST, PATCH
- [ ] app/api/user/avatar/route.ts — POST, DELETE
- [ ] app/api/webhooks/[platform]/route.ts — POST
- [ ] app/api/webhooks/stripe/route.ts — POST
- [ ] app/api/webhooks/video-published/route.ts — POST

---

## [C] missing-rate-limit candidates (23)

Route looks AI / expensive (AI provider import, generate\*/completion call, or
`@/lib/ai` / `content-pipeline` usage) and is not wrapped in `withRateLimit` and
references no rate-limit preset.

Triage notes: several are `internal/` cron-protected jobs (CRON_SECRET) that are
not user-reachable and may not need per-user rate limiting; confirm whether the
trigger surface is authenticated user traffic before adding `withRateLimit`.

- [ ] app/api/auth/api-keys/route.ts — POST, DELETE
- [ ] app/api/brand-dna/extract/route.ts — POST
- [ ] app/api/brand/generate/route.ts — POST
- [ ] app/api/content/score/route.ts — POST
- [ ] app/api/geo/rewrite/route.ts — POST
- [ ] app/api/google-business/reviews/[reviewId]/auto-reply/route.ts — POST
- [ ] app/api/internal/algorithm-freshness-monitor/route.ts — POST
- [ ] app/api/internal/build-knowledge-graph/route.ts — POST
- [ ] app/api/internal/compute-content-profiles/route.ts — POST
- [ ] app/api/internal/generate-advisor-brief/route.ts — POST
- [ ] app/api/internal/generate-monthly-story/route.ts — POST
- [ ] app/api/internal/generate-review-responses/route.ts — POST
- [ ] app/api/internal/vision-board/ai-commentary/route.ts — POST
- [ ] app/api/onboarding/kickstart/route.ts — POST
- [ ] app/api/onboarding/validate-key/route.ts — POST
- [ ] app/api/personas/[id]/train/route.ts — POST
- [ ] app/api/pr/journalists/[id]/route.ts — PATCH, DELETE
- [ ] app/api/pr/press-releases/[id]/route.ts — PATCH, DELETE
- [ ] app/api/prompts/trackers/route.ts — POST
- [ ] app/api/psychology/principles/route.ts — POST
- [ ] app/api/settings/api-credentials/route.ts — POST, DELETE
- [ ] app/api/system/models/route.ts — POST
- [ ] app/api/video/generate/route.ts — POST

---

## [B] missing-ownership candidates (5) — highest severity (cross-tenant IDOR)

Listed for completeness. These are the cross-tenant-IDOR class and warrant the
fastest review. A Prisma write was detected with no ownership / org-scope
indicator in the file. (Tracked in the baseline; not blocking CI.)

- [ ] app/api/bio/[pageId]/track/route.ts — POST
- [ ] app/api/internal/bo-callback/route.ts — POST
- [ ] app/api/internal/score-accuracy-matcher/route.ts — POST
- [ ] app/api/newsletter/unsubscribe/route.ts — POST
- [ ] app/api/quotes/[id]/route.ts — PUT, DELETE, PATCH

---

## [A] missing-Zod — 8 routes unmasked 21/08/2026

These were **already unvalidated**; they were invisible because `HAS_ZOD`
matched a bare `.parse(`, and `JSON.parse(` satisfies it. 44 files under
`app/api` call `JSON.parse`. Tightening the pattern (commit on
`fix/restore-migration-gate-inputs`) made them visible. Newly VISIBLE, not
newly introduced — nothing about these routes changed.

Baselined so CI still fails only on genuinely new violations, and listed here
so "baselined" does not become "forgotten".

**Priority: the four webhooks.** They accept unauthenticated payloads from an
external sender, which is the highest-value place in the codebase to validate
a body and the only group here reachable without credentials.

- [ ] app/api/webhooks/email/sendgrid/route.ts — POST — external, unauthenticated
- [ ] app/api/webhooks/resend/route.ts — POST — external, unauthenticated
- [ ] app/api/webhooks/social/route.ts — POST — external, unauthenticated
- [ ] app/api/affiliates/webhook/route.ts — POST — external, unauthenticated
- [ ] app/api/admin/private-refs/route.ts — POST — admin-gated
- [ ] app/api/internal/algorithm-freshness-monitor/route.ts — POST — internal
- [ ] app/api/internal/generate-advisor-brief/route.ts — POST — internal
- [ ] app/api/brand-iq/next-steps/route.ts — POST — product surface

Each needs a schema matching its real payload. Guessing a webhook's shape and
getting it wrong breaks production ingestion, so these are deliberately NOT
bulk-fixed in the branch that revealed them.

---

## How to clear an item

1. Fix the route (add Zod `safeParse`, an ownership/org-scope check per
   `app/api/content/bulk/route.ts`, or wrap in `withRateLimit`), **or** confirm
   it is a false positive / intentional public route.
2. Regenerate the baseline: `node scripts/security/route-safety-scan.mjs --baseline`.
3. Commit the updated `route-safety-baseline.json` and tick the box here.
