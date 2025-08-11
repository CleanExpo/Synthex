import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN || 'YOUR_SENTRY_DSN_HERE',
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Environment configuration
  environment: process.env.NODE_ENV,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
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
  
  // Performance monitoring
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
});