# CI merge policy — PR checks (SYN-988)

## Blocking (must be green to merge on code quality)

- GitHub Actions: **CI/Build**, **Type Check**, **Lint**, **Unit Tests**
- Security: CodeQL, npm audit, Snyk, Trivy, dependency review (as configured on PR)
- Synthex gates: Review Board, Score Accuracy, Agent PR Validation (non-skipped jobs), DESIGN.md lint, Linear dependency check

## Ignorable for merge decisions (unless branch protection lists them)

- **`Vercel – synthex-sandbox`** — separate Vercel project; often env/config; main preview can pass while sandbox fails
- **CodeRabbit** — advisory when review skipped
- **Skipped** Agent PR Validation sub-jobs and Supabase Preview when not applicable

## Use for QA

- **`Vercel – synthex`** preview URL on the PR (main app build)

## Evidence

PR #300 (2026-05-25): 26 checks passed; only `Vercel – synthex-sandbox` failed; `CI/Build` passed on same commit.

## Vercel CLI on Windows

Corporate TLS inspection may block `npx vercel` / `node` HTTPS. Use Vercel **dashboard** build logs or fix `NODE_EXTRA_CA_CERTS` with a valid corporate root PEM.
