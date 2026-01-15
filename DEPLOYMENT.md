# 🚀 SYNTHEX Production Deployment Guide

## Prerequisites

- Node.js 22.x installed
- Vercel CLI installed (`npm i -g vercel`)
- Access to Vercel dashboard
- Access to Supabase dashboard
- All environment variables configured

## Environment Variables

### Required for Production

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

# Security
JWT_SECRET=[RANDOM_32_CHAR_STRING]

# AI Features
OPENROUTER_API_KEY=[YOUR_API_KEY]
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=gpt-4-turbo-preview

# Application
NEXT_PUBLIC_APP_URL=https://synthex.social
NODE_ENV=production
```

## Deployment Steps

### Automated Deployment (Recommended)

```bash
# Run the deployment script
node scripts/deploy-production.js
```

This script will:
1. ✅ Verify environment variables
2. ✅ Run type checking and linting
3. ✅ Perform security audit
4. ✅ Build the application
5. ✅ Deploy to Vercel
6. ✅ Generate deployment report

### Manual Deployment

```bash
# 1. Verify environment
node scripts/validate-env.js

# 2. Run tests
npm run type-check
npm run lint
npm audit --omit=dev

# 3. Build application
npm run build

# 4. Deploy to Vercel
vercel --prod --yes

# 5. Verify deployment
curl -I https://synthex.social
```

## Database Migrations

### Before First Deployment

1. **Apply database hardening** (if not already done):
```sql
-- In Supabase SQL Editor
-- Run: ship-audit/sql/00_supabase_final.sql
```

2. **Verify RLS policies**:
```sql
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

3. **Check indexes**:
```sql
SELECT * FROM pg_indexes WHERE schemaname = 'public';
```

## Vercel Configuration

### Build Settings
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### Environment Variables
Add all variables from `.env.example` in Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable for Production environment
3. Ensure sensitive values are encrypted

### Domain Configuration
1. Add custom domain: `synthex.social`
2. Configure DNS:
   - A Record: `@` → `76.76.21.21`
   - CNAME: `www` → `cname.vercel-dns.com`

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check site availability
curl -I https://synthex.social

# Verify security headers
curl -I https://synthex.social | grep -E "strict-transport|content-security"

# Test API endpoint
curl https://synthex.social/api/health
```

### 2. Critical User Flows

- [ ] **Authentication**
  - [ ] Sign up with email
  - [ ] Sign in
  - [ ] Password reset
  - [ ] Sign out

- [ ] **Core Features**
  - [ ] Create campaign
  - [ ] Generate content
  - [ ] View dashboard
  - [ ] Update settings

- [ ] **Database Operations**
  - [ ] Read operations working
  - [ ] Write operations working
  - [ ] RLS policies enforced

### 3. Monitoring Setup

#### Vercel Analytics
- Enable Web Analytics in Vercel dashboard
- Monitor Core Web Vitals
- Set up alerts for errors > 1%

#### Error Tracking
```javascript
// Sentry configuration (if using)
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production
```

#### Uptime Monitoring
- Configure uptime checks for:
  - `https://synthex.social`
  - `https://synthex.social/api/health`

## Rollback Procedures

### Quick Rollback

```bash
# View recent deployments
vercel ls synthex

# Rollback to previous deployment
vercel rollback [DEPLOYMENT_URL]

# Or use alias to switch back
vercel alias [OLD_DEPLOYMENT_URL] synthex.social
```

### Database Rollback

```sql
-- Each migration has rollback script at bottom
-- Example: ship-audit/sql/02_hardening.sql
-- Find ROLLBACK SCRIPT section and run
```

## Maintenance Mode

### Enable Maintenance

```javascript
// Set in Vercel Environment Variables
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE="We'll be back shortly!"
```

### Disable Maintenance

```javascript
// Remove or set to false
MAINTENANCE_MODE=false
```

## Performance Optimization

### CDN Configuration
- Static assets cached for 1 year
- API responses cached for 0 seconds (no-cache)
- HTML pages cached for 5 minutes

### Image Optimization
- Use Next.js Image component
- Lazy load below-fold images
- Serve WebP format when supported

## Security Checklist

- [x] HTTPS enforced
- [x] Security headers configured
- [x] CORS restricted to production domain
- [x] Environment variables encrypted
- [x] Database RLS enabled
- [x] Rate limiting on auth endpoints
- [x] Input validation on all forms
- [x] XSS protection enabled
- [x] SQL injection prevented (Prisma)

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
npm run clean:cache
npm run build

# Check for type errors
npx tsc --noEmit

# Check for missing dependencies
npm ls
```

### Database Connection Issues

```bash
# Test connection
node scripts/test-db-connection.js

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### API Errors

```bash
# Check API logs in Vercel
vercel logs synthex --follow

# Test specific endpoint
curl -X POST https://synthex.social/api/[endpoint] \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Support

- **Documentation:** This file
- **GitHub Issues:** https://github.com/CleanExpo/Synthex/issues
- **Email:** support@synthex.social
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support

---

**Last Updated:** 2025-08-13
**Version:** 2.0.1
**Status:** Production Ready (94% Ship Readiness)
