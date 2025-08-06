# 🚀 SYNTHEX Production Environment Setup Guide

## ⚠️ CRITICAL SECURITY ALERT

**IMMEDIATE ACTION REQUIRED:**
Your current `.env` file contains exposed API keys that are visible in the repository. These must be rotated immediately:

1. **OpenAI API Key** - Exposed in `.env`
2. **Anthropic API Key** - Exposed in `.env`
3. **Google API Key** - Exposed in `.env`
4. **OpenRouter API Key** - Exposed in `.env`
5. **Google OAuth Credentials** - Exposed in `.env`
6. **GitHub OAuth Credentials** - Exposed in `.env`

## 🔒 Step 1: Rotate All Exposed Keys

### Immediate Actions:
1. **OpenAI**: Go to https://platform.openai.com/api-keys → Revoke current key → Create new
2. **Anthropic**: Go to https://console.anthropic.com → API Keys → Revoke and regenerate
3. **Google Cloud**: 
   - Visit https://console.cloud.google.com
   - Go to APIs & Services → Credentials
   - Delete compromised keys
   - Create new OAuth 2.0 credentials
4. **OpenRouter**: Visit https://openrouter.ai/keys → Revoke and create new
5. **GitHub**: Settings → Developer settings → OAuth Apps → Regenerate secret

## 📋 Step 2: Set Up Secure Environment Variables

### Required Variables Checklist:

#### Core Configuration
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `JWT_SECRET` (Generate new: `openssl rand -base64 64`)

#### Database (Supabase)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- [ ] `DATABASE_URL` - Prisma Accelerate connection string
- [ ] `DIRECT_DATABASE_URL` - Direct PostgreSQL connection

#### Authentication
- [ ] `GOOGLE_CLIENT_ID` - New Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - New Google OAuth secret
- [ ] `GOOGLE_CALLBACK_URL` - https://synthex-cerq.vercel.app/auth/google/callback

#### AI Services
- [ ] `OPENROUTER_API_KEY` - New OpenRouter key
- [ ] `ANTHROPIC_API_KEY` - New Anthropic key (optional)
- [ ] `OPENAI_API_KEY` - New OpenAI key (optional)

## 🛠️ Step 3: Configure Vercel Environment Variables

### Method 1: Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `synthex` project
3. Navigate to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: Variable name (e.g., `JWT_SECRET`)
   - Value: Your secure value
   - Environment: Select **Production** only
   - Click **Save**

### Method 2: Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link to your project
vercel link

# Add environment variables
vercel env add JWT_SECRET production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add DATABASE_URL production
vercel env add OPENROUTER_API_KEY production
# ... add all other variables
```

## 📝 Step 4: Use the Setup Script

Run the automated setup script to validate your configuration:

```bash
# Install dependencies
npm install

# Run the setup script
npx tsx scripts/setup-production-env.ts
```

This script will:
- Check for exposed secrets
- Generate secure values where needed
- Validate your configuration
- Create deployment commands

## 🔐 Step 5: Security Best Practices

### Never Commit Secrets
```bash
# Add to .gitignore
.env
.env.local
.env.production
.env*.local
*.key
*.pem
```

### Use Different Keys for Each Environment
- **Development**: Use test/development API keys
- **Staging**: Use staging-specific keys
- **Production**: Use production-only keys with restrictions

### Enable API Key Restrictions

#### Google Cloud
1. Go to APIs & Services → Credentials
2. Click on your API key
3. Add restrictions:
   - HTTP referrers: `https://synthex-cerq.vercel.app/*`
   - API restrictions: Select only needed APIs

#### OpenAI
1. Go to API keys settings
2. Set usage limits
3. Enable monitoring alerts

## 📊 Step 6: Verify Deployment

### Check Environment Variables
```bash
# List all production variables (values hidden)
vercel env ls production

# Pull to local .env for testing (be careful!)
vercel env pull .env.production
```

### Test Production Build Locally
```bash
# Build with production env
npm run build

# Test locally
npm run start
```

### Monitor Deployment
```bash
# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```

## 🚨 Step 7: Post-Deployment Security

### Enable Monitoring
1. Set up Sentry for error tracking
2. Configure Vercel Analytics
3. Enable API usage monitoring

### Regular Security Audits
```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Run security scan
npm run security:scan
```

### Rotate Keys Regularly
- Set calendar reminders for key rotation (every 30-90 days)
- Document rotation procedures
- Keep audit logs

## 📌 Quick Reference

### Essential Commands
```bash
# Generate JWT secret
openssl rand -base64 64

# Generate webhook secret
openssl rand -hex 32

# Test environment setup
npm run test:env

# Validate production config
npm run validate:production
```

### Environment Variable Template
Copy `.env.production.secure` as your template and fill in actual values.

### Support Resources
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Supabase Setup](https://supabase.com/docs/guides/getting-started)
- [Prisma Accelerate](https://www.prisma.io/data-platform/accelerate)
- [OpenRouter Docs](https://openrouter.ai/docs)

## ✅ Final Checklist

Before deploying to production:

- [ ] All exposed keys have been rotated
- [ ] New keys are stored in Vercel (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] Production database is configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] Error monitoring is set up
- [ ] API key restrictions are enabled
- [ ] Security headers are configured
- [ ] Budget limits are set

## 🆘 Troubleshooting

### Common Issues

1. **"Missing environment variable" error**
   - Ensure variable is set in Vercel dashboard
   - Check spelling and case sensitivity
   - Redeploy after adding variables

2. **"Invalid API key" error**
   - Verify key hasn't been revoked
   - Check for extra spaces or quotes
   - Ensure using production key, not development

3. **Database connection failed**
   - Verify DATABASE_URL is correct
   - Check Supabase project is active
   - Ensure connection pooling is enabled

### Get Help
- Create issue in repository
- Check Vercel deployment logs
- Review Supabase connection logs

---

**Remember:** Security is not a one-time setup. Regularly review and update your security practices.