/**
 * Next.js Instrumentation Hook — Phase 114-02 DIAGNOSTIC v2
 *
 * Absolute minimal stub: a single console.log, no imports.
 * Previous deploy with full register() + all Sentry imports removed still hangs.
 * This isolates whether the hang is in register() or in Lambda framework init.
 *
 * If this STILL hangs → issue is NOT in register(), it's in webpack shared chunks
 * or Node.js module resolution. Next step: uninstall @sentry/nextjs entirely.
 *
 * Full implementation preserved in git history (commit 180fb5cd).
 */

export async function register() {
  console.log('[instrumentation] register() called — Phase 114-02 diagnostic v2');
}
