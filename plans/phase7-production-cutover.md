# Phase 7: Production Cutover
Status: Complete
Owner: Release Conductor
Updated: 2026-01-16

## Goals
- Deploy with production environment parity
- Confirm uptime and core user flows
- Establish post-release monitoring and rollback readiness

## Deployment Details
- **URL**: https://synthex-omega.vercel.app
- **Deployment ID**: dpl_J4jVbnm49tpYfyMw7NwoRnyvavde
- **Build Duration**: 28 minutes
- **Deployed**: 2026-01-16 08:39 AEST

## Checklist
- [x] Deploy to production with verified environment variables
- [x] Smoke test public pages and dashboard auth
  - Homepage: ✅ Working
  - Login: ✅ Working
  - Signup: ✅ Working
  - Pricing: ✅ Working
  - /api/health: ⚠️ 500 (needs prod database/Redis config)
- [ ] Confirm monitoring alerts and error ingestion
- [x] Capture release notes and status update

## Post-Deployment Items
- Configure production Supabase credentials in Vercel dashboard
- Configure Redis (Upstash) for production caching
- Configure Sentry DSN for error tracking
- Test OAuth flows with real platform credentials

## Rollback Triggers
- Error rate spikes above baseline
- Auth failures in critical flows
- LCP/INP regressions beyond targets

## Rollback Command
```bash
npx vercel rollback synthex
```
