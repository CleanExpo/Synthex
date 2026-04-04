# Synthex Workflows Reference

Last updated: 2026-04-01

---

## Scope Routing

Before starting any task, classify the scope:

| Scope    | Criteria                                        | Workflow                                          |
| -------- | ----------------------------------------------- | ------------------------------------------------- |
| Trivial  | Copy change, config tweak, doc update           | Direct execute → verify → commit                  |
| Standard | New component, new endpoint, bug fix            | Plan → execute → verify → PR                      |
| Complex  | Schema migration, new subsystem, auth changes   | Full harness: discovery → plan → execute → verify → PR |

**Intent classification** before every task:
- **Build** — new feature/component/API route
- **Fix** — bug fix, error resolution
- **Refactor** — restructure without behaviour change
- **Migrate** — schema change, data migration
- **Deploy** — push to production
- **Audit** — review, scan, analyse

---

## Multi-Agent Execution Rules (CONSTITUTION.md — authoritative)

1. **2-round auto-fix cap:** Maximum 2 automatic retries per failing step → escalate to human. Never brute-force past failures.
2. **Linear issue required:** Every subagent dispatch must include a Linear issue ID (SYN-XXXX). No ticket = no agent.
3. **Token budget discipline:** Inject only verified-relevant context. No full conversation history — use specific file paths + prior outputs only.
4. **One-shot principle:** Plan once, execute once. If the plan is wrong, pause and ask — don't loop.
5. **Parallelise independent work:** Use parallel Task calls for independent subagents. Sequential only for true data dependencies.
6. **Walls before models:** TypeCheck/lint/test must pass before code is considered complete. Guardrails > model selection.
7. **System runs the model:** Orchestrators control flow. LLM output is consumed by the system — it does not direct it.

---

## Agent Dispatch Pattern

```typescript
// Parallel agents (independent work)
Agent A: → writes tests/unit/api/advisor-brief.test.ts
Agent B: → writes tests/unit/api/team-card.test.ts
Agent C: → writes tests/unit/api/collaborator-context.test.ts
// All three dispatch simultaneously, no data dependency between them

// Sequential agents (data dependency exists)
Agent 1: explores codebase → returns findings
Agent 2: receives findings from Agent 1 → implements based on them
```

**Agent prompt requirements:**
- State: Linear issue ID (SYN-XXXX)
- State: exact file paths to read/write
- State: what output is expected (files created, tests passing, etc.)
- Do NOT: inject full conversation history
- Do NOT: include unrelated context

---

## Pre-Implementation Checklist

Before writing any code:

- [ ] Identify the Linear issue (SYN-XXXX) — if none exists, create one
- [ ] Read `.planning/ROUTE_REFERENCE.md` for the exact route path, HTTP method, auth level
- [ ] Check "Known issues" section for that route
- [ ] If route not in reference: `grep -r "routename" app/` to find actual location
- [ ] Read the existing file before editing (never edit blind)
- [ ] Classify scope (trivial/standard/complex) and choose appropriate workflow
- [ ] Assess risk level (LOW/MEDIUM/HIGH) — HIGH requires pause and confirm

---

## Post-Implementation Checklist

After writing code:

- [ ] Run `npm run type-check` — must be 0 errors
- [ ] Run `npm run lint` — must be 0 errors
- [ ] Run `npm test` — all tests pass (paste actual output)
- [ ] Update `.planning/ROUTE_REFERENCE.md` → "Recent Changes" log
- [ ] Update Linear issue: add comment with files changed + what was done
- [ ] Commit with issue identifier: `fix(api): description (SYN-XXXX)`
- [ ] Produce verification checklist for user confirmation

---

## Production Deployment Protocol

**Phase 8 (production) always ends at a human review gate — never auto-merge PRs.**

1. All pre-PR gates pass (type-check + lint + test)
2. Create PR via `gh pr create` — do NOT push directly to main
3. Wait for CI checks to pass
4. Human reviews and approves PR
5. Human merges PR → triggers Vercel deploy
6. Monitor Vercel dashboard until status shows "Ready" (not "Building")
7. Run live verification (curl demo endpoint, confirm features accessible)
8. Update Linear issues: status → Done + final comment

---

## Session Management Pattern

**Every 10 tool calls** — write to `.claude/scratchpad/current-session.md`:

```markdown
## [HH:MM] Progress
- Done: [what was completed]
- Next: [what comes next]
- Issue: SYN-XXXX
- Blockers: [any blockers, or "none"]
```

**On context window warning** — immediately write full state to scratchpad:

```markdown
## [HH:MM] EMERGENCY SAVE — Context compacting
- Files modified: [list with paths]
- Last commit: [hash]
- Current task: [description]
- Branch: [branch name]
- Tests status: [pass/fail/not-run]
- Resume: [exact next step]
```

---

## Error Recovery Pattern

When a multi-step task encounters failure mid-execution:

1. **Stop** at the failure point
2. **Report** what succeeded and what failed (with specifics)
3. **Assess** whether partial state is consistent (no half-written files, no schema drift)
4. **Propose** either: fix and continue, or rollback to clean state
5. Max 2 attempts to fix automatically → if still failing, escalate to human

---

## Linear Workflow

```
New work:   create Linear issue → assign to sprint → code → PR → merge → Done
Bug fix:    find/create issue → fix → test → PR → merge → Done
Session end: update all touched issues (comment + status) → clear scratchpad
```

**Status transitions:**
- Start coding: In Progress
- PR created: In Review
- Merged to main: Done
- Human-gated: stays In Progress until human acts

---

## Confidence Gate

Before major execution:

```
CONFIDENCE: [0-100]
RISK: [LOW/MEDIUM/HIGH]
REVERSIBLE: [yes/no/partial]
READY: [yes/no — all prerequisites met?]
```

- HIGH risk: only proceed at CONFIDENCE ≥ 80
- MEDIUM risk: only proceed at CONFIDENCE ≥ 60
- LOW risk: proceed at any confidence level
