/**
 * HERMES weekly digest cron — SYN-913 / HER-1e
 *
 * GET /api/cron/hermes-digest
 * Schedule: 0 22 * * 0 UTC (Sunday 22:00 UTC = Monday 08:00 AEST / 09:00 AEDT).
 * First working day of the week, before the team reviews the Calendar queue.
 *
 * For each org with HermesConfig.enabled=true:
 *   1. Build last 7 days of metrics (READ-ONLY — zero writes to content tables)
 *   2. Format as plain-text digest (Grade 4 readable, no markdown)
 *   3. Send via sendEscalation({ channel: TELEGRAM, priority: 'routine' })
 *   4. Log full metrics object to Vercel logs for archival
 *
 * The success metric — hours of human work eliminated per week — is credited
 * only when posts.source='hermes' reaches status='published'. The aggregator
 * enforces that exactly. Pending proposals are reported separately as
 * informational, not credited.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import {
  sendEscalation,
  NotificationChannel,
} from '@/lib/alerts/notification-channels';
import { brands, type BrandSlug } from '@unite-group/brand-config';
import {
  buildWeeklyMetrics,
  formatWeeklyDigest,
  type HermesWeeklyMetrics,
} from '@/lib/hermes/metrics/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface OrgDigestResult {
  orgId: string;
  brandSlug: string;
  outcome: 'sent' | 'no_brand' | 'send_failed';
  metricsSummary?: {
    proposalsGenerated: number;
    postsPublished: number;
    postsPendingApproval: number;
    estimatedMinutesEliminated: number;
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'HERMES_DIGEST');
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  logger.info('cron:hermes-digest:start', {
    timestamp: new Date().toISOString(),
  });

  const configs = await prisma.hermesConfig.findMany({
    where: { enabled: true },
    select: { organizationId: true, brandSlug: true },
  });

  const results: OrgDigestResult[] = [];
  let orgsReported = 0;

  for (const config of configs) {
    const brand = brands[config.brandSlug as BrandSlug];
    if (!brand) {
      results.push({
        orgId: config.organizationId,
        brandSlug: config.brandSlug,
        outcome: 'no_brand',
      });
      continue;
    }

    let metrics: HermesWeeklyMetrics;
    try {
      metrics = await buildWeeklyMetrics(config.organizationId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('cron:hermes-digest:aggregator-error', {
        orgId: config.organizationId,
        error: errorMessage,
      });
      results.push({
        orgId: config.organizationId,
        brandSlug: config.brandSlug,
        outcome: 'send_failed',
        error: `aggregator: ${errorMessage}`,
      });
      continue;
    }

    const digest = formatWeeklyDigest(metrics, brand.displayName);

    // Log the full metrics object to Vercel logs for archival before send.
    logger.info('cron:hermes-digest:metrics', {
      orgId: config.organizationId,
      brandSlug: config.brandSlug,
      metrics,
    });

    const escalation = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: digest,
      priority: 'routine',
      // Linear fallback is unnecessary for the digest — a missed weekly send is
      // recoverable from the Vercel logs above. Telegram-only keeps the digest
      // out of Linear noise during a Telegram outage.
      context: { orgId: config.organizationId },
    });

    if (escalation.sent) {
      orgsReported += 1;
      results.push({
        orgId: config.organizationId,
        brandSlug: config.brandSlug,
        outcome: 'sent',
        metricsSummary: {
          proposalsGenerated: metrics.proposalsGenerated,
          postsPublished: metrics.postsPublished,
          postsPendingApproval: metrics.postsPendingApproval,
          estimatedMinutesEliminated: metrics.estimatedMinutesEliminated,
        },
      });
    } else {
      results.push({
        orgId: config.organizationId,
        brandSlug: config.brandSlug,
        outcome: 'send_failed',
        error: escalation.error,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('cron:hermes-digest:end', {
    durationMs,
    orgsReported,
    orgsAttempted: configs.length,
  });

  return NextResponse.json({
    success: true,
    orgsReported,
    durationMs,
    results,
  });
}
