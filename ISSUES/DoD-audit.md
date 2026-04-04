# Definition-of-Done Audit — Backlog & Remediation Plan

Created: 2025-08-13  
Author: Automated audit (assistant)

Summary
-------
This document centralizes findings from a Definition-of-Done (DoD) review performed against the repository and records work completed during this session. It lists the immediate issues discovered, build outcomes, and a prioritized remediation backlog to reach the "Completely Finished" state.

Current status (high-level)
- Storybook dependency conflict has been resolved locally. Static build succeeded with Storybook 8.6.x alignment.
- Runtime standardized to Node 20.x across engines and developer tooling.
- Next.js production build compiles, but export phase reported errors/warnings that must be triaged (see below).
- Security triage pending for xlsx and jspdf/dompurify chain.
- CI pipeline not yet present; tests need expansion and gating in PRs.

Completed this session
----------------------
- Standardized Node 20.x across environments
  - Updated package.json engines: `"node": "20.x"`, `"npm": ">=10 <11"`.
  - Added `.nvmrc` and `.node-version` files pinned to `20`.
  - Committed and pushed on `storybook-fix` branch.

- Storybook fix (BLOCKER addressed)
  - Pinned Storybook family to `^8.6.14` (addons and core).
  - Removed unresolved addon `@storybook/addon-onboarding`.
  - Restricted story globs to TS/TSX only (avoids MDX compiler/indexer errors for now).
  - Verified: `npm run build-storybook` succeeded; output at `storybook-static/`.
  - Committed and pushed on `storybook-fix` branch.

- Dependency install on Node 20
  - Fresh `npm install` completed (Prisma generate OK).
  - Lockfile updated and pushed alongside Storybook config change.

Recent build results
--------------------
- Storybook (static):
  - Success on Storybook 8.6.14 after:
    - Removing `@storybook/addon-onboarding`
    - Restricting globs to `**/*.stories.@(ts|tsx)`
  - Notes: Some webpack bundle size WARNs (non-blocking).

- Next.js production build:
  - Compile: OK.
  - Export phase warnings/errors:
    1) Missing dependency for CSS inlining
       - Error: `Cannot find module 'critters'` when prerendering `/404` and `/500`.
       - Likely due to `optimizeCss` experiment; Next expects `critters` to be installed.
    2) Metadata warnings
       - `metadataBase` not set; fallback to `http://localhost:3000` across many pages.
    3) Dynamic server usage during export
       - `/api/user/settings`: uses `request.headers` → not statically renderable (DYNAMIC_SERVER_USAGE).
    4) Build-time fetch of relative API path
       - `/test-email` page attempted to use `fetch('/api/test-email')` during export → `ERR_INVALID_URL`.
    5) Prisma/DB initialization during export
       - Runtimes hit DB routes (`/api/test-db`, `/api/health`, `/api/dashboard/stats`) leading to `FATAL: Tenant or user not found` at build/export time.

Security — known issues
-----------------------
- `xlsx` (SheetJS):
  - Upstream npm registry does not expose `0.20.2` at time of install; direct upgrade path blocked.
  - Vulnerabilities noted (Prototype Pollution, ReDoS in earlier lines).
- `jspdf` / `jspdf-autotable` chain can pull vulnerable `dompurify` in some versions (triage required).

Priority Backlog (actionable)
-----------------------------

Top priority (BLOCKERS)
1) Merge Storybook fix and verify on Vercel
   - Validate Storybook build on CI and Vercel using Node 20.x.
   - Acceptance:
     - CI: install+build passes.
     - Vercel: install step and build step pass; static Storybook artifacts are produced (if deployed) or Next build unaffected.

2) Next build/export hardening
   - 2.1 Add `critters` dependency or disable `optimizeCss`
     - Option A: `npm i -D critters` (version compatible with Next 14.2.x), keep `optimizeCss`.
     - Option B: disable `optimizeCss` experiment in `next.config.mjs`.
     - Acceptance: No `critters`-related errors in `/404` and `/500` prerender.
   - 2.2 Set `metadataBase`
     - Define `metadataBase` in root layout metadata using a canonical base URL from env (e.g., `NEXT_PUBLIC_SITE_URL`).
     - Acceptance: No metadataBase warnings in build logs.
   - 2.3 Guard build-time API calls
     - Replace relative build-time `fetch('/api/...')` with:
       - Client-only usage (guard for `typeof window !== 'undefined'`), or
       - Absolute URL built from `NEXT_PUBLIC_SITE_URL` and only executed in runtime (not at export), or
       - Use `export const dynamic = 'force-dynamic'` or equivalent on pages/routes that must not be prerendered.
     - Acceptance: No `ERR_INVALID_URL` and no export attempts to call app routes at build time.
   - 2.4 Mark dynamic/DB-backed routes appropriately
     - For API routes that hit Prisma or depend on headers, declare `export const dynamic = 'force-dynamic'` or move to SSR-only without static export.
     - Gate DB checks during `phase-production-build` or mock DB calls in build/export worker paths.
     - Acceptance: No Prisma DB errors during build/export; export phase succeeds (or routes skip export safely).

High priority (FUNCTIONAL / QUALITY)
3) Security triage — xlsx
   - Inventory xlsx usage (read vs write).
   - Preferred: migrate to `exceljs` (actively maintained); if migration requires more time, implement mitigations:
     - MIME/type and size validation, sandbox parsing (worker/subprocess), timeouts, rate limiting.
   - Acceptance:
     - `npm audit` shows no high items from xlsx (or documented mitigation + timeline), end-to-end flows validated.

4) Security triage — jspdf/dompurify chain
   - Upgrade `jspdf` / `jspdf-autotable` to versions that avoid vulnerable dompurify or rework usage.
   - Acceptance: `npm audit` has no new highs from that chain.

5) CI pipeline
   - GitHub Actions: Node 20.x (setup-node v4), `npm ci`, type-check, unit tests, integration tests, build; optional Lighthouse budget.
   - Acceptance: Green CI required before merge to main; artifacts stored.

6) Tests & coverage
   - Unit tests for auth UI and key components.
   - Integration tests for `/api/auth/login` and `/api/auth/register`.
   - Playwright E2E: sign-up, sign-in, forgot-password, dashboard flows.
   - Acceptance: Coverage ≥ 70% lines; critical UX paths covered E2E.

Medium priority (UX / Perf / A11y)
7) Accessibility
   - Run axe/Lighthouse across key pages; fix ARIA/contrast/focus issues; ensure keyboard navigation.
   - Acceptance: WCAG 2.1 AA; Lighthouse Accessibility ≥ 90.

8) Performance
   - Optimize images; add responsive `srcset`; split heavy bundles; verify caching.
   - Acceptance: Core Web Vitals thresholds met; Lighthouse performance scores within budget.

Medium priority (Security & Compliance)
9) Authentication hardening
   - Rate limiting and brute-force prevention on login endpoints; secure token flows; input validation/sanitisation.
   - Acceptance: Negative tests; logs confirm throttling; no reflected XSS in auth surfaces.

10) Privacy & Legal
   - Finalize Privacy Policy and TOS content; ensure discoverability.
   - Acceptance: Published pages linked in footer and settings.

Low priority (Docs / Handover)
11) Documentation
   - README: local dev steps, Node 20, common scripts.
   - API docs: auth endpoints; expected responses and errors.
   - Ops guides: deploy/rollback/monitoring/backups.
   - Acceptance: Docs audited; links from repo root; versioning policy captured.

Environment & Deployment Readiness
----------------------------------
- Node 20.x enforcement:
  - engines pinned; `.nvmrc`/`.node-version` created.
  - Action pending: ensure Vercel project is set to Node 20.x (either via engines or project setting).
- Staging parity:
  - Ensure staging mirrors production (sandbox payments, unlocked tiers).
- Secrets hygiene:
  - Confirm no secrets leak into client bundles.

Branch / PRs
------------
- `storybook-fix` branch:
  - Align Storybook 8.6.x, remove onboarding addon, restrict TS/TSX stories only.
  - Node 20 standardization committed here.
  - Next steps: open PR, validate CI, and merge.

Immediate recommended next steps
--------------------------------
1) Open PR for `storybook-fix`, enable CI checks, and validate Vercel build.
2) Address Next export issues:
   - Add `critters` as a devDependency (or disable `optimizeCss`).
   - Set `metadataBase` in root layout metadata.
   - Guard build-time API calls; mark dynamic routes to avoid export-time DB/headers usage.
3) Start security remediation tracks:
   - xlsx: inventory + migration/mitigation plan.
   - jspdf chain: upgrade path and audit.
4) Add CI pipeline with install/build/test and optional Lighthouse budgets.

How I can help next
-------------------
- Create individual markdown issue tickets in `ISSUES/` for each backlog item with acceptance criteria.
- Add a GitHub Actions workflow for Node 20 with install/build/test.
- Implement the `critters` fix and `metadataBase` updates behind a new branch and PR.
- Begin `xlsx` usage inventory and propose a migration plan to `exceljs`.
