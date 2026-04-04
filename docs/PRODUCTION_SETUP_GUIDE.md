# Synthex Production Setup Guide

## 🎯 Overview

This guide walks you through setting up Synthex in production with Supabase for database/auth and Vercel for hosting.

## 📋 Prerequisites

- Vercel account (for hosting)
- Supabase account (for database/auth)
- OpenRouter API key (for AI features)
- Domain configured (synthex.social)

## 🔐 Generated Secrets

**IMPORTANT**: Save these securely! They were generated specifically for your installation.

```bash
ENCRYPTION_KEY=9c17d99f4d5441b20b8e52a84a041be8
JWT_SECRET=0da255528b98ca4657bcc82f0d8343c6def0450cfa525988c1bf2cc0d9f9f842
NEXTAUTH_SECRET=2d114cc403607a4c9d3620a1f3a372b6417c34a22bd0b8d003038f6e9f7f4cc1
```

## 📦 Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub
4. Click "New project"
5. Fill in:
   - Project name: `synthex-production`
   - Database password: (generate a strong one)
   - Region: Choose closest to your users
   - Pricing plan: Free tier is fine to start

### 1.2 Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste contents of `supabase/migrations/001_create_user_integrations.sql`
4. Click "Run"
5. Repeat for `supabase/migrations/002_create_integration_logs.sql`

### 1.3 Get Supabase Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public key**: `eyJhbGc...` (long string)
   - **Service role key**: `eyJhbGc...` (different long string)

### 1.4 Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Optional: Enable **Google** OAuth:
   - Get OAuth credentials from Google Cloud Console
   - Add authorized redirect URL: `https://xxxxx.supabase.co/auth/v1/callback`
   - Enter Client ID and Secret in Supabase

## 🚀 Step 2: Vercel Configuration

### 2.1 Import GitHub Repository

1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select "Next.js" as framework

### 2.2 Add Environment Variables

In Vercel project settings → Environment Variables, add:

| Variable | Value | Environment |
|----------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Production |
| `ENCRYPTION_KEY` | `9c17d99f4d5441b20b8e52a84a041be8` | Production |
| `JWT_SECRET` | `0da255528b98ca4657bcc82f0d8343c6def0450cfa525988c1bf2cc0d9f9f842` | Production |
| `NEXTAUTH_SECRET` | `2d114cc403607a4c9d3620a1f3a372b6417c34a22bd0b8d003038f6e9f7f4cc1` | Production |
| `NEXTAUTH_URL` | `https://synthex.social` | Production |
| `OPENROUTER_API_KEY` | Your OpenRouter API key | Production |

### 2.3 Configure Domain

1. In Vercel project → Settings → Domains
2. Add `synthex.social` and `www.synthex.social`
3. Update DNS records as instructed by Vercel

## 🧪 Step 3: Testing

### 3.1 Verify Deployment

1. Visit https://synthex.social
2. Check for:
   - ✅ Glassmorphic UI loads
   - ✅ No console errors
   - ✅ Navigation works

### 3.2 Test Authentication

1. Click "Sign Up"
2. Create test account
3. Verify email (check Supabase → Authentication → Users)
4. Log in successfully

### 3.3 Test Integrations

1. Navigate to `/dashboard/integrations`
2. Click "Connect" on Twitter
3. Enter test credentials:
   ```
   API Key: test_api_key
   API Secret: test_api_secret
   Access Token: test_access_token
   Access Token Secret: test_token_secret
   ```
4. Verify in Supabase:
   - Go to Table Editor → user_integrations
   - Check credentials are encrypted (should be unreadable)

### 3.4 Security Verification

Run this test script locally:

```bash
# Test encryption is working
node scripts/test-integrations.js

# Should output:
# ✅ Encryption System: PASSED
# ✅ Platform Credentials: PASSED
# ✅ User Flow: PASSED
# ✅ Security Measures: PASSED
```

## 📊 Step 4: Monitoring Setup

### 4.1 Vercel Analytics

1. In Vercel dashboard → Analytics
2. Enable Web Analytics
3. Enable Speed Insights

### 4.2 Supabase Monitoring

1. In Supabase → Reports
2. Monitor:
   - Database size
   - API requests
   - Auth events

### 4.3 Error Tracking (Optional)

1. Sign up at [https://sentry.io](https://sentry.io)
2. Create new project
3. Add Sentry DSN to Vercel environment variables

## 🔒 Security Checklist

- [ ] All environment variables set in Vercel
- [ ] No secrets in code repository
- [ ] HTTPS enforced on domain
- [ ] Row Level Security enabled in Supabase
- [ ] API routes require authentication
- [ ] Encryption key is unique and secure
- [ ] Service role key not exposed to client

## 🚨 Troubleshooting

### Issue: "Authentication required" error
**Solution**: Check Supabase keys are correctly set in Vercel

### Issue: Integration credentials not saving
**Solution**: Verify ENCRYPTION_KEY is set and Supabase is connected

### Issue: Can't connect to Supabase
**Solution**: Check CORS settings in Supabase (Settings → API → CORS)

### Issue: Domain not working
**Solution**: Verify DNS records match Vercel's requirements

## 📝 Maintenance Tasks

### Weekly
- Check error logs in Vercel
- Review Supabase usage metrics
- Monitor integration success rates

### Monthly
- Update dependencies: `npm update`
- Review security alerts
- Backup Supabase data

### Quarterly
- Rotate encryption keys (requires data migration)
- Review and update API rate limits
- Performance optimization review

## 🎉 Success Indicators

Your production setup is complete when:

1. ✅ Users can sign up and log in
2. ✅ Integrations connect and store encrypted credentials
3. ✅ No errors in production logs
4. ✅ Site loads quickly (<3s)
5. ✅ All security measures active

## 📞 Support

- **Supabase Issues**: support@supabase.io
- **Vercel Issues**: support@vercel.com
- **Synthex Issues**: Create issue on GitHub

---

*Last Updated: 2025-01-14*
*Encryption Key Generated: Today (keep secure!)*