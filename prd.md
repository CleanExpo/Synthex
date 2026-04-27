# PRD — Synthex Development Loop

> **Status:** Draft 1 · 2026-04-25 · Author: Claude + Phill
> **Problem this solves:** sessions keep hitting context limits mid-work. We need a bounded, repeatable loop so each session does exactly one thing, hands off clean state, and ends before context bloats.

---

## 1. The Loop (single iteration)

```
    ┌────────────────────┐
    │  1. SYSTEM PROMPT  │  fresh session; reads only HANDOFF.md
    └──────────┬─────────┘
               │
               ▼
    ┌────────────────────┐
    │  2. GRILL-ME       │  /grill-me — clarifies scope before touching code
    └──────────┬─────────┘
               │
               ▼
    ┌────────────────────┐
    │  3. IMPLEMENTATION │  surgical change; no refactor creep
    └──────────┬─────────┘
               │
               ▼
    ┌────────────────────┐
    │  4. TESTING        │  type-check + lint + jest — paste real output
    └──────────┬─────────┘
               │
               ▼
    ┌────────────────────┐
    │  5. FEEDBACK LOOP  │  write HANDOFF.md · update Linear · end session
    └──────────┬─────────┘
               │
               └──► next session reads HANDOFF.md and restarts at stage 1
```

**Non-negotiable:** every session produces exactly one PR (or one no-op decision). No compound sessions. No "while I'm in here, let me also fix…".

---

## 2. Stage contracts

### Stage 1 — System Prompt

- **Input:** `.claude/loop/HANDOFF.md` (the only file the new session reads first)
- **Output:** understanding of one current task, with a Linear ID
- **Token budget:** ≤ 3k tokens of initial context
- **Forbidden:** loading MEMORY.md, ARCHITECTURE.md, or the full CLAUDE.md unless `HANDOFF.md` flags them as required for this task
- **Skill:** `/loop-start <SYN-XXX>` — loads the ticket + the handoff note

### Stage 2 — Grill Me

- **Skill:** `/grill-me` (skill already exists in `.claude/skills/`; if not, create as outlined in §6)
- **Purpose:** before writing code, Claude must produce 3–7 numbered clarification questions, and Phill must answer them OR confirm assumptions
- **Output:** a decision log appended to `HANDOFF.md` under `## Grilled` with the confirmed scope
- **Token budget:** ≤ 8k tokens
- **Exit gate:** Phill writes "proceed" or corrections. No "proceed" → no implementation.

### Stage 3 — Implementation

- **Tool set:** Read, Edit, Write, Grep, Glob, Bash for test gate only
- **Scope rule:** every changed line must trace to a Grill-Me answer. No speculative improvement.
- **Worktree rule:** every implementation runs in its own git worktree under `.claude/worktrees/<ticket>`. Worktrees are cheap; cross-session collisions are expensive.
- **Token budget:** ≤ 40k tokens for the entire coding stage
- **Circuit breaker:** if the session hits 60% context, stop, write partial state to `HANDOFF.md`, and exit. Next session resumes.

### Stage 4 — Testing

- **Mandatory gate:** `npm run type-check && npm run lint && npm test`
- **Output rule (CONSTITUTION):** paste the actual final line, never "should pass"
- **If red:** fix inline. If fix takes > 15 minutes, park state in `HANDOFF.md` and exit.
- **Token budget:** ≤ 10k tokens

### Stage 5 — Feedback Loop

Writes three artefacts, in order:

1. **PR** — `gh pr create` with full body
2. **Linear** — state → `In Review`; comment includes commit SHA + PR URL; **this happens automatically in the same session, never the next one** (Phill's standing directive)
3. **`HANDOFF.md` update** — overwrites the file with:
   - What was just shipped (one line + PR URL)
   - What's next (one Linear ID)
   - Any known blocker for the next session to surface in Grill-Me
   - Pending human actions, if any

- **Token budget:** ≤ 5k tokens
- **Then:** end the session. Do not start the next loop inside the same session.

---

## 3. Persistent artefacts (survive across sessions)

| File                        | Role                                                                           | Edit cadence              |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| `.claude/loop/HANDOFF.md`   | The **only** file a new session needs to read first. ≤ 150 lines. Canonical.   | Every Feedback-Loop stage |
| `.claude/loop/BACKLOG.md`   | Ordered list of remaining loop iterations with ticket IDs + dependencies       | When scope changes        |
| `.claude/loop/DECISIONS.md` | Running log of Grill-Me answers that matter beyond one session                 | As decisions are made     |
| `.claude/memory/MEMORY.md`  | Unchanged — long-term architectural memory. Read only when explicitly flagged. | Post-sprint only          |

`HANDOFF.md` is deliberately small. It is not a log. It is a baton.

---

## 4. Phase plan for remaining work

### Phase A — Finish the current hardening round (3 sessions)

Gate: PRs #86, #87, #88 must land before Phase B starts.

| Loop | Linear  | Task                                   | Est. Session Length |
| ---- | ------- | -------------------------------------- | ------------------- |
| A.1  | SYN-794 | Review + merge PR #86 (Lead model)     | Short (~30 min)     |
| A.2  | SYN-779 | Review + merge PR #87 (benchmark page) | Short (~30 min)     |
| A.3  | SYN-793 | Review + merge PR #88 (GA4 property)   | Short (~30 min)     |

Each of these is **one loop**. Do not attempt all three in one session — the merge discipline is the point.

### Phase B — Attribution engine (1 session)

| Loop | Linear  | Task                                | Prereq       |
| ---- | ------- | ----------------------------------- | ------------ |
| B.1  | SYN-795 | Real multi-touch attribution engine | A.1 + A.3 in |

Large scope (L). Use `/grill-me` to decide: which attribution model is default? Which data paths are MVP vs stretch?

### Phase C — Human-unblock round

These cannot be done by a code session. Phill must clear the gate first.

| Loop | Linear  | Action needed from Phill                                     |
| ---- | ------- | ------------------------------------------------------------ |
| C.1  | SYN-725 | Apply migration + schedule pg_cron + add Slack secret        |
| C.2  | SYN-734 | Only dispatchable after SYN-725 soaks for 72h in production  |
| C.3  | SYN-573 | YouTube OAuth in Vercel (HeyGen scope removed — see SYN-800) |
| C.4  | SYN-787 | AU GCP project                                               |
| C.5  | SYN-788 | Same AU GCP project                                          |

### Phase D — Strategy authoring

These are Phill-authored. Claude is a writing partner, not owner.

| Loop | Linear  | Task                                 |
| ---- | ------- | ------------------------------------ |
| D.1  | SYN-777 | Cross-Client Benchmark IOR table row |
| D.2  | SYN-774 | IOR hypothesis — benchmark layer     |
| D.3  | SYN-736 | Retrofit 5 innovations w/ hypotheses |
| D.4  | SYN-735 | Monday scorecard innovation section  |
| D.5  | SYN-780 | Network Score architecture spec      |
| D.6  | SYN-776 | Sprint 9 benchmark architecture spec |

---

## 5. Session exit criteria

A session **MUST** exit (not continue into the next loop) when any of these fire:

1. Context usage ≥ 70% (hard stop; write `HANDOFF.md` and quit)
2. A PR has merged **and** Linear has been updated
3. A blocker has been identified that needs human input
4. Grill-Me produced "do not proceed" or the scope was rejected
5. The test gate has been red for more than 3 fix attempts

---

## 6. The `/grill-me` skill (create if missing)

Location: `.claude/skills/grill-me/SKILL.md`

Purpose: **force explicit clarification before code**. Every non-trivial task enters Grill-Me.

Contract:

1. Read the Linear ticket (via MCP) + any files the ticket names.
2. Produce **3–7 numbered questions** that, if wrong, would produce the wrong change. Categories to cover:
   - Scope boundaries (what is explicitly out?)
   - Data model (new tables? enum extensions?)
   - Failure modes (what happens if this breaks?)
   - Auth / authorisation (public? org-scoped? admin-only?)
   - Migration story (schema-only? apply now?)
   - Rollback (can we revert without data loss?)
3. For each question, state the assumption you'd make if not answered.
4. Wait for Phill to respond with one of:
   - A direct answer per question
   - "Proceed with assumptions"
   - "Reject — this task is wrong"
5. Write the final confirmed scope to `.claude/loop/HANDOFF.md` under `## Grilled` before any code is written.

Hard rule: **no code until Grill-Me produces a confirmed scope.**

---

## 7. Token budget per loop

| Stage          | Budget  | If exceeded                                  |
| -------------- | ------- | -------------------------------------------- |
| System Prompt  | 3k      | Strip HANDOFF.md further                     |
| Grill-Me       | 8k      | Narrow scope — fewer questions               |
| Implementation | 40k     | Circuit-break; partial state → HANDOFF.md    |
| Testing        | 10k     | Park red tests — exit                        |
| Feedback Loop  | 5k      | HANDOFF.md is a baton, not a diary           |
| **Total**      | **66k** | Session should close with ≥ 30% context free |

---

## 8. What this PRD deliberately rejects

- **Long-context marathons.** 200k-token sessions hide failures. One loop, one session.
- **Compound sessions.** "While I'm here I'll also fix X" — forbidden. X is its own loop.
- **Silent Linear state.** The session that wrote the code is the session that updates Linear. Never the next one.
- **Speculative memory reads.** MEMORY.md/ARCHITECTURE.md are explicit-opt-in per session, not default.
- **Agent swarms across a shared worktree.** Proven to collide (SYN-732 / SYN-793 leaks). Worktree-per-agent is mandatory.

---

## 9. Success metrics

- Average context usage at session end: **≤ 70%**
- Linear ticket drift (tickets shipped but not closed in-session): **0**
- Sessions requiring mid-loop compaction: **≤ 1 in 10**
- PRs per session: **1** (never 0, never 2)

---

## 10. Implementation plan for this PRD itself

Two small loops, that's it:

**Loop PRD.1 — Scaffolding**

- Create `.claude/loop/` directory
- Write `HANDOFF.md`, `BACKLOG.md`, `DECISIONS.md` templates
- Create `.claude/skills/grill-me/SKILL.md`
- Add `/loop-start` slash command
- One commit, one PR

**Loop PRD.2 — First real use**

- Next session starts at Phase A.1 — review/merge PR #86
- Verify the loop actually bounds context; adjust budgets if needed
