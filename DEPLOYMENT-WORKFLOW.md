# SYNTHEX Deployment Workflow

## Overview
This document outlines the complete workflow for transferring changes from local development to GitHub and Vercel production.

## Prerequisites
- Git installed and configured
- Vercel CLI installed (`npm i -g vercel`)
- GitHub repository access
- Vercel project linked to GitHub repo

## Workflow Steps

### 1. Development Phase
Work on your changes locally in the D:\Synthex directory.

### 2. Version Control (Git)
```bash
# Check current status
git status

# Stage all changes
git add -A

# Or stage specific files
git add <file-path>

# Create a commit with descriptive message
git commit -m "Your descriptive commit message"

# Push to GitHub
git push origin main
```

### 3. Deployment Options

#### Option A: Automatic Deployment (Recommended)
If your Vercel project is linked to GitHub, pushing to the main branch automatically triggers a deployment.

```bash
# Simply push to GitHub
git push origin main

# Vercel will automatically deploy within 2-5 minutes
```

#### Option B: Manual Deployment via CLI
```bash
# Deploy to production
vercel --prod --yes

# Check deployment status
vercel list synthex --yes
```

#### Option C: Deploy via Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Redeploy" on the latest deployment

### 4. Verification

```bash
# List recent deployments
vercel list synthex --yes

# Inspect specific deployment
vercel inspect <deployment-url>

# Open production site
vercel --prod --yes
```

## Current Setup Status

### GitHub Repository
- **Repo**: https://github.com/CleanExpo/Synthex
- **Branch**: main
- **Status**: Connected to Vercel

### Vercel Project
- **Project**: synthex
- **Team**: unite-group
- **Production URL**: https://synthex-unite-group.vercel.app
- **Auto-deploy**: Enabled for main branch

## Best Practices

### Before Deploying
1. Test locally with `npm run dev`
2. Run build to check for errors: `npm run build`
3. Ensure all environment variables are set in Vercel

### Commit Messages
Use clear, descriptive commit messages:
- ✨ feat: Add new feature
- 🐛 fix: Fix bug
- 💄 style: Update UI/styling
- 📝 docs: Update documentation
- ♻️ refactor: Refactor code
- ⚡ perf: Improve performance

### Environment Variables
Manage sensitive data in Vercel Dashboard:
1. Go to Project Settings > Environment Variables
2. Add variables for Production, Preview, and Development
3. Never commit .env files with secrets

## Troubleshooting

### Deployment Fails
```bash
# Check build logs
vercel logs <deployment-url>

# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint
```

### Git Issues
```bash
# Discard local changes
git checkout -- <file>

# Reset to last commit
git reset --hard HEAD

# Pull latest from GitHub
git pull origin main
```

### Vercel CLI Issues
```bash
# Re-link project
vercel link

# Clear cache and redeploy
vercel --prod --force --yes
```

## Quick Deploy Script

Create a `deploy.sh` file:

```bash
#!/bin/bash

echo "🚀 Starting deployment process..."

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "📝 Committing changes..."
    git add -A
    git commit -m "Deploy: $(date +'%Y-%m-%d %H:%M:%S')"
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod --yes

echo "✅ Deployment complete!"
```

Make it executable: `chmod +x deploy.sh`
Run with: `./deploy.sh`

## Monitor Deployments

### Real-time Monitoring
```bash
# Watch deployment logs
vercel logs --follow

# Monitor build output
vercel inspect <deployment-url> --logs
```

### Post-Deployment Checks
1. Visit production URL
2. Check browser console for errors
3. Test critical user flows
4. Verify API endpoints
5. Check performance metrics

## Rollback Procedure

If issues occur after deployment:

```bash
# List previous deployments
vercel list synthex --yes

# Promote previous deployment to production
vercel rollback <previous-deployment-url>

# Or via dashboard
# Go to Vercel Dashboard > Select deployment > Click "Promote to Production"
```

## Automated CI/CD Pipeline

Your current setup uses GitHub + Vercel integration:

1. **Push to GitHub** → Triggers Vercel build
2. **Vercel Build** → Runs build process
3. **Deployment** → Deploys to production
4. **Notifications** → Receive status updates

## Contact & Support

- **Vercel Dashboard**: https://vercel.com/unite-group/synthex
- **GitHub Repo**: https://github.com/CleanExpo/Synthex
- **Production URL**: https://synthex-unite-group.vercel.app

## Current Deployment Status

Latest deployment initiated at: 2025-08-11 14:26:21 GMT+1000
URL: https://synthex-n15z29nju-unite-group.vercel.app
Status: Building/Ready (check with `vercel list synthex --yes`)

---

*Last updated: 2025-08-11*