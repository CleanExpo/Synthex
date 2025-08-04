# 🆕 New Vercel Project Setup Guide

## Step 1: Create New Vercel Project

1. **Go to Vercel Dashboard:**
   https://vercel.com/dashboard

2. **Click "Add New..." → Project**

3. **Import from GitHub:**
   - Select your GitHub account
   - Choose: **CleanExpo/Synthex**
   - Click "Import"

4. **Configure Build Settings:**
   ```
   Framework Preset: Other
   Build Command: npm run build:prod
   Output Directory: dist
   Install Command: npm install
   ```

5. **Environment Variables:**
   Add these required variables:
   ```
   ANTHROPIC_API_KEY=your_key_here
   OPENROUTER_API_KEY=your_key_here
   DATABASE_URL=your_postgres_url
   JWT_SECRET=your_jwt_secret
   NODE_ENV=production
   ```

6. **Click "Deploy"**

## Step 2: Get New Deploy Hook

After project is created:

1. **Go to Project Settings:**
   - Click on your new project
   - Go to Settings → Git

2. **Create Deploy Hook:**
   - Scroll to "Deploy Hooks"
   - Click "Create Hook"
   - Name: `github-actions`
   - Branch: `main`
   - Click "Create Hook"

3. **Copy the webhook URL** (will look like):
   ```
   https://api.vercel.com/v1/integrations/deploy/prj_XXXXXXXX/XXXXXXXX
   ```

## Step 3: Update GitHub Secret

1. **Go to GitHub Secrets:**
   https://github.com/CleanExpo/Synthex/settings/secrets/actions

2. **Update VERCEL_DEPLOY_HOOK:**
   - Click on existing `VERCEL_DEPLOY_HOOK` secret
   - Click "Update"
   - Paste the NEW webhook URL
   - Click "Update secret"

## What I'll Do Next:

Once you give me the new webhook URL, I'll:
1. Update the local deployment scripts
2. Update documentation with new URLs
3. Test the deployment pipeline
4. Commit and push to trigger first deployment

## Benefits of Fresh Start:

- Clean project configuration
- No old webhook conflicts
- Fresh environment variables
- Proper build settings from start

---

**Let me know the new webhook URL when you have it!**