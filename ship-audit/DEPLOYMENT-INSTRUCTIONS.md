# 🚀 SYNTHEX Deployment Instructions
**Branch**: release/audit-fixes  
**Date**: 2025-08-13  
**Readiness**: 65% → Ready with Environment Configuration

## ✅ Completed Fixes
- ✅ Removed 5 test/debug endpoints
- ✅ Fixed CORS configuration  
- ✅ Added security headers
- ✅ Created environment validation
- ✅ Configured console.log removal
- ✅ Updated database documentation

## 🔴 Required Before Deployment

### 1. Configure Vercel Environment Variables
Go to [Vercel Dashboard](https://vercel.com) → Your Project → Settings → Environment Variables

Add these **REQUIRED** variables:

```bash
# Supabase Configuration (get from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Security
JWT_SECRET=[generate-32-char-random-string]

# AI Features  
OPENROUTER_API_KEY=sk-or-v1-...your-key...

# Application
NEXT_PUBLIC_APP_URL=https://synthex.social
NODE_ENV=production
```

### 2. Optional But Recommended Variables

```bash
# Error Tracking
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Email (choose one provider)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-specific-password
```

## 📋 Deployment Steps

### Option A: Vercel CLI (Recommended)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Link project
vercel link

# 4. Deploy to staging first
vercel

# 5. Test staging URL
# https://synthex-[hash].vercel.app

# 6. Deploy to production
vercel --prod
```

### Option B: Git Push (Auto-deploy)
```bash
# 1. Push to main branch
git checkout main
git merge release/audit-fixes
git push origin main

# Vercel will auto-deploy on push to main
```

### Option C: Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com)
2. Import from GitHub
3. Select branch: `release/audit-fixes`
4. Configure environment variables
5. Deploy

## 🧪 Post-Deployment Verification

### 1. Quick Health Check
```bash
curl https://synthex.social/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Security Headers Check
```bash
curl -I https://synthex.social/api/health
# Verify: X-Frame-Options, X-Content-Type-Options, etc.
```

### 3. Database Connection Test
Visit: https://synthex.social/dashboard
- Should load without errors
- Check browser console for database errors

### 4. Run Full Test Suite
```bash
# From local machine
npm run test
npm run e2e
```

## 🔄 Rollback Procedure (if needed)

### Immediate Rollback
```bash
# Via Vercel CLI
vercel rollback

# Or in Vercel Dashboard
# Deployments → Previous deployment → Promote to Production
```

### Git Rollback
```bash
git revert HEAD
git push origin main
```

## 📊 Monitoring

### First 24 Hours
- Monitor [Vercel Functions](https://vercel.com/dashboard) for errors
- Check Sentry for any new issues
- Watch for 500 errors in logs
- Monitor database connection stability

### Key Metrics to Watch
- API response times < 200ms
- Error rate < 1%
- Database connection pool usage
- Memory usage < 512MB

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Test connection string
node scripts/test-db-connection.js

# Common fixes:
# 1. Check DATABASE_URL format
# 2. Verify Supabase project is active
# 3. Check connection pooling settings
```

### Build Failures
```bash
# Run validation
npm run validate:env

# Force build without validation
npm run build:force
```

### CORS Issues
- Verify NEXT_PUBLIC_APP_URL matches your domain
- Check allowed origins in next.config.mjs
- Update for additional domains if needed

## 📝 Final Checklist

Before marking deployment complete:
- [ ] All environment variables configured in Vercel
- [ ] Staging deployment tested
- [ ] Health check endpoint responding
- [ ] No console errors in browser
- [ ] Database queries working
- [ ] Authentication flow tested
- [ ] API endpoints secured (no test routes)
- [ ] Monitoring configured

## 🎉 Success Criteria

Deployment is successful when:
- ✅ Production URL loads without errors
- ✅ Health check returns 200 OK
- ✅ No critical errors in first hour
- ✅ Core features functional
- ✅ Database connected and queries working

## 📞 Support

**Issues?** Create ticket at: https://github.com/synthex/issues
**Email**: support@synthex.social
**Documentation**: https://synthex.social/docs

---

**Note**: This deployment uses the `release/audit-fixes` branch with critical security patches applied. Ensure all team members are aware of the removed test endpoints and updated security configuration.