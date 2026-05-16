# Service-Role Refactor Priority List — 2026-05-16

**Source:** `docs/security/service-role-leak-triage-2026-05-16.md`
**Scope:** REFACTOR-CRITICAL + top REFACTOR-AUTH-SCOPED routes.

Routes are ordered by: (1) exploitability (CRITICAL > AUTH-SCOPED), (2) data sensitivity, (3) traffic.

## Top 10 (refactor first)

| Rank | Route | Class | Why first | Refactor scope |
|---|---|---|---|---|
| 1 | `app/api/og/effect-report/route.tsx` | REFACTOR-CRITICAL | NO auth + `?client_id=` flows into `.eq('client_id', x)` on `effect_reports`. Leaks full report_data JSON for any tenant. **Fixed in this PR.** | Auth gate + ignore param + node runtime |
| 2 | `app/api/results/testimonial-card/route.tsx` | REFACTOR-CRITICAL | NO auth + `?client_id=` over `organizations`, `client_geo_scores`, `brand_profiles`. Leaks org name + GEO trend + brand colour | Same template as #1 |
| 3 | `app/api/journey/click/route.ts` | REFACTOR-CRITICAL | Unsigned email-tracking link. Takes `client_id`+`moment_id` from query string, mutates `client_journey_events`. Lets any caller flip another tenant's event states | HMAC-sign the link token at email-send time; verify before write |
| 4 | `app/api/journey/pulse/route.ts` | REFACTOR-CRITICAL | Same shape — unsigned 1×1-pixel survey writer | Same HMAC fix |
| 5 | `app/api/journey/pulse-confirm/route.ts` | REFACTOR-CRITICAL | Same shape — unsigned survey-confirmation page | Same HMAC fix |
| 6 | `app/api/effect-report/generate/route.ts` | REFACTOR-CRITICAL | `body.client_id` override accepted for any `role === 'owner'`. Per-org owners can cross-tenant generate reports | Drop override OR cross-org-membership check before honouring it |
| 7 | `app/api/ask-synthex/route.ts` | REFACTOR-CRITICAL | `AskSynthexSchema.clientId` user-supplied, same per-org owner-cross-tenant gap as #6 | Tighten owner-bypass: assert `body.clientId === auth.clientId` unless caller is platform-admin |
| 8 | `app/api/dashboard/geo-score/route.ts` | REFACTOR-AUTH-SCOPED | High-traffic dashboard endpoint; safe today but regression-prone | `withAuth` wrap |
| 9 | `app/api/dashboard/content-score-history/route.ts` | REFACTOR-AUTH-SCOPED | Same — dashboard, high traffic | `withAuth` wrap |
| 10 | `app/api/notifications/route.ts` | REFACTOR-AUTH-SCOPED | Polled by every dashboard session; contains PII | `withAuth` wrap |

## Tier 2 (batches of 5 after Top 10)

11. `app/api/effect-report/[id]/pdf/route.ts` — add explicit `report.client_id === auth.clientId` assertion
12. `app/api/email/send/route.ts` — `withAuth` wrap
13. `app/api/media/upload/route.ts` — `withAuth` wrap
14. `app/api/patterns/cached/route.ts` — `withAuth` wrap
15. `app/api/analytics/post-performance-sync/route.ts` — `withAuth` wrap
16. `app/api/effect-report/list/route.ts` — already `withAuth` ✓; consolidate admin client factory
17. `app/api/effect-report/by-period/route.ts` — same
18. `app/api/health/pipelines/route.ts` — system-wide intentionally; doc-only

## Tier 3 (single batched PR — same pattern across 9 routes)

19–27. All 9 `app/api/social/<platform>/post/route.ts` files. Refactor as one PR — `withAuth` wrap + `platform_connections.user_id = auth.userId` assertion across all.

## This PR refactors rank #1

Per the mandate's hard rule "DO NOT bulk-refactor all 46", this PR ships the single highest-risk route: **`app/api/og/effect-report/route.tsx`** (rank #1). Ranks #2–#27 will follow in subsequent PRs.
