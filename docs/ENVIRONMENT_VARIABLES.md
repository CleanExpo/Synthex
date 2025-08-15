# Environment Variables Documentation

> **⚠️ SECURITY NOTICE:** This document contains example values only. Never commit real secrets!

## Required Variables

These variables MUST be set for the application to function:

| Variable | Description | Security Level | Example |
|----------|-------------|---------------|---------|
| `DATABASE_URL` | PostgreSQL connection string with credentials | **CRITICAL** | `postg...ame` |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) | **CRITICAL** | `base6...g==` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | **PUBLIC** | `https....co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for client) | **PUBLIC** | `eyJhb......` |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI services | **SECRET** | `sk-or...xxx` |

## Optional Variables

These variables enable additional features:

| Variable | Description | Security Level | Default | Example |
|----------|-------------|---------------|---------|---------|
| `NEXTAUTH_SECRET` | NextAuth.js secret for session encryption | CRITICAL | None | `gener...uth` |
| `NEXTAUTH_URL` | Canonical URL of the site for NextAuth | INTERNAL | None | `https...app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (NEVER expose to client) | CRITICAL | None | `eyJhb......` |
| `OPENAI_API_KEY` | OpenAI API key (alternative to OpenRouter) | SECRET | None | `sk-xx...xxx` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | SECRET | None | `sk-an...xxx` |
| `STRIPE_SECRET_KEY` | Stripe secret key for payment processing | CRITICAL | None | `sk_te...xxx` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (safe for client) | PUBLIC | None | `pk_te...xxx` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret | SECRET | None | `whsec...xxx` |
| `EMAIL_PROVIDER` | Email service provider | INTERNAL | None | `xxx` |
| `SMTP_HOST` | SMTP server hostname | INTERNAL | None | `smtp....com` |
| `SMTP_PORT` | SMTP server port | INTERNAL | 587 | `xxx` |
| `SMTP_USER` | SMTP authentication username | SECRET | None | `your-...com` |
| `SMTP_PASS` | SMTP authentication password | SECRET | None | `your-...ord` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | INTERNAL | None | `xxxxx...com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | SECRET | None | `GOCSP...xxx` |
| `SENTRY_DSN` | Sentry error tracking DSN | INTERNAL | None | `https...xxx` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for client-side | PUBLIC | None | `https...xxx` |
| `NEXT_PUBLIC_GA_ID` | Google Analytics tracking ID | PUBLIC | None | `G-XXX...XXX` |
| `NEXT_PUBLIC_APP_URL` | Public application URL | PUBLIC | http://localhost:3000 | `https...app` |
| `NODE_ENV` | Node environment | INTERNAL | development | `xxx` |
| `REDIS_URL` | Redis connection URL for caching | SECRET | None | `redis...379` |
| `RATE_LIMIT_MAX` | Maximum requests per window | INTERNAL | 100 | `xxx` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | INTERNAL | 900000 | `xxx` |

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
