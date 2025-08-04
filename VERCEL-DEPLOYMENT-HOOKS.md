# Vercel Deployment Hooks Setup Guide

## Method 1: Deploy Hook (Recommended)

### Step 1: Create Deploy Hook in Vercel Dashboard

1. **Navigate to your project:**
   ```
   https://vercel.com/[your-username]/synthex/settings/git
   ```

2. **Find "Deploy Hooks" section:**
   - Scroll down to "Deploy Hooks"
   - Click "Create Hook"

3. **Configure the hook:**
   - **Name**: `manual-deploy` (or any name you prefer)
   - **Git Branch**: `main`
   - Click "Create Hook"

4. **Copy the webhook URL:**
   You'll get a URL like:
   ```
   https://api.vercel.com/v1/integrations/deploy/prj_xxxxxxxxxxxxx/xxxxxxxxxxxxxx
   ```

### Step 2: Save and Use the Deploy Hook

Save this webhook URL securely. You can trigger deployments using:

#### PowerShell (Windows):
```powershell
# Save this as deploy-vercel.ps1
$webhookUrl = "YOUR_DEPLOY_HOOK_URL_HERE"
Invoke-WebRequest -Uri $webhookUrl -Method POST
Write-Host "Deployment triggered successfully!"
```

#### Bash (Mac/Linux):
```bash
# Save this as deploy-vercel.sh
#!/bin/bash
WEBHOOK_URL="YOUR_DEPLOY_HOOK_URL_HERE"
curl -X POST "$WEBHOOK_URL"
echo "Deployment triggered successfully!"
```

#### Node.js Script:
```javascript
// Save this as deploy-vercel.js
const https = require('https');

const DEPLOY_HOOK = 'YOUR_DEPLOY_HOOK_URL_HERE';

const url = new URL(DEPLOY_HOOK);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
};

const req = https.request(options, (res) => {
  console.log(`Deployment triggered! Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error('Error triggering deployment:', error);
});

req.end();
```

## Method 2: Vercel CLI with Token

### Step 1: Generate Vercel Token

1. **Go to Account Settings:**
   ```
   https://vercel.com/account/tokens
   ```

2. **Create new token:**
   - Click "Create"
   - Name: `synthex-deploy`
   - Scope: Full Account (or specific project)
   - Expiration: Never (or set as needed)
   - Click "Create Token"

3. **Copy and save the token securely**

### Step 2: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 3: Use CLI with Token

#### PowerShell Script:
```powershell
# Save this as deploy-vercel-cli.ps1
$env:VERCEL_TOKEN = "YOUR_VERCEL_TOKEN_HERE"
$env:VERCEL_ORG_ID = "YOUR_ORG_ID"  # Optional
$env:VERCEL_PROJECT_ID = "YOUR_PROJECT_ID"  # Optional

# Deploy to production
vercel --prod --token $env:VERCEL_TOKEN --yes

Write-Host "Deployment completed!"
```

#### Bash Script:
```bash
#!/bin/bash
# Save this as deploy-vercel-cli.sh
export VERCEL_TOKEN="YOUR_VERCEL_TOKEN_HERE"
export VERCEL_ORG_ID="YOUR_ORG_ID"  # Optional
export VERCEL_PROJECT_ID="YOUR_PROJECT_ID"  # Optional

# Deploy to production
vercel --prod --token $VERCEL_TOKEN --yes

echo "Deployment completed!"
```

## Method 3: GitHub Actions (Automated)

### Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]
  workflow_dispatch:  # Allows manual trigger from GitHub

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Vercel CLI
        run: npm install -g vercel
        
      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        
      - name: Build Project
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        
      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Add GitHub Secrets:

1. Go to: `https://github.com/CleanExpo/Synthex/settings/secrets/actions`
2. Add these secrets:
   - `VERCEL_TOKEN`: Your Vercel token
   - `VERCEL_ORG_ID`: Found in Vercel project settings
   - `VERCEL_PROJECT_ID`: Found in Vercel project settings

## Method 4: API Direct Call

### Using Vercel API v2:

```javascript
// deploy-api.js
const axios = require('axios');

const VERCEL_TOKEN = 'YOUR_VERCEL_TOKEN';
const TEAM_ID = 'YOUR_TEAM_ID'; // Optional
const PROJECT_NAME = 'synthex';

async function triggerDeployment() {
  try {
    const response = await axios.post(
      'https://api.vercel.com/v13/deployments',
      {
        name: PROJECT_NAME,
        gitSource: {
          type: 'github',
          org: 'CleanExpo',
          repo: 'Synthex',
          ref: 'main'
        },
        target: 'production',
        projectSettings: {
          framework: null,
          buildCommand: 'npm run build:prod',
          outputDirectory: 'dist'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: {
          teamId: TEAM_ID // if using team account
        }
      }
    );
    
    console.log('Deployment triggered:', response.data);
  } catch (error) {
    console.error('Deployment failed:', error.response?.data || error.message);
  }
}

triggerDeployment();
```

## Finding Your Project IDs

### Get Organization/Team ID:
1. Go to: https://vercel.com/account
2. Look in the URL or Settings

### Get Project ID:
1. Go to your project: https://vercel.com/[username]/synthex
2. Open Settings → General
3. Look for "Project ID"

Or use Vercel CLI:
```bash
vercel project ls
```

## Quick Setup Script

Save this as `setup-deploy-hook.ps1`:

```powershell
Write-Host "Vercel Deployment Hook Setup" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Follow these steps:" -ForegroundColor Yellow
Write-Host "1. Go to: https://vercel.com/dashboard/synthex/settings/git" -ForegroundColor White
Write-Host "2. Scroll to 'Deploy Hooks'" -ForegroundColor White
Write-Host "3. Click 'Create Hook'" -ForegroundColor White
Write-Host "4. Name: 'manual-deploy', Branch: 'main'" -ForegroundColor White
Write-Host "5. Copy the webhook URL" -ForegroundColor White
Write-Host ""
$hookUrl = Read-Host "Paste your Deploy Hook URL here"

if ($hookUrl) {
    # Create deployment script
    @"
# Vercel Manual Deployment Script
`$webhookUrl = "$hookUrl"
Write-Host "Triggering Vercel deployment..." -ForegroundColor Yellow
`$response = Invoke-WebRequest -Uri `$webhookUrl -Method POST -UseBasicParsing
if (`$response.StatusCode -eq 200) {
    Write-Host "✓ Deployment triggered successfully!" -ForegroundColor Green
    Write-Host "Check status at: https://vercel.com/dashboard/synthex" -ForegroundColor Cyan
} else {
    Write-Host "✗ Deployment failed with status: `$(`$response.StatusCode)" -ForegroundColor Red
}
"@ | Out-File -FilePath "trigger-deploy.ps1" -Encoding UTF8
    
    Write-Host ""
    Write-Host "✓ Created trigger-deploy.ps1" -ForegroundColor Green
    Write-Host "Run './trigger-deploy.ps1' anytime to deploy!" -ForegroundColor Cyan
}
```

## Security Best Practices

1. **Never commit tokens or webhook URLs to Git**
2. **Use environment variables for sensitive data**
3. **Rotate tokens regularly**
4. **Use project-specific tokens when possible**
5. **Enable 2FA on your Vercel account**

## Testing Your Hook

After setup, test your deployment trigger:

```powershell
# PowerShell
./trigger-deploy.ps1

# Or with curl
curl -X POST "YOUR_DEPLOY_HOOK_URL"
```

You should see:
- Immediate response confirming trigger
- Deployment appearing in Vercel dashboard
- GitHub showing deployment status

## Troubleshooting

### Hook not working?
- Verify the URL is correct
- Check if project still exists
- Regenerate hook if needed

### CLI deployment fails?
- Verify token is valid
- Check token permissions
- Ensure you're in project directory

### Need to find project info?
```bash
vercel whoami
vercel project ls
vercel env ls
```

---

**Next Steps:**
1. Create your deploy hook in Vercel dashboard
2. Save the webhook URL securely
3. Create your deployment script
4. Test the deployment trigger