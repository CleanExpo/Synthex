---
name: deployment
version: 1.0.0
description: Deployment patterns and processes
author: Your Team
priority: 3
triggers:
  - deploy
  - deployment
  - production
---

# Deployment Patterns

## Deployment Targets

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | Auto-deploy on push |
| Backend | DigitalOcean App Platform | Via GitHub Actions |
| Database | Supabase | Managed service |

## Frontend Deployment (Vercel)

### Setup
1. Connect GitHub repo to Vercel
2. Set root directory to `apps/web`
3. Configure environment variables

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BACKEND_URL=
```

### Build Settings
- Framework: Next.js
- Build Command: `pnpm turbo run build --filter=web`
- Output Directory: `.next`

## Backend Deployment (DigitalOcean)

### App Spec
```yaml
name: backend
region: nyc
services:
  - name: api
    source:
      type: github
      repo: your-org/your-repo
      branch: main
      deploy_on_push: true
    dockerfile_path: apps/backend/Dockerfile
    health_check:
      http_path: /health
    envs:
      - key: ANTHROPIC_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: SUPABASE_URL
        scope: RUN_TIME
        value: ${SUPABASE_URL}
```

### GitHub Actions Deploy
```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "apps/backend/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}

      - name: Deploy to App Platform
        run: doctl apps create-deployment ${{ secrets.DO_APP_ID }}
```

## Database Migrations

### Apply in Production
```bash
# Set production connection string
export SUPABASE_DB_URL="postgresql://..."

# Run migrations
supabase db push --db-url $SUPABASE_DB_URL
```

### Rollback
```bash
# Revert last migration
supabase db reset --db-url $SUPABASE_DB_URL
```

## Pre-Deployment Checklist

- [ ] All tests pass
- [ ] Build completes without errors
- [ ] Environment variables set
- [ ] Database migrations ready
- [ ] Secrets configured
- [ ] Health checks implemented

## Post-Deployment Verification

- [ ] Application loads correctly
- [ ] Health endpoint returns 200
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] Database queries succeed
- [ ] No error spikes in logs

## Rollback Procedure

1. Identify the issue
2. Revert to previous deployment
   - Vercel: Promote previous deployment
   - DO: Rollback to previous image
3. Fix the issue in development
4. Deploy fix

## Monitoring

### Metrics to Watch
- Response times (p50, p95, p99)
- Error rates
- Request volume
- CPU/Memory usage

### Alerts
- Error rate > 1%
- Response time p95 > 500ms
- Health check failures

## Secrets Management

**Never commit secrets to git!**

Store in:
- Vercel Environment Variables
- DigitalOcean App Platform Secrets
- GitHub Secrets (for CI/CD)

## Verification

- [ ] Deployment completes successfully
- [ ] All health checks pass
- [ ] No errors in logs
- [ ] Performance within acceptable range
- [ ] Rollback procedure tested
