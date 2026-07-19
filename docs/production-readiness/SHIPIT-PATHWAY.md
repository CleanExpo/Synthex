# Synthex — Production-Readiness / Shipit Pathway

> **RECONCILED 2026-07-19 — Status: GREEN.** Every ship-gate P0/P1 below was closed the same week the
> audit ran (PR #321 `cadaa9a6` + #327 `0b6ab0a4`), verified against main `5f8ba0fa` by a 13-agent
> evidence reconciliation (workflow `wf_fa779d84-264`) with live production probes (SSRF payload →
> HTTP 400; demo endpoint → 200) and a full local gauntlet (type-check 0 errors, lint clean,
> **6813 tests / 0 fail**). Fast-follow P2s are also closed except **DB-BASELINE** (founder-gated,
> SYN-1002 — DR debt, not a deploy gate). `TEST-CRITICAL-COVERAGE`'s last open slice (auto-publish
> State-1/State-6) closed with real behavioural tests + the State-1 hold-no-retry implementation in
> the same PR as this note. Per-blocker evidence: `readiness-scorecard.json` → `reconciliation`.
> The body below is retained unchanged as the 2026-05-29 point-in-time record.

> Status (2026-05-29, superseded): **RED — not production-ready as-is.** Estimate to ship: **~4 working days** (P0 + P1 only).
> Source: evidence-based swarm audit (`wf_d5164248-da2`, 28 agents) — six finders ran the real gates +
> scans, every blocker was adversarially verified (disprove-first), Senior PM synthesised the pathway.
> Raw evidence: [`readiness-scorecard.json`](readiness-scorecard.json) · [`audit-findings-raw.json`](audit-findings-raw.json).
> No hype. Every line below traces to a verified finding.

## Verdict (blunt)

Not shippable today. One confirmed **P0 SSRF** on a **public, unauthenticated** endpoint reaches cloud
metadata → IAM credential theft / infra compromise. One confirmed **P1 IDOR** lets any tenant read+write
another tenant's comments on a multi-tenant app. The **build is genuinely clean** (type-check 0 errors,
lint clean at `--max-warnings 0`, **3672 tests pass / 0 fail**), and auth discipline across 664 routes is
broadly sound — but the **test suite is theatre on the surfaces that matter** (82 API test files mock
Prisma, so nothing proves org-scoped queries actually filter; RLS/integration tests are env-gated and
skipped every run). The migration system can't rebuild prod (DR debt) but does **not** gate the live
deploy (Vercel runs `prisma generate` + `next build`, not `migrate deploy`). **Fix the two security
defects, prove the IDOR fix with a real cross-tenant test, ship. Everything else is fast-follow.**

## Scorecard

| Dimension                         |  Status  | One line                                                                                                                                                                           |
| --------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build & Quality Gates             | 🟢 GREEN | type-check 0 errors, lint clean, 3672 pass / 0 fail in 18s.                                                                                                                        |
| Security (SSRF / authz / secrets) |  🔴 RED  | **P0** SSRF via IPv4-mapped IPv6 `[::ffff:169.254.169.254]` on public `/api/demo/analyze`; no DNS recheck. JWT/CORS/returnTo/org-scope OK; no committed secrets.                   |
| Architecture & API compliance     | 🟡 AMBER | **P1** IDOR: `GET/POST /api/comments` authenticates but never authorizes (cross-tenant read+write). In-memory rate limiter useless on serverless (P2).                             |
| Integrations / OAuth / crons      | 🟡 AMBER | **P1** GA4 token read bypasses self-heal → dies hourly until manual reconnect (GSC/GBP self-heal correctly). LinkedIn has no refresh_token (P2). Cron 500s need Vercel-log triage. |
| Test-suite reality                |  🔴 RED  | Green but false confidence: 82 files mock Prisma, RLS/integration tests skipped, OAuth-callback/GSC/admin routes zero behavioral coverage, auto-publish = 27 `it.todo()`.          |
| Database & migrations             | 🟡 AMBER | Schema valid (214 models) but migrations reconstruct ~58 and prod ledger is empty → DR/bootstrap broken. **Not** a live-deploy gate; high-priority debt.                           |

## Ship gate — P0 / P1 (must clear before deploy)

| ID                     |  Sev   | Title                                                                     | Fix (summary)                                                                                                                                                          | Effort | Owner                  | Depends           |
| ---------------------- | :----: | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------- | ----------------- |
| `SEC-SSRF-IPV6`        | **P0** | SSRF: mapped-IPv6 bypass reaches cloud metadata from public demo endpoint | Block `::ffff:` patterns in `lib/security/validate-url.ts` **and** DNS-resolve the host + re-check resolved IP against private/metadata ranges (kills DNS-rebind too)  |  0.5d  | codex-security-auditor | —                 |
| `SEC-IDOR-COMMENTS`    | **P1** | `/api/comments` authenticates but doesn't authorize (cross-tenant)        | Load parent content by `contentType+contentId`, verify caller owns it / shares `organizationId` before findMany + on POST; 404 if not; all 4 contentType branches      |  0.5d  | code-architect         | —                 |
| `TEST-IDOR-REGRESSION` | **P1** | Prove the IDOR fix holds (not Prisma-mocked)                              | `tests/unit/api/comments-authz.test.ts` invoking real GET/POST: different-org caller gets 404/403 on read+write; exercises (not mocks) the ownership query             |  0.5d  | qa-sentinel            | SEC-IDOR-COMMENTS |
| `INT-GA4-REFRESH`      | **P1** | GA4 OAuth dies hourly — never self-heals                                  | In `ga4/properties/route.ts` get the token via `getOAuthAccessToken(connection.id)` (the lazy-refresh path GSC/GBP already use) instead of `decryptField(accessToken)` |  0.5d  | code-architect         | —                 |
| `OPS-CRON-500-TRIAGE`  | **P1** | Confirm/clear reported prod cron 500s                                     | Pull 7-day Vercel cron logs + env audit for `dr-gbp-oauth-refresh`, `seo-audits`, `autopilot`; root-cause or close with real stack traces                              |   1d   | build-engineer         | —                 |

## Fast-follow — P2 (after ship)

| ID                          | Title                                                                                                           | Effort | Owner                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | :----: | ---------------------- |
| `TEST-CRITICAL-COVERAGE`    | Behavioral tests for OAuth-callback, admin, auto-publish State-1/State-6 (real handlers, not string-scan)       |   5d   | qa-sentinel            |
| `SEC-SSRF-DEFENSE-IN-DEPTH` | Gate website-analyzer Firecrawl path + YouTube `thumbnailUrl` fetch with `validateExternalUrl`                  |  0.5d  | codex-security-auditor |
| `DB-BASELINE`               | Execute + verify prod migration baseline, stamp `_prisma_migrations`, squash from-empty baseline (CEO sign-off) |   3d   | database-prisma        |
| `INT-LINKEDIN-REFRESH`      | Enrol LinkedIn refresh-token program or surface pre-expiry reconnect notice                                     |   1d   | general-purpose        |
| `OBS-RATELIMIT-ERRORS`      | Upstash-back AI-route rate limiting; stop dashboard GETs masking outages as 200 (feed Sentry)                   |   2d   | senior-reviewer        |

## Critical path (ordered)

1. `SEC-SSRF-IPV6` — patch P0, verify with live curl
2. `SEC-IDOR-COMMENTS` — ownership/org gate on `/api/comments`
3. `TEST-IDOR-REGRESSION` — cross-tenant test proving the fix
4. `INT-GA4-REFRESH` — route GA4 through the self-heal path
5. `OPS-CRON-500-TRIAGE` — confirm/clear cron 500s from Vercel logs
6. **senior-reviewer** post-change review (route-auditor + security-hardener + architecture-enforcer)
7. **Ship to production behind HUMAN GATE sign-off**
8. Fast-follow: `TEST-CRITICAL-COVERAGE` → `SEC-SSRF-DEFENSE-IN-DEPTH` → `DB-BASELINE` (CEO sign-off) → `INT-LINKEDIN-REFRESH` → `OBS-RATELIMIT-ERRORS`

## Definition of Ready (checkable gate — "done" means done)

- [ ] `POST /api/demo/analyze {"url":"http://[::ffff:169.254.169.254]/latest/meta-data"}` → **HTTP 400**, error body, not a fetched body — output pasted
- [ ] DNS-rebind domain → 169.254.169.254 also blocked (DNS recheck in place); unit test covers bracketed + bare mapped forms
- [ ] Cross-org: user B GET **and** POST `/api/comments` for user A's `contentId` → 404/403 — both curl outputs pasted; `comments-authz.test.ts` exercises (not mocks) the ownership query
- [ ] GA4: a `googleanalytics` connection with past `expiresAt` → `/api/integrations/ga4/properties` returns 200 and the row's token/expiry are refreshed
- [ ] Vercel cron logs for the 3 crons reviewed — each clean over 7 days or root-caused + fixed; severity assigned from real traces
- [ ] `npm run type-check && npm run lint && npm test` green **with the new tests** — paste the `Tests: X passed` line
- [ ] senior-reviewer sign-off on all changes; **HUMAN GATE** sign-off for the deploy (no DB migration in this batch → no CEO migration gate)
- [ ] Linear issues exist for every blocker (P0/P1 in the gate, P2 as fast-follow)

## Risks if shipped as-is today

1. **Unauthenticated cloud-IAM credential theft** via the public demo endpoint (mapped-IPv6 SSRF) — most severe, full infra compromise.
2. **Cross-tenant comment read/write** (IDOR) by enumerating `contentId` — and no test catches it (Prisma mocked).
3. **GA4 silently breaks ~1h after every connect** until manual reconnect — recurring user-visible failure.
4. **Unknown cron health** — reported 500s unverified from source; GBP/SEO/autopilot jobs may be failing now.
5. **Green CI is misleading** — RLS/org-scope regressions would pass undetected (integration tests skipped).
6. **Dashboard outages invisible to monitoring** — ~5 GET routes return 200 with empty payloads on DB failure.
7. **No working DR** — prod can't be reconstructed from migrations (~58 of 214 models; empty ledger).
8. **LinkedIn dies ~every 60 days** with no proactive warning.
