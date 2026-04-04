// This file configures the initialization of Sentry on the server side when
// running in edge runtime.
// The config you add here will be used whenever middleware or an Edge route handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (!SENTRY_DSN) {
  console.warn('[Sentry] SENTRY_DSN not configured - edge error tracking disabled');
}

Sentry.init({
  dsn: SENTRY_DSN || undefined, // undefined disables Sentry gracefully

  // Organization: cleanexpo247
  // Project: synthex
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Environment configuration
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
});