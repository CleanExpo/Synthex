# Synthex — Current Focus

> This file tells Claude what matters RIGHT NOW. Update it each sprint.
> Detailed history lives in `.planning/ROADMAP.md`.

## This sprint (2026-08-18)

**Primary goal:** Ship the Gruen self-approval workflow — allow authorised agents to approve their own work under defined conditions.

**Focus areas (in priority order):**

1. `feat/gruen-self-approval` — finish and merge the self-approval gate
2. Media library — stable after recent audio/video upload fixes; hold here
3. Reference library routing — Real Images Only destination fix shipped; no further work

## What Claude should work on when asked

- Any ticket in Linear with status "In Progress" or "Todo" under the current sprint
- Bugs blocking the media upload or approval flows
- TypeScript or test failures on the current branch

## Out of scope this sprint

- New AI generation features (wait for self-approval gate to land first)
- Stripe / billing (internal tool, out of scope permanently for now)
- Admin dashboards beyond what already exists
- New database tables without CEO approval

## North star

Synthex is an **internal Unite Group tool** — not a public SaaS. Every decision prioritises: does this make CleanExpo, CARSI, RestoreAssist, DR, or NRPG operators' day better?

## Key files to read before any non-trivial change

- `CONSTITUTION.md` — immutable rules
- `.planning/ROUTE_REFERENCE.md` — all routes
- `.claude/rules/real-images-only.md` — image generation law
- `.claude/rules/fabel-evidence-standard.md` — evidence tagging
