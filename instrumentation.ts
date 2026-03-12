/**
 * Next.js Instrumentation Hook
 *
 * Phase 114-02 DIAGNOSTIC: Minimal stub with a single console.log.
 * If /api/ping and /api/health/live respond after this deploy, the hang
 * is INSIDE register() (one of the await import() calls).
 * If they still hang, the issue is in shared webpack chunks or Lambda framework.
 *
 * Full implementation: .claude/scratchpad/instrumentation-fix-ready.ts
 */

export async function register() {
  console.log('[instrumentation] register() called — minimal stub');
}
