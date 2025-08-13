# Strategic Marketing Deployment Guide

## 🚀 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set `OPENROUTER_API_KEY` from https://openrouter.ai/keys
- [ ] Configure database connection (`DATABASE_URL`)
- [ ] Set `JWT_SECRET` for authentication
- [ ] Configure `NEXT_PUBLIC_APP_URL` for production

### 2. Database Migration
```bash
# Run the psychology principles migration
npx prisma migrate dev --name strategic-marketing

# Or for production
npx prisma migrate deploy
```

### 3. Install Dependencies
```bash
npm install
# or
yarn install
```

### 4. Build Application
```bash
npm run build
# Check for any build errors
```

### 5. Run Tests
```bash
# Run the strategic marketing tests
npm test tests/strategic-marketing/

# Run all tests
npm test
```

## 📋 Deployment Steps

### Option 1: Vercel Deployment (Recommended)

1. **Push to GitHub**
```bash
git push origin strategic-marketing
```

2. **Create Pull Request**
- Navigate to GitHub repository
- Create PR from `strategic-marketing` to `main`
- Review changes and merge

3. **Vercel Auto-Deploy**
- Vercel will automatically deploy on merge
- Monitor build logs in Vercel dashboard

4. **Configure Environment Variables in Vercel**
- Go to Vercel Dashboard > Settings > Environment Variables
- Add all required variables from `.env.example`
- Redeploy if necessary

### Option 2: Manual Vercel Deployment

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy to production
vercel --prod

# Follow prompts to configure project
```

### Option 3: Docker Deployment

```bash
# Build Docker image
docker build -t synthex-strategic .

# Run container
docker run -p 3000:3000 --env-file .env.local synthex-strategic
```

## 🔍 Post-Deployment Verification

### 1. Health Checks
- [ ] Navigate to `/brand-generator` - UI loads correctly
- [ ] Test brand generation with sample input
- [ ] Verify API endpoint at `/api/brand/generate`
- [ ] Check database connectivity

### 2. Feature Testing
- [ ] Generate a brand with psychology principles
- [ ] Verify all 5 brand names are generated
- [ ] Check tagline variations
- [ ] Confirm metadata packages for all platforms
- [ ] Test effectiveness scoring

### 3. Performance Monitoring
- [ ] Response time < 10 seconds for generation
- [ ] Check OpenRouter API usage
- [ ] Monitor error rates
- [ ] Verify rate limiting is working

## 🔧 Troubleshooting

### Common Issues

#### 1. OpenRouter API Errors
**Problem**: "OpenRouter API key is not configured"
**Solution**: 
- Verify `OPENROUTER_API_KEY` is set in environment
- Check API key validity at https://openrouter.ai/keys
- Ensure sufficient credits

#### 2. Database Connection Failed
**Problem**: "Can't reach database server"
**Solution**:
- Verify `DATABASE_URL` format
- Check network connectivity
- Ensure database is running
- Run migrations: `npx prisma migrate deploy`

#### 3. Build Failures
**Problem**: TypeScript or build errors
**Solution**:
```bash
# Clear cache and rebuild
rm -rf .next
npm run build

# Check for missing dependencies
npm install
```

#### 4. Slow Generation Times
**Problem**: Brand generation takes > 15 seconds
**Solution**:
- Check OpenRouter API status
- Consider using faster model (gpt-3.5-turbo)
- Implement caching for repeated requests
- Check network latency

## 📊 Monitoring & Analytics

### Key Metrics to Track
1. **Usage Metrics**
   - Daily/Weekly/Monthly generation count
   - Most used psychological principles
   - Average effectiveness scores

2. **Performance Metrics**
   - API response times
   - Generation success rate
   - Error rates by component

3. **Business Metrics**
   - User satisfaction scores
   - A/B test conversion improvements
   - Brand recall rates

### Recommended Monitoring Tools
- **Vercel Analytics** - Built-in performance monitoring
- **Sentry** - Error tracking and debugging
- **Mixpanel** - User behavior analytics
- **Custom Dashboard** - Psychology principle usage stats

## 🔐 Security Considerations

1. **API Key Security**
   - Never commit API keys to repository
   - Use environment variables only
   - Rotate keys regularly

2. **Rate Limiting**
   - Implement per-user rate limits
   - Monitor for abuse patterns
   - Set up alerts for unusual activity

3. **Data Privacy**
   - Encrypt sensitive brand data
   - Implement data retention policies
   - Comply with GDPR/CCPA

## 📚 Additional Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Vercel Deployment Docs](https://vercel.com/docs)
- [Next.js Production Checklist](https://nextjs.org/docs/going-to-production)

## 🆘 Support

For issues or questions:
1. Check the [Architecture Documentation](./STRATEGIC_MARKETING_ARCHITECTURE.md)
2. Review test files in `tests/strategic-marketing/`
3. Create an issue in the repository
4. Contact the development team

---
*Last Updated: 2025-08-13*
*Version: 1.0.0*