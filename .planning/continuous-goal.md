# Continuous Execution Goal — In-House Agency OS v1

**Milestone:** v12.0 In-House Agency OS  
**Linear epic:** [SYN-971](https://linear.app/unite-group/issue/SYN-971)  
**PM pack:** `docs/pm/` (CEO confirmed 2026-05-25)  
**Command:** `/gsd:continuous-execute 128-133`

---

## North-star objective

Deliver **M1 — In-House Agency OS v1**: top-15 agency catalog tasks (AT-001–015) can run **Trigger → Artefact → Gate → Publish/Measure → Audit** inside Synthex with CEO time ≤6–10 h/week — without relying on Claude Code for every step.

**Closure target:** In-house score **52 → 75+** (product wiring; not full 100-route parity).

---

## Already shipped (skip in plans)

Do **not** re-implement these in GSD phases:

| Work                               | Evidence                                                                             | Linear            |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------- |
| PM agency gap audit pack           | `docs/pm/*` (9 files)                                                                | SYN-971           |
| Advisor Mark Done → workflow spawn | `lib/advisor/spawn-workflow-from-action.ts`, PATCH `/api/advisor/brief`, tests 15/15 | SYN-972 (slice 1) |
| Linear children SYN-972/973/974    | Backlog + SYN-972 In Progress                                                        | SYN-971           |

Phase planners: treat slice 1 as **done**; start SYN-972 plans at slice 2.

---

## Phase scope (128–133)

| Phase | Slug                      | Goal                                                                  | Linear               | Depends  |
| ----: | ------------------------- | --------------------------------------------------------------------- | -------------------- | -------- |
|   128 | `agency-task-model`       | AT-\* task types in Prisma + Tasks UI (`task-config.ts`)              | SYN-PM-104 / SYN-972 | —        |
|   129 | `tenant-brand-seed`       | Idempotent portfolio tenant seed + Business DNA in org config         | SYN-973              | —        |
|   130 | `h1-workflow-gates`       | H-1 product path: gate step, CEO queue, autonomous foundation context | SYN-972              | 128, 129 |
|   131 | `tier1-reporting`         | Tier-1 weekly report cron + gate-tagged metrics in product            | SYN-PM-107           | 129      |
|   132 | `priority-partial-routes` | Close 8 priority partial dashboard routes (not all 100)               | SYN-974              | 130      |
|   133 | `m1-verification`         | Verify M1: tests, ROUTE_REFERENCE, gap-register, Linear comments      | SYN-971              | 128–132  |

**Parallel allowed:** 128 and 129 (no file overlap). **130 blocks on 129** (tenants need DNA for brand-correct gates).

---

## Per-phase success criteria

### Phase 128 — Agency task model

- [ ] `AgencyTaskType` (or equivalent) in Prisma + migration via `migrate diff` + `db execute` (no `db push`)
- [ ] `components/tasks/task-config.ts` maps to AT-001–032 labels / service lines
- [ ] Unit tests for mapping + API if extended
- [ ] `npm run type-check` pass; advisor/workflow tests still pass

### Phase 129 — Tenant + brand DNA

- [ ] `prisma/seed-brand.ts` (or extend seed) — DR, NRPG, RestoreAssist, CARSI (+ CCW carve-out doc)
- [ ] Brand voice fields persisted per org (from `ceo-foundation` voice tags)
- [ ] Smoke script or test: org exists with DNA readable by content APIs
- [ ] **Human gate expected:** first run against real DB — orchestrator must PAUSE (no auto `db push`)

### Phase 130 — H-1 workflow gates

- [ ] Workflow step type or executor path for brand-voice gate (scores + pass/fail metadata)
- [ ] Minimal CEO batched-review queue (list drafts awaiting approval)
- [ ] Autonomous execute loads `ceo-foundation` + `verification-gates` snippets into workflow input
- [ ] Tests for gate step + queue API (401 → 403 → 400 → 200 pattern)

### Phase 131 — Tier-1 reporting

- [ ] Cron or internal route for Monday 07:00 AEST Tier-1 snapshot (performance-attribution template)
- [ ] Report output tags metrics verified vs hypothesised per `verification-gates.md`
- [ ] `/dashboard/reports` shows latest Tier-1 artefact for org

### Phase 132 — Priority partial routes

Close end-to-end loops for:

- `/dashboard/tasks`, `/dashboard/workflows`, `/dashboard/brand-voice`
- `/dashboard/settings/brand-setup`, `/dashboard/platforms`
- `/dashboard/autonomous`, `/dashboard/reports` (if not done in 131)

### Phase 133 — M1 verification

- [ ] `npm run type-check && npm run lint && npm test` — paste pass counts in SUMMARY
- [ ] Update `docs/pm/gap-register.md` — close or downgrade GAP-001–010 where fixed
- [ ] `.planning/ROUTE_REFERENCE.md` Recent Changes for touched routes
- [ ] Linear comment on SYN-971 with M1 checklist + remaining non-goals

---

## Human gates (continuous mode MUST pause)

| Gate                                              | Phases |
| ------------------------------------------------- | ------ |
| `npx prisma db push`                              | 129    |
| New npm packages                                  | any    |
| `.env` / `.env.local` changes                     | any    |
| `git push`                                        | any    |
| Production deploy / Vercel promote                | 133    |
| `checkpoint:decision` / `checkpoint:human-action` | any    |
| OAuth live credentials / human platform login     | 132    |

**Auto-approved:** commits, unit tests, ROUTE_REFERENCE Recent Changes, `docs/pm` updates, non-destructive verify.

---

## Verification bar (every phase)

```bash
npm run type-check
npm run lint
npm test
```

- Test count must not drop below baseline captured at continuous start.
- New tests required for new API routes and workflow steps.

**Pre-flight (orchestrator):** git clean, type-check pass before `active: true`.

---

## Non-goals (v1 — do not expand scope)

- Mobile app
- External paying-customer Stripe onboarding
- Full closure of 100 partial dashboard routes
- Full SYN-806 senior skill implementations (Track 2 — IDE only)
- SYN-970 / SYN-967 campaign content (separate urgent work; link only)

---

## Orchestrator invocation

```text
/gsd:continuous-execute 128-133
```

**Resume after pause:**

```text
/gsd:continuous-execute
```

Reads `.planning/continuous-state.json` when `active: true`.

**Suggested pre-flight (human):**

1. Commit or stash current work (includes SYN-972 slice 1).
2. Disable Cursor **1Password** shell hook if `validate-mounted-env-files.sh` still blocks `npm test`.
3. Confirm `REDIS_URL` for workflow queue tests on staging.

---

## State file template

On start, orchestrator writes:

```json
{
  "version": "1.0",
  "active": true,
  "state": "PLANNING",
  "milestone": "v12.0 In-House Agency OS",
  "goalFile": ".planning/continuous-goal.md",
  "currentPhase": 128,
  "currentPlan": null,
  "phasesRequested": [128, 129, 130, 131, 132, 133],
  "phasesCompleted": [],
  "linearEpic": "SYN-971",
  "baselineTestCount": null,
  "pauseReason": null,
  "startedAt": null,
  "toolCallCount": 0
}
```

---

## CEO top-15 traceability

AT-001, 002, 003, 004, 005, 009, 010, 011, 006, 007, 008, 012, 013, 014, 015 → mapped in `docs/pm/agency-task-catalog.md`. Each phase SUMMARY must list which AT-\* IDs moved from `IDE_ONLY` / `UI_PARTIAL` toward `COMPLETE`.
