# Agent Registry — Synthex

Reference for all agents available in the Synthex development environment.
Updated: 2026-03-03 | Linear: UNI-1238

---

## Project-Level Agents (.claude/agents/)

These agents are Synthex-specific and auto-load project skills.

### build-engineer
**Purpose:** Vercel deployment, builds, environment config, production monitoring
**Tools:** Read, Write, Bash, Grep, Glob
**Skills:** build-orchestrator, database-prisma, project-scanner, security-hardener, sql-hardener
**Use when:** Deploying to Vercel, diagnosing build failures, auditing environment variables,
  running npm build, checking bundle size, Prisma migration deployment
**Don't use for:** Code architecture decisions, test writing, PR reviews
**Cost estimate:** Medium — typically 2-4 tool calls for a build check

### code-architect
**Purpose:** Architecture decisions, code review, design patterns, refactoring strategies
**Tools:** Read, Write, Bash, Grep, Glob
**Skills:** architecture-enforcer, content-pipeline, design, spec-generator, ui-ux, social-integrations
**Use when:** Planning feature implementation, reviewing PR architecture, deciding between patterns,
  refactoring component structure, writing specs before implementation
**Don't use for:** Running builds/deploys, test execution, security auditing
**Cost estimate:** Medium-High — architecture work benefits from thorough context

### qa-sentinel
**Purpose:** Test coverage, quality gates, output validation, regression checking
**Tools:** Read, Write, Bash, Grep, Glob
**Skills:** api-testing + QA domain skills
**Use when:** Writing Jest/Playwright tests, checking test coverage, validating API contracts,
  running test suites, verifying phase outputs meet acceptance criteria
**Don't use for:** Architecture decisions, deployment, security deep-dives
**Cost estimate:** Medium — test runs are fast but test writing needs context

### senior-reviewer
**Purpose:** Senior engineering review post-significant changes — Blockers, Warnings, Suggestions
**Tools:** Glob, Grep, Read, Bash
**Skills:** route-auditor, security-hardener, architecture-enforcer
**Use when:** After implementing a phase, reviewing API routes for security gaps,
  checking auth patterns, verifying org-scoping, auditing for architectural drift
**Don't use for:** Active implementation, deployment, writing new code
**Cost estimate:** Low-Medium — structured review with fixed output format

---

## User-Level Agents (~/.claude/agents/)

These agents are general-purpose and available across all projects.

### general-purpose
**Purpose:** Multi-step autonomous tasks combining research + implementation
**Tools:** All tools including Task, Edit, Write, Bash, WebSearch, WebFetch
**Use when:** Complex tasks requiring multiple rounds of exploration + code changes,
  investigating unfamiliar patterns, researching external APIs, open-ended searches
**Don't use for:** Simple single-file edits (use tools directly instead)
**Cost estimate:** High — full autonomy, multiple turns

### Explore
**Purpose:** Fast codebase exploration and search (read-only, no edits)
**Tools:** All tools EXCEPT Task, ExitPlanMode, Edit, Write, NotebookEdit
**Thoroughness levels:** quick (basic search), medium (moderate), very thorough (comprehensive)
**Use when:** Finding files by pattern, searching for keywords across codebase,
  answering questions about code structure without making changes
**Don't use for:** Any task requiring file changes
**Cost estimate:** Low — read-only, fast

### Plan
**Purpose:** Software architect — returns step-by-step implementation plans
**Tools:** All tools EXCEPT Task, ExitPlanMode, Edit, Write, NotebookEdit
**Use when:** Designing multi-file implementation strategy before writing code,
  identifying which files need to change, understanding architectural trade-offs,
  assessing complexity of a proposed change
**Don't use for:** Any task requiring file changes
**Cost estimate:** Low-Medium — analysis only

### claude-code-guide
**Purpose:** Claude Code CLI, Agent SDK, and Anthropic API documentation
**Tools:** Glob, Grep, Read, WebFetch, WebSearch
**Use when:** Questions about Claude Code features, hooks configuration, MCP servers,
  building Anthropic SDK applications, Claude API usage, keyboard shortcuts
**Don't use for:** General programming questions unrelated to Claude/Anthropic

---

## Routing Guide

| Task | Best Agent |
|------|-----------|
| Deploy to Vercel | `build-engineer` |
| Review code quality after phase | `senior-reviewer` |
| Plan a new feature implementation | `Plan` then `code-architect` |
| Write tests for a component | `qa-sentinel` |
| Explore codebase to find a pattern | `Explore` |
| Complex multi-step research + code | `general-purpose` |
| Architecture decision between options | `code-architect` |
| Run full build validation | `build-engineer` |
| Audit API route security | `senior-reviewer` |
| Phase acceptance testing | `qa-sentinel` |
| Questions about Claude Code hooks | `claude-code-guide` |
| Orchestrate multiple agents | `hive-mind` |

---

## Blueprint Library (Minions-Inspired)

Repeatable execution patterns for common development tasks. Each blueprint specifies the
agent sequence, tools required, and verification gate before the next step can begin.

Reference: `.planning/research/stripe-minions-synthesis.md`

### blueprint:feature
**For**: New feature implementation (new model, API route, UI component)

```
1. [Explore]   → discover: existing patterns, related files, schema
2. [Plan]      → design: file list, contract signatures, acceptance criteria
3. [code-architect] → implement: schema, service, route, component
4. [qa-sentinel]    → verify: type-check, tests, acceptance criteria met
5. [senior-reviewer]→ audit: security, org-scoping, arch patterns
6. [build-engineer] → commit + validate build
```

**Verification gate**: `npm run type-check && npm test` must pass before commit.
**Isolation**: Use `isolation: "worktree"` for significant features.

### blueprint:bugfix
**For**: Reported bug, test failure, production issue

```
1. [Explore]   → reproduce: find failing code, understand root cause
2. [code-architect] → fix: targeted change, no unrelated refactoring
3. [qa-sentinel]    → regression: test that covers the bug
4. [build-engineer] → commit
```

**Verification gate**: Regression test must pass. No new TypeScript errors.
**Principle**: Fix root cause. Never bypass gates to make symptoms disappear.

### blueprint:refactor
**For**: Structural improvement without behaviour change

```
1. [Explore]       → read: understand current structure fully
2. [Plan]          → design: target architecture, file moves
3. [code-architect]→ extract: apply changes incrementally
4. [qa-sentinel]   → verify: all existing tests still pass
```

**Verification gate**: Zero behaviour change. All tests green before and after.
**Constraint**: Only touches files in scope. No opportunistic cleanup.

### blueprint:api-route
**For**: New API endpoint

```
1. [Explore]       → schema: check Prisma models, existing similar routes
2. [code-architect]→ implement: route handler + Zod validation + org-scoping
3. [senior-reviewer]→ audit: route-auditor skill — auth, validation, scoping
4. [qa-sentinel]   → test: contract test + error cases
```

**Verification gate**: route-auditor skill passes. Auth + org-scope confirmed.
**Required**: Zod input schema + org-scoped query in every mutation handler.

### blueprint:workflow-step
**For**: Adding a new step type to the Phase 62 workflow engine

```
1. [Explore]       → read: existing step-types/, orchestrator.ts, context-builder.ts
2. [code-architect]→ implement: step-types/[name].ts + orchestrator routing
3. [qa-sentinel]   → test: unit test for step execution + confidence scoring
4. [senior-reviewer]→ audit: isolation, error handling, retry logic
```

**Verification gate**: Step returns { output, confidenceScore } or throws structured error.
**Required**: Confidence score (0.0–1.0) for all AI step types.

---

## Dispatch Template

When spawning a specialist, always include:

```
Task tool:
  subagent_type: [agent-name]
  description: "UNI-XXXX: [brief description]"
  prompt: |
    Linear: UNI-XXXX
    Goal: [specific outcome]
    Files: [relevant paths]
    Acceptance: [measurable criteria]
    Constraints: [from CONSTITUTION.md]
```

---

## Anti-patterns

- DON'T use `general-purpose` for tasks a specialist handles better (wastes context)
- DON'T use `build-engineer` for code reviews (wrong skill set)
- DON'T run `senior-reviewer` mid-implementation (invoke after a complete change set)
- DON'T skip the `Plan` agent for complex multi-file features (prevents rework)
- DON'T omit a Linear issue ID from the task description (violates CONSTITUTION)
- ALWAYS check: does a specialist exist before reaching for `general-purpose`?
- NEVER spawn agents without a clear, measurable acceptance criterion
