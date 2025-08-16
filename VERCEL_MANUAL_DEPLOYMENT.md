# 🚀 Manual Vercel Deployment Guide

## Issue: Vercel Not Auto-Deploying Latest Changes

Your latest commits have been pushed to GitHub, but Vercel is showing a build from ~2 weeks ago.

## Solution: Manual Deployment Trigger

### Option 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your `Synthex` project

2. **Check Git Integration**
   - Go to Settings → Git
   - Ensure it's connected to `CleanExpo/Synthex` repository
   - Verify the production branch is set to `main`

3. **Trigger Manual Deployment**
   - Go to the Deployments tab
   - Click "Redeploy" on the latest commit OR
   - Click the three dots menu → "Redeploy"

4. **Alternative: Create New Deployment**
   - Click "Create Deployment" button
   - Select branch: `main`
   - Click "Deploy"

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy directly
vercel --prod

# Or link and deploy
vercel link
vercel --prod
```

### Option 3: Force Push to Trigger

```bash
# Make a small change to force a new deployment
echo "" >> README.md
git add README.md
git commit -m "chore: trigger vercel deployment"
git push origin main
```

## Verify Git Integration Settings

In Vercel Dashboard → Settings → Git:

- **Production Branch**: `main`
- **Deploy Hooks**: Should be enabled
- **GitHub Integration**: Should show `CleanExpo/Synthex`

## Check Deployment Logs

1. Go to Vercel Dashboard
2. Click on the latest deployment attempt
3. Check the "Build Logs" for any errors
4. Look for:
   - Connection issues
   - Build failures
   - Environment variable problems

## Latest Commit Information

Your latest commit that should be deployed:
- Commit: `3039abf`
- Message: "fix: update package-lock.json for Prisma 6.14.0 compatibility"
- Branch: `main`

## Required Environment Variables

Ensure these are set in Vercel Dashboard → Settings → Environment Variables:

```env
# Database
DATABASE_URL=your_postgres_url
DIRECT_URL=your_direct_url

# Prisma
PRISMA_DISABLE_TELEMETRY=1
PRISMA_LOG_LEVEL=error

# Auth (if using)
NEXTAUTH_URL=https://synthex.social
NEXTAUTH_SECRET=your_secret_key
```

## Quick Verification

After deployment completes:
1. Check build logs for success
2. Visit: https://synthex.social
3. Check browser DevTools → Network → Response Headers
4. Look for `x-vercel-deployment-url` to verify new deployment

## Need Help?

If automatic deployments aren't working:
1. Check GitHub webhook settings
2. Verify Vercel has access to your repository
3. Check for any blocked webhooks in GitHub settings

The deployment should take 2-3 minutes once triggered.
