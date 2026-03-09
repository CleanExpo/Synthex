import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (!SENTRY_DSN) {
  console.warn('[Sentry] SENTRY_DSN not configured - server error tracking disabled');
}

Sentry.init({
  dsn: SENTRY_DSN || undefined, // undefined disables Sentry gracefully
  
  // Organization: cleanexpo247
  // Project: synthex
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Environment configuration
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  
  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Server-specific configuration
  initialScope: {
    tags: {
      component: 'backend',
      runtime: 'node',
    },
  },
  
  // Error filtering
  beforeSend(event, hint) {
    // Add additional context
    if (event.exception) {
      event.extra = {
        ...event.extra,
        nodeVersion: process.version,
        platform: process.platform,
      };
    }
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
  ],
});