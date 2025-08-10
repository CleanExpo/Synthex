# 🔐 Environment Variables Setup Guide for SYNTHEX

## ⚠️ Important: Your Site Needs Environment Variables

The SYNTHEX platform is deployed but requires environment variables for full functionality.

## 🎯 Quick Setup Steps

### Step 1: Get Supabase Credentials
1. Go to [supabase.com](https://supabase.com)
2. Create a free project
3. Go to Settings → API
4. Copy these values:
   - Project URL
   - anon public key
   - service_role key

### Step 2: Add to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/unite-group/synthex/settings/environment-variables)
2. Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
```

### Step 3: Redeploy
```bash
vercel --prod --yes
```

## 📋 All Available Environment Variables

### Required for Authentication
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required for Database
- `DATABASE_URL` (get from Supabase Settings → Database)

### Optional AI Features
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### Optional OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 🚨 Current Status
- Site is deployed: ✅
- Middleware updated to handle missing config: ✅
- Environment variables needed for auth: ⚠️

## 📞 Need Help?
Check the `.env.example` file for all available options and descriptions.

---
*Generated: 2025-08-10*