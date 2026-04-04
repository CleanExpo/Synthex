# Phase 123 — Diagnostic Repeat Findings

**Date:** 2026-03-19
**Scope:** Code-level verification of Phase 121 fixes and Phase 119 residual findings
**Method:** Direct file inspection, grep verification, Linear issue cross-reference

---

## Summary

| Category       | Finding                                                 | Status                |
| -------------- | ------------------------------------------------------- | --------------------- |
| CONNECT-01     | `/api/billing/subscription` route missing               | ✅ CONFIRMED FIXED    |
| CONNECT-03     | NotificationBell `?unread` param mismatch               | ✅ CONFIRMED FIXED    |
| ROUTE-10       | Tasks route missing `organizationId` scoping            | ✅ FIXED THIS SESSION |
| ROUTE-11       | Research route missing `organizationId` scoping         | ✅ FIXED THIS SESSION |
| CONTRAST-01    | `placeholder:text-white/30` in prompt-input.tsx         | ✅ CONFIRMED FIXED    |
| CONTRAST-02–04 | `text-white/15` in analytics-tab, SystemPulse, UniteHub | ✅ CONFIRMED FIXED    |
| CONTRAST-05    | `text-white/10` in SASScore.tsx                         | ✅ CONFIRMED FIXED    |

**Result: 0 CRITICAL findings open. All Phase 121-02 blocking issues resolved.**

---

## Detailed Verification

### CONNECT-01 — Billing Route (FIXED ✓)

`app/api/billing/subscription/route.ts` EXISTS.
Dashboard call to `/api/billing/subscription` will no longer 404.

### CONNECT-03 — Notification Filter Mismatch (FIXED ✓)

`components/NotificationBell.tsx:53` — uses `?unreadOnly=true` ✓
`components/NotificationBell.tsx:58` — reads `data.unreadCount` ✓

### ROUTE-10 / ROUTE-11 — Org Scoping (FIXED THIS SESSION)

**Root cause found:** Previous "fix" (commit context) was only a code comment acknowledging the limitation — no actual schema or route change was made. Issues were incorrectly marked Done.

**Actual fix applied (commit `85b98427`):**

- Added `organizationId String? @map("organization_id")` to `Task` model
- Added `organizationId String? @map("organization_id")` to `GEOResearchReport` model
- Created and applied DB migration `20260319000002`
- `GET /api/tasks` now uses `getEffectiveQueryFilter(userId)`
- `GET /api/research` now uses `getEffectiveQueryFilter(userId)`
- Both POST handlers store `organizationId` from `getEffectiveOrganizationId(userId)` on create

### CONTRAST-01 — prompt-input.tsx (FIXED ✓)

`components/ui/prompt-input.tsx:132` — `placeholder:text-white/70` ✓ (was `/30`)

### CONTRAST-02 — analytics-tab.tsx (FIXED ✓)

Grep for `text-white/15` → no matches. The specific `/15` violation is gone.
Note: file still contains `/10` (icon colour), `/25`, `/30` — these are secondary/decorative
and are tracked as MEDIUM in the open backlog (not CRITICAL).

### CONTRAST-03 — SystemPulsePanel.tsx (FIXED ✓)

Grep for `text-white/15` → no matches. The specific `/15` violation is gone.
Note: file still contains `/20`, `/25` for secondary metadata text.

### CONTRAST-04 — UniteHubWidget.tsx (FIXED ✓)

Grep for `text-white/15` → no matches. The specific `/15` violation is gone.

### CONTRAST-05 — SASScore.tsx (FIXED ✓)

Grep for low-contrast values → no matches at all. File is clean.

---

## Open Non-Critical Items (not blocking v10.0)

| Finding                                                           | Files                                | Severity | Action                                                                 |
| ----------------------------------------------------------------- | ------------------------------------ | -------- | ---------------------------------------------------------------------- |
| Secondary text contrast `/20-/30`                                 | analytics-tab, SystemPulse, UniteHub | MEDIUM   | Backlog (v11.0)                                                        |
| Org scoping — existing tasks/reports have `organizationId = NULL` | DB                                   | LOW      | By design — new records will be scoped; old records remain userId-only |
| Phase 122 E2E on live synthex.social                              | All                                  | GATE     | Human-gated — see SYN-410                                              |

---

## v10.0 Gate Status

| Gate                            | Status                            |
| ------------------------------- | --------------------------------- |
| `npm run type-check` — 0 errors | ✅ PASS (verified post-commit)    |
| CONNECT-01 billing route        | ✅ FIXED                          |
| CONNECT-03 notification filter  | ✅ FIXED                          |
| ROUTE-10/11 org scoping         | ✅ FIXED                          |
| CONTRAST-01–05                  | ✅ FIXED                          |
| Phase 122 E2E on live           | ⏳ PENDING (human gate — SYN-410) |

**All code-verifiable gates: PASSED**
