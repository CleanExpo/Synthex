# Production Rollback Runbook — Synthex

One-liner exit for a bad production deploy (billing break, OAuth callback failure,
5xx spike). Rehearse this BEFORE you need it. Vercel project: `unite-group/synthex`,
prod alias `synthex.social`.

## When to roll back
- Checkout returns errors / wrong price after a billing-config deploy.
- OAuth connect/callback fails for a platform post-deploy.
- Prod 5xx spike or a healthcheck goes red (`/api/health/stripe?prices=1`,
  `/api/health/*`) right after a deploy.

## Fastest path — promote the previous good deployment (no rebuild)
```bash
# 1. List recent prod deployments (newest first). Note the last KNOWN-GOOD URL.
vercel ls synthex --prod --scope unite-group

# 2. Promote that known-good deployment back to the prod alias instantly.
vercel promote <known-good-deployment-url> --scope unite-group
# e.g. vercel promote https://synthex-XXXXXXXXX-unite-group.vercel.app --scope unite-group
```
`promote` re-points `synthex.social` at an already-built deployment — seconds, no
rebuild, no code change. This is the primary rollback.

## Alternative — `vercel rollback`
```bash
vercel rollback --scope unite-group           # roll the alias to the prior deploy
vercel rollback <deployment-url> --scope unite-group
```

## If the cause was an env-var change (e.g. Stripe price IDs)
Env-var edits only take effect on a NEW deployment, and rolling the alias to an
older deployment reverts to that deployment's env snapshot behaviour. To fix
forward instead: correct the env var, then
`vercel redeploy <current-prod-url> --scope unite-group` (rebuild, same commit).

## Verify after rollback
```bash
curl -sI https://synthex.social | head -1                     # expect 200
curl -s "https://synthex.social/api/health/stripe?prices=1"   # status healthy + priceChecks active
```

## Notes
- `--scope unite-group` is required (deployments live under that team).
- Rolling back the alias does NOT revert database migrations. Prod DB migrations
  are a separate manual founder gate; a schema change needs its own down-path.
- Record the incident + the deployment SHAs (bad + rolled-to) in the session log.
