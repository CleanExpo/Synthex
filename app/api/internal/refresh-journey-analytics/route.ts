/**
 * POST /api/internal/refresh-journey-analytics
 *
 * CRON_SECRET-guarded internal route called by the refresh-journey-analytics
 * Supabase Edge Function every Sunday at 18:00 UTC (Monday 04:00 AEDT).
 *
 * Executes REFRESH MATERIALIZED VIEW CONCURRENTLY journey_analytics.
 * CONCURRENTLY avoids read locks — existing queries can run during the refresh.
 * Requires the unique index on journey_analytics(client_id) to be present.
 *
 * Logs the result (success or error) to edge_function_logs for observability.
 *
 * @task SYN-678
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _supabaseAdmin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }
  return _supabaseAdmin;
}

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'REFRESH_JOURNEY_ANALYTICS');
  if (!auth.ok) return auth.response;

  const startMs = Date.now();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    logger.error(
      'refresh-journey-analytics: Supabase admin client unavailable'
    );
    return NextResponse.json(
      {
        error:
          'Supabase admin client unavailable — check SUPABASE_SERVICE_ROLE_KEY',
      },
      { status: 500 }
    );
  }

  // Helper: fire-and-forget log to edge_function_logs (table not in generated types)
  const logEvent = async (
    status: string,
    message: string,
    durationMs: number
  ) => {
    try {
      await (supabase as any).from('edge_function_logs').insert({
        function_name: 'refresh-journey-analytics',
        status,
        message,
        metadata: { durationMs },
      });
    } catch {
      /* silent — observability must not block the refresh */
    }
  };

  try {
    // REFRESH MATERIALIZED VIEW CONCURRENTLY — requires unique index on client_id
    // execute_sql is a custom RPC; cast to any as it's outside generated types
    const { error } = await (supabase as any).rpc('execute_sql', {
      sql: 'REFRESH MATERIALIZED VIEW CONCURRENTLY journey_analytics',
    });

    if (error) {
      // execute_sql RPC may not exist in all Supabase projects.
      logger.warn('refresh-journey-analytics: execute_sql RPC unavailable', {
        error: (error as { message: string }).message,
      });

      await logEvent(
        'warning',
        `execute_sql RPC unavailable: ${(error as { message: string }).message}`,
        Date.now() - startMs
      );

      return NextResponse.json(
        {
          success: false,
          view: 'journey_analytics',
          warning:
            'execute_sql RPC not available — run REFRESH MATERIALIZED VIEW CONCURRENTLY journey_analytics manually or schedule via pg_cron',
          durationMs: Date.now() - startMs,
        },
        { status: 200 }
      );
    }

    const durationMs = Date.now() - startMs;
    await logEvent('success', 'journey_analytics view refreshed', durationMs);
    logger.info('refresh-journey-analytics: view refreshed', { durationMs });

    return NextResponse.json({
      success: true,
      view: 'journey_analytics',
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    await logEvent('error', message, durationMs);
    logger.error('refresh-journey-analytics: unexpected error', {
      message,
      durationMs,
    });
    return NextResponse.json({ error: message, durationMs }, { status: 500 });
  }
}
