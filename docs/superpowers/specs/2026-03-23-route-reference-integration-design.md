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
- Prisma model → routes reverse index (top 30 most-used models by frequency; the full schema contains ~135 models — the index covers the high-traffic surface, not every table)
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

1. Extract public routes directly from `ROUTE_REFERENCE.md` (grep for `— public` in the route listing section)
2. Use this as the starting surface for its auth audit pass
3. No ad-hoc filesystem scan needed

**Effect:** Security audits start from a verified list rather than re-deriving it each time.

### 2.3 Refresh script (new)

**File:** `.claude/scripts/refresh-routes.sh`
**Must be created before the post-route-create hook is updated (see 2.4).**

Regenerates Zone 1 of `ROUTE_REFERENCE.md` (auto-generated section) while preserving Zone 2 (hand-maintained Known Issues + Recent Changes).

**Extraction pipeline (exact grep patterns):**

```bash
# HTTP methods per route file
grep -rn "^export async function GET\|^export async function POST\|^export async function PUT\|^export async function PATCH\|^export async function DELETE" \
  app/api/ --include="route.ts"

# Auth level per route file
# → "user"  if file contains getUserIdFromRequestOrCookies|getUserIdFromCookies|requireAuth|APISecurityChecker
# → "admin" if file contains verifyAdmin|isOwnerEmail
# → "cron"  if file contains CRON_SECRET
# → "public" otherwise

# Prisma models per route file
grep -oP "prisma\.\K[a-zA-Z]+" <file>
```

**Sentinel handling:**

- Script reads `ROUTE_REFERENCE.md` and searches for the exact byte-for-byte string `<!-- HAND-MAINTAINED: Do not regenerate below this line -->`
- If sentinel is **absent**: script exits with code 1 and message `ERROR: Sentinel comment not found in ROUTE_REFERENCE.md. Aborting to prevent data loss.` — never overwrites the whole file.
- If sentinel is **present**: replaces everything above it with freshly generated Zone 1, leaves everything from sentinel downward unchanged.
- Script normalises line endings to LF before searching (Windows CRLF safe): `sed -i 's/\r//' "$FILE"`

**Diff summary:** After writing, the script prints a count of routes added/removed by comparing the new route list against the previous Zone 1 using a `diff` of route paths only (not full content).

**Trigger:** Manual via `npm run routes:refresh`. Also called by `post-route-create` hook (see 2.4).

### 2.4 `post-route-create.hook.md` (wire existing hook)

**Prerequisite: refresh script (2.3) must exist first.**

Update `.claude/hooks/post-route-create.hook.md` to call `bash .claude/scripts/refresh-routes.sh` when a new `route.ts` is created under `app/api/`.

**Condition:** Only fires when the new file path matches `app/api/**/route.ts`.

### 2.5 `CONSTITUTION.md` (add one line — requires human approval)

> **⚠️ Human gate:** `CONSTITUTION.md` is an immutable governance document. This addition must be explicitly approved by the project owner before being committed. Present the proposed line and wait for confirmation.

Proposed addition to the pre-implementation checklist:

```
Before touching any route or page file: check .planning/ROUTE_REFERENCE.md
for the exact path, auth level, and canonical lib/auth/ function required.
```

This ensures the protocol survives context compaction — `CONSTITUTION.md` is re-read every session.

### 2.6 File structure — sentinel comment

Add to `ROUTE_REFERENCE.md` immediately before the Known Issues section:

```
<!-- HAND-MAINTAINED: Do not regenerate below this line -->
```

Everything above: auto-generated, replaced by refresh script.
Everything below: hand-maintained, never touched by refresh script.

### 2.7 `pre-compact-context.py` hook (update)

Update `.claude/hooks/pre-compact-context.py` to include `ROUTE_REFERENCE.md` as a context-drift recovery resource alongside `CLAUDE.md`, `CONSTITUTION.md`, and `STATE.md`. When context is compacted, the hook should inject a reminder that the route reference exists and must be consulted before touching routes.

---

## 3. Milestone Audit Protocol

### 3.1 Audit checklist

Applied to every route in scope for the current milestone:

| Check              | Pass condition                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth level correct | Public routes have a documented reason to be public; user routes call a canonical `lib/auth/` function (`getUserIdFromRequestOrCookies`, `requireAuth`, `verifyAdmin`, or `isOwnerEmail`) — raw JWT decode or missing auth is a fail |
| Zod validation     | Every POST/PUT/PATCH/DELETE has a `z.object(...)` schema validated before business logic                                                                                                                                             |
| Org scoping        | Queries include `orgId` or `userId` scoped to the authenticated user — never a caller-supplied ID without verification                                                                                                               |
| Rate limiting      | Mutation routes use `writeDefault` (30/min) or stricter; auth routes use `authStrict` (5/min)                                                                                                                                        |
| Error shape        | All error responses return `{ error: string }` — no raw `Error.message` exposed, no stack traces                                                                                                                                     |
| No stubs           | No `return { stub: true }`, `// TODO`, or hardcoded response arrays posing as real data                                                                                                                                              |
| No `any` types     | No `any` in function signatures or return types                                                                                                                                                                                      |

### 3.2 Triage rules

| Severity | Criteria                                                                                               | Destination                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **P0**   | Security vulnerability, cross-org data leak, unauthenticated write                                     | Linear ticket immediately — **blocks milestone execution**                   |
| **P1**   | Auth missing on user route, GDPR gap, broken feature, missing Zod on **currently live mutation route** | Linear ticket — included in this milestone's work                            |
| **P2**   | Missing Zod on stub/TODO route, missing rate limit, code quality violation                             | Known Issues log in ROUTE_REFERENCE.md — batched into next quality milestone |
| **P3**   | Cosmetic, minor inconsistency, non-blocking code smell                                                 | Known Issues log only                                                        |

> **Zod clarification:** A missing Zod schema on an active mutation route that already has real users hitting it is **P1** (violates CONSTITUTION rule 2). A missing Zod schema on a route that is a stub or has no live traffic is **P2**.

### 3.3 Milestone scope mapping

Run `npm run routes:refresh` before auditing any milestone to ensure the public route count and route listing are current.

| Milestone                       | Audit scope                                                                                | Rationale                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **B — Legal Clearance**         | `/api/user/*`, `/api/auth/*`, `/api/webhooks/*`, all routes marked `— public` in reference | Personal data handlers and unauthenticated entry points           |
| **C — Production Infra**        | `/api/cron/*`, `/api/health/*`, `/api/admin/*`, `/api/stripe/*`                            | Background jobs, health checks, billing — production-critical     |
| **D — Quality Gates**           | All mutation routes (POST/PUT/PATCH/DELETE across full reference)                          | Zod coverage and org-scoping completeness sweep                   |
| **E — Functional Completeness** | `/api/reports/*`, `/api/analytics/*`, `/api/billing/*`, `/api/onboarding/*`                | Routes backing stub/broken features being fixed in this milestone |

---

## 4. Execution Loop

Per-milestone execution follows this fixed sequence:

```
1. AUDIT     Run npm run routes:refresh first.
             Explore agent scans milestone's route scope against the audit checklist.
             P0/P1 findings → Linear tickets (created before execution starts).
             P2/P3 findings → ROUTE_REFERENCE.md Known Issues log.

2. MERGE     Combine: existing execution plan items + P0/P1 findings from audit.
             Sort: P0 blockers first, then by effort (XS → XL).
             All P0/P1 findings must have Linear tickets before execution starts.
             Human reviews merged list before execution begins.

3. EXECUTE   Subagent-driven development — one subagent per task.
             Each task: implementer → spec reviewer → code quality reviewer.
             After each task: update ROUTE_REFERENCE.md Recent Changes.

4. GATE      npm run type-check && npm run lint && npm test must all pass.
             Verify ROUTE_REFERENCE.md Known Issues updated for completed tasks.
             Human gates (e.g. COMP-4 privacy policy, INFRA-6 E2E) flagged explicitly.
             Execution pauses at human gates with a checklist of what to verify.
             Milestone declared Done only when code gate + human gates cleared.

5. HANDOFF   ROUTE_REFERENCE.md Known Issues reviewed for newly urgent P2/P3 items.
             Urgent items promoted to next milestone's execution plan.
             STATE.md updated with new milestone position.
```

### 4.1 Human gate handling

When a task is marked `Owner: H` in the execution plan:

- Execution stops
- A checklist is output: what to verify, where to look, expected outcome
- Claude waits for explicit confirmation before continuing
- All code changes up to this point are committed before pausing

---

## 5. Refresh Mechanism

### 5.1 Two-zone file structure

`ROUTE_REFERENCE.md` is divided into two zones separated by the sentinel comment:

```
Zone 1 (auto-generated — replaced on every refresh)
  ├── Header + stats line
  ├── Auth levels table
  ├── API Routes (grouped by prefix)
  ├── Dashboard Pages table
  └── Prisma Model → Routes index (top 30 by usage frequency)

<!-- HAND-MAINTAINED: Do not regenerate below this line -->

Zone 2 (hand-maintained — never touched by refresh script)
  ├── Known Issues Log
  └── Recent Changes
```

### 5.2 Refresh script behaviour

`.claude/scripts/refresh-routes.sh` — full behaviour:

1. Normalise line endings: `sed -i 's/\r//' .planning/ROUTE_REFERENCE.md`
2. Search for exact sentinel string `<!-- HAND-MAINTAINED: Do not regenerate below this line -->`
3. If absent: exit 1 with `ERROR: Sentinel comment not found in ROUTE_REFERENCE.md. Aborting to prevent data loss.`
4. Extract Zone 2 (sentinel line + everything below) into a temp variable
5. Run extraction greps (see Section 2.3) across all `app/api/**/route.ts` files
6. Generate new Zone 1 content in memory using the same format as the original reference
7. Write: new Zone 1 + sentinel + Zone 2 → `ROUTE_REFERENCE.md`
8. Print diff summary: compare old vs new route list, output counts of added/removed routes and auth level changes

### 5.3 `npm run routes:refresh` script

Add to `package.json` scripts:

```json
"routes:refresh": "bash .claude/scripts/refresh-routes.sh"
```

### 5.4 Refresh frequency guideline

Added to `CLAUDE.md`:

- Run `npm run routes:refresh` before any audit phase
- Run after adding or renaming any route file
- The `post-route-create` hook calls it automatically on new route creation under `app/api/`

---

## 6. Files Modified / Created

Implementation order matters — follow this sequence:

| Order | File                                      | Action | Notes                                                     |
| ----- | ----------------------------------------- | ------ | --------------------------------------------------------- |
| 1     | `.planning/ROUTE_REFERENCE.md`            | Update | Add sentinel comment before Known Issues                  |
| 2     | `.claude/scripts/refresh-routes.sh`       | Create | Zone 1 regeneration script                                |
| 3     | `package.json`                            | Update | Add `routes:refresh` script                               |
| 4     | `.claude/hooks/post-route-create.hook.md` | Update | Wire to refresh script (script must exist first)          |
| 5     | `.claude/skills/route-auditor.md`         | Update | Add reference lookup as Step 1                            |
| 6     | `.claude/skills/security-hardener.md`     | Update | Add public routes extraction from reference               |
| 7     | `.claude/hooks/pre-compact-context.py`    | Update | Register ROUTE_REFERENCE.md as drift-recovery resource    |
| 8     | `CLAUDE.md`                               | Update | Add refresh frequency guideline                           |
| 9     | `CONSTITUTION.md`                         | Update | **Human gate — present proposed line, wait for approval** |

---

## 7. Success Criteria

- [ ] `route-auditor` skill reads from ROUTE_REFERENCE.md before opening any file
- [ ] `security-hardener` skill extracts public routes from reference without grepping the filesystem
- [ ] `npm run routes:refresh` regenerates Zone 1 and preserves Zone 2 intact
- [ ] `npm run routes:refresh` exits 1 with a clear error when sentinel is absent
- [ ] New route creation under `app/api/` triggers automatic reference refresh
- [ ] `CONSTITUTION.md` includes route reference check (after human approval)
- [ ] `pre-compact-context.py` injects route reference reminder on compaction
- [ ] Milestone B audit runs after `routes:refresh` and produces a triaged list with all P0/P1 findings in Linear before execution starts
- [ ] Execution loop completes Milestone B with type-check + lint + test all passing
- [ ] ROUTE_REFERENCE.md Known Issues and Recent Changes updated after each completed task
