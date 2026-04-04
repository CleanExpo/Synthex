/**
 * Diagnostic ping endpoint — zero imports, zero logic.
 * If this hangs, the issue is in Lambda framework init (OTel/instrumentation).
 * If this responds, the issue is specific to the health route bundles.
 * Phase 114-02 diagnostic — safe to delete after fix confirmed.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
