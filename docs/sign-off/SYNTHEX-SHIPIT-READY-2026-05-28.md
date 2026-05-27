# Synthex Shipit Readiness Packet - 2026-05-28

| Field | Value |
|---|---|
| Evidence date | 2026-05-28 Australia/Brisbane |
| Evidence UTC window | 2026-05-27 21:48-22:55 UTC |
| Canonical local checkout | `/Users/phill-mac/pi-seo-workspace/Synthex` |
| Working path used | `/Users/phill-mac/Documents/Synthex` |
| GitHub repo | `https://github.com/CleanExpo/Synthex.git` |
| Release identity source of truth | `npm run shipit:status:live -- --run-rls` release parity gate |
| Production domain probed | `https://synthex.social` |

## Verdict

Automated `/shipit` gates are green for the consolidated main repo.

This packet supersedes `SYNTHEX-PRODUCTION-READY-2026-05-27.md`, which captured an earlier blocked state before the cleanup commits, database remediation, PR merge, production deployment, and post-deploy audits completed.

## Build Consolidation Evidence

| Gate | Result | Evidence |
|---|---|---|
| Canonical checkout | PASS | `pwd` from `/Users/phill-mac/Documents/Synthex` resolves to `/Users/phill-mac/pi-seo-workspace/Synthex`. |
| Documents path | PASS | `/Users/phill-mac/Documents/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`. |
| Home shortcut path | PASS | `/Users/phill-mac/Synthex -> /Users/phill-mac/pi-seo-workspace/Synthex`. |
| Git worktrees | PASS | `git worktree list` shows one active Synthex worktree at `/Users/phill-mac/pi-seo-workspace/Synthex` on `main`. |
| Git remote | PASS | `origin` is `https://github.com/CleanExpo/Synthex.git`. |
| Local git state | PASS | `git status --short --branch` returned `## main...origin/main` with no uncommitted files. |
| Stale partial artifact | PASS | `/Users/phill-mac/Documents/.Synthex_PARTIAL_ORPHAN_20260526-230400_ARCHIVED_DO_NOT_USE` remains preserved outside the active repo path and is checked by `/shipit`. |

## Release Evidence

| Gate | Result | Evidence |
|---|---|---|
| Remediation PR | PASS | PR #311 merged into `main` at `700dff176801a9c88a0e839b41ca65ae4ad8efbb`. |
| Database migration ledger | PASS | `npm run db:migrate:dry-run` reported `Database is already up to date!`. |
| RLS schema coverage | PASS | `npm run rls:coverage` reported 214 models, 259 RLS-enabled tables, 0 uncovered. |
| Live `/shipit` gate | PASS | `npx dotenv -e .env.local -- npm run shipit:status:live -- --run-rls` reported 0 blocking gates and 0 warnings. |
| Production release parity | PASS | `/shipit` confirmed live production serves the local `HEAD` release commit. The gate checks `/api/health.buildId` against the current git SHA prefix at runtime, so this packet does not hard-code a self-invalidating docs commit. |
| Production health | PASS | `https://synthex.social/api/health` returned `status:"healthy"`, `version:"2.0.1"`, `environment:"production"`, and a `buildId` matching the current `/shipit` release parity gate. |
| Vercel production deployment | PASS | Latest Vercel production deployment for `unite-group/synthex` was Ready. |

## GitHub Post-Merge Workflows

All checked workflows on the release commits completed successfully:

- `CI`
- `Deploy`
- `CodeQL`
- `Security`
- `DESIGN.md lint`
- `Lighthouse Agentic Browsing`
- `Lighthouse Audit`

The Deploy workflow completed its production deploy job and Lighthouse budget assertion successfully.

## Remaining Human Acceptance

No automated blocker remains in the consolidated `/shipit` report.

The remaining recommended acceptance is manual founder/product UAT inside the live app:

- sign in with the intended production user
- update business details
- save
- reload
- switch business context away and back
- verify the saved details persist

This manual UAT is not a repo/build-sprawl blocker, but it is still the best final product-confidence check before treating the business-details workflow as founder-accepted.
