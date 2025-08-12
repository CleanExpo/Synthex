# Definition-of-Done Audit — Backlog & Remediation Plan

Created: 2025-08-13
Author: Automated audit (assistant)

Summary
-------
This document centralizes findings from a quick Definition-of-Done (DoD) review performed against the repository. It lists the immediate issues discovered, the Vercel build failure details, and a prioritized remediation backlog to reach the "Completely Finished" application state.

Recent actions performed
- Restored `public/login.html` from backup and committed it to `main`.
- Applied Safari compatibility fix: added `-webkit-backdrop-filter`.
- Added accessibility attributes (`aria-label` and `title`) to password toggle buttons.
- Ran `npm audit fix` (non-force). Result: 22 remaining vulnerabilities (19 moderate, 3 high).
- Committed and pushed changes to `main`.

Vercel build failure (excerpt)
--------------------------------
During an automated build on Vercel the install step failed:

```
npm error ERESOLVE could not resolve
While resolving: @storybook/addon-essentials@8.6.14
Found: storybook@9.1.2
Could not resolve dependency: peer storybook@"^8.6.14" from @storybook/addon-essentials@8.6.14
Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps
```

High-level findings
-------------------
- Dependency conflicts between Storybook addons (8.x) and Storybook (9.1.2).
- Security vulnerabilities remain (notably `xlsx` with no upstream fix, dompurify via jspdf).
- No failing tests were executed as part of the build; CI must be added to surface regressions earlier.
- Accessibility issues were flagged by Edge tools (fixed for the login page).

Priority Backlog (actionable)
-----------------------------
Top priority (BLOCKERS)
1. Resolve Storybook / Vercel install failure
   - Option A: Upgrade `@storybook/addon-essentials` and related addons to match `storybook@9.1.2`.
   - Option B: If addons are not available on 9.x, pin storybook to a compatible 8.x release and test.
   - Test: run `npm ci` and `npm run build` locally, then redeploy to staging.

2. Security triage
   - Triage `xlsx` (high severity) — investigate replacement or sandbox usage.
   - Triage dompurify via jspdf/jspdf-autotable — upgrade/replace jspdf if needed.
   - Run `npm audit` and produce a dependency upgrade plan (separate PRs for high-impact packages).

High priority (FUNCTIONAL / QUALITY)
3. Add CI:
   - `npm ci`, `npm run build`, `npm test`, and Playwright E2E in CI for PRs.
4. Tests:
   - Unit tests for auth UI (login/register).
   - Integration tests for `/api/auth/login` and `/api/auth/register`.
   - Playwright E2E: sign-up, sign-in, forgot-password, dashboard flows.

Medium priority (UX / Perf / A11y)
5. Accessibility:
   - Run axe/Lighthouse across key pages and fix issues.
   - Add keyboard navigation checks and ARIA attributes as needed.
6. Performance:
   - Optimize images; add responsive `srcset` for `logo.png`.
   - Add Core Web Vitals checks in CI.

Medium priority (Security & Compliance)
7. Auth hardening:
   - Implement/verify rate limiting, account lockout, secure token handling.
   - Server-side input validation and sanitisation.
8. Privacy & Legal:
   - Finalize privacy policy and TOS pages content.

Low priority (Docs / Handover)
9. Documentation:
   - Update README with local dev steps (`node test-server.js`, env vars).
   - Add API docs for auth endpoints to `API_DOCUMENTATION.md`.

Immediate recommended next steps
--------------------------------
1. Fix Storybook dependency conflict so Vercel builds succeed.
2. Create PRs for security-sensitive package updates (one per major change).
3. Add CI pipeline with install/build/test steps.
4. Implement minimal Playwright E2E for auth to ensure deployed app paths are validated.

How I can help next
-------------------
- Create PR/branch to align Storybook deps (upgrade addons to 9.x or pin storybook to 8.x).
- Run `npm install --legacy-peer-deps` locally and produce a short report.
- Create separate GitHub issue files for each backlog item and push them as markdown files in `ISSUES/`.
- Implement the initial CI workflow (GitHub Actions) to run install/build/tests on PRs.

Use this file as the centralized backlog for the DoD audit. If you want, I will:
- push this file to the repo (commit & push),
- open a branch to attempt the Storybook fix and run a local install/build,
- or create individual issue files per backlog item.
