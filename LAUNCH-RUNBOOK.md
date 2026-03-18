# Launch Runbook — Synthex v3.0

## Overview

This runbook covers the go-live process for Synthex at synthex.social.
Follow each step in order. Do not skip ahead.

---

## Day -1 (Pre-launch)

### 1. Secrets Rotation

Work through the SECURITY.md pre-launch checklist:

- Rotate STRIPE*SECRET_KEY to live key (`sk_live*\*`)
- Set STRIPE_WEBHOOK_SECRET to live-mode webhook endpoint secret
- Verify SENTRY_DSN points to production project
- Verify RESEND_API_KEY is domain-verified for synthex.social
- Verify all social OAuth credentials are production app credentials

Update all secrets in Vercel dashboard → Project Settings → Environment Variables.

### 2. DNS Configuration

| Record             | Type    | Value                                    |
| ------------------ | ------- | ---------------------------------------- |
| synthex.social     | A/CNAME | Vercel (configured via Vercel dashboard) |
| www.synthex.social | CNAME   | cname.vercel-dns.com                     |

Verify DNS propagation: `dig synthex.social` should return Vercel IP.

### 3. Final Build Verification

```bash
npm run type-check && npm run lint && npm test
```

All must pass with zero errors.

### 4. Staging Smoke Test

```bash
BASE_URL=https://staging.synthex.social node scripts/smoke-test.mjs
```

All 7 tests must pass before proceeding to Day 0.

---

## Day 0 (Launch)

### Step 1: Remove GOD MODE restriction

If synthex.social is behind a maintenance page or GOD MODE flag:

- Remove the flag from Vercel environment variables
- Redeploy: `vercel --prod` or trigger via Vercel dashboard

### Step 2: Live Smoke Test

```bash
BASE_URL=https://synthex.social node scripts/smoke-test.mjs
```

Expected output: 7/7 passed.

If any test fails — stop, investigate, do not announce.

### Step 2b: Production Critical Paths (Playwright)

Run the production critical path E2E suite against the live site:

**Windows PowerShell (recommended on Windows):**

```powershell
$env:BASE_URL = "https://synthex.social"
$env:PROD_TEST_EMAIL = "you@example.com"
$env:PROD_TEST_PASSWORD = "yourpassword"
$env:PW_SKIP_WEBSERVER = "1"

npx playwright test tests/e2e/production-critical-paths.spec.ts
```

If you see an error like:

> `[global-setup] Missing required env vars for production E2E run: PROD_TEST_EMAIL, PROD_TEST_PASSWORD`

…it means you did not set the required environment variables in the current shell.

**Bash (Mac/Linux):**

```bash
BASE_URL=https://synthex.social \
  PROD_TEST_EMAIL=you@example.com \
  PROD_TEST_PASSWORD=yourpassword \
  PW_SKIP_WEBSERVER=1 \
  npx playwright test tests/e2e/production-critical-paths.spec.ts
```

If you have an owner/admin account available, you can also enable admin-path coverage:

```bash
BASE_URL=https://synthex.social \
  PROD_TEST_EMAIL=you@example.com \
  PROD_TEST_PASSWORD=yourpassword \
  PROD_ADMIN_EMAIL=admin@example.com \
  PROD_ADMIN_PASSWORD=adminpassword \
  PW_SKIP_WEBSERVER=1 \
  npx playwright test tests/e2e/production-critical-paths.spec.ts
```

> Note: The signup path in production is invite-code gated and is treated as a
> non-destructive smoke check by default (it does not create accounts unless
> explicitly enabled).

#### Human gates (manual verification — must be ticked)

The automated spec will print these at the end of the run. They must be completed manually:

- [ ] 1. Full signup → email confirm → 5-step onboarding → dashboard
- [ ] 2. Stripe checkout → tier shows Pro → webhook confirmed in Stripe dashboard
- [ ] 3. Live Instagram OAuth → connection confirmed
- [ ] 4. Post schedule → notification bell badge count correct
- [ ] 5. Register Linear webhook URL (UNI-1180)

### Step 3: Monitor First 30 Minutes

- Sentry: https://sentry.io → Synthex project → Issues tab
- Vercel: https://vercel.com → Synthex project → Functions tab (watch error rates)
- Uptime: /api/health/ready should consistently return 200

Watch for:

- 500 errors in Sentry
- Database connection failures
- Stripe webhook failures (check Stripe Dashboard → Webhooks)
- Auth failures (failed Supabase logins)

### Step 4: Announce Launch

Once smoke test passes and first 15 minutes are stable:

- Post to social media channels
- Send launch announcement email (Resend)
- Update status page (if applicable)

---

## Rollback Procedure

If critical issues are found after launch:

### Option A: Traffic Block (fastest — <1 minute)

Set a Vercel environment variable `MAINTENANCE_MODE=true` and redeploy.
Display a maintenance page from middleware.ts.

### Option B: Revert to previous deployment (<5 minutes)

1. Open Vercel dashboard → Deployments
2. Find the last known-good deployment
3. Click "..." → Promote to Production

### Option C: Emergency feature flag

For partial issues affecting one feature:

- Disable via feature flag in Vercel environment variables
- Redeploy (Vercel can reuse build cache — deploys in ~30 seconds)

---

## Post-Launch (Week 1)

- [ ] Monitor Sentry error rate daily — target <0.1% error rate
- [ ] Review Vercel analytics for slow routes (>2s p95)
- [ ] Check cron jobs ran successfully (Sentry cron monitors)
- [ ] Review Stripe webhook delivery success rate
- [ ] Test one full user journey manually (signup → connect platform → create post)

---

## Key URLs

| Service            | URL                               |
| ------------------ | --------------------------------- |
| App                | https://synthex.social            |
| Vercel Dashboard   | https://vercel.com                |
| Supabase Dashboard | https://app.supabase.com          |
| Stripe Dashboard   | https://dashboard.stripe.com      |
| Sentry Dashboard   | https://sentry.io                 |
| Health Check       | https://synthex.social/api/health |
| Smoke Test         | `node scripts/smoke-test.mjs`     |
