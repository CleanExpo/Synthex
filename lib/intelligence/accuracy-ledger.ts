/**
 * Score Accuracy Ledger — SYN-669
 *
 * Two-function module that closes the loop between scores issued and actual
 * outcomes measured by the nightly score-accuracy-matcher (SYN-670).
 *
 * Usage in a scoring Edge Function / internal route:
 *
 *   import { recordScoreIssued } from '@/lib/intelligence/accuracy-ledger';
 *
 *   // After computing and saving the score — final step, never throws:
 *   await recordScoreIssued({
 *     clientId:               org.id,
 *     domain:                 'content',
 *     scoreValue:             computed.total,
 *     confidence:             computed.confidence,
 *     calibrationDataPoints:  computed.calibration.dataPoints,
 *     entityId:               org.id,
 *     sprintVersion:          'sprint-7',
 *   });
 */

import type {
  CalibrationState,
  ScoreIssueParams,
} from '@/lib/intelligence/types';

// ── Not provisioned ───────────────────────────────────────────────────────────
//
// `score_accuracy_events` and the `get_score_calibration` RPC have no Prisma
// model, so the ledger cannot record or read. Both functions keep their
// never-throw contract but say so explicitly instead of dropping silently.

const LEDGER_TABLE = 'score_accuracy_events';

/** Explicit outcome of {@link recordScoreIssued}. */
export interface ScoreLedgerResult {
  recorded: false;
  reason: 'FEATURE_NOT_PROVISIONED';
  table: typeof LEDGER_TABLE;
}

// ── recordScoreIssued ─────────────────────────────────────────────────────────

/**
 * Would insert a row into `score_accuracy_events` marking that a score was
 * issued. The table is not provisioned, so it returns `recorded: false` with
 * the reason and logs a warning — never a silent drop.
 *
 * Never throws — a telemetry failure should not abort the scoring pipeline.
 *
 * @param params - Score issue metadata
 */
export async function recordScoreIssued(
  params: ScoreIssueParams
): Promise<ScoreLedgerResult> {
  console.warn(
    `[accuracy-ledger] recordScoreIssued not recorded: ${LEDGER_TABLE} is not provisioned`,
    { clientId: params.clientId, domain: params.domain }
  );
  return {
    recorded: false,
    reason: 'FEATURE_NOT_PROVISIONED',
    table: LEDGER_TABLE,
  };
}

// ── getScoreCalibration ───────────────────────────────────────────────────────

/**
 * Returns the calibration state for a client + domain pair.
 *
 * The ledger is not provisioned, so this always returns zero data points,
 * `meetsThreshold: false`, and a summary that says calibration is unavailable.
 * Scoring pipelines can still produce a score; they just cannot claim it is
 * calibrated.
 *
 * @param _clientId   - Organization UUID
 * @param domain      - Scoring domain ('content' | 'geo' | 'health')
 */
export async function getScoreCalibration(
  _clientId: string,
  domain: 'content' | 'geo' | 'health'
): Promise<CalibrationState> {
  const thresholds = { content: 10, geo: 5, health: 8 } as const;

  return {
    dataPoints: 0,
    meetsThreshold: false,
    thresholdRequired: thresholds[domain],
    accuracyRate: null,
    firstScoredAt: null,
    calibrationSummary:
      'Calibration unavailable — the accuracy ledger is not provisioned',
  };
}
