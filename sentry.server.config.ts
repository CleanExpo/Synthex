/**
 * Sentry Server Configuration (stub)
 *
 * Sentry.init() has been moved to instrumentation.ts register() to prevent
 * Lambda cold-start hangs. The Sentry webpack plugin auto-requires this file
 * at bundle-load time (before the event loop is ready). Calling Sentry.init()
 * there triggers OpenTelemetry hooks (require-in-the-middle / import-in-the-middle)
 * that hang the Lambda for 10+ seconds on cold start.
 *
 * By stubbing this file and moving init to register(), Sentry initialises after
 * the event loop is fully ready, eliminating the hang.
 *
 * @see instrumentation.ts — where Sentry.init() now lives
 */
