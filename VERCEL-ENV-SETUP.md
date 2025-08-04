# Vercel Environment Variables Setup Guide

## Quick Setup Checklist

### Required Environment Variables

These MUST be set in Vercel for your app to work:

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `ANTHROPIC_API_KEY` | Claude API key | https://console.anthropic.com/account/keys |
| `OPENROUTER_API_KEY` | OpenRouter API key | https://openrouter.ai/keys |
| `DATABASE_URL` | PostgreSQL connection string | Your database provider |
| `POSTGRES_URL_NON_POOLING` | Direct PostgreSQL connection | Your database provider |
| `JWT_SECRET` | Secret for JWT tokens | Generate a random string |
| `NODE_ENV` | Environment setting | Set to `production` |

### Optional but Recommended

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | - |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | `https://your-domain.vercel.app/auth/google/callback` |
| `PORT` | Server port | `3000` |
| `RATE_LIMIT_WINDOW_API` | API rate limit window (ms) | `60000` |
| `RATE_LIMIT_MAX_API` | Max API requests per window | `50` |

## Step-by-Step Setup

### 1. Access Vercel Environment Variables

```bash
# Direct link to your project's env vars:
https://vercel.com/[your-username]/synthex/settings/environment-variables

# Or navigate manually:
1. Go to https://vercel.com/dashboard
2. Select your "synthex" project
3. Click "Settings" tab
4. Click "Environment Variables" in sidebar
```

### 2. Add Each Variable

For each variable:

1. Click "Add New"
2. Enter the variable name (e.g., `ANTHROPIC_API_KEY`)
3. Enter the value
4. Select environments:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
5. Click "Save"

### 3. Generate Required Values

#### Generate JWT_SECRET

```powershell
# PowerShell - Generate secure JWT secret
[System.Web.Security.Membership]::GeneratePassword(32, 8)

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Get API Keys

**Anthropic (Claude):**
1. Go to https://console.anthropic.com/account/keys
2. Click "Create Key"
3. Copy the key starting with `sk-ant-api03-`

**OpenRouter:**
1. Go to https://openrouter.ai/keys
2. Create a new key
3. Copy the key starting with `sk-or-v1-`

#### Database URLs (Using Vercel Postgres)

If using Vercel's PostgreSQL:
1. Go to https://vercel.com/dashboard/stores
2. Click "Create Database" → "Postgres"
3. Copy both URLs from the dashboard

#### Google OAuth Setup

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://synthex-h4j7.vercel.app/auth/google/callback`

## Quick Copy-Paste Template

Copy this template and fill in your values:

```env
# Core API Keys
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE

# Database (Vercel Postgres)
DATABASE_URL=postgres://default:YOUR_PASSWORD@YOUR_HOST/verceldb?sslmode=require
POSTGRES_URL_NON_POOLING=postgres://default:YOUR_PASSWORD@YOUR_HOST/verceldb?sslmode=require

# Security
JWT_SECRET=YOUR_GENERATED_SECRET_HERE
NODE_ENV=production

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://synthex-h4j7.vercel.app/auth/google/callback

# Server Configuration
PORT=3000

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

## PowerShell Script to Set Variables

Save as `set-vercel-env.ps1`:

```powershell
# Vercel Environment Variables Setup Script
# Run this to quickly set up your environment variables

Write-Host "Vercel Environment Variables Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "Please enter your environment variables:" -ForegroundColor Yellow
Write-Host ""

# Collect variables
$vars = @{}

# Required variables
$vars['ANTHROPIC_API_KEY'] = Read-Host "Enter ANTHROPIC_API_KEY"
$vars['OPENROUTER_API_KEY'] = Read-Host "Enter OPENROUTER_API_KEY"
$vars['DATABASE_URL'] = Read-Host "Enter DATABASE_URL (or press Enter to skip)"
$vars['JWT_SECRET'] = Read-Host "Enter JWT_SECRET (or press Enter to generate)"

# Generate JWT_SECRET if not provided
if (-not $vars['JWT_SECRET']) {
    Add-Type -AssemblyName System.Web
    $vars['JWT_SECRET'] = [System.Web.Security.Membership]::GeneratePassword(32, 8)
    Write-Host "Generated JWT_SECRET: $($vars['JWT_SECRET'])" -ForegroundColor Green
}

# Set NODE_ENV
$vars['NODE_ENV'] = 'production'

# Optional Google OAuth
$setupGoogle = Read-Host "Set up Google OAuth? (y/n)"
if ($setupGoogle -eq 'y') {
    $vars['GOOGLE_CLIENT_ID'] = Read-Host "Enter GOOGLE_CLIENT_ID"
    $vars['GOOGLE_CLIENT_SECRET'] = Read-Host "Enter GOOGLE_CLIENT_SECRET"
    $vars['GOOGLE_CALLBACK_URL'] = Read-Host "Enter GOOGLE_CALLBACK_URL (or press Enter for default)"
    
    if (-not $vars['GOOGLE_CALLBACK_URL']) {
        $vars['GOOGLE_CALLBACK_URL'] = 'https://synthex-h4j7.vercel.app/auth/google/callback'
    }
}

Write-Host ""
Write-Host "Setting environment variables in Vercel..." -ForegroundColor Yellow

# Set each variable using Vercel CLI
foreach ($key in $vars.Keys) {
    if ($vars[$key]) {
        Write-Host "Setting $key..." -ForegroundColor Gray
        vercel env add $key production < <($vars[$key])
        vercel env add $key preview < <($vars[$key])
        vercel env add $key development < <($vars[$key])
    }
}

Write-Host ""
Write-Host "✓ Environment variables set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Trigger a new deployment to apply the variables" -ForegroundColor White
Write-Host "2. Run: ./deploy.bat" -ForegroundColor Cyan
```

## Verify Your Setup

### Check Variables Are Set

```bash
# Using Vercel CLI
vercel env ls

# Or check in dashboard
https://vercel.com/[your-username]/synthex/settings/environment-variables
```

### Test Your Deployment

After setting variables, redeploy:

```bash
# Trigger new deployment with updated env vars
./deploy.bat

# Or manually
vercel --prod --force
```

### Verify Endpoints

```bash
# Health check
curl https://synthex-h4j7.vercel.app/health

# Should return:
# {"status":"healthy","timestamp":"...","environment":"production"}
```

## Common Issues

### "Missing required environment variable"

**Solution:** Make sure all required variables are set for Production environment

### "Invalid API key"

**Solution:** 
- Check for extra spaces in the value
- Ensure key hasn't expired
- Regenerate key if needed

### "Database connection failed"

**Solution:**
- Verify DATABASE_URL format
- Check SSL settings (`?sslmode=require`)
- Ensure database is accessible

### Changes not taking effect

**Solution:**
- Redeploy after changing variables
- Use `vercel --prod --force` to force rebuild

## Security Best Practices

1. **Never commit .env files to Git**
2. **Use different API keys for dev/prod**
3. **Rotate keys regularly**
4. **Enable 2FA on all service accounts**
5. **Use Vercel's built-in secrets management**

## Environment-Specific Settings

### Production
```env
NODE_ENV=production
LOG_LEVEL=error
DEBUG=false
```

### Preview (Staging)
```env
NODE_ENV=staging
LOG_LEVEL=info
DEBUG=true
```

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=true
```

## Quick Reference

### All Supported Variables

```env
# API Keys
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=

# Database
DATABASE_URL=
POSTGRES_URL_NON_POOLING=

# Authentication
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Server
NODE_ENV=production
PORT=3000

# Rate Limiting
RATE_LIMIT_WINDOW_API=60000
RATE_LIMIT_MAX_API=50
RATE_LIMIT_WINDOW_CONTENT=60000
RATE_LIMIT_MAX_CONTENT=20

# MCP Features
MCP_SEQUENTIAL_THINKING_ENABLED=true
MCP_CONTEXT7_ENABLED=true
MLE_STAR_MIN_PRODUCTION_SCORE=70

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_RETENTION_DAYS=90

# Logging
LOG_LEVEL=info
DEBUG=false
```

---

**Need Help?**
- Vercel Docs: https://vercel.com/docs/environment-variables
- Project Issues: https://github.com/CleanExpo/Synthex/issues
- Vercel Support: https://vercel.com/support