# Google Cloud Console Setup Guide

Complete setup guide for configuring Google Cloud Console for Synthex production deployment.

## Overview

Synthex uses the following Google APIs:

| API | Purpose | Auth Method |
|-----|---------|-------------|
| YouTube Data API v3 | Video uploads, channel management | OAuth 2.0 |
| YouTube Analytics API | Channel analytics sync | OAuth 2.0 |
| Web Search Indexing API | Instant URL submission | Service Account |
| Generative Language API (Gemini) | AI content generation | API Key |
| PageSpeed Insights API | SEO performance audits | API Key (optional) |

## Prerequisites

- Google account with Google Cloud Console access
- Verified domain for production OAuth
- Search Console access (for Indexing API)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top-left) > **New Project**
3. Enter project details:
   - **Project name**: `Synthex Production` (or your preferred name)
   - **Organization**: Select your organization (or leave as "No organization")
   - **Location**: Select appropriate folder
4. Click **Create**
5. Wait for project creation, then select it from the dropdown

> **Note**: Save your Project ID - you'll need it for `GOOGLE_CLOUD_PROJECT_ID`

---

## Step 2: Enable Required APIs

Navigate to **APIs & Services > Library** and enable the following:

### Required APIs

1. **YouTube Data API v3**
   - Search: "YouTube Data API v3"
   - Click **Enable**
   - Used for: Video uploads, channel management, video metadata

2. **YouTube Analytics API**
   - Search: "YouTube Analytics API"
   - Click **Enable**
   - Used for: Channel analytics, video performance metrics

3. **Web Search Indexing API**
   - Search: "Web Search Indexing API"
   - Click **Enable**
   - Used for: Instant URL submission to Google Search

4. **Generative Language API** (Gemini)
   - Search: "Generative Language API"
   - Click **Enable**
   - Used for: AI content generation via Gemini models

### Optional APIs

5. **PageSpeed Insights API**
   - Search: "PageSpeed Insights API"
   - Click **Enable**
   - Used for: SEO performance audits (works without key at lower rate limits)

6. **Maps JavaScript API** (if using location features)
   - Search: "Maps JavaScript API"
   - Click **Enable**

---

## Step 3: Configure OAuth 2.0 Credentials

### 3.1 Create OAuth Client ID

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth client ID**
3. If prompted, configure the OAuth consent screen first (see Step 4)
4. Select **Application type**: Web application
5. Enter a **Name**: `Synthex Web Client`
6. Add **Authorized JavaScript origins**:

   ```
   # Development
   http://localhost:3000

   # Production
   https://synthex.vercel.app
   https://your-custom-domain.com  (if applicable)
   ```

7. Add **Authorized redirect URIs**:

   ```
   # Development - NextAuth callback
   http://localhost:3000/api/auth/callback/google

   # Development - YouTube OAuth callback
   http://localhost:3000/api/auth/youtube/callback

   # Production - NextAuth callback
   https://synthex.vercel.app/api/auth/callback/google

   # Production - YouTube OAuth callback
   https://synthex.vercel.app/api/auth/youtube/callback

   # Custom domain (if applicable)
   https://your-custom-domain.com/api/auth/callback/google
   https://your-custom-domain.com/api/auth/youtube/callback
   ```

8. Click **Create**
9. Copy the **Client ID** and **Client Secret**

> **Environment Variables**:
> - `GOOGLE_CLIENT_ID`: Your OAuth client ID (ends with `.apps.googleusercontent.com`)
> - `GOOGLE_CLIENT_SECRET`: Your OAuth client secret (starts with `GOCSPX-`)

---

## Step 4: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **User Type**: External (unless using Google Workspace)
3. Click **Create**

### 4.1 App Information

| Field | Value |
|-------|-------|
| App name | Synthex |
| User support email | Your support email |
| App logo | Upload 120x120 PNG (optional for testing) |

### 4.2 App Domain

| Field | Value |
|-------|-------|
| Application home page | `https://synthex.vercel.app` |
| Application privacy policy link | `https://synthex.vercel.app/privacy` |
| Application terms of service link | `https://synthex.vercel.app/terms` |
| Authorized domains | `synthex.vercel.app`, `vercel.app` |

### 4.3 Developer Contact Information

Enter your developer email addresses.

### 4.4 Scopes

Click **Add or Remove Scopes** and add:

**Non-sensitive scopes** (no verification required):
```
.../auth/userinfo.email
.../auth/userinfo.profile
openid
```

**Sensitive scopes** (requires verification for 100+ users):
```
https://www.googleapis.com/auth/youtube.readonly
```

**Restricted scopes** (requires verification):
```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.force-ssl
```

> **Important**: See [OAuth Verification Guide](./google-oauth-verification.md) for verification requirements.

### 4.5 Test Users

For development/testing before verification:

1. Click **Add Users**
2. Add email addresses of testers (max 100)
3. Only these users can authorize the app before verification

---

## Step 5: Create Service Account (for Indexing API)

The Indexing API requires a service account, not OAuth.

### 5.1 Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **+ CREATE SERVICE ACCOUNT**
3. Enter details:
   - **Name**: `synthex-indexing`
   - **Description**: Service account for Google Indexing API
4. Click **Create and Continue**
5. Skip role assignment (not needed for Indexing API)
6. Click **Done**

### 5.2 Generate JSON Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON** format
5. Click **Create** - downloads the key file
6. **CRITICAL**: Store this file securely, never commit to git

### 5.3 Add to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Select your property (or add it)
3. Go to **Settings > Users and permissions**
4. Click **Add User**
5. Enter the service account email (from the JSON file, `client_email` field)
6. Select **Owner** permission
7. Click **Add**

> **Environment Variable**:
> - `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`: Paste the entire JSON contents as a single line

---

## Step 6: Create API Keys

### 6.1 Gemini API Key (Google AI Studio)

The easiest way to get a Gemini API key:

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API key**
3. Click **Create API key in new project** or select existing project
4. Copy the generated key

> **Environment Variable**: `GOOGLE_AI_API_KEY`

### 6.2 PageSpeed API Key (optional)

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > API key**
3. Copy the key
4. Click **Edit API key** to restrict it:
   - **Name**: `PageSpeed API Key`
   - **API restrictions**: Restrict to PageSpeed Insights API
5. Save

> **Environment Variable**: `GOOGLE_PAGESPEED_API_KEY`

### 6.3 Maps API Key (optional)

1. Create another API key as above
2. Restrict to Maps JavaScript API
3. Add HTTP referrer restrictions:
   - `https://synthex.vercel.app/*`
   - `http://localhost:3000/*`

> **Environment Variable**: `GOOGLE_API_KEY`

---

## Step 7: Verify Domain Ownership

Required for OAuth consent screen verification:

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Add your domain property
3. Verify using one of:
   - **DNS record** (recommended): Add TXT record to your DNS
   - **HTML file**: Upload verification file to your site
   - **HTML tag**: Add meta tag to your homepage

---

## Troubleshooting

### "Access blocked: This app's request is invalid"

- Check redirect URIs match exactly (including trailing slashes)
- Ensure the OAuth client is configured for web application type
- Verify JavaScript origins include your domain

### "Error 403: access_denied"

- App is in testing mode and user is not a test user
- User has not granted required scopes
- OAuth consent screen is not properly configured

### "The API is not enabled for this project"

- Go to APIs & Services > Library and enable the required API
- Wait a few minutes for propagation

### Service Account not working for Indexing API

- Verify service account email is added as Owner in Search Console
- Check the JSON key is valid and not expired
- Ensure the service account is in the correct project

### Rate Limits

| API | Quota |
|-----|-------|
| YouTube Data API | 10,000 units/day (varies by operation) |
| YouTube Analytics API | 100 requests/100 seconds |
| Indexing API | 200 requests/day |
| Gemini API | Varies by model and tier |
| PageSpeed API | 400 queries/day (free) |

---

## Environment Variables Checklist

After completing setup, verify these environment variables:

```bash
# OAuth (Required for Google Sign-In and YouTube)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# AI Features (Required for content generation)
GOOGLE_AI_API_KEY=AIza-xxxxx

# Indexing API (Optional - for instant URL submission)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Optional APIs
GOOGLE_API_KEY=AIza-xxxxx          # Maps/Places
GOOGLE_PAGESPEED_API_KEY=AIza-xxxxx # PageSpeed Insights

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## Next Steps

1. [Configure OAuth verification](./google-oauth-verification.md) for production
2. [Review environment variables](./google-env-variables.md) reference
3. Run `npm run validate:google` to verify configuration
