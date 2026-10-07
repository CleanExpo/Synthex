# Opportunity auth coverage classification repair

CI job 112597063650 in run 37560705174 reports two violations at baseline zero: the proposal collection and export routes. Both already use the existing authenticated `resolveProposalContext` guard inside the immediately invoked `proposalResponse` error boundary.

1. Reproduce the zero-baseline failure and add real-route and spoofing regression fixtures.
2. Register the exact resolver import, and recognize its call only inside an inline callback directly returned through the exact imported `proposalResponse` wrapper. Keep nested function traversal disabled elsewhere.
3. Require real import bindings; reject shadowing, wrong modules, wrapper-only calls, unused nested helpers, and unguarded sibling handlers.
4. Run the blocking ratchet, strict informational scanner, existing opportunity API auth tests, targeted diagnostics and lint. Have the independent reviewer inspect the scanner diff before publication.

No route exemptions, baseline increase, auth policy changes, product changes, or new dependencies.

## Verification

- Red: the CI log and local blocking ratchet both report exactly two missing guards at baseline zero. New positive fixtures fail before recognition is added; spoofing fixtures remain rejected.
- Green: `node node_modules/jest/bin/jest.js --config config/jest/jest.worktree.cjs tests/auth/route-coverage.test.ts tests/unit/opportunity-review/api.test.ts --no-coverage --runInBand` passes all 72 tests.
- `node node_modules/tsx/dist/cli.mjs scripts/check-auth-coverage.ts --strict` scans 764 routes: 589 covered, 175 existing exemptions, zero missing.
- Targeted ESLint and file diagnostics pass. Publication remains with the parent task after independent review.
- Review found that invoking a generator returns an iterator without executing its guard body. Sync and async generator negative controls both failed before the callback recognizer rejected `asteriskToken`; both now pass.
