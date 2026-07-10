/**
 * assertGatePassed — deterministic, fail-closed gate enforcer — nexus-viral
 * productionise WS3b (SYN-1075, spec §8(3) / §15(3)).
 *
 * Reads the latest MarketingAgencyQaReport for (assetRef, gate) and resolves
 * only when a row exists AND its status is 'passed'. A 'blocked' row, or the
 * ABSENCE of a row, is a FAIL — never a pass. This is what makes an agent's
 * "8/8 verdict" inert until read by deterministic code: the verdict must have
 * been persisted as a QA row for this enforcer to ever pass.
 *
 * NOTE (schema-fit blocker, see ./index.ts + PR body): QA-row persistence is
 * currently skipped whenever a gate run has no real campaignId
 * (MarketingAgencyQaReport.campaignId is a required FK with no asset/video-ref
 * column). Until that is resolved, assertGatePassed will fail closed for any
 * asset whose gate run had no campaignId — this is the intended, conservative
 * behaviour of a fail-closed enforcer, not a bug in this file.
 *
 * FAIL is terminal for the caller — no auto-retry/re-judge loop lives here.
 * On FAIL, exactly one alert is emitted via captureServerException (guarded
 * by isSentryServerEnabled; never `@sentry/nextjs` directly).
 */

import { prisma } from '@/lib/prisma';
import { captureServerException, isSentryServerEnabled } from '@/lib/observability/sentry-server';
import { GateFailedError, type GateName } from './types';

/**
 * Resolve the gate verdict for assetRef and throw GateFailedError unless the
 * latest matching QA report has status 'passed'.
 */
export async function assertGatePassed(assetRef: string, gate: GateName): Promise<void> {
  const row = await prisma.marketingAgencyQaReport.findFirst({
    where: {
      AND: [
        { metadata: { path: ['assetRef'], equals: assetRef } },
        { metadata: { path: ['gate'], equals: gate } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) {
    const err = new GateFailedError(gate, assetRef, ['no_qa_report_found']);
    alertOnce(err, gate, assetRef);
    throw err;
  }

  if (row.status !== 'passed') {
    const blockedReasons = normaliseReasons(row.blockedReasons);
    const err = new GateFailedError(gate, assetRef, blockedReasons);
    alertOnce(err, gate, assetRef);
    throw err;
  }

  // status === 'passed' — resolve.
}

function normaliseReasons(blockedReasons: unknown): string[] {
  if (Array.isArray(blockedReasons)) {
    return blockedReasons.map(r => (typeof r === 'string' ? r : JSON.stringify(r)));
  }
  return [];
}

function alertOnce(err: GateFailedError, gate: GateName, assetRef: string): void {
  if (!isSentryServerEnabled()) return;
  captureServerException(err, {
    operation: 'video/gates/assertGatePassed',
    level: 'error',
    tags: { gate, assetRef },
  });
}

export { GateFailedError } from './types';
export type { GateName } from './types';
