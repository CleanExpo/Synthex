# 🚀 SYNTHEX Production Deployment Guide

## Current Status: January 15, 2025

### ✅ Completed
- ✓ Test deployment banner removed
- ✓ Complete database schema created (18 tables)
- ✓ Environment variables checklist created
- ✓ OpenRouter API key added (per your confirmation)
- ✓ Redis caching layer implemented
- ✓ Rate limiting system implemented

### 🔴 IMMEDIATE ACTIONS REQUIRED

## Step 1: Configure Vercel Environment Variables
**Time Required:** 10 minutes

1. **Go to Vercel Dashboard**
   - https://vercel.com/dashboard
   - Select your `synthex` project
   - Navigate to: Settings → Environment Variables

2. **Add ALL Required Variables**
   Copy each from `VERCEL_ENV_CHECKLIST.md`:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   OPENROUTER_API_KEY (you said this is done ✓)
   JWT_SECRET
   SESSION_SECRET
   DATABASE_URL
   NEXT_PUBLIC_APP_URL=https://synthex.social
   NODE_ENV=production
   ```

3. **Optional but Recommended**
   - Upstash Redis credentials (for caching)
   - Email service API key
   - Analytics tracking ID

## Step 2: Run Database Migration
**Time Required:** 5 minutes

### Option A: Via Supabase Dashboard (Easiest)
1. Go to your Supabase SQL Editor:
   https://app.supabase.com/project/znyjoyjsvjotlzjppzal/sql

2. Click "New Query"

3. Copy ALL contents from:
   `supabase/migrations/001_complete_schema.sql`

4. Paste and click "RUN"

5. Verify tables created:
   - Go to Table Editor
   - You should see 18 new tables

### Option B: Via Command Line
```bash
cd D:\Synthex
node scripts/setup-database.js
# Follow the instructions printed
```

## Step 3: Connect synthex.social Domain
**Time Required:** 5-15 minutes

1. **In Vercel Dashboard**
   - Go to Settings → Domains
   - Add `synthex.social` if not already there
   - Select your production branch (main)

2. **Update DNS Records** (at your domain registrar)
   
   For apex domain (synthex.social):
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```
   
   For www subdomain:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

3. **Verify Connection**
   - Wait 5-10 minutes for DNS propagation
   - Check: https://synthex.social
   - Should see your app, not a Vercel error

## Step 4: Deploy to Production
**Time Required:** 5 minutes

```bash
# From your project directory
cd D:\Synthex

# Deploy to production
vercel --prod --yes

# OR trigger from dashboard
```

## Step 5: Verify Everything Works

### ✅ Quick Verification Checklist

1. **Homepage Loads**
   - Visit: https://synthex.social
   - No test banner visible ✓
   - Page loads without errors

2. **Database Connection**
   ```bash
   curl https://synthex.social/api/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

3. **Authentication Works**
   - Try signup at: https://synthex.social/signup
   - Check Supabase Auth dashboard for new user

4. **API Endpoints Respond**
   ```bash
   curl https://synthex.social/api/patterns/cached
   ```

## 🔧 Troubleshooting

### If Build Fails on Vercel:
```bash
# Try force build locally first
npm run build:force

# If it works locally but not on Vercel:
# Update vercel.json buildCommand:
"buildCommand": "npm ci && next build"
```

### If Domain Not Working:
1. Check DNS propagation: https://dnschecker.org
2. Verify in Vercel: Domains tab should show "Valid Configuration"
3. Try: `nslookup synthex.social`

### If Database Connection Fails:
1. Verify env vars in Vercel dashboard
2. Check Supabase connection pooler is enabled
3. Test with direct connection string

## 📊 Production Monitoring

### Set Up Monitoring (Optional but Recommended)

1. **Vercel Analytics** (Free)
   - Already included, check Analytics tab

2. **Uptime Monitoring**
   - Use: https://uptimerobot.com (free tier)
   - Monitor: https://synthex.social
   - Alert on downtime

3. **Error Tracking**
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```

## 🎯 Success Criteria

Your production deployment is complete when:

- [ ] synthex.social loads your app
- [ ] Users can sign up and log in
- [ ] Database tables are created
- [ ] API endpoints respond
- [ ] No test/debug code visible
- [ ] Environment is set to production
- [ ] SSL certificate is active (automatic with Vercel)

## 📞 Support Resources

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **DNS Issues**: Check with your domain registrar
- **Build Issues**: Check Vercel build logs

## 🚦 Current Deployment Status

```
Last Push: Just now (removed test banner)
GitHub: ✅ Updated
Vercel: ⏳ Awaiting redeploy with env vars
Database: ⏳ Awaiting migration execution
Domain: ⏳ Needs verification
```

---

**Remember:** After completing steps 1-3, the site should be fully functional!

**Estimated Total Time:** 30-45 minutes

**Priority Order:**
1. Environment Variables (10 min)
2. Database Migration (5 min)
3. Domain Connection (15 min)
4. Production Deploy (5 min)
5. Verification (5 min)