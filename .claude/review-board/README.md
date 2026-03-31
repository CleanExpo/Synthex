# Synthex Review Board

Automated 4-layer code review system that triggers on every PR to `main`. Runs 16 domain-specialist reviews in parallel, synthesises findings through a senior engineering authority (Chief Reviewer), and tracks patterns over time.

## Architecture

1. **PR Manager** (Layer 1) — GitHub Actions triage classifies PR risk tier, dispatches specialists
2. **Specialist Panel** (Layer 2) — 16 skills run in 4 batches of 4 (security, architecture, performance, etc.)
3. **Chief Reviewer** (Layer 3) — Orchestrator with 80% confidence filter, posts unified GitHub PR review
4. **Learning Loop** (Layer 4) — JSONL metrics log, recurring pattern detection, specialist effectiveness tracking

## Risk Tiers

| Tier | Specialists | Timeout | Trigger |
|------|------------|---------|---------|
| Trivial | 2 | 2 min | Docs, config, .gitignore only |
| Standard | 14 | 5 min | Components, utils, styles, tests |
| High-Risk | 16 | 8 min | Auth, API routes, Prisma schema, Stripe |
| Critical | 16 + human flag | 10 min | Migrations, .env, auth rewrites, next.config |

## Manual Review (for testing)

To invoke the Chief Reviewer locally on the current branch:

```bash
claude --agent .claude/agents/chief-reviewer.md
```

## Overriding a Blocked Review

If the Review Board blocks your PR and you believe it is a false positive:

1. Dismiss the review in GitHub UI (click "Dismiss review")
2. Add a PR comment: `OVERRIDE: [reason]`
3. The override is logged in metrics for tracking

## Metrics

- **Active log:** `.claude/review-board/metrics.jsonl`
- **Archive:** `.claude/review-board/metrics-archive/YYYY-MM.jsonl`
- **Report:** Run `/review-metrics` in Claude Code for trend analysis

Entries older than 90 days are automatically archived. Active file capped at 500 entries.

## Spec

Full design specification: `docs/superpowers/specs/2026-03-31-review-board-design.md`

## Linear

SYN-591: [SYN] Review Board — 4-Layer Automated Code Review System
