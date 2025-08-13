# Repository Inventory Report

Generated: 2025-08-13  
Target: Next.js 14 App Router, Node 20.x, Vercel

## 1) Framework & Runtime

- Framework: Next.js 14.2.31 (App Router)
- Language: TypeScript (tsconfig implied by Next usage)
- Node: engines set to 20.x; npm >=10 <11
- Deployment: Vercel (vercel.json present; middleware headers set)
- Storybook: 8.6.14 aligned; stories restricted to TS/TSX; static artifacts present

## 2) Directory Map (high-signal)

- app/
  - pages, layouts, error boundaries, providers
  - api/ with many app routes: auth, dashboard, monitoring, test-db, test-email, etc.
- middleware.ts (security headers, rate limiting, auth guard; matcher excludes /api)
- prisma/ (schema referenced; Prisma client generated on postinstall)
- public/ (assets)
- stories/ + .storybook/ (Storybook config)
- tests/ (Playwright to be added)
- reports/, plans/ (this document + finish plan)

## 3) Dependencies (selected)

Runtime:
- next ^14.2.31, react ^18.2.0, lucide-react, tailwindcss ^3.4.0
- prisma ^5.8.0, @prisma/client ^5.8.0
- @supabase/supabase-js ^2.39.3, @supabase/ssr ^0.6.1
- @sentry/nextjs ^7.90.0 (moved to dependencies)
- nodemailer ^7.0.5 (email sending endpoint)
- axios ^1.11.0, zod, zustand, tanstack/react-query
- xlsx ^0.18.5 (risk: historical advisories)
- jspdf ^3.0.1, jspdf-autotable ^5.0.2 (review chain for dompurify risk)
- ioredis ^5.7.0 (present; check usage)

Dev:
- @storybook/* ^8.6.14
- @playwright/test, playwright (E2E ready)
- jest, @testing-library/*, eslint, prettier

## 4) Scripts (selected)

- dev, build, start, lint, test/coverage, postinstall (prisma generate)
- db:push/migrate/studio (Prisma)
- analyze: `ANALYZE=true next build`
- storybook: dev/build
- websocket scripts (tsx)
- deploy:prod (vercel --prod --yes)
- e2e scripts to be added (Playwright)

## 5) Middleware & Security

- middleware.ts
  - Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
  - CORS headers for API routes
  - Rate limiting: in-memory (replace with Redis in production)
  - Auth guard for protected paths (/dashboard, /api/protected)
  - CSRF checks for mutations
  - Matcher excludes `/_next/*`, `/favicon.ico`, `/public/*`, and `/api/*` (so app API routes are not intercepted)

CSP allowlist references:
- JS/CDN: jsdelivr, unpkg, tailwind CDN
- Fonts: Google Fonts
- Images: https/self/data/blob
- Connect: self, openrouter, supabase

## 6) Environment Variables (detected in code / docs)

Required / used:
- NEXT_PUBLIC_APP_URL (used in metadataBase and client absolute fetch)
- Supabase:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- Email:
  - EMAIL_PROVIDER (smtp|gmail|sendgrid)
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (if smtp)
  - GMAIL_USER, GMAIL_APP_PASSWORD (if gmail)
  - SENDGRID_API_KEY (if sendgrid)
  - EMAIL_FROM
- OpenRouter (from docs/tools):
  - OPENROUTER_API_KEY
  - OPENROUTER_BASE_URL (https://openrouter.ai/api/v1)
  - OPENROUTER_MODEL (gpt-5-thinking)
- Sentry:
  - SENTRY_DSN (runtime)
  - SENTRY_ENVIRONMENT
  - SENTRY_AUTH_TOKEN (CI upload only)
- Database/Prisma (if used directly outside Supabase HTTP):
  - DATABASE_URL
- OAuth providers (if enabling Google/GitHub flows):
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

Present in existing .env.example:
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- OPENROUTER_API_KEY
- JWT_SECRET
- NEXT_PUBLIC_APP_URL
- DATABASE_URL
- NEXT_PUBLIC_SENTRY_DSN
- NODE_ENV

Gaps to add in .env.example:
- OPENROUTER_BASE_URL, OPENROUTER_MODEL
- EMAIL_PROVIDER, EMAIL_FROM
- SMTP_* / GMAIL_* / SENDGRID_API_KEY
- SENTRY_DSN, SENTRY_ENVIRONMENT (rename or add to match usage; keep NEXT_PUBLIC_SENTRY_DSN if used on client)
- OAuth provider keys (if desired): GOOGLE_*, GITHUB_*

## 7) Recent Build Issues & Fixes

- “critters” error during export: resolved by disabling experimental.optimizeCss
- metadataBase warnings: resolved by setting metadataBase in app/layout.tsx
- Dynamic server usage for /api/user/settings: resolved by `export const dynamic = 'force-dynamic'`
- Export-time relative fetch (ERR_INVALID_URL): test-email page now uses absolute URL and runs in client effect
- Middleware matcher updated to not intercept /api, fixing 404s
- Storybook globs set to TS/TSX; onboarding addon removed

## 8) Risks & Action Items

Security:
- Audit xlsx (migrate to exceljs or pin to safe version) and jspdf/dompurify chain
- Tighten CSP allowlist; document policy
- Ensure secrets never leak in client bundles (safeguard by prefixing NEXT_PUBLIC only for public values)

Auth:
- Confirm Supabase-based login flows; if adding OAuth providers, ensure callbacks and NEXT_PUBLIC_APP_URL are correct; add tests

Performance:
- Run bundle analyzer; code-split heavy dashboard routes
- Ensure images use Next/Image and lazy loading

DX/CI:
- Add scripts: typecheck, lint, e2e, release:check
- Add GitHub Actions workflow to run release:check on PRs and main (upload Playwright artifacts)

QA:
- Add Playwright tests: auth, happy-path, errors, visual

## 9) Commands (to be used in later phases)

- Install browsers for E2E: `npx playwright install chromium`
- Run E2E: `npx playwright test`
- Analyze bundles: `npm run analyze`
- Audit deps: `npm run audit` (to be added)

## 10) Summary

The repository is in a shippable posture after recent build fixes. Remaining work: finalize env parity, tighten security/CSP, add E2E tests and CI gates, and perform targeted perf/code-splitting. See “Finish Plan” for a detailed breakdown and acceptance criteria.
