# Finish Plan — Release Conductor

Generated: 2025-08-13  
Target Stack: Next.js 14 (App Router) + TypeScript + Node 20.x + Vercel

This plan drives the repo to a production-ready release with Security, Auth, Performance, UX, 3D/UI (optional), DX/CI, and QA coverage. It includes work breakdowns, exact files to change, acceptance criteria, commands, and deliverables.

--------------------------------------------------------------------

0) Context Summary (from Inventory)
- Next.js 14.2.31 App Router; Node 20; Vercel deploy
- Supabase client used; Prisma present; multiple app/api routes
- Email test endpoint (/api/test-email) supports SMTP/Gmail/SendGrid
- Middleware sets security headers and now excludes /api matcher
- metadataBase configured; optimizeCss disabled; dynamic flags added where required
- Storybook aligned (8.6.14), stories TS/TSX

Key Gaps
- E2E + CI gate missing
- Security hardening (audit, CSP tighten, dependency risks)
- Perf code-splitting and Lighthouse budgeting
- Env template parity (OpenRouter base/model, email provider values, Sentry, optional OAuth)

--------------------------------------------------------------------

1) Security 🔐

Tasks
- Threat Model (STRIDE-lite) and Data Flow (include AI/OpenRouter + Supabase flows)
- Secrets Hygiene: ensure .env.example parity; add runtime safety checks for critical envs
- Dependency Audit and remediation:
  - Run `npm audit --omit=dev` and patch or document mitigations
  - Evaluate `xlsx` (migrate to `exceljs` or justify pin with mitigations)
  - Validate `jspdf` chain vs dompurify versions; ensure safe usage
- Headers/CSP Review:
  - middleware.ts: confirm CSP allow-list minimal and explicit (object-src 'none', frame-ancestors 'none' unless needed)
  - Keep CORS limited to required origins
- AI Safety:
  - Redact PII/secrets from logs/prompts
  - Validate tool outputs; sandbox any remote fetches; prompt-injection guards

Files to touch
- security/threat-model.md (new)
- security/csp.md (new)
- patches/dependency-updates.md (new)
- middleware.ts (only if allow-list needs refinement)

Acceptance Criteria
- Zero high/critical `npm audit` issues
- Documented threat model + CSP
- .env.example includes all required keys; no secrets in repo

Commands
- `npm run audit` (to be added)
- `npm audit --omit=dev`

--------------------------------------------------------------------

2) Auth 🪪

Tasks
- Confirm current auth flows (Supabase-based endpoints)
- Add dev-time runtime logging of critical auth envs (only in development)
- Redirect policy: after login return to intended page; logout clears tokens and goes to home
- Add Playwright E2E tests for:
  - visit /login page (renders; form present)
  - mock provider or local stub approach (basic smoke if OAuth not enabled yet)
  - session persistence (basic check behind a guarded page if implemented)
- Author `auth/README.md` with provider setup and allowed origins

Files to touch
- app/(auth)/login/page.tsx (redirects/status messages if needed)
- tests/e2e/auth.spec.ts (new)
- auth/README.md (new)

Acceptance Criteria
- E2E auth smoke passes in CI
- No 500s during login flows or redirects
- Developer-friendly error messages for missing envs

--------------------------------------------------------------------

3) Performance 🚀

Tasks
- Analyze bundles: `npm run analyze` to identify >200KB chunks
- Code-split heavy routes: app/dashboard/* and similar by dynamic imports
- Images: ensure Next/Image usage; lazy load below fold; preload LCP assets
- Add Lighthouse CI (local first) and capture before/after JSON
- Review caching headers for static assets (middleware or vercel.json)

Files to touch
- scripts/perf-check.mjs (new; runs analyze + Lighthouse if desired)
- Code-split diffs in app/dashboard/* as needed
- lighthouserc.json (optional)

Acceptance Criteria
- Desktop: LCP < 2.5s, INP < 200ms, CLS < 0.1 for primary pages
- `reports/perf-audit-before.json` and `reports/perf-audit-after.json` attached

Commands
- `npm run analyze`
- `npx lighthouse http://localhost:3000 --output=json --output-path=reports/perf-audit-before.json` (local)

--------------------------------------------------------------------

4) UX 🎯

Tasks
- Ensure loading/empty/error states across critical routes (dashboard, forms)
- Add skeleton loaders + retry UI for API calls
- A11y: aria, focus, keyboard nav; fix color contrast
- Global error boundary exists (present); ensure per-route error.tsx coverage

Files to touch
- app/** (add skeletons/spinners/empty states)
- ux/ux-checklist.md (new)

Acceptance Criteria
- Lighthouse Accessibility ≥ 90 on key pages
- No dead-end screens; friendly error states; retries present where sensible

--------------------------------------------------------------------

5) 3D/UI 🧊 (if applicable)

Tasks
- If react-three-fiber present: DRACO/meshopt compression; Suspense loader; move heavy work to workers; cap fps appropriately
- Add notes with tradeoffs

Files to touch
- ui3d/optimization-notes.md (new)
- 3D scene files (if present)

Acceptance Criteria
- Stable visual snapshot; target FPS met on typical hardware

--------------------------------------------------------------------

6) DX/CI 🛠

Tasks
- Add scripts:
  - "e2e", "e2e:ui", "audit", "release:check"
- Add GitHub Actions workflow to run:
  - npm ci
  - playwright install
  - type-check (script exists as "type-check")
  - lint
  - unit tests (jest)
  - e2e (Playwright headless)
  - build
  - Upload Playwright artifacts
- Optional: vercel.json headers/caching (middleware covers many headers already)

Files to touch
- package.json (scripts)
- .github/workflows/ci.yml (new)

Acceptance Criteria
- PRs require `release:check` green to merge
- Artifacts available for E2E (videos/traces/screenshots)

Commands
- `npm ci`
- `npx playwright install --with-deps`
- `npm run release:check`

--------------------------------------------------------------------

7) QA ✅

Tasks
- Add baseline Playwright E2E:
  - auth.spec.ts: /login page renders; optional mocked sign-in
  - happy-path.spec.ts: home/dashboard load; core UI visible
  - errors.spec.ts: call a known API, handle non-200 gracefully in UI if possible
  - visual.spec.ts: snapshot (desktop + mobile)
- Ensure mobile viewport smoke (iPhone 12/Android midrange)

Files to add
- tests/e2e/auth.spec.ts
- tests/e2e/happy-path.spec.ts
- tests/e2e/errors.spec.ts
- tests/e2e/visual.spec.ts

Acceptance Criteria
- All E2E tests green locally and in CI
- Artifacts stored in CI

--------------------------------------------------------------------

8) Release DoD ✅

- No TypeScript errors (`npm run type-check`)
- Build passes (`npm run build`)
- E2E happy-path green (auth + critical flows)
- Lighthouse targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 (desktop baseline)
- Zero high/critical vulnerabilities (`npm run audit`)
- Auth provider/session persistence verified (if enabled)
- .env.example parity with production

--------------------------------------------------------------------

Unified Diff Examples (planned changes)

A) package.json scripts (append)
+    "e2e": "playwright test",
+    "e2e:ui": "playwright test --ui",
+    "audit": "npm audit --omit=dev",
+    "release:check": "npm run type-check && npm run lint && npm run test && npm run e2e && npm run build"

B) .github/workflows/ci.yml (new)
+ name: CI
+ on:
+   pull_request:
+   push:
+     branches: [ main ]
+ jobs:
+   build:
+     runs-on: ubuntu-latest
+     steps:
+       - uses: actions/checkout@v4
+       - uses: actions/setup-node@v4
+         with:
+           node-version: 20
+           cache: npm
+       - run: npm ci
+       - run: npx playwright install --with-deps
+       - run: npm run type-check
+       - run: npm run lint
+       - run: npm test
+       - run: npm run e2e
+       - run: npm run build
+       - name: Upload Playwright artifacts
+         if: always()
+         uses: actions/upload-artifact@v4
+         with:
+           name: playwright-artifacts
+           path: |
+             playwright-report
+             test-results

C) tests/e2e/*.spec.ts (new stubs)
+ import { test, expect } from '@playwright/test';
+ test.describe('Auth', () => {
+   test('login route renders', async ({ page }) => {
+     await page.goto('/login');
+     await expect(page.locator('body')).toBeVisible();
+   });
+ });

--------------------------------------------------------------------

Commands to Execute (local)
- Install Playwright browsers: `npx playwright install chromium`
- Run E2E: `npm run e2e`
- Run release check: `npm run release:check`
- Analyze bundles: `npm run analyze`

--------------------------------------------------------------------

Next Agent Handoff
- DX/CI agent: add scripts + CI workflow
- QA agent: add E2E tests (stubs), run locally, attach artifacts
- Security agent: generate threat-model.md, csp.md, audit/patches
- Performance agent: run analyzer + produce before/after metrics
- Auth agent: confirm envs + redirects; implement smoke tests

When all phases complete and CI green with perf targets met, declare:
“✅ READY TO SHIP” with links to the CI run, Playwright report, Lighthouse JSON, and zipped artifacts.
