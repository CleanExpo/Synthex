# GitHub Actions Debugging Guide

## Issue: GitHub Actions not triggering Vercel deployments

### Possible Causes:

1. **GitHub Actions might be disabled**
   - Check: https://github.com/CleanExpo/Synthex/settings/actions
   - Ensure "Actions permissions" is set to "Allow all actions"

2. **Workflow files might not be recognized**
   - Files must be in `.github/workflows/` directory
   - Files must have `.yml` or `.yaml` extension

3. **Secret might not be accessible**
   - Check: https://github.com/CleanExpo/Synthex/settings/secrets/actions
   - Secret name must be exactly: `VERCEL_DEPLOY_HOOK`
   - Value: `https://api.vercel.com/v1/integrations/deploy/prj_QcJrayyUbPteT2ez5JKpImPLgCWZ/wyQpfX55Zx`

4. **Branch protection rules**
   - Check if main branch has restrictions

## Quick Checks:

### 1. Check if workflows are visible:
Go to: https://github.com/CleanExpo/Synthex/actions

You should see:
- "Deploy to Vercel" workflow
- "CI/CD Pipeline" workflow

### 2. Check workflow runs:
- Are there any workflow runs listed?
- Are they failing or not starting at all?

### 3. If no workflows visible:
The `.github` folder might not have been pushed correctly.

## Manual Test:

Try manually triggering the workflow:
1. Go to: https://github.com/CleanExpo/Synthex/actions/workflows/deploy.yml
2. Click "Run workflow"
3. Select "main" branch
4. Click "Run workflow" button

## What to tell me:

Please check and let me know:
1. Can you see the workflows in GitHub Actions tab?
2. Are there any workflow runs (even failed ones)?
3. What happens when you try to manually trigger?
4. Is the secret definitely added with the exact name `VERCEL_DEPLOY_HOOK`?