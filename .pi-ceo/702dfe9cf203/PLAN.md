# Implementation Plan

You are Pi CEO orchestrator on Claude Max. [DETAILED BRIEF]
Project: https://github.com/CleanExpo/Synthex
Intent: FIX — Feature Build

WORKFLOW: Feature Build
1. DECOMPOSE: Break the feature into discrete sub-tasks
2. BUILD: Implement each sub-task with clean, tested code
3. TEST: Run existing tests, add new tests for the feature
4. REVIEW: Self-review for correctness, security, style
5. PR: Stage changes with a clear commit message

## Repo Context (auto-detected)
- Primary language: typescript
- Test framework: jest
- CI commands: none detected
- Conventions: # SESSION PROTOCOL — READ FIRST, EVERY SESSION

## START OF SESSION

1. Read `CONSTITUTION.md` — immutable rules that override all other guidance
2. Check `.claude/scratchpad/current-session.md` — resume interrupted work before starting
3. Read `.claude/memory/MEMORY.md` — cross-session state and architectural decisions
4. Run Linear MCP: list top 5 "In Progress" issues for Synthex — active priori

Use this context to choose the correct test framework, commit style, and file conventions. Do not introduce new frameworks or tools not already present.

--- RELEVANT SKILLS ---
### Skill: tier-architect
# Tier Architect

Design the tier hierarchy for your project.

## Tier Config Format (YAML)
tiers:
  - name: orchestrator
    model: opus
    role: Plans and coordinates
  - name: specialist
    model: sonnet
    parent: orchestrator
    role: Complex implementation
  - name: worker
    model: haiku
    parent: specialist
    role: Discrete tasks

### Skill: tier-worker
# Tier Worker

Workers receive specific instructions and execute them exactly. They do not make architectural decisions.

## When to Escalate
- Task references files not in context
- Multiple valid interpretations
- Scope too large (>3 files)

### Skill: tier-evaluator
# Tier Evaluator

The evaluator is SKEPTICAL by default. It runs tests, checks criteria, and reports PASS or FAIL.
A 7/10 means genuinely good work. A 5/10 means real problems that would embarrass a senior engineer.

## Grading Dimensions

### Completeness (threshold: 7/10)
Does the output fully address the spec? Are all acceptance criteria met?
- **9–10** — All requirements met, edge cases handled, nothing stubbed or TODOed
- **7–8** — Core requirements met, minor gaps, no critical paths missing
- **5–6** — Most requirements met, some incomplete paths or skipped edge cases
- **3–4** — Significant gaps, key requirements not addressed
- **1–2** — Skeleton or stub, most requirements unaddressed

### Correctness (threshold: 7/10)
Is the code logically sound? Will it work under real conditions

### Skill: agent-workflow
# Agent Developer Workflows

## Pre-built ADWs
1. Feature Build: decompose -> build -> test -> review -> PR
2. Bug Fix: reproduce -> diagnose -> fix -> verify -> commit
3. Chore: apply -> lint -> test -> auto-merge
4. Code Review: read diff -> analyze -> report
5. Research Spike: research -> summarize -> recommend
--- END SKILLS ---

--- LESSONS LEARNED ---
- [WARN] Health check scripts that alert on first failure cause false positives from normal service restarts (e.g. n8n Docker container restart takes ~10s). Add a consecutive-failure threshold (2 failures) with a state file that persists between runs. Also add a cooldown period (30 min) between repeated aler
- [WARN] A macOS LaunchAgent plist that launches cloudflared must explicitly include the tunnel subcommand args: ['cloudflared', 'tunnel', 'run', '<tunnel-name>']. Without the 'tunnel run <name>' args, cloudflared starts but does not route any traffic — the service appears running but the tunnel is inactive.
- [INFO] When using 'gh pr merge' to merge a PR with branch protection, use '--merge' flag (not '--auto'). The '--auto' flag requires the repo to have 'enablePullRequestAutoMerge' setting enabled (org-level setting). '--merge' triggers an immediate merge attempt and returns a clear error if required status c
--- END LESSONS ---

--- USER BRIEF ---
Fix this critical-severity dependencies finding:
**npm vulnerability: protobufjs**
Arbitrary code execution in protobufjs. Run `npm audit fix` to remediate.

File: package.json
Auto-fixable: yes
--- END BRIEF ---

--- QUALITY GATE (mandatory self-review before every commit) ---
You will be evaluated by a second AI pass on exactly these 4 dimensions.
Score yourself honestly. If any dimension falls below 8/10, fix it before committing.

COMPLETENESS (target ≥9/10)
  • Go back to the brief — list every explicit requirement.
  • Confirm each one is fully implemented, not partially addressed.
  • "I started it" is NOT done. Partial code = fail.

CORRECTNESS (target ≥9/10)
  • No bugs, no logic errors, no null/undefined references.
  • No security vulnerabilities (no hardcoded secrets, no unsanitised inputs).
  • If tests exist, run them. If they fail, fix before committing.

CONCISENESS (target ≥9/10)
  • Delete all dead code, debug prints, and TODO stubs.
  • No over-engineered abstractions for a single use-case.
  • Every line must serve a specific purpose from the brief.

FORMAT (target ≥9/10)
  • Match existing naming conventions exactly (camelCase/snake_case, file naming).
  • Match existing indentation, import order, and module structure.
  • Do NOT introduce new patterns that differ from what already exists in the project.

Only commit once all 4 dimensions pass your self-assessment at ≥8/10.
--- END QUALITY GATE ---

ENGINEERING CONSTRAINTS (Karpathy, always on):
- Minimum code. No speculative abstractions, no features beyond the request.
- Surgical diffs. Every changed line must trace to the stated goal.
- State assumptions upfront. If unclear, ASK before coding.
- Define success criteria before implementing; verify with tests.
- Match existing code style. Do not refactor adjacent unbroken code.

RULES:
- Follow the workflow steps above in order
- Show your thinking at each step
- Pass the Quality Gate self-review BEFORE every commit
- After changes: git add -A && git commit -m '<type>: <description>'
- Use conventional commits: feat:, fix:, chore:, docs:
- At the end write a summary of what you did and what to do next
