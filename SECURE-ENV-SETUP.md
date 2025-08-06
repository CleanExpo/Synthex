# Secure Environment Setup Guide

## 🔒 Security Best Practices

### API Key Management

1. **Never commit API keys to version control**
   - Always use environment variables
   - Keep `.env` file in `.gitignore`
   - Rotate keys immediately if exposed

2. **Use different keys for different environments**
   - Development keys for local testing
   - Production keys only in Vercel dashboard
   - Never use production keys locally

## 📋 Required Environment Variables

### For Vercel Production Deployment

Add these in Vercel Dashboard → Settings → Environment Variables:

```bash
# Authentication
JWT_SECRET=<generate-secure-64-char-string>

# OpenRouter API
OPENROUTER_API_KEY=<your-new-openrouter-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://your-app.vercel.app
OPENROUTER_SITE_NAME=Auto Marketing Platform

# Anthropic API
ANTHROPIC_API_KEY=<your-new-anthropic-key>

# Database (if using Supabase)
DATABASE_URL=<your-database-connection-string>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# Environment
NODE_ENV=production
```

### For Local Development

1. Copy `env-example.txt` to `.env`
2. Add your development API keys
3. Never commit the `.env` file

## 🚀 Deployment Checklist

- [ ] All API keys rotated and updated in Vercel
- [ ] `.env` file not committed to repository
- [ ] Environment variables verified in Vercel dashboard
- [ ] Build succeeds with `npm run build`
- [ ] Health check endpoint responds at `/health`

## 🔧 Troubleshooting

### If environment variables aren't loading in Vercel:

1. Check variable names match exactly (case-sensitive)
2. Ensure no quotes around values in Vercel dashboard
3. Redeploy after adding/updating variables
4. Check build logs for environment validation messages

### If build fails:

1. Run `npm run lint` locally to check for TypeScript errors
2. Ensure all dependencies are in `package.json`
3. Check `vercel.json` build command matches your setup

## 📝 Notes

- Vercel automatically injects environment variables at build time
- The `dotenv` package is only used for local development
- Always verify environment variables are loaded before deploying

## 🛡️ Security Reminders

1. **Rotate keys regularly** (every 90 days recommended)
2. **Use key rotation immediately if exposed**
3. **Monitor API usage** for unusual activity
4. **Set up rate limiting** on production APIs
5. **Use separate development and production keys**