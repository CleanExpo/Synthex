---
id: deploy-001
domain: deployment
title: Vercel Deployment Configuration
created: 2026-02-16
updated: 2026-02-16
freshness: current
confidence: 0.95
evidence: vercel.json
tags: [vercel, serverless, deployment]
---

# Vercel Deployment Configuration

## Summary
Deployed to Vercel as `synthex-production`. Single serverless function handles all routes. iad1 region, 1024MB memory, 30s timeout.

## Detail

### Configuration
- **Project name**: `synthex-production`
- **Root directory**: `Synthex/` (only app code deploys)
- **Build chain**: `npm ci` -> `npx prisma generate` -> `npm run build:prod`
- **Runtime**: `@vercel/node@3.0.0`
- **Memory**: 1024MB
- **Timeout**: 30 seconds
- **Region**: `iad1` (US East)

### Routing
All requests rewrite to `api/vercel.js`:
- `/api/*` -- API endpoints
- `/auth/*` -- Authentication
- `/health` -- Health check
- `/api-docs*` -- Swagger documentation
- `/app`, `/classic`, `/dashboard`, `/seo`, `/seo-demo` -- Frontend routes

### Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- API routes: `Cache-Control: no-cache, no-store, must-revalidate`

## Implications
- `.claude/` directory is NOT deployed (outside rootDirectory)
- All new API routes must be added to `rewrites` in vercel.json
- Cold starts possible -- serverless function, not always-on
- `FORCE_REBUILD` build env var can trigger fresh deployments
