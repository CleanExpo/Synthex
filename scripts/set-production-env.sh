#!/bin/bash

# Production Environment Variables Configuration
# Sets feature flags and monitoring configuration

echo "🔧 Setting Production Environment Variables..."

# Feature Flags
vercel env add FF_PAYMENTS_ENABLED production <<< "false"
vercel env add FF_NEW_ONBOARDING_FLOW production <<< "5"
vercel env add FF_AI_CONTENT_GENERATION production <<< "100"
vercel env add FF_SOCIAL_POSTING production <<< "100"
vercel env add FF_ADVANCED_ANALYTICS production <<< "50"
vercel env add FF_EMAIL_NOTIFICATIONS production <<< "true"
vercel env add FF_STRICT_RATE_LIMITING production <<< "true"
vercel env add FF_MAINTENANCE_MODE production <<< "false"

# Canary Deployment
vercel env add CANARY_PERCENTAGE production <<< "0"
vercel env add DEPLOYMENT_TYPE production <<< "production"

# Monitoring
vercel env add SENTRY_DSN production <<< ""
vercel env add SENTRY_ENVIRONMENT production <<< "production"
vercel env add LOG_LEVEL production <<< "info"
vercel env add ENABLE_TRACING production <<< "true"

# Performance
vercel env add NODE_ENV production <<< "production"
vercel env add NODE_OPTIONS production <<< "--max-old-space-size=4096"

# Security
vercel env add RATE_LIMIT_WINDOW production <<< "60000"
vercel env add RATE_LIMIT_MAX production <<< "100"
vercel env add CORS_ORIGIN production <<< "https://synthex.social"

echo "✅ Environment variables configured"
echo ""
echo "📊 To verify, run:"
echo "vercel env ls production"