# Ship-Loop Recovery Recipes

Library of "if you get stuck, try this" patterns. Seeded from PR #142 root-cause work.

Each recipe = `signature → fix → verification`. Loop child skills match a failure's stderr/stdout against the **signature** column, apply the **fix** if matched (one retry), verify with the **verification** column, and escalate if still failing.

## How recipes are matched

A child loop captures the failure output and runs against this list top-to-bottom. First signature match wins. Recipes are deliberately ordered most-specific to most-general.

## Recipe table

| #   | Signature (regex on stderr/stdout)                                                                                                | Fix command(s)                                                                                                                                                          | Verification                                                             | Source                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| 1   | `Property '\w+' does not exist on type 'PrismaClient'`                                                                            | `npx prisma generate`                                                                                                                                                   | Re-run failing command; expect 0 errors on the cited Prisma model        | PR #142 (Prisma drift, 5-week stale client)   |
| 2   | `Cannot find module '@(sentry/react\|vercel/analytics\|vercel/speed-insights)'`                                                   | `npm install`                                                                                                                                                           | Re-run; module resolves                                                  | PR #142 (lockfile drift)                      |
| 3   | `SyntaxError: Unexpected token 'export'` AND path matches `node_modules/(uncrypto\|@upstash/redis\|jose\|@panva\|oauth4webapi)/`  | Confirm `transformIgnorePatterns` in jest configs allowlists the package; if missing, append it                                                                         | Re-run `npx jest <file>`; expect load success                            | PR #142 (uncrypto ESM via @upstash/redis)     |
| 4   | `UnhandledSchemeError: Reading from "node:(fs\|path\|crypto\|os\|stream)"`                                                        | Strip `node:` prefix from import OR convert to `eval('require')` lazy-load inside function body                                                                         | Re-run `npm run build`; expect ✓ Compiled                                | PR #142 (Edge bundle compilation)             |
| 5   | `Module not found: Can't resolve '(fs\|path\|crypto)/promises\|fs/promises\|path'` AND import trace contains `instrumentation.ts` | Convert top-level `import { x } from 'fs/promises'` to `eval('require')('fs/promises')` inside function body                                                            | Re-run `npm run build`                                                   | PR #142 (Edge bundle node-builtin)            |
| 6   | `ReferenceError: fail is not defined`                                                                                             | Replace `fail(...)` with `throw new Error(...)` (Jest 27+ removed `fail` global)                                                                                        | Re-run failing test; the error message is preserved as the throw message | PR #142 (route-coverage test)                 |
| 7   | `Auth coverage ratchet breached. \d+ violations found \(baseline: \d+\)`                                                          | List the new violator route paths from the test stderr; for each: read the route, classify as needs-`withAuth` or needs-`EXEMPT_PREFIXES` entry; apply                  | Re-run `npx jest tests/auth/route-coverage.test.ts`                      | PR #142 (auth coverage discipline)            |
| 8   | `npm audit` reports new HIGH severity AND vuln package is in `dependencies` (not `devDependencies`)                               | `npm audit fix` (non-`--force`); re-run full test suite to catch breakage                                                                                               | `npm audit --omit=dev` shows 0 HIGH                                      | PR #142 (xmldom, basic-ftp closures)          |
| 9   | Test paths in failure log start with `.claude/worktrees/`                                                                         | Confirm `roots: ['<rootDir>/tests', '<rootDir>/__tests__']` is set in `jest.worktree.cjs`; if missing, add it                                                           | Re-run `npm test`; expect 0 worktree-pollution suites                    | PR #142 (worktree discovery scope)            |
| 10  | CI shows `Build: FAILURE` but local `npm run build` passes                                                                        | Diff `package-lock.json` between local and origin; `npm ci` to match exact CI state; `npm run build` again                                                              | Local repro of CI failure visible                                        | PR #142 (lockfile drift surfacing only in CI) |
| 11  | `git push` rejected with `non-fast-forward`                                                                                       | `git fetch origin && git rebase origin/<branch>`; resolve conflicts if any; re-push                                                                                     | `git push` succeeds                                                      | Standard git pattern                          |
| 12  | `gh pr create` returns `pull request already exists for branch`                                                                   | Capture existing PR URL via `gh pr view --json url`; record into state; skip create                                                                                     | State `pr.url` populated                                                 | Standard gh CLI pattern                       |
| 13  | Production smoke `synthex.social/api/health` returns `degraded` with database latency >1500ms                                     | Wait 60s; re-test (cold-start serverless characteristic); if still degraded after 3 retries, escalate                                                                   | Latency drops below 800ms on warm call                                   | Observed in PR #142 production smoke          |
| 14  | Production smoke 5xx on any surface                                                                                               | Check Vercel deploy status via `gh api`; if last deploy state ≠ READY, halt the loop and escalate "Vercel deploy failure"; otherwise classify per `browser-debug` skill | Vercel deploy READY confirmed OR escalation written                      | Standard production triage                    |

## Adding a new recipe

After every shipping incident that wasn't covered:

1. Note the exact failure signature (copy stderr line, generalise to regex)
2. Note the fix that worked (commands run, files changed)
3. Note how you verified the fix (single command that turns red → green)
4. Append to the table above with new # at end
5. Cite the PR or scratchpad doc as `Source` for traceability

The recipe library is the loop's institutional memory. Each row makes the next incident faster.

## Anti-patterns (do NOT add as recipes)

- **Wholesale `--force` operations** (`npm audit fix --force` that downgrades majors; `git push --force` to shared branches; `prisma db push --accept-data-loss`) — these always require human approval, never auto-recipe
- **Recipes that mask root cause** (catch-and-ignore an error to "make the test pass") — recipes must fix the underlying bug, not the symptom
- **Recipes that silently change behavior** (auto-disable a failing test, auto-skip a flaky check) — escalate flakiness to a human, don't paper over it
