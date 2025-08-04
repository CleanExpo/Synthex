# 🚀 SYNTHEX - Vercel Production Setup Guide

## Prerequisites

Before deploying to production, ensure you have:
- ✅ GitHub repository at `https://github.com/CleanExpo/Synthex`
- ✅ Vercel account (create at https://vercel.com)
- ✅ API keys from Anthropic and OpenRouter
- ✅ Domain name (optional, but recommended)

## Step 1: Deploy to Vercel

### Option A: One-Click Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CleanExpo/Synthex)

Click the button above and follow these steps:
1. Connect your GitHub account if not already connected
2. Select your personal account or team
3. Name your project: `synthex` (or keep default)
4. Click "Create"

### Option B: Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import Git Repository
4. Search for: `CleanExpo/Synthex`
5. Click "Import"

## Step 2: Configure Environment Variables

### Required Variables (MUST SET)

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxx
NODE_ENV=production
PORT=3000
```

### Recommended Variables (For Better Performance)

```env
# Rate Limiting
RATE_LIMIT_WINDOW_API=60000
RATE_LIMIT_MAX_API=50
RATE_LIMIT_WINDOW_CONTENT=60000
RATE_LIMIT_MAX_CONTENT=20

# MCP Configuration
MCP_SEQUENTIAL_THINKING_ENABLED=true
MCP_CONTEXT7_ENABLED=true
MLE_STAR_MIN_PRODUCTION_SCORE=70

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90
```

### How to Add Environment Variables:

1. Go to: https://vercel.com/[your-username]/synthex/settings/environment-variables
2. For each variable:
   - Enter "Key" (e.g., `ANTHROPIC_API_KEY`)
   - Enter "Value" (your actual API key)
   - Select environments: ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

## Step 3: Configure Build Settings

In Vercel Dashboard → Settings → General:

- **Framework Preset**: Other
- **Build Command**: `npm run build:prod`
- **Output Directory**: `.`
- **Install Command**: `npm ci --production=false`
- **Node.js Version**: 18.x

## Step 4: Configure Domain (Optional but Recommended)

### Option A: Use Vercel Subdomain
Your app is automatically available at:
- `https://synthex.vercel.app`
- `https://synthex-[username].vercel.app`

### Option B: Custom Domain

1. Go to Settings → Domains
2. Add your domain (e.g., `synthex.dev`)
3. Follow DNS configuration:
   - Add CNAME record: `www` → `cname.vercel-dns.com`
   - Add A record: `@` → `76.76.21.21`
4. Wait for SSL certificate (automatic)

## Step 5: Configure Production Features

### Enable Analytics
1. Go to Analytics tab
2. Enable Web Analytics (free tier available)
3. View real-time metrics

### Set Up Speed Insights
1. Go to Speed Insights tab
2. Enable monitoring
3. Track Core Web Vitals

### Configure Security Headers
Already configured in `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

## Step 6: Deploy and Verify

### Initial Deployment
1. After configuration, click "Deploy"
2. Wait 2-3 minutes for build
3. Check build logs for any errors

### Verify Deployment

Test these endpoints:

```bash
# Health Check
curl https://synthex.vercel.app/health
# Expected: {"status":"healthy","timestamp":"...","environment":"production"}

# API Status
curl https://synthex.vercel.app/api
# Expected: API information JSON

# MLE Star Score
curl https://synthex.vercel.app/api/mle-star/score
# Expected: Score data

# Main Application
open https://synthex.vercel.app
```

## Step 7: Set Up Continuous Deployment

### Automatic Deployments
Already configured! Every push to `main` branch triggers:
1. Automatic build
2. Preview deployment for PRs
3. Production deployment for main branch

### Branch Protection (Recommended)
1. Go to GitHub → Settings → Branches
2. Add rule for `main`
3. Enable:
   - Require pull request reviews
   - Require status checks (Vercel)
   - Require branches to be up to date

## Step 8: Monitoring and Maintenance

### Monitor Performance

1. **Vercel Dashboard**
   - Function logs
   - Error tracking
   - Performance metrics

2. **Built-in Endpoints**
   - `/health` - System health
   - `/api/mle-star/score` - ML readiness
   - `/api/enhancement/analytics/insights` - Analytics

### Set Up Alerts

1. Go to Settings → Integrations
2. Add Slack/Discord for notifications
3. Configure alert thresholds:
   - Error rate > 1%
   - Response time > 3s
   - Build failures

## Production Checklist

Before going live, ensure:

- [ ] All environment variables are set
- [ ] API keys are valid and have sufficient quota
- [ ] Custom domain is configured (if using)
- [ ] SSL certificate is active
- [ ] Health endpoint returns 200 OK
- [ ] All API endpoints are responsive
- [ ] Rate limiting is configured
- [ ] Analytics is enabled
- [ ] Error tracking is set up
- [ ] Backup strategy is defined

## Troubleshooting

### Build Fails
```bash
# Check logs in Vercel dashboard
# Common issues:
- Missing dependencies: Check package.json
- TypeScript errors: Run locally `npm run build:prod`
- Node version: Ensure 18.x is selected
```

### API Keys Not Working
```bash
# Verify in Vercel dashboard:
- Environment variables are set for Production
- No extra spaces in values
- Keys are not expired
- Redeploy after adding variables
```

### Slow Performance
```bash
# Optimize:
- Enable caching in vercel.json
- Check function size (<50MB)
- Review rate limits
- Use CDN for static assets
```

### 500 Errors
```bash
# Debug:
- Check function logs in Vercel
- Verify all environment variables
- Test locally with production build
- Check API quotas
```

## Performance Optimization

### Current Configuration
- **Function Memory**: 1024 MB
- **Max Duration**: 30 seconds
- **Region**: iad1 (US East)
- **Cache Headers**: Configured for static assets

### Scaling Options
If you need to scale:
1. Increase function memory (up to 3008 MB)
2. Add more regions for global distribution
3. Enable Edge Functions for faster response
4. Implement database connection pooling

## Security Best Practices

1. **API Key Rotation**
   - Rotate keys every 30-90 days
   - Use different keys for dev/staging/prod
   - Never commit keys to repository

2. **Access Control**
   - Enable CORS for your domain only
   - Implement rate limiting
   - Add authentication for sensitive endpoints

3. **Monitoring**
   - Enable Vercel Analytics
   - Set up error alerts
   - Monitor API usage

## Cost Management

### Free Tier Limits
- 100 GB bandwidth
- 100 GB-hours serverless execution
- Unlimited deployments

### Optimization Tips
- Cache responses where possible
- Optimize image sizes
- Use CDN for static assets
- Monitor function execution time

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **GitHub Issues**: https://github.com/CleanExpo/Synthex/issues
- **Vercel Support**: https://vercel.com/support
- **Community Discord**: https://discord.gg/synthex

## Next Steps

1. **Enable Advanced Features**
   - A/B testing
   - Smart scheduling
   - Multi-language support

2. **Integrate Monitoring**
   - Sentry for error tracking
   - Google Analytics
   - Custom metrics dashboard

3. **Scale Your Deployment**
   - Add team members
   - Set up staging environment
   - Implement CI/CD pipeline

---

## 🎉 Congratulations!

Your SYNTHEX platform is now running in production on Vercel!

**Production URL**: https://synthex.vercel.app
**Repository**: https://github.com/CleanExpo/Synthex
**Dashboard**: https://vercel.com/dashboard

For any issues, check the logs in your Vercel dashboard or open an issue on GitHub.