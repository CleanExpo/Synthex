# 🚀 SYNTHEX Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Code Preparation
- [x] All features tested locally
- [x] Linting passes with no errors
- [x] TypeScript compilation successful
- [x] Environment variables documented
- [x] Sensitive data removed from code
- [x] Demo credentials configured

### ✅ Database Setup
- [ ] Production database created (PostgreSQL/Supabase)
- [ ] Database URL configured
- [ ] Prisma migrations ready
- [ ] Initial data seeded (if needed)

### ✅ Environment Variables
- [ ] Copy `.env.production.example` values
- [ ] Generate secure JWT_SECRET (32+ chars)
- [ ] Configure database URLs
- [ ] Set up email provider
- [ ] Add AI API keys
- [ ] Configure social media APIs (optional)

---

## 🎯 Deployment Steps

### Step 1: Prepare Database

#### Option A: Supabase (Recommended)
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection strings:
   - `DATABASE_URL` (for Prisma)
   - `DIRECT_URL` (for migrations)
4. Run migrations:
```bash
npx prisma migrate deploy
```

#### Option B: PostgreSQL (Self-hosted)
1. Create PostgreSQL database
2. Ensure SSL is enabled
3. Create database user with permissions
4. Update connection strings

### Step 2: Configure Vercel

1. **Import Project**
```bash
# If not already connected
vercel link

# Or import from GitHub
vercel import
```

2. **Set Environment Variables**
Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables

**Required Variables:**
```env
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_url
JWT_SECRET=generate_secure_32_char_secret
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

**For Email (Choose one):**
```env
# Resend (Easiest)
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_key

# SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_key
```

**For AI Features:**
```env
OPENROUTER_API_KEY=your_openrouter_key
```

3. **Configure Build Settings**
- Framework Preset: Next.js
- Build Command: `npx prisma generate && npm run build`
- Output Directory: `.next`
- Install Command: `npm ci --legacy-peer-deps`

### Step 3: Deploy to Production

#### Method 1: CLI Deployment
```bash
# Build locally first to test
npm run build

# Deploy to production
vercel --prod

# Or with confirmation
vercel --prod --yes
```

#### Method 2: Git Integration
1. Push to GitHub:
```bash
git add .
git commit -m "🚀 Production deployment ready"
git push origin main
```

2. Vercel auto-deploys from main branch

#### Method 3: Manual Dashboard Deploy
1. Go to Vercel Dashboard
2. Click "Deploy"
3. Select branch/commit
4. Deploy

### Step 4: Post-Deployment Setup

1. **Run Database Migrations**
```bash
# After deployment
vercel env pull .env.production.local
npx prisma migrate deploy
```

2. **Verify Deployment**
- [ ] Homepage loads
- [ ] Demo login works (demo@synthex.com / demo123)
- [ ] API endpoints respond
- [ ] Database connection active

3. **Create Admin User**
```bash
# Use the registration endpoint or run script
node scripts/create-admin.js
```

---

## 🔧 Configuration Details

### Database Schema Setup
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or run migrations
npx prisma migrate deploy
```

### Email Provider Setup

#### Resend (Recommended for Quick Start)
1. Sign up at [resend.com](https://resend.com)
2. Get API key
3. Add domain (optional)
4. Set environment variables

#### SendGrid
1. Create account at [sendgrid.com](https://sendgrid.com)
2. Verify sender email
3. Get API key
4. Configure in Vercel

### AI Configuration

#### OpenRouter
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Add credits ($5 minimum)
3. Get API key
4. Add to environment variables

---

## 🚨 Common Issues & Solutions

### Issue: Database Connection Failed
```
Solution:
1. Check DATABASE_URL format
2. Ensure SSL is required: ?sslmode=require
3. Verify firewall/IP whitelist
4. Test with: npx prisma db pull
```

### Issue: Build Fails on Vercel
```
Solution:
1. Clear cache: vercel --force
2. Check build logs
3. Ensure npx prisma generate in build command
4. Use npm ci --legacy-peer-deps
```

### Issue: Email Not Sending
```
Solution:
1. Verify EMAIL_PROVIDER is set
2. Check API key is valid
3. Confirm sender email is verified
4. Check logs for specific errors
```

### Issue: 500 Errors in Production
```
Solution:
1. Check Vercel function logs
2. Verify all env variables set
3. Check database connection
4. Review error tracking (if configured)
```

---

## 📊 Production Monitoring

### Vercel Analytics
- Automatic with Vercel deployment
- View at: vercel.com/analytics

### Database Monitoring
```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_time DESC LIMIT 10;
```

### Application Monitoring
1. **Built-in Analytics**
   - Visit `/analytics` dashboard
   - Monitor user activity
   - Track API usage

2. **Error Tracking (Optional)**
   - Set up Sentry
   - Configure error boundaries
   - Monitor function logs

---

## 🎯 Quick Deploy Commands

### One-Line Production Deploy
```bash
# Ensure you're logged in to Vercel first
vercel --prod --yes
```

### Full Deploy with Checks
```bash
# 1. Test build
npm run build

# 2. Run type check
npm run type-check

# 3. Deploy
vercel --prod

# 4. Run migrations
npx prisma migrate deploy

# 5. Verify
curl https://your-app.vercel.app/api/health
```

---

## 🔐 Security Checklist

### Before Going Live
- [x] Strong JWT_SECRET (32+ characters)
- [x] HTTPS enforced (automatic with Vercel)
- [x] Environment variables secured
- [x] SQL injection prevented (Prisma)
- [x] XSS protection enabled
- [x] CORS configured properly
- [x] Rate limiting ready
- [x] Input validation active
- [x] Error messages sanitized

### Production Best Practices
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking
- [ ] Configure backups
- [ ] Monitor performance
- [ ] Set up alerts
- [ ] Document API endpoints
- [ ] Create runbook

---

## 📱 Testing Production

### Core Features to Test
1. **Authentication**
   - Sign up new user
   - Login with demo account
   - Password reset flow
   - Email verification

2. **Content Generation**
   - Generate AI content
   - Test all platforms
   - Verify variations

3. **Social Posting**
   - Create test post
   - Multi-platform selection
   - Character validation

4. **Analytics**
   - View dashboard
   - Check metrics
   - Verify tracking

### Test URLs
```
Homepage: https://your-app.vercel.app
Login: https://your-app.vercel.app/login
Dashboard: https://your-app.vercel.app/dashboard
Analytics: https://your-app.vercel.app/analytics
API Health: https://your-app.vercel.app/api/health
```

---

## 🎉 Launch Checklist

### Soft Launch (Friends & Family)
- [ ] Deploy to production
- [ ] Test all features
- [ ] Gather feedback
- [ ] Fix critical issues
- [ ] Monitor performance

### Public Launch
- [ ] Marketing site ready
- [ ] Documentation complete
- [ ] Support email configured
- [ ] Analytics tracking
- [ ] Social media announcement
- [ ] Product Hunt submission (optional)

---

## 📞 Support Resources

### Deployment Help
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Deploy Guide](https://www.prisma.io/docs/guides/deployment)

### Community
- GitHub Issues: [your-repo/issues]
- Discord: [your-discord]
- Email: support@synthex.com

---

## 🚀 Deploy Command

Ready to deploy? Run:

```bash
vercel --prod --yes
```

Then follow the URL provided to see your live app!

---

**Congratulations! SYNTHEX is going live!** 🎊