import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (!SENTRY_DSN) {
  console.warn('[Sentry] NEXT_PUBLIC_SENTRY_DSN not configured - error tracking disabled');
}

Sentry.init({
  dsn: SENTRY_DSN || undefined, // undefined disables Sentry gracefully
  
  // Organization: cleanexpo247
  // Project: synthex
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  // Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      // Set `tracePropagationTargets` to control what URLs are traced
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/synthex\.social/,
        /^https:\/\/synthex-.*\.vercel\.app/,
        /^https:\/\/api\.synthex\.social/,
      ],
    }),
  ],
  
  // Environment configuration
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // User context
  initialScope: {
    tags: {
      component: 'frontend',
    },
  },
  
  // Error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Don't send network errors in development
      if (process.env.NODE_ENV === 'development' && error?.message?.includes('Network')) {
        return null;
      }
      
      // Don't send cancelled requests
      if (error?.name === 'AbortError') {
        return null;
      }
      
      // Add user context if available
      const user = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (user) {
        event.user = JSON.parse(user);
      }
    }
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    // Network errors
    'Network request failed',
    'NetworkError',
    'Failed to fetch',
    // Third-party errors
    'Script error',
    'fb_xd_fragment',
  ],
});