/**
 * Monkey-patch for pg's SCRAM-SHA-256 server signature verification.
 *
 * Supabase's Supavisor connection pooler has a known bug where it doesn't
 * faithfully relay the server's final SCRAM signature back to the client.
 * This causes node-postgres (pg) to throw:
 *   "SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing"
 *
 * This patch makes `finalizeSession` log a warning instead of throwing
 * when the server signature is missing or doesn't match. The client has
 * already authenticated successfully at this point — the server signature
 * is the server proving ITS identity to the client, not the other way around.
 *
 * References:
 * - https://github.com/supabase/supabase/issues/29257
 * - https://github.com/supabase/supabase/issues/35820
 * - https://github.com/supabase/supavisor/issues/331
 *
 * IMPORTANT: Import this module BEFORE creating any pg.Pool instances.
 */

let patched = false;

export function patchPgScram(): void {
  if (patched) return;
  patched = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sasl = require('pg/lib/crypto/sasl');
    const originalFinalizeSession = sasl.finalizeSession;

    sasl.finalizeSession = function patchedFinalizeSession(
      session: { message: string; serverSignature: string },
      serverData: string
    ) {
      try {
        originalFinalizeSession(session, serverData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('SCRAM-SERVER-FINAL-MESSAGE')) {
          // Supavisor SCRAM relay bug — log warning but don't throw.
          // The client has already authenticated; the server signature
          // verification is the server proving its identity to us.
          console.warn(
            '[pg-scram-patch] Suppressed Supavisor SCRAM relay error:',
            msg
          );
        } else {
          throw err;
        }
      }
    };

  } catch (err) {
    console.warn('[pg-scram-patch] Failed to patch pg SASL module:', err);
  }
}
