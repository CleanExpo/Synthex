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

import { createClient } from '@supabase/supabase-js';
import type { CalibrationState, ScoreIssueParams } from '@/lib/intelligence/types';

// ── Supabase admin singleton ──────────────────────────────────────────────────

let _admin: ReturnType<typeof createClient> | null = null;

function getAdmin() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('[accuracy-ledger] Missing SUPABASE env vars');
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

// ── recordScoreIssued ─────────────────────────────────────────────────────────

/**
 * Inserts a row into `score_accuracy_events` marking that a score was issued.
 *
 * Designed to be called as the **final step** in every scoring pipeline.
 * Never throws — a telemetry failure should not abort the scoring pipeline.
 *
 * @param params - Score issue metadata
 */
export async function recordScoreIssued(params: ScoreIssueParams): Promise<void> {
  try {
    const admin = getAdmin();
    const { error } = await (admin as ReturnType<typeof createClient<any>>)
      .from('score_accuracy_events')
      .insert({
      client_id:               params.clientId,
      score_domain:            params.domain,
      score_value:             params.scoreValue,
      confidence:              params.confidence,
      calibration_data_points: params.calibrationDataPoints,
      entity_id:               params.entityId,
      issued_at:               new Date().toISOString(),
      sprint_version:          params.sprintVersion ?? null,
    });

    if (error) {
      console.error('[accuracy-ledger] recordScoreIssued insert error:', error.message);
    }
  } catch (err) {
    // Telemetry failure — log and continue; never propagate
    console.error('[accuracy-ledger] recordScoreIssued unexpected error:', err);
  }
}

// ── getScoreCalibration ───────────────────────────────────────────────────────

/**
 * Returns the current calibration state for a client + domain pair.
 *
 * Calls the `get_score_calibration` Supabase RPC which computes:
 * - data_points: matched outcome events
 * - accuracy_rate: fraction within 15 percentile points of actual
 * - meets_threshold: whether calibration threshold has been crossed
 *
 * Returns a safe default `CalibrationState` on any error — scoring pipelines
 * can always produce a score even when calibration data is unavailable.
 *
 * @param clientId    - Organization UUID
 * @param domain      - Scoring domain ('content' | 'geo' | 'health')
 */
export async function getScoreCalibration(
  clientId: string,
  domain: 'content' | 'geo' | 'health'
): Promise<CalibrationState> {
  const thresholds = { content: 10, geo: 5, health: 8 } as const;
  const thresholdRequired = thresholds[domain];

  const defaultState: CalibrationState = {
    dataPoints:        0,
    meetsThreshold:    false,
    thresholdRequired,
    accuracyRate:      null,
    firstScoredAt:     null,
    calibrationSummary: buildSummary(domain, 0, false),
  };

  try {
    const admin = getAdmin();
    const { data, error } = await (admin as ReturnType<typeof createClient<any>>)
      .rpc('get_score_calibration', {
        p_client_id: clientId,
        p_domain:    domain,
      });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return defaultState;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const dataPoints       = (row.data_points as number) ?? 0;
    const meetsThreshold   = (row.meets_threshold as boolean) ?? false;
    const accuracyRate     = (row.accuracy_rate as number | null) ?? null;
    const firstScoredAt    = (row.first_scored_at as string | null) ?? null;

    return {
      dataPoints,
      meetsThreshold,
      thresholdRequired: (row.threshold_required as number) ?? thresholdRequired,
      accuracyRate,
      firstScoredAt,
      calibrationSummary: buildSummary(domain, dataPoints, meetsThreshold),
    };
  } catch (err) {
    console.error('[accuracy-ledger] getScoreCalibration error:', err);
    return defaultState;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds the plain-English calibration summary shown in the score card subtitle.
 * Always returns a non-empty string.
 */
function buildSummary(
  domain: 'content' | 'geo' | 'health',
  dataPoints: number,
  meetsThreshold: boolean
): string {
  if (meetsThreshold && dataPoints > 0) {
    const subject =
      domain === 'content' ? 'your posts' :
      domain === 'geo'     ? 'your local search data' :
                             'your marketing activity';
    return `Based on ${dataPoints} data points from ${subject}`;
  }

  return 'Calibration in progress — collecting data from your posts';
}
