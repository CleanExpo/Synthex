/**
 * Sentry Edge Configuration (stub)
 *
 * Sentry.init() for Edge runtime has been stubbed out.
 * The @sentry/nextjs webpack plugin is not active (removed from next.config.mjs
 * to prevent Lambda cold-start hangs via require-in-the-middle OTel hooks).
 * Without the webpack plugin, this file is never auto-imported into Edge bundles.
 *
 * Client-side error capture remains active via sentry.client.config.ts.
 * Original: .claude/archived/2026-03-12/sentry.edge.config.ts
 *
 * @see next.config.mjs — serverExternalPackages for why Sentry is kept external
 */
