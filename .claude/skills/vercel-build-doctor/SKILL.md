---
name: vercel-build-doctor
description: >
  Diagnose Synthex Vercel production build failures from the actual build logs,
  not guesses. Pulls the failed deployment's logs via the Vercel REST API,
  classifies the failure against a known-error table (OOM/exit 137, type-check,
  schema drift, module-not-found, function-size, timeout), and applies the
  proven fix. Use whenever a Vercel deploy shows "failure"/ERROR, the
  GitHub "Vercel – synthex" check is red, or someone says "we're still getting
  Vercel errors".
type: reference-skill
context: fork
---

# Vercel Build Doctor

Synthex deploys to two Vercel projects under team `unite-group`:
`synthex` (production) and `synthex-sandbox`. The GitHub commit status
`Vercel – synthex` is the production gate. When it is red, the live site does
not update. **Never guess the cause — read the actual build log first.**

## Step 1 — Find the failed deployment

The Vercel CLI is often scoped to the wrong account (`vercel projects ls`
returns nothing for unite-group). Use the GitHub commit status to get the
deployment URL, then the REST API for logs.

```bash
# Which Vercel deploys failed, across recent main commits:
for sha in $(git log --format=%H -8 origin/main); do
  echo "=== ${sha:0:8} ==="
  gh api repos/CleanExpo/Synthex/commits/$sha/status \
    | python3 -c "import sys,json;[print(' ',s['context'],'|',s['state']) for s in json.load(sys.stdin).get('statuses',[]) if 'ercel' in s['context']]"
done
```

The **last green** commit bounds the regression: the break landed between it and
the first red one.

## Step 2 — Pull the real build log (Vercel REST API)

The CLI auth token lives at
`~/Library/Application Support/com.vercel.cli/auth.json`. Team `unite-group`
= `team_KMZACI5rIltoCRhAtGCXlxUf`.

```bash
TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
TEAM=team_KMZACI5rIltoCRhAtGCXlxUf

# Most recent deployments + state + commit:
curl -s "https://api.vercel.com/v6/deployments?app=synthex&teamId=$TEAM&limit=8" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
for d in json.load(sys.stdin)['deployments']:
    m=d.get('meta',{})
    print(d['uid'], d.get('state'), m.get('githubCommitSha','')[:8], m.get('githubCommitMessage','')[:50])"

# Full build log for the failing deployment id (dpl_...):
DPL=dpl_xxxxxxxx
curl -s "https://api.vercel.com/v3/deployments/$DPL/events?teamId=$TEAM&builds=1&limit=1000" \
  -H "Authorization: Bearer $TOKEN" -o /tmp/vlogs.json
python3 -c "import json;[print(e.get('text','').rstrip()) for e in json.load(open('/tmp/vlogs.json')) if e.get('text','').strip()]" | tail -100
```

The last ~40 lines almost always carry the verdict. Look for the explicit
`Error:` line and the Vercel "Build system report" footer (it names OOM events).

## Step 3 — Classify the failure

| Signal in log                                                             | Cause                                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exited with 137`, `Killed`, "Out of Memory"/"OOM" in Build system report | **OOM** — `next build --webpack` peak RSS > 16GB build container                             | `experimental.webpackMemoryOptimizations: true` in `next.config.mjs` (already applied — see History). If it recurs: drop entries from `experimental.optimizePackageImports` (it raises build memory), or raise the build machine memory tier in Vercel project settings. Do **not** raise `--max-old-space-size` past the container — that makes OOM worse. |
| `Type error:` / `tsc` failure                                             | Build-time type-check (`next.config.mjs` re-enables it unless `NEXT_SKIP_BUILD_TYPECHECK=1`) | Fix the type locally: `npm run type-check`. Never set `ignoreBuildErrors: true` (SYN-877 shipped broken code that way).                                                                                                                                                                                                                                     |
| `[drift-check] ✗` / "column ... missing"                                  | Live Supabase DB is behind `prisma/schema.prisma`                                            | Apply the migration out of band via Supabase `apply_migration` (NEVER `prisma db push`). The drift gate in `scripts/build-with-migrations.sh` is correct to block.                                                                                                                                                                                          |
| `Module not found: Can't resolve '<node builtin>'` in Edge compilation    | A node-only dep pulled into the Edge/instrumentation bundle                                  | Alias it to `false` for `nextRuntime === 'edge'` in the `webpack()` hook (pattern already there for `@linear/sdk`, `crypto`).                                                                                                                                                                                                                               |
| `Serverless Function ... exceeds 250 MB`                                  | Binary deps traced into the Lambda                                                           | Add to `serverExternalPackages` + `outputFileTracingExcludes` in `next.config.mjs`.                                                                                                                                                                                                                                                                         |
| `P3005`/`P3009` (and build continues)                                     | Unbaselined `_prisma_migrations` ledger — **expected, not a failure**                        | None. The build script tolerates it by design; the drift check is the real gate.                                                                                                                                                                                                                                                                            |
| Build exceeds 45 min / timeout                                            | Usually source-map upload or runaway step                                                    | Confirm Sentry webpack plugin stays disabled (see `next.config.mjs` footer).                                                                                                                                                                                                                                                                                |

OOM is the recurring one: the app keeps growing, so the webpack build drifts
toward the memory ceiling and goes **flaky** (same commit passes on retry, fails
on the next). A green retry is not a fix — treat any 137 as a real regression.

## Step 4 — Fix, then verify locally before re-deploying

```bash
npm run type-check && npm run lint && npm test
```

For OOM specifically, reproduce the memory profile locally when possible:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx next build --webpack
```

Commit with the issue id, push, then re-run Step 1/2 against the new deployment
and confirm `READY` (not `ERROR`) before claiming done. Paste the deployment
`state` line — per `.claude/rules/verification-gate.md`, a "fixed" claim needs
the tool output that proves it.

## History (so we stop relearning this)

- **2026-06-17** — Production `synthex` builds failed from commit `ca63dc17`
  (#516) onward with **exit 137 / OOM**; last green was #515. Cause: cumulative
  app growth pushed `next build --webpack` past the 16GB container. Flaky at the
  ceiling (69ce505e produced both an ERROR and a READY deployment). Fix:
  `experimental.webpackMemoryOptimizations: true`. The failures were _not_
  caused by the code in the intervening PRs — they were memory-ceiling drift.
