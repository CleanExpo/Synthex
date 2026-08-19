# Production deployment gate (Synthex)

Production deploys via GitHub Actions (`deploy-production` in `.github/workflows/deploy.yml`)
run `vercel deploy --prod` on push to `main`. Two controls protect that path:

## 1. Human approval (required reviewer)

The `deploy-production` job runs in the `production` GitHub Environment, which has a
**required reviewer**. GitHub pauses the job and waits for a human to approve before
the deploy step runs. The approval is bound to the exact workflow run — i.e. the
commit `github.sha` that triggered it — so approving ships that commit and nothing else.

- Approve: the run appears under Actions → the waiting run → "Review deployments" → Approve.
- This is configured on the environment, not in this file.

## 2. Central deploy inhibition (kill switch)

Set the repository **variable** `DEPLOY_INHIBIT=true` (Settings → Secrets and variables →
Actions → Variables) to freeze all production deploys without editing code. The
`deploy-production` job's `if:` skips when `DEPLOY_INHIBIT == 'true'`. Unset (or set to
anything else) to resume.

## Rollback of the gate itself

To remove the required-reviewer gate and return to the prior (ungated) state, clear the
`production` environment's protection rules:

```bash
echo '{"wait_timer":0,"reviewers":[],"deployment_branch_policy":null}' \
  | gh api -X PUT repos/CleanExpo/Synthex/environments/Production --input -
```

## Known residual bypasses (not closed by this gate)

The required-reviewer gate covers the **GitHub Actions** deploy path only. These other
paths can still reach production and are NOT gated by it:

- **Vercel deploy hook** — the repo has a `VERCEL_DEPLOY_HOOK` secret; a URL POST to a
  deploy hook triggers a Vercel deploy directly, bypassing Actions.
- **Vercel Git integration** — if enabled on the Vercel project, a push can auto-deploy
  independently of Actions.
- **`vercel --prod` with a token** — anyone holding a `VERCEL_TOKEN` can deploy from a
  workstation.
- **Environment admin bypass** — `can_admins_bypass` is currently `true` on the
  environment, so a repo admin can skip the wait.
  Closing these requires Vercel-dashboard changes (disable auto-deploy / rotate the deploy
  hook / scope the token) — see the estate auto-deploy gating package.
