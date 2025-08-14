# Platform Integrations Setup Guide

## Overview
Synthex supports integration with major social media platforms through OAuth authentication and API connections. This guide explains how to set up and configure each platform integration.

## Quick Status Check

### ✅ Working Components:
- **Integration UI**: `/dashboard/integrations` page with Connect buttons
- **Modal System**: OAuth flow and manual API key entry
- **API Routes**: `/api/integrations/[platform]/connect` endpoints
- **Google OAuth**: Properly configured and redirecting

### 🔧 Required Configuration:
To make platform integrations fully functional, you need to:

1. **Configure Supabase** for authentication
2. **Set up OAuth apps** on each platform
3. **Add environment variables** to Vercel

## Environment Variables Required

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# Database (Required for auth)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# OAuth Keys (Required for each platform)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

NEXT_PUBLIC_TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

NEXT_PUBLIC_INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

NEXT_PUBLIC_TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
```

## Platform-Specific Setup

### 1. Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `https://synthex.social/api/auth/oauth/google`
6. Copy Client ID and Secret to environment variables

### 2. Twitter/X OAuth
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app
3. Enable OAuth 2.0
4. Add callback URL: `https://synthex.social/api/auth/oauth/twitter`
5. Copy API Key and Secret

### 3. LinkedIn OAuth
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create a new app
3. Add redirect URL: `https://synthex.social/api/auth/oauth/linkedin`
4. Request necessary permissions
5. Copy Client ID and Secret

### 4. Facebook/Instagram
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure OAuth redirect: `https://synthex.social/api/auth/oauth/facebook`
5. For Instagram, add Instagram Basic Display product
6. Copy App ID and Secret

### 5. TikTok
1. Go to [TikTok Developer Portal](https://developers.tiktok.com/)
2. Create a new app
3. Add redirect URI: `https://synthex.social/api/auth/oauth/tiktok`
4. Copy Client Key and Secret

## How the Integration Flow Works

### OAuth Flow (Preferred):
1. User clicks "Connect" button on `/dashboard/integrations`
2. Modal opens with platform information
3. User clicks "Connect with [Platform]"
4. OAuth window opens for authorization
5. Platform redirects back to Synthex with auth code
6. Backend exchanges code for access token
7. Connection is saved and user sees success

### Manual API Key Flow (Fallback):
1. If OAuth keys are not configured
2. Modal shows API key input form
3. User enters their API credentials
4. Credentials are encrypted and stored
5. Connection is established

## File Structure

```
app/
├── dashboard/
│   └── integrations/
│       └── page.tsx          # Main integrations page
├── api/
│   └── integrations/
│       ├── route.ts          # List all integrations
│       └── [integrationId]/
│           ├── connect/
│           │   └── route.ts  # Connect/disconnect platform
│           └── status/
│               └── route.ts  # Check connection status
components/
└── IntegrationModal.tsx      # OAuth/API key modal
```

## Testing the Integrations

### Without Environment Variables:
1. Navigate to `/dashboard/integrations` (requires login)
2. Click "Connect" on any platform
3. Modal will fallback to manual API key entry

### With Environment Variables:
1. Add OAuth credentials to Vercel dashboard
2. Navigate to `/dashboard/integrations`
3. Click "Connect" on configured platform
4. OAuth flow will open in popup window
5. Authorize the app
6. Connection will be established

## Troubleshooting

### Common Issues:

1. **"Continue with Google" redirects to Google but fails**
   - ✅ This is expected behavior - OAuth is configured but needs valid credentials
   - Add proper Google OAuth credentials to fix

2. **Integrations page redirects to login**
   - ✅ This is correct - integrations require authentication
   - Configure Supabase to enable user login

3. **Connect buttons show "Connecting..." but nothing happens**
   - Check browser console for errors
   - Verify API routes are accessible
   - Check network tab for failed requests

4. **OAuth window opens but shows error**
   - Verify redirect URIs match exactly
   - Check OAuth app is approved/published
   - Ensure all required scopes are configured

## Next Steps

1. **Set up Supabase**:
   - Create project at [supabase.com](https://supabase.com)
   - Enable authentication
   - Add environment variables

2. **Configure OAuth Apps**:
   - Follow platform-specific setup above
   - Add all credentials to Vercel environment variables

3. **Test Each Integration**:
   - Login to dashboard
   - Navigate to `/dashboard/integrations`
   - Test each platform connection

## Support

For issues or questions:
- Check console for detailed error messages
- Review API route logs in Vercel dashboard
- Contact support@synthex.social