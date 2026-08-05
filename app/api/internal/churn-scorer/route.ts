/**
 * POST /api/internal/churn-scorer
 *
 * Nightly churn risk scoring for active client organisations.
 * Invoked by Vercel cron (/api/cron/churn-scorer) or legacy edge proxies.
 *
 * Auth: CRON_SECRET bearer token.
 * SYN-618 | AT-023
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { runChurnScoring } from '@/lib/retention/churn-scorer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  trigger: z.string().optional(),
  scope: z
    .enum(['all_organizations'])
    .or(z.string().min(1))
    .default('all_organizations'),
});

export async function POST(request: NextRequest) {
  const auth = verifyCronRequest(request, 'CHURN_SCORER');
  if (!auth.ok) return auth.response;

  const start = Date.now();
  let trigger = 'manual';
  let scope: 'all_organizations' | string = 'all_organizations';

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    trigger = parsed.data.trigger ?? 'manual';
    scope = parsed.data.scope;
  } catch {
    // Empty body is valid — defaults apply.
  }

  logger.info('[churn-scorer] Starting run', { trigger, scope });

  try {
    const result = await runChurnScoring(scope);
    const durationMs = Date.now() - start;

    logger.info('[churn-scorer] Run complete', {
      trigger,
      scope,
      processed: result.processed,
      scored: result.scored,
      insufficientData: result.insufficientData,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      trigger,
      scope,
      ...result,
      durationMs,
    });
  } catch (err) {
    logger.error('[churn-scorer] Fatal error', err);
    return NextResponse.json(
      { error: 'Churn scoring failed' },
      { status: 500 }
    );
  }
}
