/**
 * HERMES discovery cron — SYN-911 / HER-1c
 *
 * GET /api/cron/hermes-discover
 * Schedule: 0 16 * * * UTC (daily 02:00 AEST / 03:00 AEDT).
 *
 * For each org with HermesConfig.enabled=true:
 *   1. Resolve the Owner-role impersonated author (skip + LINEAR escalate if missing)
 *   2. Run the discovery sweep — write hermes_discovery_signal rows
 *   3. Run the gap engine — write hermes_gap_candidate rows up to soft cap
 *   4. Update HermesConfig.lastRunAt + nextRunAt
 *
 * Per-org errors are caught and counted — never abort the loop.
 *
 * Mirrors the structure of /api/cron/autopilot — same auth pattern, same
 * per-org isolation, same failure model.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { resolveImpersonatedAuthor } from '@/lib/hermes/orgs';
import { runDiscoverySweepForOrg } from '@/lib/hermes/discovery/sweep';
import { runGapEngineForOrg } from '@/lib/hermes/gaps/engine';
import {
  sendEscalation,
  NotificationChannel,
} from '@/lib/alerts/notification-channels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — bound LLM call latency × org count

interface OrgResult {
  orgId: string;
  outcome: 'processed' | 'skipped_no_owner' | 'error';
  signalsWritten?: number;
  urgentEscalated?: number;
  candidatesCreated?: number;
  signalsConsidered?: number;
  trafficCheckOutcome?: string;
  error?: string;
}

interface HermesMetadata {
  trafficBaseline?: Array<{ date: string; value: number }>;
  trafficBaselineSource?: string;
  currentTrafficValue?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronRequest(request, 'HERMES_DISCOVER');
  if (!auth.ok) return auth.response;

  const startedAt = Date.now();
  logger.info('cron:hermes-discover:start', {
    timestamp: new Date().toISOString(),
  });

  const configs = await prisma.hermesConfig.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      dailyQuota: true,
      metadata: true,
    },
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const results: OrgResult[] = [];

  for (const config of configs) {
    const orgId = config.organizationId;

    try {
      const userId = await resolveImpersonatedAuthor(orgId);
      if (!userId) {
        // No Owner — escalate to Linear, skip the org. Audible skip, not silent.
        await sendEscalation({
          channel: NotificationChannel.LINEAR,
          message: `HERMES: org ${orgId} skipped — no active Owner-role user. Cron cannot impersonate an author.`,
          priority: 'routine',
          context: { orgId, hermesConfigId: config.id },
        });
        skipped += 1;
        results.push({ orgId, outcome: 'skipped_no_owner' });
        continue;
      }

      const metadata = (config.metadata ?? {}) as HermesMetadata;
      const sweep = await runDiscoverySweepForOrg(orgId, metadata);
      const gaps = await runGapEngineForOrg(orgId, config.dailyQuota);

      // Mark cron run completion. nextRunAt = now + 24h (matches the daily
      // schedule). HER-3 lifts to 6h — change here when the cadence changes.
      const now = new Date();
      const nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await prisma.hermesConfig.update({
        where: { id: config.id },
        data: { lastRunAt: now, nextRunAt },
      });

      processed += 1;
      results.push({
        orgId,
        outcome: 'processed',
        signalsWritten: sweep.signalsWritten,
        urgentEscalated: sweep.urgentEscalated,
        candidatesCreated: gaps.candidatesCreated,
        signalsConsidered: gaps.signalsConsidered,
        trafficCheckOutcome: sweep.trafficCheckOutcome,
      });
    } catch (err) {
      errors += 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('cron:hermes-discover:org-error', {
        orgId,
        error: errorMessage,
      });
      results.push({ orgId, outcome: 'error', error: errorMessage });

      // Routine Linear escalation so the failure is visible in the next digest.
      // Best-effort — do not let escalation failure mask the original error.
      try {
        await sendEscalation({
          channel: NotificationChannel.LINEAR,
          message: `HERMES discovery sweep failed for org ${orgId}: ${errorMessage}`,
          priority: 'routine',
          context: { orgId, hermesConfigId: config.id },
        });
      } catch {
        // already logged inside sendEscalation
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info('cron:hermes-discover:end', {
    durationMs,
    orgsProcessed: processed,
    orgsSkipped: skipped,
    orgsErrored: errors,
  });

  return NextResponse.json({
    success: true,
    processed,
    skipped,
    errors,
    durationMs,
    results,
  });
}
