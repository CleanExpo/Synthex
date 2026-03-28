/**
 * Sentry Client Configuration — SYN-489
 *
 * Re-enabled with tunnel route to avoid Lambda cold-start hang.
 * Client errors are proxied through /api/monitoring/sentry-tunnel
 * which avoids ad-blockers and the @sentry/nextjs webpack plugin issue.
 *
 * The webpack plugin (withSentryConfig) remains DISABLED in next.config.mjs.
 * Server-side capture uses instrumentation.ts → Sentry.init() (lazy, post-bundle-load).
 */
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Route client events through our API to avoid ad-blockers
  tunnel: '/api/monitoring/sentry-tunnel',
  
  environment: process.env.NODE_ENV,
  
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session replay for debugging production issues
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,
  
  // Filter noisy errors
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') return null;
    
    // Filter out browser extension errors
    if (event.exception?.values?.some(e => 
      e.stacktrace?.frames?.some(f => 
        f.filename?.includes('chrome-extension://') ||
        f.filename?.includes('moz-extension://')
      )
    )) {
      return null;
    }
    
    return event;
  },
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev',
});

export default Sentry;
