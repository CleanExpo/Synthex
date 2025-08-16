# Environment Variables Documentation

## Overview
This document details all environment variables used in SYNTHEX, their purpose, security level, and whether they're required or optional.

## Security Levels

- **PUBLIC**: Safe to expose in client-side code (prefixed with `NEXT_PUBLIC_`)
- **SECRET**: Server-side only, never expose to client
- **SENSITIVE**: Contains credentials or tokens, must be kept secure

## Required Variables

### Core Configuration

| Variable | Security | Purpose | Example |
|----------|----------|---------|---------|
| `NODE_ENV` | PUBLIC | Environment mode | `development`, `production` |
| `NEXT_PUBLIC_APP_URL` | PUBLIC | Application base URL | `https://synthex.social` |

### Database & Authentication (Supabase)

| Variable | Security | Purpose | Required |
|----------|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC | Anonymous access key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Service role key for server operations | ✅ |
| `DATABASE_URL` | **SECRET** | PostgreSQL connection with pooler | ✅ |
| `DIRECT_URL` | **SECRET** | Direct PostgreSQL connection | ✅ |
| `JWT_SECRET` | **SECRET** | JWT signing secret | ✅ |

## Optional Variables (Based on Features)

### Email Service

| Variable | Security | Purpose | When Needed |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER` | PUBLIC | Email service provider | When sending emails |
| `EMAIL_ENABLED` | PUBLIC | Enable/disable email sending | Email features |
| `EMAIL_FROM_ADDRESS` | PUBLIC | Sender email address | Email features |
| `EMAIL_FROM_NAME` | PUBLIC | Sender display name | Email features |
| `SENDGRID_API_KEY` | **SECRET** | SendGrid authentication | SendGrid emails |

### Redis Cache (Performance)

| Variable | Security | Purpose | When Needed |
|----------|----------|---------|-------------|
| `UPSTASH_REDIS_REST_URL` | **SECRET** | Upstash Redis URL | Caching/Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | **SECRET** | Upstash authentication | Caching/Rate limiting |

### Monitoring & Analytics

| Variable | Security | Purpose | When Needed |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | PUBLIC | Sentry error tracking | Error monitoring |
| `SENTRY_AUTH_TOKEN` | **SECRET** | Sentry authentication | Source map uploads |

### Payment Processing

| Variable | Security | Purpose | When Needed |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | **SECRET** | Stripe API authentication | Payment processing |
| `STRIPE_PUBLISHABLE_KEY` | PUBLIC | Stripe client-side key | Payment UI |
| `STRIPE_WEBHOOK_SECRET` | **SECRET** | Webhook signature verification | Stripe webhooks |

### Social OAuth

| Variable | Security | Purpose | When Needed |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | PUBLIC | Google OAuth app ID | Google login |
| `GOOGLE_CLIENT_SECRET` | **SECRET** | Google OAuth secret | Google login |

## Environment-Specific Files

### Development
`.env.local` - Local development environment variables

### Production
`.env.production` - Production environment variables (set in Vercel Dashboard)

### Testing
`.env.test` - Test environment variables

## Setting Variables in Different Environments

### Local Development
1. Copy `.env.clean` to `.env.local`
2. Fill in required values
3. Add optional values as needed

### Vercel Production
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add each variable with production values
3. Select "Production" environment
4. Save changes

### Docker
Use `docker-compose.yml` environment section or `.env` file

## Security Best Practices

### DO's ✅
- Use `.env.local` for local development
- Add `.env.local` to `.gitignore`
- Use Vercel Dashboard for production secrets
- Rotate secrets regularly
- Use strong, randomly generated secrets

### DON'Ts ❌
- Never commit `.env.local` to git
- Never expose `SERVICE_ROLE_KEY` to client
- Never log sensitive variables
- Never use production keys in development
- Never share secrets in plain text

## Variable Usage in Code

### Client-Side (React Components)
```typescript
// Only NEXT_PUBLIC_ variables are available
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
```

### Server-Side (API Routes, Server Components)
```typescript
// All variables are available
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;
```

### Edge Functions
```typescript
// Limited to Edge-compatible variables
const url = process.env.NEXT_PUBLIC_APP_URL;
```

## Troubleshooting

### Variable Not Working?
1. Check spelling (case-sensitive)
2. Restart dev server after changes
3. Clear `.next` cache: `rm -rf .next`
4. Verify in correct environment

### Production Issues?
1. Check Vercel Dashboard settings
2. Verify environment selected
3. Redeploy after changes
4. Check build logs for errors

## Minimal Setup for Quick Start

```env
# Copy these to .env.local for minimum functionality
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

## Feature-Specific Requirements

### To Enable Email
1. Get SendGrid API key from sendgrid.com
2. Add `SENDGRID_API_KEY=your_key`
3. Set `EMAIL_ENABLED=true`

### To Enable Payments
1. Get Stripe keys from stripe.com
2. Add `STRIPE_SECRET_KEY=your_secret`
3. Add `STRIPE_PUBLISHABLE_KEY=your_publishable`

### To Enable OAuth
1. Create OAuth app (Google/GitHub/etc)
2. Add `PROVIDER_CLIENT_ID=your_id`
3. Add `PROVIDER_CLIENT_SECRET=your_secret`

## Environment Variable Validation

The app validates required variables on startup. Missing required variables will show warnings but won't crash the app in development mode.

## Questions?

For help with environment variables:
1. Check this documentation
2. Review `.env.clean` for examples
3. Check error messages in console
4. Verify Vercel Dashboard settings
