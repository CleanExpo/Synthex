# 🔧 Vercel Environment Variables Setup Guide

## 🎯 Required Environment Variables for Production

Add these environment variables in your **Vercel Dashboard → Project Settings → Environment Variables**:

### 🔑 Critical Variables (Required)

| Variable | Description | Example/Format |
|----------|-------------|----------------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing secret | `your-super-secret-jwt-key-minimum-64-characters-long` |

### 🗄️ Database (Supabase)

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API |
| `DATABASE_URL` | PostgreSQL connection string | Supabase Dashboard → Settings → Database |
| `POSTGRES_URL_NON_POOLING` | Non-pooling connection | Supabase Dashboard → Settings → Database |

### 🤖 AI API Keys

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | ✅ Yes |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | ✅ Yes |
| `OPENROUTER_BASE_URL` | OpenRouter base URL | ❌ Optional (defaults to https://openrouter.ai/api/v1) |
| `OPENROUTER_SITE_URL` | Your site URL for OpenRouter | ❌ Optional |
| `OPENROUTER_SITE_NAME` | Your site name for OpenRouter | ❌ Optional |

### 🔐 Google OAuth (Optional)

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ❌ Optional |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | ❌ Optional |

## 🚀 Quick Setup Checklist

### 1. Go to Vercel Dashboard
```
https://vercel.com/dashboard/[your-project]/settings/environment-variables
```

### 2. Add Required Variables
**Start with these critical ones:**
- ✅ `NODE_ENV` = `production`
- ✅ `JWT_SECRET` = `[generate a long random string]`
- ✅ `OPENROUTER_API_KEY` = `[your OpenRouter key]`
- ✅ `ANTHROPIC_API_KEY` = `[your Anthropic key]`

### 3. Add Supabase Variables
- ✅ `NEXT_PUBLIC_SUPABASE_URL` = `https://[project-id].supabase.co`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[your supabase anon key]`  
- ✅ `DATABASE_URL` = `postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres`
- ✅ `POSTGRES_URL_NON_POOLING` = `[non-pooling connection string]`

### 4. Optional Google OAuth
- ❌ `GOOGLE_CLIENT_ID` = `[your google client id]`
- ❌ `GOOGLE_CLIENT_SECRET` = `[your google client secret]`
- ❌ `GOOGLE_CALLBACK_URL` = `https://[your-app].vercel.app/auth/google/callback`

## 🔍 How to Get API Keys

### OpenRouter API Key:
1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up/Login → API Keys
3. Create new key → Copy

### Anthropic API Key:
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up/Login → API Keys  
3. Create new key → Copy

### Supabase Keys:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Settings → API → Copy URL and anon key
4. Settings → Database → Copy connection strings

### Google OAuth (Optional):
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable Google+ API
3. Credentials → Create OAuth 2.0 client ID
4. Set redirect URI: `https://[your-app].vercel.app/auth/google/callback`

## ⚠️ Important Notes

### Environment Variable Scope:
- Use **Production** scope for live deployment
- Use **Preview** scope for branch previews  
- Use **Development** scope for local development

### JWT Secret Generation:
```bash
# Generate a secure JWT secret (64+ characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### After Adding Variables:
1. **Redeploy** your Vercel project
2. **Check build logs** for any missing variables
3. **Test API endpoints** to ensure connections work

## 🔧 Troubleshooting

### Build Failures:
- Check all required variables are set
- Verify variable names match exactly (case-sensitive)
- Ensure no extra spaces in values

### API Connection Issues:
- Test API keys in Postman/curl first
- Check Vercel function logs for detailed errors
- Verify URL formats are correct

### Database Connection Issues:
- Test DATABASE_URL with a PostgreSQL client
- Ensure Supabase project is active
- Check IP allowlisting in Supabase settings

---

**After setting all environment variables, redeploy your project for changes to take effect!** 🚀