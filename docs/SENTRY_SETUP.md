# 🚨 Sentry Error Tracking Setup for SYNTHEX

## Quick Setup Guide

### Step 1: Get Your Sentry DSN

1. Log in to your Sentry account: https://sentry.io
2. Navigate to your project: **cleanexpo247 → javascript-react**
3. Go to **Settings → Client Keys (DSN)**
4. Copy your DSN (looks like: `https://[key]@o[org].ingest.sentry.io/[project]`)

### Step 2: Configure Environment Variables

#### Option A: Use the Configuration Script (Recommended)

**Windows PowerShell:**
```powershell
# Basic setup (just DSN)
.\scripts\configure-sentry.ps1 -DSN "your-dsn-here"

# With auth token for source maps
.\scripts\configure-sentry.ps1 -DSN "your-dsn-here" -AuthToken "your-token"
```

**Linux/Mac:**
```bash
# Make the script executable
chmod +x scripts/configure-sentry.sh

# Run configuration
./scripts/configure-sentry.sh
```

#### Option B: Manual Setup

1. Create/edit `.env.local` in project root:
```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=your-dsn-here
SENTRY_DSN=your-dsn-here
SENTRY_ORG=cleanexpo247
SENTRY_PROJECT=javascript-react
SENTRY_ENVIRONMENT=production
```

2. Add the same variables to Vercel Dashboard:
   - Go to: https://vercel.com/your-team/synthex/settings/environment-variables
   - Add each variable for Production environment

### Step 3: Get Auth Token (Optional - For Source Maps)

1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click **Create New Token**
3. Give it a name: "SYNTHEX Source Maps"
4. Select scopes:
   - `project:releases`
   - `org:read`
5. Copy the token and add to environment:
```env
SENTRY_AUTH_TOKEN=your-token-here
```

### Step 4: Test Your Setup

#### Local Testing:
```bash
# Start dev server
npm run dev

# Test endpoints:
# Basic test
curl http://localhost:3000/api/sentry-test

# Trigger test error
curl http://localhost:3000/api/sentry-test?action=error

# Send test message
curl http://localhost:3000/api/sentry-test?action=message
```

#### Production Testing:
After deployment, visit:
- https://synthex.social/api/sentry-test
- https://synthex.social/api/sentry-test?action=error

### Step 5: Deploy with Sentry

**Windows:**
```powershell
.\scripts\deploy-with-sentry.ps1
```

**Linux/Mac:**
```bash
./scripts/deploy-with-sentry.sh
```

## Vercel Environment Variables

Add these to your Vercel project settings:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Your DSN | Client-side error tracking |
| `SENTRY_DSN` | Your DSN | Server-side error tracking |
| `SENTRY_ORG` | cleanexpo247 | Your organization |
| `SENTRY_PROJECT` | javascript-react | Your project |
| `SENTRY_AUTH_TOKEN` | Your token | For source maps (optional) |
| `SENTRY_ENVIRONMENT` | production | Environment name |

## Verify Integration

1. **Check Sentry Dashboard:**
   - Go to: https://sentry.io/organizations/cleanexpo247/projects/javascript-react/
   - You should see test events after triggering errors

2. **Monitor Releases:**
   - Each deployment creates a new release
   - Source maps are uploaded if auth token is configured
   - Commits are associated with releases

3. **Performance Monitoring:**
   - Traces sample rate is set to 10% by default
   - Adjust `SENTRY_TRACES_SAMPLE_RATE` as needed

## Troubleshooting

### DSN Not Found
- Ensure DSN is in both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
- Check Vercel environment variables are set for production

### Source Maps Not Uploading
- Verify `SENTRY_AUTH_TOKEN` has correct permissions
- Check token has `project:releases` scope
- Ensure `sentry-cli` is installed: `npm install -g @sentry/cli`

### Events Not Appearing
- Check DSN is correct format
- Verify project exists in Sentry
- Test with `/api/sentry-test?action=error`
- Check browser console for errors

## Security Notes

- Never commit `.env.local` to git
- Keep `SENTRY_AUTH_TOKEN` secure
- Use different DSNs for dev/staging/production if needed
- Rotate auth tokens periodically

## Support

- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Project Dashboard: https://sentry.io/organizations/cleanexpo247/projects/javascript-react/
- SYNTHEX Issues: Contact your team lead