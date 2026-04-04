# SYNTHEX Production Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying SYNTHEX to production. Follow these procedures to ensure safe, reliable deployments with minimal downtime.

**Platform**: Vercel (Primary), AWS (Backup)
**Database**: Supabase PostgreSQL
**Cache**: Redis (Upstash)
**CDN**: Vercel Edge Network

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Deployment Procedures](#deployment-procedures)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Emergency Contacts](#emergency-contacts)

---

## Prerequisites

### Required Access

| Resource | Access Level | How to Obtain |
|----------|-------------|---------------|
| GitHub Repository | Write | Team admin adds to repo |
| Vercel Dashboard | Admin/Developer | Team admin invites |
| Supabase Dashboard | Admin | Team admin invites |
| Linear | Member | Team admin invites |
| Sentry | Member | Team admin invites |

### Local Setup

```bash
# Clone repository
git clone https://github.com/CleanExpo/Synthex.git
cd Synthex

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with production values

# Verify setup
npm run validate:all
```

### Required Tools

- Node.js v22.x
- npm v10+
- Vercel CLI: `npm i -g vercel`
- Git

---

## Pre-Deployment Checklist

### Code Quality Checks

```bash
# Run all quality checks
npm run type-check && npm run lint && npm test

# Verify build succeeds
npm run build
```

- [ ] All TypeScript errors resolved
- [ ] All ESLint warnings addressed
- [ ] All tests passing
- [ ] Build completes successfully

### Database Checks

```bash
# Check migration status
npm run db:status

# Verify database integrity
npm run db:integrity-check
```

- [ ] No pending migrations
- [ ] Database integrity verified
- [ ] Backup created within last 24 hours

### Security Checks

```bash
# Run security audit
npm run security:audit

# Validate environment
npm run validate:env:enhanced
```

- [ ] No critical vulnerabilities
- [ ] All secrets properly configured
- [ ] API keys rotated if needed

### Communication

- [ ] Team notified of deployment window
- [ ] Stakeholders informed of potential downtime
- [ ] Support team prepared for user inquiries

---

## Deployment Procedures

### Standard Deployment (Vercel Auto-Deploy)

**Trigger**: Push to `main` branch

```bash
# 1. Ensure on main branch
git checkout main
git pull origin main

# 2. Create deployment branch
git checkout -b deploy/$(date +%Y%m%d-%H%M)

# 3. Make changes or merge feature branch
git merge feature/your-feature

# 4. Run final checks
npm run check:deploy

# 5. Push to trigger deployment
git checkout main
git merge deploy/$(date +%Y%m%d-%H%M)
git push origin main

# 6. Monitor deployment
# Visit: https://vercel.com/unite-group/synthex/deployments
```

### Manual Deployment (Vercel CLI)

```bash
# 1. Login to Vercel
vercel login

# 2. Preview deployment (staging)
vercel

# 3. Verify preview deployment
# Test all critical paths on preview URL

# 4. Production deployment
vercel --prod --yes

# 5. Record deployment
echo "$(date): Deployed by $(whoami)" >> .deployment-log
```

### Database Migration Deployment

```bash
# 1. Create database backup
npm run db:backup:production

# 2. Run migrations in dry-run mode
npm run db:migrate:dry-run

# 3. Apply migrations
npm run db:migrate:production

# 4. Verify migration success
npm run db:status

# 5. Deploy application code
vercel --prod --yes
```

### Hotfix Deployment

For critical production issues:

```bash
# 1. Create hotfix branch from production tag
git checkout -b hotfix/critical-fix production

# 2. Make minimal fix
# Edit only affected files

# 3. Test locally
npm run test -- --grep "affected-area"

# 4. Commit with hotfix prefix
git commit -m "hotfix: critical issue description"

# 5. Deploy directly to production
vercel --prod --yes

# 6. Merge back to main
git checkout main
git merge hotfix/critical-fix
git push origin main
```

---

## Post-Deployment Verification

### Immediate Checks (0-5 minutes)

```bash
# Health check endpoints
curl https://synthex.social/api/health
curl https://synthex.social/api/health/ready
curl https://synthex.social/api/health/db

# Expected responses: status 200, status: "healthy"
```

- [ ] Health endpoints return 200
- [ ] Database connection healthy
- [ ] Cache connection healthy

### Functional Checks (5-15 minutes)

| Feature | Test URL | Expected Result |
|---------|----------|-----------------|
| Landing Page | https://synthex.social | Page loads < 3s |
| Login | https://synthex.social/login | Form renders |
| Dashboard | https://synthex.social/dashboard | Auth required |
| API | https://synthex.social/api/health | JSON response |

- [ ] Landing page loads
- [ ] Authentication works
- [ ] Dashboard renders
- [ ] API responds correctly

### Performance Checks

```bash
# Lighthouse audit (via Chrome DevTools or CI)
# Target scores:
#   Performance: > 90
#   Accessibility: > 90
#   Best Practices: > 90
#   SEO: > 90
```

- [ ] Lighthouse scores meet thresholds
- [ ] Core Web Vitals within acceptable range
- [ ] No new console errors

### Monitoring Checks

- [ ] Sentry receiving events (check for new errors)
- [ ] Analytics tracking working
- [ ] Log streams flowing

### Sign-off

```
Deployment Sign-off
-------------------
Date: ____________________
Deployer: ________________
Build ID: ________________
Version: _________________

Health Checks: [ ] Pass [ ] Fail
Functional Tests: [ ] Pass [ ] Fail
Performance: [ ] Pass [ ] Fail

Notes:
_______________________________
_______________________________

Approved by: _________________
```

---

## Rollback Procedures

### Quick Rollback (Vercel)

```bash
# List recent deployments
vercel ls synthex

# Identify previous working deployment
# Format: https://synthex-<deployment-id>.vercel.app

# Rollback to previous deployment
vercel rollback <deployment-url>

# Or via dashboard:
# 1. Go to https://vercel.com/unite-group/synthex/deployments
# 2. Find last working deployment
# 3. Click "..." menu → "Promote to Production"
```

### Database Rollback

```bash
# 1. Check current migration status
npm run db:status

# 2. Identify rollback target
# Check migration history

# 3. Execute rollback
npm run db:rollback

# 4. Restore from backup if needed
npm run db:restore -- backups/backup_YYYY-MM-DD.sql
```

### Full Rollback Procedure

1. **Assess Impact**
   - Identify affected features
   - Determine rollback urgency
   - Notify stakeholders

2. **Execute Rollback**
   ```bash
   # Application rollback
   vercel rollback <previous-deployment>

   # Database rollback (if needed)
   npm run db:rollback
   ```

3. **Verify Rollback**
   ```bash
   curl https://synthex.social/api/health
   # Verify version matches expected
   ```

4. **Document**
   - Record rollback reason
   - Create incident report
   - Schedule post-mortem

---

## Troubleshooting Guide

### Deployment Failures

#### Build Fails

```bash
# Check build logs
vercel logs <deployment-url>

# Common causes:
# 1. TypeScript errors
npm run type-check

# 2. Missing dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Environment variables
npm run validate:env
```

#### Deployment Hangs

```bash
# Check Vercel status
curl https://www.vercel-status.com/api/v2/status.json

# Cancel and retry
vercel cancel
vercel --prod --yes
```

### Runtime Errors

#### 500 Internal Server Error

```bash
# Check server logs
vercel logs <deployment-url> --since=1h

# Check Sentry for errors
# Visit: https://sentry.io/organizations/synthex/issues/

# Common causes:
# 1. Database connection issues
# 2. Missing environment variables
# 3. Unhandled exceptions
```

#### Database Connection Issues

```bash
# Test database connection
npm run db:status

# Check Supabase status
# Visit: https://status.supabase.com

# Verify connection string
# Check DATABASE_URL in Vercel dashboard
```

#### Cache Connection Issues

```bash
# Check Redis health
curl https://synthex.social/api/health/redis

# Verify Upstash status
# Visit: https://status.upstash.com
```

### Performance Issues

#### Slow Response Times

```bash
# Check for slow queries
# Review Supabase query performance

# Check edge function logs
vercel logs <deployment-url> --filter=edge

# Review cache hit rates
# Check Redis metrics in Upstash dashboard
```

#### Memory Issues

```bash
# Check function memory usage
# Vercel dashboard → Deployments → Functions tab

# Increase function memory if needed
# Update vercel.json:
# "functions": { "app/api/**/*.ts": { "memory": 1024 } }
```

---

## Emergency Contacts

### Primary On-Call

| Role | Name | Contact |
|------|------|---------|
| Lead Developer | [Name] | [Phone/Slack] |
| DevOps | [Name] | [Phone/Slack] |
| Product Owner | [Name] | [Phone/Slack] |

### Escalation Path

1. **P0 (Critical)**: Lead Developer → DevOps → CTO
2. **P1 (High)**: Lead Developer → Product Owner
3. **P2 (Medium)**: Lead Developer
4. **P3 (Low)**: Next business day

### External Support

| Service | Support URL | SLA |
|---------|-------------|-----|
| Vercel | https://vercel.com/help | Pro plan support |
| Supabase | https://supabase.com/support | Pro plan support |
| Upstash | https://upstash.com/support | Pro plan support |

---

## Appendix

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| DIRECT_URL | Yes | Direct database URL (migrations) |
| JWT_SECRET | Yes | Authentication secret |
| OPENROUTER_API_KEY | Yes | AI service API key |
| NEXT_PUBLIC_APP_URL | Yes | Application URL |

### Deployment Checklist Template

```markdown
## Deployment Checklist - [DATE]

### Pre-Deployment
- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Build successful
- [ ] Database backup created
- [ ] Team notified

### Deployment
- [ ] Deployed to staging
- [ ] Staging verified
- [ ] Deployed to production
- [ ] Production health checks passed

### Post-Deployment
- [ ] Functional tests passed
- [ ] Performance verified
- [ ] Monitoring confirmed
- [ ] Stakeholders notified

### Sign-off
- Deployer:
- Time:
- Build ID:
- Notes:
```

### Quick Commands Reference

```bash
# Deployment
vercel                        # Preview deployment
vercel --prod --yes           # Production deployment
vercel rollback <url>         # Rollback deployment
vercel ls synthex             # List deployments

# Database
npm run db:status             # Check migration status
npm run db:backup             # Create backup
npm run db:migrate            # Run migrations
npm run db:rollback           # Rollback migration

# Health Checks
curl /api/health              # Full health check
curl /api/health/live         # Liveness probe
curl /api/health/ready        # Readiness probe
curl /api/health/db           # Database health

# Debugging
vercel logs <url>             # View logs
vercel logs <url> --since=1h  # Recent logs
npm run validate:all          # Validate configuration
```

---

*Last Updated: February 2026*
*Version: 1.0.0*
