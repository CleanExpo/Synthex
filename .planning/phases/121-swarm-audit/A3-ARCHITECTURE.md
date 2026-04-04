# A3 — Architecture & Code Quality Audit

Generated: 2026-03-18
Agent: A3 (architecture-enforcer + code-review)
Phase-119 baseline: 107 findings

---

## Findings

---

### [A3-FINDING-001] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-094 (formerly QUALITY-12)
File: `components/QuickStats.tsx:2`
Issue: `'use client'` directive is on line 2, after an `import` statement on line 1; the directive is therefore a dead string expression (never applied as a module directive) and triggers `@typescript-eslint/no-unused-expressions`. Next.js will treat the component as a Server Component, and any client-side hooks inside it will break at runtime.
Fix: Move `'use client'` to be the very first line of the file (before all imports).
Linear: CREATE-NEW

---

### [A3-FINDING-002] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43 + QUALITY-18/20)
File: `lib/data/validators.ts:367`
Issue: Anonymous object default export (`export default {`) — violates `import/no-anonymous-default-export`. The export cannot be tree-shaken or debugged by name.
Fix: Assign to a named const (e.g. `const validators = { ... }; export default validators;`) or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-003] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/metrics/business-metrics.ts:926`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-004] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/oauth/index.ts:191`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-005] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/observability/error-tracker.ts:403`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-006] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/observability/health-dashboard.ts:379`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-007] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/redis-client.ts:558`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-008] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/webhooks/index.ts:98`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-009] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/webhooks/sender.ts:455`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-010] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/webhooks/verifier.ts:461`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-011] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-18)
File: `components/error-states/ErrorStates.tsx:200`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-012] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-20)
File: `components/marketing/SocialProof.tsx:352`
Issue: Anonymous object default export (`export default {`).
Fix: Assign to a named const before exporting, or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-013] LOW

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/testing/api-test-helpers.ts:386`
Issue: Anonymous object default export (`export default {`) — applies to test helper only; low production risk but still violates the no-anonymous-default-export rule.
Fix: Assign to a named const or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-014] LOW

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-095 (formerly QUALITY-32–43)
File: `lib/testing/db-test-helpers.ts:499`
Issue: Anonymous object default export (`export default {`) — test helper only.
Fix: Assign to a named const or convert to named exports.
Linear: CREATE-NEW

---

### [A3-FINDING-015] MEDIUM

Status: CONFIRMED-OPEN
Phase-119 ref: FINDING-035 (formerly QUALITY-44)
File: `eslint.config.js:14-58`
Issue: `.next-turbo/` is absent from the ESLint `ignores` array. The current ignores list covers `.next/**`, `.next2 /**`, `.next-alt/**`, `.next-analyze/**`, `.next-dev/**`, and `.turbo/**`, but not `.next-turbo/**`. If Turbopack writes build artefacts to `.next-turbo/`, running `npm run lint` will lint generated files and produce spurious errors.
Fix: Add `'.next-turbo/**'` to the `ignores` array in `eslint.config.js`.
Linear: CREATE-NEW

---

### [A3-FINDING-016] HIGH

Status: NEW
Phase-119 ref: N/A
File: `app/dashboard/admin/layout.tsx:18`
Issue: Server layout (`app/dashboard/admin/layout.tsx`) imports Prisma directly (`import prisma from '@/lib/prisma'`) and executes a `prisma.user.findUnique()` call inside the layout body, skipping the hooks/services layer entirely. This bypasses the `lib/auth/` service abstraction, duplicates auth-guard logic that should live in a dedicated service, and makes the layout untestable without a live DB.
Fix: Extract the owner-verification query into a `lib/auth/` service function (e.g. `verifyOwnerOrRedirect(token)`) and call that from the layout instead of calling Prisma directly.
Linear: CREATE-NEW

---

### [A3-FINDING-017] MEDIUM

Status: NEW
Phase-119 ref: N/A
File: `app/dashboard/integrations/page.tsx:11`
Issue: Dashboard page (`'use client'`) imports `integrationsAPI` from `@/lib/api/settings` — a client-side API helper that wraps `fetch` — directly in a page component, bypassing the hooks layer. The correct pattern is: page → hook in `hooks/` → `lib/api/settings`. The `useThirdPartyIntegrations` hook is also imported on the same page, showing the hook layer exists; `integrationsAPI` should be called from within a hook, not the page.
Fix: Move the `integrationsAPI` calls into the existing `hooks/use-third-party-integrations.ts` hook or a new dedicated hook.
Linear: CREATE-NEW

---

### [A3-FINDING-018] LOW

Status: NEW
Phase-119 ref: N/A
File: `app/dashboard/geo/optimiser/page.tsx:8`
Issue: Dashboard page imports `TACTIC_LABELS` (a constant map) directly from `@/lib/geo/tactic-prompts`. While this is a pure constant (not a service), importing lib internals directly into pages bypasses the architectural boundary and couples the page to lib implementation details.
Fix: Either re-export the constant from a component-facing barrel in `components/geo/` or accept as a low-risk constant-only exception and document it.
Linear: CREATE-NEW

---

### [A3-FINDING-019] LOW

Status: NEW
Phase-119 ref: N/A
File: `app/dashboard/integrations/page.tsx:10`
Issue: Dashboard page imports `INTEGRATION_REGISTRY` directly from `@/lib/integrations/types`. This is a constant/type export, not a service, but still couples the page directly to lib internals.
Fix: Re-export from a component-facing barrel or accept as a low-risk constant exception and document it.
Linear: CREATE-NEW

---

### [A3-FINDING-020] CONFIRMED-RESOLVED

Status: CONFIRMED-RESOLVED
Phase-119 ref: N/A (pre-Phase-120 regression concern)
File: `package.json` (dependencies + devDependencies), `next.config.mjs` (serverExternalPackages)
Issue: Checked for `puppeteer-screen-recorder` in `package.json` and `next.config.mjs`. Neither file contains the package. `puppeteer` (v24.37.2) is present in devDependencies (used for testing/screenshots) and in `serverExternalPackages`, but `puppeteer-screen-recorder` is absent throughout. No regression detected.
Fix: N/A — no action required.
Linear: N/A

---

### [A3-FINDING-021] CONFIRMED-RESOLVED

Phase-119 ref: N/A
Status: CONFIRMED-RESOLVED
File: `app/api/` (all route files)
Issue: Checked all `app/api/` route files for `console.log(` calls. The only match was `app/api/cache/route.ts:14`, which imports `ConsoleLogger` (a class name in an import path) — not a `console.log()` call. No actual `console.log()` production leaks found in API routes.
Fix: N/A — no action required.
Linear: N/A

---

### [A3-FINDING-022] CONFIRMED-RESOLVED

Phase-119 ref: FINDING-052 (formerly CONNECT-04)
Status: CONFIRMED-OPEN (no new callers added — route still orphaned)
File: `app/api/example/redis-demo/route.ts`
Issue: No frontend callers found for `/api/example/redis-demo`. Route still exists. Developer example route should be removed or access-restricted before production.
Fix: Move to `.claude/archived/` or add admin-only auth guard.
Linear: CREATE-NEW

---

### [A3-FINDING-023] CONFIRMED-OPEN

Phase-119 ref: FINDING-053 (formerly CONNECT-05)
Status: CONFIRMED-OPEN (no callers found)
File: `app/api/sentry-test/route.ts`
Issue: No frontend callers found for `/api/sentry-test`. The file header notes it was archived from `.claude/archived/2026-03-12/` and restored — suggests it should have remained archived. No test caller, no admin UI caller found in `app/`, `components/`, or `hooks/`.
Fix: Archive to `.claude/archived/YYYY-MM-DD/` or restrict to admin + add auth guard.
Linear: CREATE-NEW

---

### [A3-FINDING-024] CONFIRMED-OPEN

Phase-119 ref: FINDING-054 (formerly CONNECT-07)
Status: CONFIRMED-OPEN (no callers found)
File: `app/api/cache/route.ts`
Issue: No frontend callers found for `/api/cache`. Auth guard status unknown from route inspection alone.
Fix: Verify auth guard present; if route is for internal tooling only, add admin-only restriction.
Linear: CREATE-NEW

---

### [A3-FINDING-025] CONFIRMED-OPEN

Phase-119 ref: FINDING-055 (formerly CONNECT-08)
Status: CONFIRMED-OPEN (no callers found)
File: `app/api/eeat/audit/route.ts`, `app/api/eeat/score/route.ts`
Issue: No frontend callers found for `/api/eeat/audit` or `/api/eeat/score`. The active EEAT page (`app/dashboard/eeat/page.tsx`) and components reference `@/lib/eeat/audit-types` (type imports) and the `eeat/v2/` routes, not the legacy `eeat/audit` or `eeat/score` routes. These appear superseded.
Fix: Confirm the v2 routes cover all functionality; archive or remove the legacy routes.
Linear: CREATE-NEW

---

### [A3-FINDING-026] CONFIRMED-OPEN

Phase-119 ref: FINDING-056 (formerly CONNECT-09)
Status: CONFIRMED-OPEN (no callers found)
File: `app/api/indexing/route.ts`, `app/api/mobile/config/route.ts`, `app/api/mobile/sync/route.ts`
Issue: No frontend callers found for `/api/indexing`, `/api/mobile/config`, or `/api/mobile/sync` in `app/`, `components/`, or `hooks/`.
Fix: Document as intentional external/mobile API (add comment), or archive if unneeded.
Linear: CREATE-NEW

---

### [A3-FINDING-027] CONFIRMED-OPEN

Phase-119 ref: FINDING-057 (formerly CONNECT-10)
Status: CONFIRMED-OPEN (no callers found for `/api/quality/gate`; `/api/moderation/check` also unresolved)
File: `app/api/moderation/check/route.ts`, `app/api/quality/gate/route.ts`
Issue: No frontend callers found for `/api/moderation/check` or `/api/quality/gate`. `/api/quality/audit` is called from the dashboard; `/api/quality/gate` is not. `/api/moderation/check` is entirely unconnected.
Fix: Verify these are intended as internal/programmatic routes; add auth guards if missing; consider archiving if unused.
Linear: CREATE-NEW

---

### [A3-FINDING-028] LOW

Status: NEW
Phase-119 ref: N/A
File: `app/api/bio/route.ts:33`
Issue: `Math.random().toString(36).substring(2, 6)` used to generate a bio page slug suffix. `Math.random()` is not cryptographically random and can produce collisions under concurrent load. Phase 120 Sprint 3 removed mock data from audience/stats routes (confirmed: no `Math.random()` found in `app/api/audience/` or `app/api/analytics/`), but this unrelated instance in the bio route remains.
Fix: Replace with `crypto.randomBytes(4).toString('hex')` (Node.js built-in) for collision-resistant slug generation.
Linear: CREATE-NEW

---

### [A3-FINDING-029] CONFIRMED-RESOLVED

Phase-119 ref: N/A (Phase-120 Sprint 3 claim)
Status: CONFIRMED-RESOLVED
File: `app/api/audience/insights/route.ts`, `app/api/analytics/route.ts`
Issue: Phase 120 Sprint 3 claimed to remove `Math.random()` mock data from audience insights and stats engagement routes. Verified: no `Math.random()` calls found in `app/api/audience/` or `app/api/analytics/`. The claim is confirmed accurate.
Fix: N/A.
Linear: N/A

---

## Summary

### Counts by Severity

| Severity               | Count  |
| ---------------------- | ------ |
| CRITICAL               | 0      |
| HIGH                   | 1      |
| MEDIUM                 | 9      |
| LOW                    | 5      |
| **Total (actionable)** | **15** |

### Counts by Status

| Status             | Count |
| ------------------ | ----- |
| NEW                | 6     |
| CONFIRMED-OPEN     | 11    |
| CONFIRMED-RESOLVED | 3     |
| REGRESSION         | 0     |

### Key Findings

**Architecture layer violations (NEW):**

- `app/dashboard/admin/layout.tsx` directly imports and calls Prisma — skips service layer entirely (HIGH, A3-FINDING-016)
- `app/dashboard/integrations/page.tsx` calls `integrationsAPI` from `lib/api/settings` directly in a page component, bypassing the hooks layer (MEDIUM, A3-FINDING-017)
- Two additional pages import lib constants directly (LOW, A3-FINDING-018/019)

**Anonymous default exports (CONFIRMED-OPEN from Phase 119):**

- 11 instances remain across `lib/` and `components/` (A3-FINDING-002 through A3-FINDING-014), all `export default {` anonymous object exports violating `import/no-anonymous-default-export`

**`'use client'` directive placement (CONFIRMED-OPEN):**

- `components/QuickStats.tsx` still has `'use client'` on line 2 after an import, making the directive a dead expression statement (A3-FINDING-001)

**ESLint ignore gap (CONFIRMED-OPEN):**

- `.next-turbo/**` still absent from `eslint.config.js` ignores array (A3-FINDING-015)

**Orphaned routes (CONFIRMED-OPEN, all from Phase 119 CONNECT-04–10):**

- 7 routes remain unconnected: `redis-demo`, `sentry-test`, `cache`, `eeat/audit`, `eeat/score`, `indexing`, `mobile/config`, `mobile/sync`, `moderation/check`, `quality/gate` — see A3-FINDING-022 through A3-FINDING-027

**Phase 120 Sprint 3 verification:**

- `Math.random()` mock data removal from audience/analytics routes confirmed (CONFIRMED-RESOLVED, A3-FINDING-029)
- `puppeteer-screen-recorder` not present in `package.json` or `next.config.mjs` (CONFIRMED-RESOLVED, A3-FINDING-020)
- No `console.log()` leaks in production API routes (CONFIRMED-RESOLVED, A3-FINDING-021)
