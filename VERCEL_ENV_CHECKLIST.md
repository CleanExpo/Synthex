# 🔐 Vercel Environment Variables Checklist

## ✅ Required Environment Variables for Production

Copy these to your Vercel Dashboard → Settings → Environment Variables

### 🔑 Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=https://znyjoyjsvjotlzjppzal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWpveWpzdmpvdGx6anBwemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjc1NTcsImV4cCI6MjA2OTg0MzU1N30.mOBWTEMF9tYKnRqqqVbCgLMteFKD2w85uTQDatt_b9Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWpveWpzdmpvdGx6anBwemFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI2NzU1NywiZXhwIjoyMDY5ODQzNTU3fQ.ZdjG_wBP6pJb1uVzrUVdyWfqlzPYyPbKwlXktWvE3mk
```

### 🤖 AI Configuration
```env
# OpenRouter (You mentioned you added this - make sure it's correct)
OPENROUTER_API_KEY=[YOUR_NEW_KEY]
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=gpt-4-turbo-preview

# Optional AI APIs (if you have them)
OPENAI_API_KEY=[YOUR_KEY_IF_AVAILABLE]
ANTHROPIC_API_KEY=[YOUR_KEY_IF_AVAILABLE]
```

### 🔒 Security & Authentication
```env
JWT_SECRET=NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX/EED1XhTr0A8C8ZMZomMAUbvw==
SESSION_SECRET=NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX/EED1XhTr0A8C8ZMZomMAUbvw==
CRON_SECRET=NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX
ADMIN_API_KEY=sk_salt_2025_synthex_integration
```

### 📦 Database URLs
```env
DATABASE_URL=postgresql://postgres:postgres@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:postgres@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres
```

### 🚀 Application Settings
```env
NEXT_PUBLIC_APP_URL=https://synthex.social
NODE_ENV=production
ENABLE_STRATEGIC_MARKETING=true
ENABLE_AB_TESTING=true
ENABLE_PSYCHOLOGY_ANALYTICS=true
```

### 💾 Redis/Caching (Optional but Recommended)
```env
# Option 1: Upstash (Recommended for Vercel)
UPSTASH_REDIS_REST_URL=[GET_FROM_UPSTASH]
UPSTASH_REDIS_REST_TOKEN=[GET_FROM_UPSTASH]

# Option 2: Redis Cloud
REDIS_URL=[YOUR_REDIS_URL]
```

### 📧 Email Service (Optional)
```env
# Choose one:
# SendGrid
SENDGRID_API_KEY=[YOUR_KEY]

# OR Resend
RESEND_API_KEY=[YOUR_KEY]

# OR Postmark
POSTMARK_API_KEY=[YOUR_KEY]
```

### 📊 Analytics & Monitoring (Optional)
```env
# Google Analytics
NEXT_PUBLIC_GA_ID=[YOUR_GA_ID]

# Sentry Error Tracking
SENTRY_DSN=[YOUR_SENTRY_DSN]
SENTRY_AUTH_TOKEN=[YOUR_TOKEN]

# Mixpanel
NEXT_PUBLIC_MIXPANEL_TOKEN=[YOUR_TOKEN]
```

### 🔗 Social Media APIs (Future)
```env
# Twitter/X API
TWITTER_API_KEY=[YOUR_KEY]
TWITTER_API_SECRET=[YOUR_SECRET]
TWITTER_ACCESS_TOKEN=[YOUR_TOKEN]
TWITTER_ACCESS_SECRET=[YOUR_SECRET]

# Instagram (via Facebook)
INSTAGRAM_ACCESS_TOKEN=[YOUR_TOKEN]
FACEBOOK_APP_ID=[YOUR_APP_ID]
FACEBOOK_APP_SECRET=[YOUR_SECRET]

# LinkedIn
LINKEDIN_CLIENT_ID=[YOUR_ID]
LINKEDIN_CLIENT_SECRET=[YOUR_SECRET]

# TikTok
TIKTOK_CLIENT_KEY=[YOUR_KEY]
TIKTOK_CLIENT_SECRET=[YOUR_SECRET]
```

## 📋 Setup Steps

### 1. Go to Vercel Dashboard
- Navigate to: https://vercel.com/dashboard
- Select your `synthex` project
- Go to Settings → Environment Variables

### 2. Add Variables
- Add each variable listed above
- Select "Production" environment
- Some can also be added to "Preview" and "Development" if needed

### 3. Verify Domain Settings
- Go to Settings → Domains
- Ensure `synthex.social` is listed
- It should point to your production deployment, not a preview URL

### 4. Redeploy
After adding all variables:
```bash
vercel --prod --yes
```

Or trigger a redeploy from the Vercel dashboard.

## 🔍 Verification Checklist

- [ ] All Supabase keys added
- [ ] OpenRouter API key added and valid
- [ ] JWT and Session secrets added
- [ ] Database URLs configured
- [ ] NEXT_PUBLIC_APP_URL set to https://synthex.social
- [ ] NODE_ENV set to production
- [ ] Optional services configured (Redis, Email, etc.)
- [ ] Domain properly connected
- [ ] Production deployment successful

## 🚨 Important Notes

1. **Never commit these keys to GitHub**
2. **Use different keys for development and production**
3. **Rotate keys regularly for security**
4. **Monitor usage to avoid overages**
5. **Test each service after configuration**

## 🔗 Quick Links

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Supabase Dashboard](https://app.supabase.com/project/znyjoyjsvjotlzjppzal)
- [OpenRouter Dashboard](https://openrouter.ai/dashboard)
- [Upstash Console](https://console.upstash.com)

---

**Last Updated:** January 15, 2025
**Status:** Ready for configuration