# Vercel Deployment Instructions for Strategic Marketing Feature

## ⚠️ IMPORTANT: OpenRouter API Key Required
Before deploying, you need to:
1. Sign up at https://openrouter.ai
2. Create an API key
3. Add credits to your account
4. Add the key to Vercel environment variables

## 📋 Pre-Deployment Checklist

### Local Testing Complete ✅
- [x] Environment variables configured in `.env.local`
- [x] Database migrations successful
- [x] Prisma schema updated with new models
- [x] All code committed to `strategic-marketing` branch

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 2: Deploy via GitHub Integration

1. **Push to GitHub:**
```bash
git push origin strategic-marketing
```

2. **Create Pull Request:**
- Go to your GitHub repository
- Create PR from `strategic-marketing` to `main`
- Review and merge

3. **Automatic Deployment:**
- Vercel will auto-deploy on merge
- Monitor at https://vercel.com/dashboard

## 🔧 Vercel Environment Variables

Add these in Vercel Dashboard > Settings > Environment Variables:

### Required for Strategic Marketing:
```env
# OpenRouter API (REQUIRED - Get from https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=gpt-4-turbo-preview

# Feature Flags
ENABLE_STRATEGIC_MARKETING=true
ENABLE_AB_TESTING=true
ENABLE_PSYCHOLOGY_ANALYTICS=true

# Your existing Supabase config (already set)
NEXT_PUBLIC_SUPABASE_URL=https://znyjoyjsvjotlzjppzal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_existing_key
DATABASE_URL=your_existing_database_url
DIRECT_URL=your_existing_direct_url

# Application URL (update for production)
NEXT_PUBLIC_APP_URL=https://synthex-hi203jfw4-unite-group.vercel.app
```

## 📊 Post-Deployment Verification

### 1. Check Deployment Status
- Visit: https://vercel.com/dashboard
- Verify build succeeded
- Check for any errors in build logs

### 2. Test Strategic Marketing Features
- Navigate to: `https://your-app.vercel.app/brand-generator`
- Try generating a brand with sample data:
  - Business Type: "SaaS Platform"
  - Target Audience: "Tech startups"
  - Goals: "Increase Trust, Drive Sales"
  - Psychology: Select 3-5 principles
  - Tone: "Professional"

### 3. Verify Database Connection
- Check if psychology principles are loading
- Verify brand generations are saved
- Test A/B testing metrics

### 4. Monitor Performance
- Response time should be < 10 seconds
- Check Vercel Analytics for errors
- Monitor API usage at OpenRouter dashboard

## 🐛 Troubleshooting

### Common Issues:

1. **"OpenRouter API key not configured"**
   - Add `OPENROUTER_API_KEY` in Vercel environment variables
   - Redeploy after adding

2. **Database Connection Failed**
   - Verify `DATABASE_URL` is correct
   - Check if migrations ran: `npx prisma migrate deploy`

3. **404 on /brand-generator**
   - Verify the page file exists: `app/brand-generator/page.tsx`
   - Check build logs for compilation errors

4. **Slow Generation Times**
   - Consider using `gpt-3.5-turbo` for faster responses
   - Check OpenRouter API status

## 📈 Monitoring Endpoints

After deployment, test these endpoints:

- **Health Check:** `GET /api/health`
- **Brand Generation:** `POST /api/brand/generate`
- **Psychology Principles:** `GET /api/psychology/principles`

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ Brand generator UI loads at `/brand-generator`
- ✅ Can generate brands with psychology principles
- ✅ Results show effectiveness scores
- ✅ Database saves generations
- ✅ No console errors in browser

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Ensure database migrations completed
4. Review the [deployment guide](docs/STRATEGIC_MARKETING_DEPLOYMENT.md)

---
**Current Deployment URL:** https://synthex-hi203jfw4-unite-group.vercel.app
**Branch:** strategic-marketing
**Last Updated:** 2025-08-13