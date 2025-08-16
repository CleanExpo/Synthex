# Environment Variables Documentation for SYNTHEX

## Summary of Terminal Freezing Issue
The terminal was freezing due to multiple Node.js processes consuming excessive resources. We identified and terminated processes using:
- 815 seconds of CPU time (Process 63712)
- 188MB of memory (Process 5492)
- 341MB of memory (Process 57804)

## Currently Used Environment Variables

Based on comprehensive codebase analysis, here are the environment variables **actually in use**:

### ✅ CORE VARIABLES (Required)
```
NODE_ENV                           - Used in: components/ErrorBoundary.tsx, lib/email/email-config-validator.ts
NEXT_PUBLIC_APP_URL               - Used in: lib/email/email-service.ts
```

### ✅ SUPABASE (Database & Auth) - All Required
```
NEXT_PUBLIC_SUPABASE_URL         - Used in: lib/ab-testing.ts, lib/auth/oauth-handler.ts
NEXT_PUBLIC_SUPABASE_ANON_KEY    - Used in: lib/ab-testing.ts
SUPABASE_SERVICE_ROLE_KEY        - Used in: lib/ab-testing.ts
```

### ✅ DATABASE CONNECTIONS - Required
```
DATABASE_URL                      - Used by Prisma ORM
DIRECT_URL                        - Used by Prisma for migrations
```

### ✅ AUTHENTICATION - Required
```
JWT_SECRET                        - Used for session tokens
```

### ✅ EMAIL SERVICE - Core Variables Used
```
EMAIL_PROVIDER                    - Used in: lib/email/email-config-validator.ts, lib/email/email-service.ts
EMAIL_ENABLED                     - Used in: lib/email/email-config-validator.ts
EMAIL_FROM_ADDRESS               - Used in: lib/email/email-config-validator.ts
EMAIL_FROM_NAME                  - Used in: lib/email/email-config-validator.ts
EMAIL_REPLY_TO                   - Used in: lib/email/email-config-validator.ts
SENDGRID_API_KEY                 - Used in: lib/email/email-config-validator.ts, lib/email/email-service.ts
```

### ⚠️ EMAIL SERVICE - Optional/Conditional Variables
These are only used if specific email providers are configured:
```
# SendGrid specific
SENDGRID_WELCOME_TEMPLATE_ID
SENDGRID_RESET_PASSWORD_TEMPLATE_ID
SENDGRID_VERIFICATION_TEMPLATE_ID

# Mailgun specific
MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_HOST

# Postmark specific
POSTMARK_API_KEY
POSTMARK_SERVER_TOKEN
POSTMARK_MESSAGE_STREAM

# AWS SES specific
AWS_SES_REGION
AWS_SES_ACCESS_KEY_ID
AWS_SES_SECRET_ACCESS_KEY

# Resend specific
RESEND_API_KEY

# SMTP specific
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
```

### ⚠️ EMAIL FEATURES - Optional
```
EMAIL_RATE_LIMIT_MAX
EMAIL_RATE_LIMIT_WINDOW_MS
EMAIL_QUEUE_ENABLED
EMAIL_RETRY_ATTEMPTS
EMAIL_RETRY_DELAY_MS
EMAIL_TRACK_OPENS
EMAIL_TRACK_CLICKS
EMAIL_TRACK_BOUNCES
EMAIL_WEBHOOK_URL
EMAIL_WEBHOOK_SECRET
```

### 🔧 DEVELOPMENT ONLY
```
DEV_EMAIL_RECIPIENT
DEV_EMAIL_LOG_ENABLED
EMAIL_TEST_MODE
```

## Variables Prepared for Future Implementation
The following variables are included in the .env file for upcoming features:

### 📊 Monitoring & Analytics
- **Sentry**: SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
- **Google Analytics**: NEXT_PUBLIC_GA_MEASUREMENT_ID

### 💳 Payment Processing
- **Stripe**: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET

### ⚡ Performance & Caching
- **Redis/Upstash**: REDIS_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

### 🤖 AI/ML Services
- **OpenAI**: OPENAI_API_KEY
- **Anthropic**: ANTHROPIC_API_KEY
- **HuggingFace**: HUGGINGFACE_API_KEY

### 🔐 Social Authentication
- **Google OAuth**: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- **GitHub OAuth**: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
- **Discord OAuth**: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET

### 🛡️ Security & Rate Limiting
- RATE_LIMIT_MAX_REQUESTS
- RATE_LIMIT_WINDOW_MS
- ALLOWED_ORIGINS

### 🎛️ Feature Flags
- FEATURE_SOCIAL_AUTH
- FEATURE_PAYMENTS
- FEATURE_AI_ASSISTANT
- FEATURE_ANALYTICS

These variables are ready to be populated when you implement the corresponding features.

## Recommended Actions

### 1. Immediate Cleanup
- Use `.env.final` as your primary environment file
- Remove all unused variables to reduce confusion
- Keep commented placeholders for future features

### 2. Security Recommendations
- **NEVER** commit the following to Git:
  - SUPABASE_SERVICE_ROLE_KEY
  - JWT_SECRET
  - Any API keys (SENDGRID_API_KEY, etc.)
  - Database passwords

### 3. For Production Deployment
Required minimum variables:
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://synthex.social
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
DATABASE_URL=<your-database-url>
DIRECT_URL=<your-direct-url>
JWT_SECRET=<your-jwt-secret>
```

### 4. For Email Functionality
If using SendGrid (current configuration):
```env
EMAIL_PROVIDER=sendgrid
EMAIL_ENABLED=true
EMAIL_FROM_ADDRESS=noreply@synthex.social
EMAIL_FROM_NAME=SYNTHEX
SENDGRID_API_KEY=<your-sendgrid-key>
```

## File Structure Recommendation
```
.env.local          # Local development (git-ignored)
.env.production     # Production values (git-ignored)
.env.example        # Template with all vars (committed to git)
```

## Terminal Performance Tips
To prevent future freezing:
1. Regularly check for runaway processes: `Get-Process node | Sort-Object CPU -Descending`
2. Kill stuck processes: `taskkill /F /PID <process-id>`
3. Clear npm cache if needed: `npm cache clean --force`
4. Use `--max-old-space-size` flag for memory-intensive operations

## Migration Steps
1. Backup current .env: `cp .env .env.backup`
2. Copy new configuration: `cp .env.final .env`
3. Test application: `npm run dev`
4. Verify all features work correctly
5. Deploy to production with updated variables
