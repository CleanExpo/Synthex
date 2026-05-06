/**
 * HERMES discovery sweep (SYN-911 / HER-1c)
 *
 * Runs once per org per cron tick. Three signal checks fire in parallel via
 * Promise.allSettled — a single check failure never blocks the others.
 *
 * H-1 scope:
 *   1. traffic_drop  — REAL. Reads HermesConfig.metadata.trafficBaseline,
 *                      compares against today's value, flags >30% drop as urgent.
 *                      Requires manual baseline seed — see ./README.md.
 *   2. competitor    — STUB returning []. Wired in HER-2.
 *   3. regulatory    — STUB returning []. Wired in HER-2.
 *
 * Urgent signals fire sendEscalation({channel:TELEGRAM, priority:'urgent'}).
 * Routine signals are written to hermes_discovery_signal only — the gap engine
 * reads them on the next tick.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  sendEscalation,
  NotificationChannel,
} from '@/lib/alerts/notification-channels';

const TRAFFIC_DROP_THRESHOLD = 0.3; // 30% drop → urgent

export interface DiscoveredSignal {
  organizationId: string;
  signalType: 'traffic_drop' | 'competitor' | 'regulatory' | 'gap';
  source: string;
  payload: Record<string, unknown>;
  severity: 'routine' | 'urgent';
}

export interface SweepResult {
  signalsWritten: number;
  urgentEscalated: number;
  trafficCheckOutcome: 'ok' | 'baseline_unseeded' | 'no_current_value';
  failures: Array<{ check: string; error: string }>;
}

interface BaselinePoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface HermesMetadata {
  trafficBaseline?: BaselinePoint[];
  trafficBaselineSource?: string;
  currentTrafficValue?: number; // H-1 hand-seeded; HER-2 will pull live from GSC
}

/**
 * Compare current traffic value against the rolling baseline mean. Returns
 * a signal record if the drop is >= TRAFFIC_DROP_THRESHOLD, otherwise null.
 *
 * Pure function — no I/O. Exported for unit tests.
 */
export function detectTrafficDrop(
  organizationId: string,
  baseline: BaselinePoint[],
  currentValue: number,
  baselineSource?: string
): DiscoveredSignal | null {
  if (baseline.length === 0) return null;

  const baselineMean =
    baseline.reduce((sum, p) => sum + p.value, 0) / baseline.length;

  if (baselineMean <= 0) return null; // can't compute % drop from zero baseline

  const deltaPct = (currentValue - baselineMean) / baselineMean;

  if (deltaPct > -TRAFFIC_DROP_THRESHOLD) return null; // not a meaningful drop

  return {
    organizationId,
    signalType: 'traffic_drop',
    source: baselineSource ?? 'hermes:traffic_check',
    payload: {
      baselineMean,
      currentValue,
      deltaPct,
      baselinePoints: baseline.length,
    },
    severity: 'urgent',
  };
}

async function checkTrafficSignal(
  orgId: string,
  metadata: HermesMetadata
): Promise<{
  signal: DiscoveredSignal | null;
  outcome: SweepResult['trafficCheckOutcome'];
}> {
  const baseline = metadata.trafficBaseline ?? [];
  if (baseline.length === 0) {
    logger.warn(
      '[hermes:sweep] Traffic baseline unseeded — no-op (see lib/hermes/discovery/README.md)',
      { orgId }
    );
    return { signal: null, outcome: 'baseline_unseeded' };
  }

  const currentValue = metadata.currentTrafficValue;
  if (typeof currentValue !== 'number') {
    logger.warn(
      '[hermes:sweep] No currentTrafficValue in HermesConfig.metadata — skipping drop check',
      { orgId }
    );
    return { signal: null, outcome: 'no_current_value' };
  }

  return {
    signal: detectTrafficDrop(
      orgId,
      baseline,
      currentValue,
      metadata.trafficBaselineSource
    ),
    outcome: 'ok',
  };
}

// TODO HER-2: wire competitor monitoring (GBP review-rate inversion + LinkedIn
// share-of-voice + manual competitor URLs from BrandConfig).
async function checkCompetitorSignal(
  _orgId: string
): Promise<DiscoveredSignal[]> {
  return [];
}

// TODO HER-2: wire ACCC + ASIC + industry-association feeds (RSS or scraper).
async function checkRegulatorySignal(
  _orgId: string
): Promise<DiscoveredSignal[]> {
  return [];
}

/**
 * Run the full discovery sweep for one org. Writes detected signals to
 * hermes_discovery_signal. Fires Telegram escalation for any urgent signal.
 */
export async function runDiscoverySweepForOrg(
  orgId: string,
  metadata: HermesMetadata
): Promise<SweepResult> {
  const failures: SweepResult['failures'] = [];

  const [trafficResult, competitorResult, regulatoryResult] =
    await Promise.allSettled([
      checkTrafficSignal(orgId, metadata),
      checkCompetitorSignal(orgId),
      checkRegulatorySignal(orgId),
    ]);

  const signals: DiscoveredSignal[] = [];
  let trafficCheckOutcome: SweepResult['trafficCheckOutcome'] = 'ok';

  if (trafficResult.status === 'fulfilled') {
    trafficCheckOutcome = trafficResult.value.outcome;
    if (trafficResult.value.signal) signals.push(trafficResult.value.signal);
  } else {
    failures.push({
      check: 'traffic',
      error: String(trafficResult.reason),
    });
  }

  if (competitorResult.status === 'fulfilled') {
    signals.push(...competitorResult.value);
  } else {
    failures.push({
      check: 'competitor',
      error: String(competitorResult.reason),
    });
  }

  if (regulatoryResult.status === 'fulfilled') {
    signals.push(...regulatoryResult.value);
  } else {
    failures.push({
      check: 'regulatory',
      error: String(regulatoryResult.reason),
    });
  }

  if (signals.length === 0) {
    return {
      signalsWritten: 0,
      urgentEscalated: 0,
      trafficCheckOutcome,
      failures,
    };
  }

  // Single transaction — all-or-nothing write per sweep so a partial failure
  // doesn't leave half the signals visible to the gap engine.
  await prisma.$transaction(
    signals.map(s =>
      prisma.hermesDiscoverySignal.create({
        data: {
          organizationId: s.organizationId,
          signalType: s.signalType,
          source: s.source,
          payload: s.payload as object,
          severity: s.severity,
        },
      })
    )
  );

  // Escalate urgent signals — best-effort. Failure here does not roll back
  // the signal writes; the gap engine still gets to see them next tick.
  let urgentEscalated = 0;
  for (const s of signals.filter(x => x.severity === 'urgent')) {
    const result = await sendEscalation({
      channel: NotificationChannel.TELEGRAM,
      message: composeUrgentMessage(s),
      priority: 'urgent',
      fallback: NotificationChannel.LINEAR,
      context: { signal: s },
    });
    if (result.sent) urgentEscalated += 1;
  }

  return {
    signalsWritten: signals.length,
    urgentEscalated,
    trafficCheckOutcome,
    failures,
  };
}

function composeUrgentMessage(signal: DiscoveredSignal): string {
  switch (signal.signalType) {
    case 'traffic_drop': {
      const p = signal.payload as {
        baselineMean: number;
        currentValue: number;
        deltaPct: number;
      };
      const dropPct = Math.round(Math.abs(p.deltaPct) * 100);
      return `HERMES traffic drop: ${dropPct}% below baseline (org ${signal.organizationId}). Baseline ${p.baselineMean.toFixed(0)} → current ${p.currentValue.toFixed(0)}.`;
    }
    case 'competitor':
      return `HERMES competitor signal (org ${signal.organizationId}): ${signal.source}`;
    case 'regulatory':
      return `HERMES regulatory signal (org ${signal.organizationId}): ${signal.source}`;
    default:
      return `HERMES signal (org ${signal.organizationId}): ${signal.signalType} from ${signal.source}`;
  }
}
