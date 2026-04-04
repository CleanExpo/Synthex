# Synthex — Senior PM Execution Plan

**Date:** 2026-03-23 | **Author:** Audit synthesis (security + production readiness + discovery)
**Score at assessment:** 39/100 (NOT PRODUCTION READY)
**Target score:** 79/100 (viable for limited public access)

---

## Legend

| Column | Meaning                                            |
| ------ | -------------------------------------------------- |
| Owner  | E = Engineer, H = Human (PM/founder), D = Designer |
| Effort | XS <2h · S <1d · M 1–3d · L 3–7d · XL >1w          |
| Deps   | Ticket IDs that must be Done first                 |
| Blocks | Ticket IDs that cannot start until this is Done    |

---

## PHASE 0 — Security Emergency Sprint

**Window:** Days 1–3 · **Gate:** All P0 tickets Done before ANY new users onboarded

These are active security vulnerabilities. Deploy these as a single atomic PR. No new feature work ships until this phase closes.

| ID    | Ticket                                                            | Owner | Effort | Deps | Blocks | Acceptance Criteria                                                | Risk Note                                             |
| ----- | ----------------------------------------------------------------- | ----- | ------ | ---- | ------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| SEC-1 | Add auth + org check to `/api/content/branded`                    | E     | XS     | —    | LAUNCH | 401 without valid session; 403 cross-org                           | BLOCKER-1. IDOR confirmed.                            |
| SEC-2 | Add auth + org check to `/api/brand/profile`                      | E     | XS     | —    | LAUNCH | 401 without valid session; 403 cross-org                           | BLOCKER-2. IDOR confirmed.                            |
| SEC-3 | Remove `accessToken` from `/api/auth/unified-login` JSON body     | E     | XS     | —    | LAUNCH | Response body contains no token field; httpOnly cookie still set   | BLOCKER-3. Defeats httpOnly entirely.                 |
| SEC-4 | Create `validateExternalUrl()` utility; apply to all SSRF vectors | E     | S      | —    | LAUNCH | Demo/analyze + 3 SEO endpoints reject non-HTTP and private-IP URLs | BLOCKER-4. SSRF via user-controlled URLs.             |
| SEC-5 | Add HMAC verification to Edge middleware JWT decode               | E     | S      | —    | LAUNCH | Forged JWTs rejected at middleware layer before route handlers     | BLOCKER-5. Currently decodes without signature check. |
| SEC-6 | Remove `NEXT_PUBLIC_BYPASS_TOKEN` from `.env.example`             | E     | XS     | —    | —      | `.env.example` no longer contains the key; SYN-395 closed          | MISSING-12. Leaks to client bundle.                   |
| SEC-7 | Wire critical-error Slack/webhook alert                           | E     | S      | —    | —      | One Slack message fires on any unhandled 500 in production         | BLOCKER-6. Currently blind to server errors.          |

**Parallelization:** SEC-1, SEC-2, SEC-3, SEC-5, SEC-6 can all be worked simultaneously by one or two engineers. SEC-4 requires identifying all SSRF surfaces first (30 min grep), then implementation. SEC-7 is independent.

---

## PHASE 1 — Legal & Compliance Sprint

**Window:** Days 2–5 · **Gate:** All items Done before public signup opens

Legal exposure that creates liability — GDPR violations, stale policy, cookie consent.

| ID     | Ticket                                                              | Owner | Effort | Deps   | Blocks | Acceptance Criteria                                                                                 | Risk Note                                                 |
| ------ | ------------------------------------------------------------------- | ----- | ------ | ------ | ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| COMP-1 | Fix GDPR account deletion — call `supabase.auth.admin.deleteUser()` | E     | S      | —      | LAUNCH | DELETE /api/user/account removes Supabase Auth record; verified via Supabase dashboard              | MISSING-5. Current code leaves Auth record. GDPR Art. 17. |
| COMP-2 | Add cookie consent banner (GDPR + CCPA)                             | E+D   | M      | —      | LAUNCH | Banner appears on first visit; preferences persisted; no analytics fires before consent             | MISSING-8. No consent mechanism exists.                   |
| COMP-3 | Add data export endpoint (GDPR Art. 20)                             | E     | M      | —      | —      | POST /api/user/export returns JSON of all user data; rate-limited                                   | MISSING. Privacy policy claims GDPR compliance.           |
| COMP-4 | Update privacy policy content                                       | H     | S      | COMP-3 | LAUNCH | Last updated date ≥ 2026-03-23; address is correct; mentions all 9 platforms; data export described | Last updated Jan 2025. 14 months stale.                   |
| COMP-5 | Fix WebSocket CORS wildcard                                         | E     | XS     | —      | —      | `Access-Control-Allow-Origin` in ws route restricted to synthex.social                              | MISSING-9. Currently `*`.                                 |

**Parallelization:** COMP-1, COMP-2, COMP-5 are fully independent. COMP-3 before COMP-4 (policy must describe the export mechanism).

---

## PHASE 2 — Production Infrastructure

**Window:** Week 2 · **Gate:** All items Done before removing invite-only restriction

| ID      | Ticket                                                                        | Owner | Effort | Deps         | Blocks          | Acceptance Criteria                                                                                                 | Risk Note                                                                                             |
| ------- | ----------------------------------------------------------------------------- | ----- | ------ | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| INFRA-1 | Generate catch-up Prisma migration from current schema                        | E     | S      | —            | INFRA-2         | `prisma/migrations/` contains a baseline migration for current 141-model schema; `prisma migrate deploy` runs clean | HIGH RISK. Requires careful dry-run first. Never run `prisma db push` on production again after this. |
| INFRA-2 | Verify RLS on all 131 tables (SYN-398)                                        | E     | S      | INFRA-1      | LAUNCH          | SQL query confirms policy exists for every `public.*` table; result documented                                      | Migration 20260319000001 claims fix but unverified.                                                   |
| INFRA-3 | Confirm and schedule backup system in production                              | H+E   | S      | —            | —               | `scripts/backup-system.js` runs daily via cron; last backup timestamp visible in admin dashboard                    | Backups configured but activation unconfirmed.                                                        |
| INFRA-4 | Confirm Redis connection (not in-memory fallback) in prod                     | H     | XS     | —            | —               | `/api/health/redis` returns `{ mode: "redis" }` not `{ mode: "memory" }` on synthex.social                          | Rate limiter resets per cold start if memory mode.                                                    |
| INFRA-5 | Replace in-memory error tracker with production-grade solution                | E     | M      | —            | —               | Server errors visible in external dashboard (Axiom / Highlight.io / Sentry workaround); alert fires on new error    | Sentry disabled due to cold-start hang. 1,000-item in-memory buffer is not production-grade.          |
| INFRA-6 | Phase 122 E2E: sign up → connect platform → create post → publish → analytics | **H** | M      | PHASE-0 done | MILESTONE-CLOSE | All 8 critical paths pass manually on synthex.social; SYN-410 closed                                                | HUMAN GATE. No automation substitutes this.                                                           |

**Dependencies:** INFRA-1 → INFRA-2 is the only hard sequential dependency. Everything else can run in parallel.

---

## PHASE 3 — Quality Gates

**Window:** Week 2–3 · **Gate:** In place before any v11.0 feature work begins

| ID   | Ticket                                                    | Owner | Effort | Deps | Blocks | Acceptance Criteria                                                                            | Risk Note                                           |
| ---- | --------------------------------------------------------- | ----- | ------ | ---- | ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| QG-1 | Fix 75 lint warnings                                      | E     | S      | —    | QG-2   | `npm run lint` output shows 0 warnings                                                         | Fix before enforcing gate.                          |
| QG-2 | Add `--max-warnings 0` to CI lint step                    | E     | XS     | QG-1 | —      | CI fails on any new lint warning                                                               | Prevents silent accumulation.                       |
| QG-3 | Fix admin/layout.tsx direct Prisma import (SYN-405)       | E     | XS     | —    | —      | `admin/layout.tsx` routes through a `lib/` service; no direct Prisma import in component layer | Layer violation.                                    |
| QG-4 | Remove unused `@auth/prisma-adapter` dependency (SYN-401) | E     | XS     | —    | —      | Package removed from `package.json`; build passes; bundle size decreases                       | Dead dep.                                           |
| QG-5 | Add Prisma query logging middleware in dev mode           | E     | XS     | —    | —      | Slow queries (>100ms) log with query text and duration in `npm run dev` output                 | Surfaces N+1 patterns immediately.                  |
| QG-6 | Raise Jest coverage threshold: 4% → 40%                   | E     | L      | —    | —      | `jest.config.cjs` thresholds updated; CI enforces 40% branches/functions/lines                 | 4% is security theatre. Will require writing tests. |

**Parallelization:** QG-3, QG-4, QG-5 are XS independent tasks — batch in one PR. QG-1 before QG-2. QG-6 is a standalone effort requiring test authoring.

---

## PHASE 4 — Functional Completeness

**Window:** Week 3–4 · **Priority:** Paying users currently hit stubs/broken flows

| ID     | Ticket                                              | Owner | Effort | Deps | Blocks | Acceptance Criteria                                                                                   | Risk Note                                                                        |
| ------ | --------------------------------------------------- | ----- | ------ | ---- | ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| FUNC-1 | Implement PDF report export (PB2)                   | E     | L      | —    | —      | POST /api/reports/{id}/export returns `application/pdf` >0 bytes with real data                       | Current implementation returns stub. jspdf is already in serverExternalPackages. |
| FUNC-2 | Wire scheduled report email queue (PB3)             | E     | L      | —    | —      | ScheduledReport rows trigger emails via Resend; delivery confirmed in Resend dashboard                | Queue not wired. Paying users receive nothing.                                   |
| FUNC-3 | Persist onboarding progress to DB immediately (PB7) | E     | S      | —    | —      | Closing tab mid-onboarding and reopening resumes at correct step; sessionStorage no longer sole state | sessionStorage-only means progress lost on tab close.                            |
| FUNC-4 | Billing history endpoint (PB10)                     | E     | S      | —    | —      | Settings billing page shows real invoice rows from Stripe; not a placeholder                          | `lib/api/settings.ts` billing history is a stub.                                 |
| FUNC-5 | Fix 7 HIGH WCAG contrast violations (SYN-399)       | D+E   | S      | —    | —      | Lighthouse accessibility score ≥90; 0 HIGH contrast violations                                        | Accessibility lawsuit risk.                                                      |

**Parallelization:** All 5 tickets are fully independent.

---

## PHASE 5 — Deep Structural Work

**Window:** Month 2 · **Owner:** Engineering sprint planning

| ID        | Ticket                                                     | Owner | Effort | Deps    | Acceptance Criteria                                                        | Risk Note                                                  |
| --------- | ---------------------------------------------------------- | ----- | ------ | ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| STRUCT-1  | Feature flag system (GrowthBook or PostHog)                | E     | XL     | —       | Flags drive at least 3 features; gradual rollout documented                | No canary capability currently. All changes are big-bang.  |
| STRUCT-2  | Raise Jest coverage to 70%+                                | E     | XL     | QG-6    | jest.config.coverage.js thresholds active and passing                      | Long-running effort. Assign dedicated sprint.              |
| STRUCT-3  | API response time SLAs + alerting                          | E     | L      | INFRA-5 | P99 latency tracked; alert fires if >2s on any critical route              | No performance budget exists.                              |
| STRUCT-4  | N+1 query audit and DataLoader patterns                    | E     | L      | QG-5    | No query group shows >10 DB calls for a single user action                 | QG-5 (Prisma logging) must surface patterns first.         |
| STRUCT-5  | Bundle size CI gate                                        | E     | M      | —       | Build fails if Lambda artifact exceeds defined size budget                 | No size regression protection.                             |
| STRUCT-6  | Archive `api.legacy/` directory                            | E     | XS     | —       | `api.legacy/` moved to `.claude/archived/2026-03-23/`; not in repo root    | 13 Express files confusing contributors.                   |
| STRUCT-7  | Delete empty `src/` directory                              | E     | XS     | —       | `src/` removed from repo; only README.md was there                         | Dead directory.                                            |
| STRUCT-8  | Anonymous export cleanup (SYN-404)                         | E     | M      | —       | Zero unnamed exports in component files                                    | Tree-shaking and refactoring blocked.                      |
| STRUCT-9  | Empty state illustrations: analytics + platforms screens   | D     | L      | —       | Zero-data states show illustrated empty state, not blank page              | High-traffic screens currently show nothing on first load. |
| STRUCT-10 | Self-serve subscription cancellation flow                  | E     | L      | —       | User can cancel from Settings; Stripe webhook updates status               | Not confirmed implemented. Paying users cannot self-serve. |
| STRUCT-11 | AI model transparency (show which model generated content) | E     | M      | —       | Post detail shows AI provider + model name; Settings shows current default | Opaque to users. Trust issue.                              |
| STRUCT-12 | Team invitation UI verification                            | E     | S      | —       | Invite flow works end-to-end; TeamInvitation model is wired to UI          | Model exists but UI wiring unconfirmed.                    |

---

## Milestone Map

```
MILESTONE A — Secure the Platform (BLOCKER to any public traffic)
  └─ PHASE 0 (SEC-1..7) + SEC-6 done
  └─ Owner: Engineer
  └─ Effort: ~2 engineer-days

MILESTONE B — Legal Clearance (BLOCKER to removing invite-only)
  └─ PHASE 1 (COMP-1..5) done
  └─ Owner: Engineer + Designer + Founder (content)
  └─ Effort: ~4 engineer-days

MILESTONE C — Production Infrastructure (BLOCKER to v10.0 close)
  └─ PHASE 2 (INFRA-1..6) done, including human E2E gate
  └─ Owner: Engineer + Human gate
  └─ Effort: ~3 engineer-days + 1 human day

MILESTONE D — Quality Foundation (BLOCKER to v11.0 kickoff)
  └─ PHASE 3 (QG-1..6) done
  └─ Effort: ~3 engineer-days

MILESTONE E — Functional Completeness (Required for paid tier)
  └─ PHASE 4 (FUNC-1..5) done
  └─ Effort: ~8 engineer-days

MILESTONE F — Platform Maturity (v11.0)
  └─ PHASE 5 (STRUCT-1..12) done
  └─ Effort: ~6–8 engineer-weeks
```

---

## Execution Order (ruthless prioritization)

### THIS WEEK (Days 1–5)

```
Day 1 (parallel):   SEC-1, SEC-2, SEC-3, SEC-6    [Engineer A]
                    SEC-5, SEC-4                   [Engineer A, sequential]
                    SEC-7                          [Engineer B]
Day 2 (parallel):   COMP-1, COMP-5                [Engineer A]
                    COMP-2                         [Engineer B + Designer]
Day 3:              COMP-3                         [Engineer A]
                    COMP-4                         [Human — content]
                    INFRA-4                        [Human — check health endpoint]
Day 4:              INFRA-3                        [Human + Engineer]
                    INFRA-1 (dry-run first)        [Engineer — careful]
Day 5:              INFRA-2 (after INFRA-1)        [Engineer]
                    QG-3, QG-4, QG-5              [Engineer — batch PR]
```

### THIS MONTH (Weeks 2–4)

```
Week 2: INFRA-5 (observability), QG-1→QG-2, QG-6 (coverage sprint)
        INFRA-6 (human E2E gate) — schedule with founder
Week 3: FUNC-3, FUNC-4, FUNC-5 (all parallel)
Week 4: FUNC-1, FUNC-2 (larger, parallel)
```

### NEXT QUARTER (Month 2+)

```
STRUCT-6, STRUCT-7 (XS — do these in 10 minutes any time)
STRUCT-1 (feature flags — requires product decision on vendor)
STRUCT-2 (coverage — ongoing sprint allocation)
STRUCT-3, STRUCT-4 (observability after INFRA-5 baseline)
STRUCT-5, STRUCT-8, STRUCT-9 (quality polish)
STRUCT-10, STRUCT-11, STRUCT-12 (product gaps)
```

---

## What CAN Be Parallelized

| Group                                      | Tickets                    | Notes                                |
| ------------------------------------------ | -------------------------- | ------------------------------------ |
| SEC-1 + SEC-2 + SEC-3 + SEC-6              | IDOR fixes + token removal | Same PR, same pattern, ≤1 hour total |
| COMP-1 + COMP-5 + SEC-5                    | Independent security fixes | Different files, no conflicts        |
| QG-3 + QG-4 + QG-5                         | All XS housekeeping        | Batch in one PR                      |
| FUNC-1 + FUNC-2 + FUNC-3 + FUNC-4 + FUNC-5 | All functional gap tickets | No shared files                      |
| STRUCT-6 + STRUCT-7                        | File moves/deletes         | 10 minutes, any time                 |

---

## What MUST Be Sequential

| Sequence               | Reason                                                   |
| ---------------------- | -------------------------------------------------------- |
| QG-1 → QG-2            | Fix warnings before enforcing 0-warning gate             |
| INFRA-1 → INFRA-2      | Generate migration before verifying RLS                  |
| QG-5 → STRUCT-4        | Must surface N+1 patterns before fixing them             |
| COMP-3 → COMP-4        | Privacy policy must describe the export endpoint         |
| PHASE 0 done → INFRA-6 | Don't run human E2E on a system with open security holes |

---

## Risk Register

| Risk                                                  | Probability | Impact   | Mitigation                                                                                |
| ----------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------- |
| INFRA-1 (migration generation) corrupts production DB | Low         | Critical | Dry-run on staging first; verify with `prisma migrate status`; snapshot DB before running |
| COMP-2 (cookie consent) breaks analytics tracking     | Medium      | Medium   | Implement consent-gated analytics; test that GA/PostHog fires only post-consent           |
| SEC-5 (HMAC verification) breaks legitimate JWTs      | Low         | High     | Test with existing active sessions; roll out with feature flag if STRUCT-1 exists         |
| QG-6 (coverage threshold) blocks CI for weeks         | High        | Medium   | Set interim 20% target first; ratchet to 40% after test sprint                            |
| INFRA-6 (human E2E) discovers critical bugs           | Medium      | High     | Block v10.0 close; triage any failures immediately into new Phase 0 tickets               |

---

## Quick Wins — Do These First (< 2h total)

These require almost no effort but meaningfully reduce risk:

1. **SEC-6** — Remove `NEXT_PUBLIC_BYPASS_TOKEN` from `.env.example` (5 min)
2. **COMP-5** — Fix WebSocket CORS wildcard (10 min)
3. **QG-3** — Fix admin/layout Prisma import (15 min)
4. **QG-4** — Remove unused `@auth/prisma-adapter` (5 min)
5. **STRUCT-6** — Archive `api.legacy/` (5 min)
6. **STRUCT-7** — Delete empty `src/` (2 min)
7. **INFRA-4** — Check `/api/health/redis` on prod (5 min)

Total: ~47 minutes. Ship as two PRs (security + housekeeping) on Day 1.

---

## Ticket Count Summary

| Phase                             | Tickets | Effort                | Owner |
| --------------------------------- | ------- | --------------------- | ----- |
| PHASE 0 — Security Emergency      | 7       | ~2d                   | E     |
| PHASE 1 — Legal & Compliance      | 5       | ~4d                   | E+D+H |
| PHASE 2 — Production Infra        | 6       | ~3d + human gate      | E+H   |
| PHASE 3 — Quality Gates           | 6       | ~3d                   | E     |
| PHASE 4 — Functional Completeness | 5       | ~8d                   | E+D   |
| PHASE 5 — Structural (long-term)  | 12      | ~8w                   | E+D   |
| **Total**                         | **41**  | **~4w critical path** |       |

---

## Definition of "Production Ready"

The application is production-ready when:

- [ ] All PHASE 0 tickets are Done
- [ ] All PHASE 1 tickets are Done
- [ ] INFRA-1, INFRA-2, INFRA-4, INFRA-6 are Done
- [ ] `npm run type-check` → 0 errors
- [ ] `npm run lint` → 0 errors, 0 warnings
- [ ] `npm test` → ≥1,547 passed, 0 failed
- [ ] `/api/health/ready` returns 200 on synthex.social
- [ ] Human E2E gate (INFRA-6/SYN-410) passed and documented

**Estimated score after PHASE 0–2:** ~79/100 (up from 39/100)
