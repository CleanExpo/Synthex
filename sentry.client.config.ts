/**
 * Sentry Client Configuration (stub)
 *
 * @sentry/nextjs import REMOVED — Phase 114-02.
 * Even though this is a client config file, importing @sentry/nextjs here
 * can leak into server-side SSR bundles through Next.js client/server boundary
 * processing, causing Lambda cold-start hangs via OTel hooks.
 *
 * The Sentry webpack plugin is disabled (no withSentryConfig in next.config.mjs),
 * so this file is NOT auto-loaded. Keeping it as a stub for documentation.
 *
 * Client-side error reporting uses /api/monitoring/events instead.
 * Original: .claude/archived/2026-03-13/sentry.client.config.ts
 */
