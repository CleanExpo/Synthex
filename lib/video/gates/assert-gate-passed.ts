/**
 * assertGatePassed — deterministic, fail-closed gate enforcer — nexus-viral
 * productionise WS3b (SYN-1075, spec §8(3) / §15(3)).
 *
 * Reads the latest `video_gate_verdicts` row for (ref, gate) and resolves only
 * when a row exists AND its status is 'passed'. A 'blocked' row, or the
 * ABSENCE of a row, is a FAIL — never a pass. This is what makes an agent's
 * "8/8 verdict" inert until read by deterministic code: the verdict must have
 * been persisted as a video_gate_verdicts row for this enforcer to ever pass
 * (SYN-1094, Option C — replaces the campaign-coupled MarketingAgencyQaReport
 * path so a video gate run persists without a campaignId).
 *
 * FAIL is terminal for the caller — no auto-retry/re-judge loop lives here.
 * On FAIL, exactly one alert is emitted via captureServerException (guarded
 * by isSentryServerEnabled; never `@sentry/nextjs` directly).
 */

import { prisma } from '@/lib/prisma';
import {
  captureServerException,
  isSentryServerEnabled,
} from '@/lib/observability/sentry-server';
import { GateFailedError, type GateName } from './types';

/**
 * Resolve the gate verdict for `ref` and throw GateFailedError unless the
 * latest matching verdict row has status 'passed'.
 */
export async function assertGatePassed(
  ref: string,
  gate: GateName
): Promise<void> {
  const row = await prisma.videoGateVerdict.findFirst({
    where: { ref, gate },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) {
    const err = new GateFailedError(gate, ref, ['no_qa_report_found']);
    alertOnce(err, gate, ref);
    throw err;
  }

  if (row.status !== 'passed') {
    const blockedReasons = normaliseReasons(row.blockedReasons);
    const err = new GateFailedError(gate, ref, blockedReasons);
    alertOnce(err, gate, ref);
    throw err;
  }

  // status === 'passed' — resolve.
}

function normaliseReasons(blockedReasons: unknown): string[] {
  if (Array.isArray(blockedReasons)) {
    return blockedReasons.map(r =>
      typeof r === 'string' ? r : JSON.stringify(r)
    );
  }
  return [];
}

function alertOnce(
  err: GateFailedError,
  gate: GateName,
  assetRef: string
): void {
  if (!isSentryServerEnabled()) return;
  captureServerException(err, {
    operation: 'video/gates/assertGatePassed',
    level: 'error',
    tags: { gate, assetRef },
  });
}

export { GateFailedError } from './types';
export type { GateName } from './types';
