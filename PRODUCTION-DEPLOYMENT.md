# 🚀 Synthex Production Deployment Guide

## Overview
This guide covers deploying Synthex to production on Vercel with all features enabled.

## 🎯 Production Features

### Current Implementation
- ✅ **REST API v1** with Swagger documentation
- ✅ **Authentication System** (JWT + Google OAuth)
- ✅ **Password Reset** with email verification
- ✅ **AI Content Generation** (OpenRouter integration)
- ✅ **Responsive UI** with breadcrumbs and footer
- ✅ **Rate Limiting** for API protection
- ✅ **Database** (PostgreSQL via Prisma)
- ✅ **API Documentation** at `/api-docs`

## 📋 Pre-Deployment Checklist

### 1. Environment Variables Required
```env
# Database (from Vercel Postgres)
DATABASE_URL=
POSTGRES_URL_NON_POOLING=

# Authentication
JWT_SECRET=your-secure-jwt-secret-min-32-chars

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://your-domain.vercel.app/auth/google/callback

# AI Services (optional but recommended)
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
```

### 2. Database Setup
1. Create a Vercel Postgres database in your project
2. The connection strings will be automatically added to your environment

### 3. Google OAuth Setup (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-domain.vercel.app/auth/google/callback`
   - `http://localhost:3000/auth/google/callback` (for development)

## 🚀 Deployment Steps

### Method 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Method 2: Deploy via GitHub Integration

1. **Connect GitHub Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install && npx prisma generate`

3. **Add Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all required variables from the checklist above

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete

## 🔧 Post-Deployment Configuration

### 1. Database Migration
```bash
# Run database migrations
npx prisma migrate deploy
```

### 2. Verify Deployment
- **Homepage**: `https://your-domain.vercel.app`
- **API Docs**: `https://your-domain.vercel.app/api-docs`
- **Health Check**: `https://your-domain.vercel.app/health`
- **API v1**: `https://your-domain.vercel.app/api/v1`

### 3. Test Core Features
- [ ] User registration and login
- [ ] Password reset flow
- [ ] Content generation (if API keys configured)
- [ ] API documentation loads
- [ ] Breadcrumb navigation works
- [ ] Footer displays correctly

## 📊 Production Monitoring

### API Endpoints
- **Health**: `/health` - Service health status
- **API Info**: `/api` - API version information
- **Swagger Docs**: `/api-docs` - Interactive API documentation

### Performance Metrics
- Average response time: < 200ms
- API rate limits: 100 req/15min general, 20 req/min API
- Database connection pool: 10 connections

## 🔐 Security Considerations

### Headers Applied
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### Rate Limiting
- General: 100 requests per 15 minutes
- API: 20 requests per minute
- Content Generation: 10 requests per minute

## 🛠️ Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify DATABASE_URL is set correctly
   - Check if database is provisioned in Vercel

2. **Build Fails**
   - Ensure all dependencies are in package.json
   - Check TypeScript compilation: `npm run build`

3. **API Routes Not Working**
   - Verify vercel.json routing configuration
   - Check function logs in Vercel dashboard

4. **OAuth Not Working**
   - Verify callback URL matches Google Console
   - Check GOOGLE_CLIENT_ID and SECRET are set

## 📈 Scaling Considerations

### Current Limits
- Function size: 50MB
- Function timeout: 30 seconds
- Memory: 1024MB

### Optimization Tips
1. Enable Vercel Edge Functions for faster response
2. Use Vercel KV for session storage
3. Implement CDN for static assets
4. Consider upgrading to Pro plan for higher limits

## 🎉 Production URLs

After successful deployment, your app will be available at:

- **Production**: `https://synthex-production.vercel.app`
- **Preview**: `https://synthex-git-main.vercel.app`
- **Custom Domain**: Configure in Vercel dashboard

## 📝 Maintenance

### Updating Production
```bash
# Push changes to main branch
git push origin main

# Vercel will automatically deploy
```

### Database Backup
```bash
# Create backup
pg_dump $DATABASE_URL > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql
```

## 🚨 Emergency Rollback

If issues occur:
1. Go to Vercel Dashboard
2. Navigate to Deployments
3. Find last working deployment
4. Click "..." menu > "Promote to Production"

## 📞 Support

- **Documentation**: `/api-docs`
- **Health Check**: `/health`
- **GitHub Issues**: Report bugs in repository
- **Email**: support@synthex.ai

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Status**: Production Ready 🎯