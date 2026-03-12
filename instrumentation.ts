/**
 * Next.js Instrumentation Hook
 *
 * Phase 114-02 DIAGNOSTIC: Stubbed to no-op to confirm whether register()
 * env-validation throw is the cause of Lambda cold-start hang.
 *
 * If /api/ping responds after this deploy, the throw in register() was the
 * root cause. Restore full validation from git (or .claude/archived/2026-03-12/)
 * after fixing the throw-on-critical-failure behaviour.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Phase 114-02 diagnostic stub — intentionally empty.
  // Full env validation disabled temporarily to isolate cold-start hang.
  // See .claude/archived/2026-03-12/instrumentation.ts.bak for original.
}
