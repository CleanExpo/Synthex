# Google Environment Variables Reference

Quick reference for all Google-related environment variables used by Synthex.

## Variable Reference

| Variable | Required | Security | Description | Where to Get |
|----------|----------|----------|-------------|--------------|
| `GOOGLE_CLIENT_ID` | Yes (OAuth) | SECRET | OAuth 2.0 client ID | Cloud Console > APIs & Services > Credentials |
| `GOOGLE_CLIENT_SECRET` | Yes (OAuth) | SECRET | OAuth 2.0 client secret | Cloud Console > APIs & Services > Credentials |
| `GOOGLE_AI_API_KEY` | Yes (AI) | SECRET | Gemini API key | [Google AI Studio](https://aistudio.google.com/) |
| `GOOGLE_CLOUD_PROJECT_ID` | No | INTERNAL | Google Cloud project ID | Cloud Console > Project selector |
| `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` | No | CRITICAL | Service account JSON for Indexing API | Cloud Console > IAM > Service Accounts |
| `GOOGLE_API_KEY` | No | SECRET | Maps/Places API key | Cloud Console > APIs & Services > Credentials |
| `GOOGLE_PAGESPEED_API_KEY` | No | SECRET | PageSpeed Insights API key | Cloud Console > APIs & Services > Credentials |
| `GOOGLE_CALLBACK_URL` | No | INTERNAL | OAuth callback URL override | Set manually |
| `NEXT_PUBLIC_GA_ID` | No | PUBLIC | Google Analytics measurement ID | [Google Analytics](https://analytics.google.com/) |

### Security Levels

- **PUBLIC**: Safe for client-side (NEXT_PUBLIC_* prefix)
- **INTERNAL**: Server-side only, not sensitive
- **SECRET**: API keys and credentials, never expose to client
- **CRITICAL**: Highly sensitive, can access/modify user data

---

## Variable Details

### GOOGLE_CLIENT_ID

OAuth 2.0 client ID for Google Sign-In and YouTube integration.

```bash
# Format
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnop.apps.googleusercontent.com

# Validation
# - Must end with .apps.googleusercontent.com
# - Length: ~70 characters
```

**Used by**:
- `lib/auth/providers/google.ts` - NextAuth Google provider
- `lib/social/youtube-service.ts` - YouTube OAuth flow

---

### GOOGLE_CLIENT_SECRET

OAuth 2.0 client secret paired with the client ID.

```bash
# Format (newer)
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz

# Format (legacy)
GOOGLE_CLIENT_SECRET=abcdefghijklmnopqrstuvwxyz
```

**Used by**:
- `lib/auth/providers/google.ts` - NextAuth Google provider
- `lib/social/youtube-service.ts` - Token refresh

---

### GOOGLE_AI_API_KEY

API key for Google's Generative Language API (Gemini).

```bash
# Format
GOOGLE_AI_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz123456

# Validation
# - Must start with AIza
# - Length: ~39 characters
```

**Used by**:
- `lib/ai/providers/google-provider.ts` - Gemini AI completions

**Rate limits**:
- Free tier: 60 requests/minute
- Pay-as-you-go: Higher limits based on usage

---

### GOOGLE_CLOUD_PROJECT_ID

Your Google Cloud project identifier.

```bash
# Format
GOOGLE_CLOUD_PROJECT_ID=synthex-production-12345

# Validation
# - Lowercase letters, digits, hyphens only
# - 6-30 characters
# - Must start with letter
```

**Used by**:
- `lib/google/indexing.ts` - Indexing API authentication
- Various Google Cloud SDK operations

---

### GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON

Complete service account JSON credentials for the Indexing API.

```bash
# Format (single line)
GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"synthex-indexing@your-project.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}

# Required fields
# - type: Must be "service_account"
# - project_id: Your project ID
# - private_key_id: Key identifier
# - private_key: RSA private key (with \n for newlines)
# - client_email: Service account email
# - client_id: Service account numeric ID
# - auth_uri: OAuth auth endpoint
# - token_uri: Token endpoint
```

**Used by**:
- `lib/google/indexing.ts` - URL submission to Google Search

**Setup requirements**:
1. Create service account in Cloud Console
2. Generate JSON key
3. Add service account email as Owner in Search Console

---

### GOOGLE_API_KEY

API key for Google Maps, Places, and other APIs.

```bash
# Format
GOOGLE_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz123456

# Validation
# - Must start with AIza
# - Length: ~39 characters
```

**Used by**:
- Location-based features (if implemented)
- Maps JavaScript API

**Recommended restrictions**:
- HTTP referrer: `https://synthex.vercel.app/*`
- API restriction: Maps JavaScript API only

---

### GOOGLE_PAGESPEED_API_KEY

API key for PageSpeed Insights API.

```bash
# Format
GOOGLE_PAGESPEED_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz123456

# Validation
# - Must start with AIza
# - Length: ~39 characters
```

**Used by**:
- `lib/seo/pagespeed.ts` - SEO performance audits (if implemented)

**Note**: PageSpeed API works without a key at lower rate limits (400/day free).

---

### GOOGLE_CALLBACK_URL

Override for the Google OAuth callback URL.

```bash
# Format
GOOGLE_CALLBACK_URL=https://synthex.vercel.app/api/auth/callback/google

# Validation
# - Must be valid URL
# - Path should include /api/auth/callback/google
```

**Used by**:
- `lib/auth/providers/google.ts` - Custom callback URL

**Note**: Usually auto-derived from `NEXT_PUBLIC_APP_URL`. Only set if you need a custom callback.

---

### NEXT_PUBLIC_GA_ID

Google Analytics measurement ID for tracking.

```bash
# Format (GA4 - recommended)
NEXT_PUBLIC_GA_ID=G-ABCDEF1234

# Format (Universal Analytics - deprecated)
NEXT_PUBLIC_GA_ID=UA-123456789-1

# Validation
# - GA4: Starts with G-
# - UA: Starts with UA-
```

**Used by**:
- `app/layout.tsx` or analytics component
- Client-side page tracking

---

## Quick Start Configurations

### Minimum for YouTube Integration

```bash
# Required for Google Sign-In + YouTube features
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

### Minimum for AI Features

```bash
# Required for Gemini AI content generation
GOOGLE_AI_API_KEY=AIzaSy-xxxxx
```

### Full Production Setup

```bash
# === REQUIRED ===
# OAuth for Google Sign-In and YouTube
GOOGLE_CLIENT_ID=123456789012-abcd.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop

# AI content generation
GOOGLE_AI_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz

# === OPTIONAL ===
# Project configuration
GOOGLE_CLOUD_PROJECT_ID=synthex-production

# Instant URL indexing (requires Search Console setup)
GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# SEO audits (higher rate limits)
GOOGLE_PAGESPEED_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz

# Maps features
GOOGLE_API_KEY=AIzaSyAbcdefghijklmnopqrstuvwxyz

# Analytics tracking
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## Validation

Run the validation script to check your configuration:

```bash
npm run validate:google
```

The script checks:
- Presence of required variables
- Format validation (prefixes, lengths)
- API connectivity tests (where applicable)
- OAuth redirect URI consistency

---

## Troubleshooting

### "Invalid client_id" errors

- Verify `GOOGLE_CLIENT_ID` ends with `.apps.googleusercontent.com`
- Ensure no extra whitespace
- Check you're using the web application client, not service account

### "redirect_uri_mismatch" errors

- Add the exact redirect URI to Cloud Console credentials
- Include both development (`http://localhost:3000/...`) and production URIs
- No trailing slashes unless your code includes them

### "API key not valid" errors

- Regenerate the API key in Cloud Console
- Check API restrictions match your usage
- Verify the correct API is enabled for your project

### Service account authentication fails

- Verify JSON is valid (single line, proper escaping)
- Check service account email is added to Search Console
- Ensure Web Search Indexing API is enabled

---

## Related Documentation

- [Google Cloud Console Setup](./google-cloud-console.md)
- [OAuth Verification Guide](./google-oauth-verification.md)
- [Main Environment Variables](../ENVIRONMENT_VARIABLES.md)
