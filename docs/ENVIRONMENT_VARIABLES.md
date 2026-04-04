# Environment Variables Documentation

**Last Updated:** 2026-01-18
**Version:** 2.0.0

> **⚠️ SECURITY NOTICE:** This document contains example values only. Never commit real secrets!

---

## Quick Start

```bash
# Copy example to local
cp .env.example .env.local

# Edit with your values
code .env.local
```

---

## Required Variables

These variables MUST be set for the application to function:

| Variable | Description | Security Level | Example |
|----------|-------------|---------------|---------|
| `DATABASE_URL` | PostgreSQL connection string with credentials | **CRITICAL** | `postg...ame` |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) | **CRITICAL** | `base6...g==` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | **PUBLIC** | `https....co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for client) | **PUBLIC** | `eyJhb......` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NEVER expose to client) | **CRITICAL** | `eyJhb......` |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI services | **SECRET** | `sk-or...xxx` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | **PUBLIC** | `https://synthex.vercel.app` |

## OAuth Providers

### Google OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | For OAuth | INTERNAL | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | **SECRET** | Google OAuth client secret |

**Setup:** https://console.cloud.google.com/apis/credentials

### GitHub OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | For OAuth | INTERNAL | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | For OAuth | **SECRET** | GitHub OAuth App client secret |

**Setup:** https://github.com/settings/applications/new

### Twitter/X OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `TWITTER_CLIENT_ID` | For OAuth | INTERNAL | Twitter API client ID |
| `TWITTER_CLIENT_SECRET` | For OAuth | **SECRET** | Twitter API client secret |

**Setup:** https://developer.twitter.com/en/portal/projects

### LinkedIn OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `LINKEDIN_CLIENT_ID` | For OAuth | INTERNAL | LinkedIn client ID |
| `LINKEDIN_CLIENT_SECRET` | For OAuth | **SECRET** | LinkedIn client secret |

**Setup:** https://www.linkedin.com/developers/apps

### Facebook OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `FACEBOOK_CLIENT_ID` | For OAuth | INTERNAL | Facebook App ID |
| `FACEBOOK_CLIENT_SECRET` | For OAuth | **SECRET** | Facebook App secret |

**Setup:** https://developers.facebook.com/apps

### Instagram OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `INSTAGRAM_CLIENT_ID` | For OAuth | INTERNAL | Instagram App ID |
| `INSTAGRAM_CLIENT_SECRET` | For OAuth | **SECRET** | Instagram App secret |

### TikTok OAuth
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `TIKTOK_CLIENT_KEY` | For OAuth | INTERNAL | TikTok client key |
| `TIKTOK_CLIENT_SECRET` | For OAuth | **SECRET** | TikTok client secret |

---

## Webhook Secrets

### Incoming Webhook Verification
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `STRIPE_WEBHOOK_SECRET` | For Stripe | **SECRET** | Stripe webhook signing secret |
| `TWITTER_WEBHOOK_SECRET` | For Twitter | **SECRET** | Twitter webhook secret |
| `LINKEDIN_WEBHOOK_SECRET` | For LinkedIn | **SECRET** | LinkedIn webhook secret |
| `FACEBOOK_WEBHOOK_SECRET` | For FB/IG | **SECRET** | Facebook/Instagram webhook secret |
| `INSTAGRAM_WEBHOOK_SECRET` | For Instagram | **SECRET** | Instagram webhook secret |
| `TIKTOK_WEBHOOK_SECRET` | For TikTok | **SECRET** | TikTok webhook secret |
| `GITHUB_WEBHOOK_SECRET` | For GitHub | **SECRET** | GitHub webhook secret |
| `SLACK_SIGNING_SECRET` | For Slack | **SECRET** | Slack signing secret |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | For FB/IG | SECRET | Facebook webhook verify token |

### Outgoing Webhooks
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `WEBHOOK_SIGNING_SECRET` | Optional | **SECRET** | Default outgoing webhook signing secret |

---

## Optional Variables

These variables enable additional features:

| Variable | Description | Security Level | Default |
|----------|-------------|----------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (fallback to OpenRouter) | **SECRET** | None |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | **SECRET** | None |
| `STRIPE_SECRET_KEY` | Stripe secret key for payment processing | **CRITICAL** | None |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (safe for client) | PUBLIC | None |
| `SENDGRID_API_KEY` | SendGrid API key for email | **SECRET** | None |
| `SENDGRID_FROM_EMAIL` | Sender email address | INTERNAL | None |
| `SENDGRID_FROM_NAME` | Sender display name | INTERNAL | None |
| `SENTRY_DSN` | Sentry error tracking DSN | INTERNAL | None |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for sourcemaps | **SECRET** | None |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | PUBLIC | None |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL | PUBLIC | None |
| `NODE_ENV` | Node environment | INTERNAL | development |

---

## Redis Caching

### Option 1: Standard Redis
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `REDIS_URL` | Optional | SECRET | Redis connection URL |

### Option 2: Upstash (Recommended for Vercel)
| Variable | Required | Security | Description |
|----------|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Optional | INTERNAL | Upstash REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | **SECRET** | Upstash REST API token |

**Setup:** https://upstash.com/

---

## Rate Limiting

| Variable | Description | Security Level | Default |
|----------|-------------|----------------|---------|
| `RATE_LIMIT_MAX` | Maximum requests per window | INTERNAL | 100 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | INTERNAL | 900000 |

## Security Classifications

- **CRITICAL** 🔴: Highly sensitive data (database URLs, private keys). Never expose, never log.
- **SECRET** 🟠: Sensitive API keys and passwords. Keep server-side only.
- **INTERNAL** 🟡: Internal configuration. Not sensitive but keep server-side.
- **PUBLIC** 🟢: Safe for client-side exposure (use NEXT_PUBLIC_ prefix).

## Validation

All environment variables are validated at startup using `src/lib/security/env-validator.ts`.

To validate your configuration:

```bash
node scripts/validate-env.js
```

## Security Best Practices

1. **Use a password manager** to generate and store secrets
2. **Rotate secrets regularly** (every 90 days minimum)
3. **Use different values** for development, staging, and production
4. **Enable audit logging** for all secret access
5. **Use secret scanning** in your CI/CD pipeline

## Common Issues

### Missing Required Variables
If you see "Required env var X is missing", ensure:
1. The variable is set in your `.env.local` file
2. The variable name is spelled correctly
3. There are no spaces around the = sign

### Invalid Format
If you see "Invalid format for X", check:
1. The value matches the expected pattern
2. URLs include the protocol (https://)
3. Keys are properly encoded (base64, etc.)

### Dependency Errors
Some variables depend on others. For example:
- `STRIPE_SECRET_KEY` requires `STRIPE_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID` requires `GOOGLE_CLIENT_SECRET`

---

*Generated on 2025-08-15T04:25:20.798Z*
