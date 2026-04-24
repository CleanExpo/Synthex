/**
 * POST /api/internal/process-publish-queue
 *
 * Internal endpoint called by the Supabase Edge Function every 15 minutes.
 * Runs the publish queue orchestrator (processPublishQueue) in the Node.js
 * runtime with full Prisma + encryption access.
 *
 * Wrapped in createEdgeFunctionRunner for structured logging to edge_function_logs
 * and automatic retry on transient failures.
 *
 * Auth: Bearer CRON_SECRET (same pattern as /api/cron/generate-calendars)
 * SYN-523 | Observability: SYN-628
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEdgeFunctionRunner } from '@/lib/pipelines/runner';
import type { AutoCalendarMetadata } from '@/lib/pipelines/metadata-schemas';
import {
  processPublishQueue,
  ProcessQueueResult,
} from '@/lib/publish/publishQueue';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';

// Allow up to 5 minutes (Edge Function max for this type of work)
export const maxDuration = 300;

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Single aggregate run — processes the entire publish queue in one pass.
 * Uses clientId = 'all-orgs' since the queue spans all organisations.
 */
const autoCalendarRunner = createEdgeFunctionRunner<
  { trigger: string },
  ProcessQueueResult
>(
  'auto-calendar',
  async (_input: { trigger: string }): Promise<ProcessQueueResult> => {
    return processPublishQueue();
  },
  (
    output: ProcessQueueResult
  ): { valid: boolean; metadata: Record<string, unknown> } => {
    // A run with some failures is normal — only mark invalid if processing itself broke
    const valid = output.processed >= 0;

    const metadata: AutoCalendarMetadata = {
      posts_scheduled: output.published,
      posts_failed: output.failed,
      // avg_content_length is not yet tracked by processPublishQueue — placeholder
      avg_content_length: 0,
    };

    return { valid, metadata };
  }
);

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'PROCESS_PUBLISH_QUEUE');
  if (!auth.ok) return auth.response;

  const runResult = await autoCalendarRunner.run([
    { clientId: 'all-orgs', input: { trigger: 'cron' } },
  ]);

  const output = runResult.outputs[0]?.output;

  logger.info('[process-publish-queue] Run complete', {
    runId: runResult.runId,
    status: runResult.status,
    processed: output?.processed ?? 0,
    published: output?.published ?? 0,
    failed: output?.failed ?? 0,
    held: output?.held ?? 0,
    durationMs: runResult.durationMs,
  });

  return NextResponse.json({
    ok: true,
    runId: runResult.runId,
    status: runResult.status,
    processed: output?.processed ?? 0,
    published: output?.published ?? 0,
    failed: output?.failed ?? 0,
    held: output?.held ?? 0,
    skipped: output?.skipped ?? 0,
    durationMs: runResult.durationMs,
  });
}
