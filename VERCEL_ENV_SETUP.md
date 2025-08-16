# Vercel Environment Variables Setup Guide

## Required Environment Variables for Production

Set these in Vercel Dashboard → Project Settings → Environment Variables

### 🔴 CRITICAL - Database & Auth

```bash
# Supabase Configuration (Project ID: znyjoyjsvjotlzjppzal)
NEXT_PUBLIC_SUPABASE_URL=https://znyjoyjsvjotlzjppzal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Get from Supabase Dashboard → Settings → API → anon public]
SUPABASE_SERVICE_ROLE_KEY=[Get from Supabase Dashboard → Settings → API → service_role secret]

# Database URL for Prisma (use pooler connection)
DATABASE_URL=postgresql://postgres.[YOUR_DB_PASSWORD]@db.znyjoyjsvjotlzjppzal.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1

# OR for direct connection (if pooler issues):
# DATABASE_URL=postgresql://postgres:[YOUR_DB_PASSWORD]@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres

# JWT Secret (generate a strong random string)
JWT_SECRET=[Generate using: openssl rand -base64 32]

# App URL (YOUR project URL)
NEXT_PUBLIC_APP_URL=https://synthex-unite-group.vercel.app
```

### 🟡 AI Services (Choose One)

```bash
# Option 1: OpenRouter (Recommended)
OPENROUTER_API_KEY=sk-or-v1-[your-key]

# Option 2: OpenAI
OPENAI_API_KEY=sk-[your-key]

# Option 3: Anthropic
ANTHROPIC_API_KEY=sk-ant-[your-key]
```

### 🟢 Optional Services

```bash
# NextAuth (if using NextAuth features)
NEXTAUTH_URL=https://synthex-unite-group.vercel.app
NEXTAUTH_SECRET=[Generate using: openssl rand -base64 32]

# Redis/Caching (choose one)
REDIS_URL=redis://default:[password]@[host]:[port]
# OR
UPSTASH_REDIS_REST_URL=https://[your-instance].upstash.io
UPSTASH_REDIS_REST_TOKEN=[your-token]

# Monitoring
SENTRY_DSN=https://[your-key]@[org].ingest.sentry.io/[project]
NEXT_PUBLIC_SENTRY_DSN=https://[your-key]@[org].ingest.sentry.io/[project]

# Email Service
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[your-email]
SMTP_PASS=[app-specific-password]

# Stripe (if payments enabled)
STRIPE_SECRET_KEY=sk_test_[your-key]
STRIPE_PUBLISHABLE_KEY=pk_test_[your-key]
STRIPE_WEBHOOK_SECRET=whsec_[your-secret]
```

## How to Get Supabase Credentials

1. **Go to Supabase Dashboard**: https://app.supabase.com/project/znyjoyjsvjotlzjppzal

2. **Get API Keys**:
   - Navigate to Settings → API
   - Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Get Database Password**:
   - Navigate to Settings → Database
   - Find your database password or reset it if needed
   - Use it in the DATABASE_URL connection string

## Vercel Setup Steps

1. **Go to Vercel Dashboard**:
   - https://vercel.com/dashboard
   - Select your project

2. **Add Environment Variables**:
   - Go to Settings → Environment Variables
   - Add each variable
   - Select scopes: ✅ Production, ✅ Preview, ✅ Development

3. **Redeploy**:
   ```bash
   vercel --prod --force
   ```

## Database Migration Command

After setting up environment variables, run in Vercel:

```bash
npx prisma migrate deploy
```

Or add to build command in vercel.json:
```json
{
  "buildCommand": "npx prisma generate && npx prisma migrate deploy && npm run build:vercel"
}
```

## Troubleshooting Failed Deployments

1. **Check Build Logs**:
   - Vercel Dashboard → Functions → View Build Logs
   - Look for missing environment variable errors

2. **Common Issues**:
   - Missing DATABASE_URL → Prisma will fail
   - Wrong Supabase keys → API calls will fail
   - Missing AI service key → Content generation will fail

3. **Test Connection**:
   ```bash
   # Test database connection locally
   npx prisma db pull
   ```

## Quick Verification

After deployment, test these endpoints on YOUR domain:
- https://synthex-unite-group.vercel.app → Should load homepage
- https://synthex-unite-group.vercel.app/api/health → Should return health status
- https://synthex-unite-group.vercel.app/api/health/redis → Should show Redis status

## Emergency Rollback

If deployment fails:
1. Go to Vercel Dashboard → Deployments
2. Find last working deployment (e.g., synthex-nmlnd4cnm)
3. Click "..." menu → Promote to Production

---

**Note**: The Supabase project ID `znyjoyjsvjotlzjppzal` has been confirmed and is correctly referenced in all URLs above.
