# Route Reference Integration — Design Spec

**Date:** 2026-03-23
**Author:** Brainstorming session
**Status:** Approved
**Goal:** Integrate `ROUTE_REFERENCE.md` into the Claude Code harness and establish a milestone-sliced audit + execution workflow to systematically clean up the Synthex codebase.

---

## 1. Context

`ROUTE_REFERENCE.md` was generated on 2026-03-23 and contains:

- 498 API routes with HTTP methods, auth levels, and Prisma models
- 100 dashboard pages with partial API call detection
- Prisma model → routes reverse index (top 30 models)
- Known Issues Log (empty, ready to populate)
- Recent Changes log (seeded with Phase 0 security fixes)

It is already referenced in `CLAUDE.md` (pre/post-implementation protocol and Key Directories table). The remaining work is to connect it to the tools that run during implementation and establish the audit + execution workflow.

---

## 2. Integration Architecture

### 2.1 `route-auditor` skill (update)

Update `.claude/skills/route-auditor.md` to start from `ROUTE_REFERENCE.md` before reading any file:

1. Look up the target route in the reference — confirm exact file path, HTTP methods, auth level, Prisma models
2. Read only the confirmed file path
3. Apply the audit checklist (see Section 3)
4. Log findings to Known Issues if P2/P3, flag P0/P1 to caller

**Effect:** Eliminates the wrong-file failure mode at the skill level.

### 2.2 `security-hardener` skill (update)

Update `.claude/skills/security-hardener.md` to:

1. Extract the 62 public routes directly from `ROUTE_REFERENCE.md` (grep for `— public`)
2. Use this as the starting surface for its auth audit pass
3. No ad-hoc grep scan needed

**Effect:** Security audits start from a verified list rather than re-deriving it each time.

### 2.3 Refresh script (new)

**File:** `.claude/scripts/refresh-routes.sh`

Regenerates Zone 1 of `ROUTE_REFERENCE.md` (auto-generated section) while preserving Zone 2 (hand-maintained Known Issues + Recent Changes).

**Implementation:**

- Runs the same extraction pipeline used to generate the original reference:
  - `grep` for HTTP method exports per route file
  - `grep` for auth patterns per route file
  - `grep` for Prisma model usage per route file
- Replaces content above the sentinel comment
- Leaves everything below `<!-- HAND-MAINTAINED: Do not regenerate below this line -->` untouched
- Prints diff summary: routes added/removed, auth level changes

**Trigger:** Manual via `npm run routes:refresh`. Also called by `post-route-create` hook.

### 2.4 `post-route-create.hook.md` (wire existing hook)

Update `.claude/hooks/post-route-create.hook.md` to call the refresh script when a new `route.ts` is created under `app/api/`.

**Condition:** Only fires when the new file path matches `app/api/**/route.ts`.

### 2.5 `CONSTITUTION.md` (add one line)

Add to the pre-implementation checklist:

```
Before touching any route or page file: check .planning/ROUTE_REFERENCE.md for the exact path, auth level, and Prisma models.
```

This ensures the protocol survives context compaction — `CONSTITUTION.md` is re-read every session.

### 2.6 File structure — sentinel comment

Add to `ROUTE_REFERENCE.md` before the Known Issues section:

```markdown
<!-- HAND-MAINTAINED: Do not regenerate below this line -->
```

Everything above: auto-generated, replaced by refresh script.
Everything below: hand-maintained, never touched by refresh script.

---

## 3. Milestone Audit Protocol

### 3.1 Audit checklist

Applied to every route in scope for the current milestone:

| Check              | Pass condition                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Auth level correct | Public routes are intentionally public; user routes have an auth check  |
| Zod validation     | Every POST/PUT/PATCH/DELETE has a Zod schema                            |
| Org scoping        | Queries include `orgId` or `userId` — never cross-org                   |
| Rate limiting      | Mutation routes have `writeDefault` or stricter                         |
| Error shape        | All errors return `{ error: string }` — no raw throws exposed           |
| No stubs           | No `return { stub: true }`, TODO comments, or hardcoded response arrays |
| No `any` types     | TypeScript clean                                                        |

### 3.2 Triage rules

| Severity | Criteria                                      | Destination                                                                  |
| -------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| **P0**   | Security vulnerability, data leak             | Linear ticket immediately — blocks milestone execution                       |
| **P1**   | Broken feature, GDPR gap, auth missing        | Linear ticket — included in this milestone's work                            |
| **P2**   | Missing Zod, missing rate limit, code quality | Known Issues log in ROUTE_REFERENCE.md — batched into next quality milestone |
| **P3**   | Cosmetic, minor inconsistency                 | Known Issues log only                                                        |

### 3.3 Milestone scope mapping

Each milestone audits a targeted route group — not all 498 routes every time:

| Milestone                       | Audit scope                                                                 | Rationale                                                     |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **B — Legal Clearance**         | `/api/user/*`, `/api/auth/*`, `/api/webhooks/*`, all 62 public routes       | These routes handle personal data and unauthenticated access  |
| **C — Production Infra**        | `/api/cron/*`, `/api/health/*`, `/api/admin/*`, `/api/stripe/*`             | Background jobs, health checks, billing — production-critical |
| **D — Quality Gates**           | All mutation routes (POST/PUT/PATCH/DELETE)                                 | Zod coverage and org-scoping completeness sweep               |
| **E — Functional Completeness** | `/api/reports/*`, `/api/analytics/*`, `/api/billing/*`, `/api/onboarding/*` | Routes backing the stub/broken features being fixed           |

---

## 4. Execution Loop

Per-milestone execution follows this fixed sequence:

```
1. AUDIT     Explore agent scans milestone's route scope against the audit checklist.
             P0/P1 findings → Linear tickets (created immediately).
             P2/P3 findings → ROUTE_REFERENCE.md Known Issues log.

2. MERGE     Combine: existing execution plan items + P0/P1 findings from audit.
             Sort: P0 blockers first, then by effort (XS → XL).
             Human reviews merged list before execution starts.

3. EXECUTE   Subagent-driven development — one subagent per task.
             Each task: implementer → spec reviewer → code quality reviewer.
             After each task: update ROUTE_REFERENCE.md Recent Changes.

4. GATE      npm run type-check && npm run lint && npm test must all pass.
             Human gates (e.g. COMP-4 privacy policy, INFRA-6 E2E) flagged explicitly.
             Execution pauses at human gates with a checklist of what to verify.
             Milestone declared Done only when code gate + human gates cleared.

5. HANDOFF   ROUTE_REFERENCE.md Known Issues reviewed.
             P2/P3 items that became urgent are promoted to next milestone.
             STATE.md updated with new position.
```

### 4.1 Human gate handling

When a task is marked `Owner: H` in the execution plan:

- Execution stops
- A checklist is output: what to verify, where, expected outcome
- Claude waits for explicit confirmation before continuing
- Partial work is committed so state is not lost

---

## 5. Refresh Mechanism

### 5.1 Two-zone file structure

`ROUTE_REFERENCE.md` is divided into two zones separated by a sentinel comment:

```
Zone 1 (auto-generated, lines 1–~800)
  ├── Header + stats
  ├── Auth levels table
  ├── API Routes (grouped by prefix)
  ├── Dashboard Pages table
  └── Prisma Model → Routes index

<!-- HAND-MAINTAINED: Do not regenerate below this line -->

Zone 2 (hand-maintained)
  ├── Known Issues Log
  └── Recent Changes
```

Zone 1 is fully replaced on every refresh. Zone 2 is never touched by the script.

### 5.2 Refresh script behaviour

`.claude/scripts/refresh-routes.sh`:

1. Runs extraction greps across all `app/api/**/route.ts` files
2. Regenerates Zone 1 content in memory
3. Reads current `ROUTE_REFERENCE.md`, finds sentinel comment
4. Replaces everything above sentinel with new Zone 1
5. Appends everything from sentinel downward unchanged
6. Outputs diff summary to stdout

### 5.3 `npm run routes:refresh` script

Add to `package.json` scripts:

```json
"routes:refresh": "bash .claude/scripts/refresh-routes.sh"
```

### 5.4 Refresh frequency guideline

Added to `CLAUDE.md`:

- Run before any audit phase
- Run after adding or renaming any route
- The `post-route-create` hook runs it automatically on new route creation

---

## 6. Files Modified / Created

| File                                      | Action | Notes                                               |
| ----------------------------------------- | ------ | --------------------------------------------------- |
| `.claude/skills/route-auditor.md`         | Update | Add reference lookup as Step 1                      |
| `.claude/skills/security-hardener.md`     | Update | Add public routes extraction from reference         |
| `.claude/scripts/refresh-routes.sh`       | Create | Zone 1 regeneration script                          |
| `.claude/hooks/post-route-create.hook.md` | Update | Wire to refresh script                              |
| `CONSTITUTION.md`                         | Update | Add reference check to pre-implementation checklist |
| `.planning/ROUTE_REFERENCE.md`            | Update | Add sentinel comment before Known Issues section    |
| `package.json`                            | Update | Add `routes:refresh` script                         |
| `CLAUDE.md`                               | Update | Add refresh frequency guideline                     |

---

## 7. Success Criteria

- [ ] `route-auditor` skill reads from ROUTE_REFERENCE.md before opening any file
- [ ] `security-hardener` skill extracts public routes from reference without grepping
- [ ] `npm run routes:refresh` regenerates Zone 1 and preserves Zone 2
- [ ] New route creation triggers automatic reference refresh
- [ ] CONSTITUTION.md includes route reference check
- [ ] Milestone B audit runs against defined scope and produces triaged findings
- [ ] Execution loop completes Milestone B with all gate checks passing
- [ ] ROUTE_REFERENCE.md Known Issues and Recent Changes updated after each task
