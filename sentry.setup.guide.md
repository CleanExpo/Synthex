# 🚨 Sentry Configuration Guide for SYNTHEX

## Step 1: Get Your Sentry DSN

1. Log into [Sentry.io](https://sentry.io)
2. Navigate to your project: https://sentry.io/organizations/cleanexpo247/projects/synthex/
3. Go to **Settings → Client Keys (DSN)** 
4. Copy your DSN (looks like: `https://abc123@o123456.ingest.sentry.io/1234567`)

## Step 2: Add to Vercel Environment Variables

Add these to your Vercel dashboard (Settings → Environment Variables):

```env
# Required - Your Sentry DSN
SENTRY_DSN=your_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_dsn_here

# Required for Source Maps (get from Sentry Settings → Account → API → Auth Tokens)
SENTRY_AUTH_TOKEN=your_auth_token_here

# Your Sentry organization
SENTRY_ORG=cleanexpo247

# Your Sentry project name
SENTRY_PROJECT=synthex

# Environment tracking
SENTRY_ENVIRONMENT=production
```

## Step 3: Update Local .env.local (for development)

```env
NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
SENTRY_DSN=your_dsn_here
```

## Step 4: Install Sentry CLI (if not already installed)

```bash
npm install --save @sentry/nextjs
```

## Step 5: Configure Next.js (I'll do this for you)

The next.config.mjs needs to be wrapped with Sentry. I'll create this configuration.

## What Sentry Will Track:

### Client-Side:
- JavaScript errors
- Performance metrics
- User sessions
- Page load times
- API call performance
- User interactions (anonymized)

### Server-Side:
- API errors
- Database query performance
- Server response times
- Memory usage
- Unhandled promise rejections

### Features Configured:
- **Session Replay** - Record user sessions when errors occur
- **Performance Monitoring** - Track slow queries and API calls
- **Release Tracking** - Link errors to specific deployments
- **Error Filtering** - Ignore common browser extension errors
- **User Context** - Associate errors with user sessions

## Verification Steps:

1. After adding environment variables, trigger a test error:
   ```javascript
   // Add this temporarily to any page
   throw new Error('Sentry test error - please ignore');
   ```

2. Check Sentry dashboard for the error

3. Remove test error code

## Privacy & Compliance:

- User data is masked in session replays
- No passwords or sensitive data are sent
- PII is automatically scrubbed
- Compliant with GDPR/CCPA

## Support:

If you need help:
- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Support: support@synthex.social