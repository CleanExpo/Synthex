/**
 * app/api/cron/autopilot/route.ts
 *
 * Vercel Cron: runs daily at 02:00 UTC.
 * Schedule registered in vercel.json: "0 2 * * *"
 *
 * Responsibilities:
 *  - Iterate all users with Autopilot enabled
 *  - Kick off the launch pipeline for each (queued via BullMQ)
 *  - Log run summary to Supabase cron_runs table
 *
 * All heavy imports (Supabase, BullMQ, etc.) are LAZY (inside the handler)
 * so this module is safe to import in Jest without env vars.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min Vercel Pro timeout

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────────────────────────────────────

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // ── Security ────────────────────────────────────────────────────────────
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    // ── Lazy imports (safe for Jest) ──────────────────────────────────────
    const { createClient } = await import('@supabase/supabase-js');
    const { launchAutopilotPipeline } = await import('@/lib/autopilot/launch-pipeline');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Fetch autopilot-enabled users ─────────────────────────────────────
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, autopilot_config')
      .eq('autopilot_enabled', true)
      .limit(500);

    if (usersError) {
      throw new Error(`Failed to fetch autopilot users: ${usersError.message}`);
    }

    const userList = users ?? [];
    const results: Array<{ userId: string; status: string; error?: string }> = [];

    // ── Enqueue each user's pipeline ──────────────────────────────────────
    for (const user of userList) {
      try {
        await launchAutopilotPipeline({
          userId: user.user_id,
          config: user.autopilot_config,
          runId,
        });
        results.push({ userId: user.user_id, status: 'queued' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ userId: user.user_id, status: 'error', error: message });
        console.error(`[autopilot-cron] Failed to queue user ${user.user_id}:`, message);
      }
    }

    // ── Log run to Supabase ────────────────────────────────────────────────
    await supabase.from('cron_runs').insert({
      id: runId,
      job_name: 'autopilot',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      total_users: userList.length,
      queued: results.filter((r) => r.status === 'queued').length,
      errors: results.filter((r) => r.status === 'error').length,
      payload: { results },
    });

    return NextResponse.json({
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      totalUsers: userList.length,
      queued: results.filter((r) => r.status === 'queued').length,
      errors: results.filter((r) => r.status === 'error').length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[autopilot-cron] Fatal error:', message);
    return NextResponse.json({ error: message, runId }, { status: 500 });
  }
}
