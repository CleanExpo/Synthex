/**
 * Per-location KPI registration — main API for SYN-842.
 *
 * Records performance-attribution snapshots per opened location.
 *
 *   recordKpiSnapshot()        → write a (period × coverage) row
 *   getLatestSnapshot()        → most recent row for a coverage
 *   getCoverageKpiHistory()    → all rows for a coverage, newest first
 *   getRetreatCandidates()     → 90-day zero-attribution coverages
 *
 * Verification rule: a 30-day snapshot with `conversions >= 30` (default)
 * is recorded as `verification_state='verified'` and stamps `verifiedAt`.
 * Anything else stays `'directional'` per Q3.2.3 A2 binding.
 *
 * Retreat rule: a 90-day snapshot exists for a coverage with
 * `conversions === 0 AND clicks === 0` → coverage is a retreat candidate.
 * Caller (NOT this module — NEVER list rule 4 in SYN-839) decides whether
 * to actually pause the budget ledger entry.
 *
 * @see SYN-842 (parent: SYN-834 epic)
 * @see lib/kpi/README.md
 */

import { logger } from '@/lib/logger';
import { supabaseKpiRepository } from './supabase-repository';
import {
  VERIFY_CONVERSIONS_THRESHOLD_DEFAULT,
  type KpiOptions,
  type KpiPeriodDays,
  type KpiRepository,
  type KpiSnapshot,
  type RecordKpiInput,
  type RecordKpiResult,
  type RetreatCandidate,
} from './types';

const VALID_PERIODS: ReadonlySet<KpiPeriodDays> = new Set([7, 30, 90]);

function resolveRepository(opts: KpiOptions = {}): KpiRepository {
  return opts.repository ?? supabaseKpiRepository;
}

function resolveVerifyThreshold(opts: KpiOptions = {}): number {
  if (typeof opts.verifyConversionsThreshold === 'number') {
    return opts.verifyConversionsThreshold;
  }
  const env = process.env.NRPG_KPI_VERIFY_CONVERSIONS_THRESHOLD;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return VERIFY_CONVERSIONS_THRESHOLD_DEFAULT;
}

// ─── RECORD ──────────────────────────────────────────────────────────────

/**
 * Write a single attribution snapshot for a coverage.
 *
 * If `periodDays === 30` AND `conversions >= threshold`, the snapshot is
 * persisted with `verification_state='verified'` and `verifiedAt=now`.
 * Otherwise it stays `'directional'`.
 *
 * @throws Error on validation failure (input rejected before any DB call).
 */
export async function recordKpiSnapshot(
  input: RecordKpiInput,
  opts: KpiOptions = {}
): Promise<RecordKpiResult> {
  validateRecordInput(input);
  const repo = resolveRepository(opts);
  const threshold = resolveVerifyThreshold(opts);

  const conversions = input.conversions ?? 0;
  const isThirtyDay = input.periodDays === 30;
  const promotedToVerified = isThirtyDay && conversions >= threshold;
  const verifiedAt = promotedToVerified ? new Date().toISOString() : null;

  const snapshot = await repo.insert({
    ...input,
    verificationState: promotedToVerified ? 'verified' : 'directional',
    verifiedAt,
  });

  logger.info('[kpi] snapshot recorded', {
    serviceAreaCoverageId: snapshot.serviceAreaCoverageId,
    periodDays: snapshot.periodDays,
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    conversions: snapshot.conversions,
    verificationState: snapshot.verificationState,
  });

  return { snapshot, promotedToVerified };
}

// ─── READ ────────────────────────────────────────────────────────────────

/**
 * Most recent snapshot for a coverage. Optionally filtered by period.
 */
export async function getLatestSnapshot(
  serviceAreaCoverageId: string,
  periodDays?: KpiPeriodDays,
  opts: KpiOptions = {}
): Promise<KpiSnapshot | null> {
  if (!serviceAreaCoverageId) {
    throw new Error('getLatestSnapshot: serviceAreaCoverageId required');
  }
  if (typeof periodDays === 'number' && !VALID_PERIODS.has(periodDays)) {
    throw new Error(
      `getLatestSnapshot: periodDays must be 7, 30, or 90 (got ${periodDays})`
    );
  }
  const repo = resolveRepository(opts);
  return repo.findLatestForCoverage(serviceAreaCoverageId, periodDays);
}

/**
 * All snapshots for a coverage, newest first.
 */
export async function getCoverageKpiHistory(
  serviceAreaCoverageId: string,
  opts: KpiOptions = {}
): Promise<KpiSnapshot[]> {
  if (!serviceAreaCoverageId) {
    throw new Error('getCoverageKpiHistory: serviceAreaCoverageId required');
  }
  const repo = resolveRepository(opts);
  return repo.findAllForCoverage(serviceAreaCoverageId);
}

// ─── RETREAT CANDIDATES ──────────────────────────────────────────────────

/**
 * Coverages whose latest 90-day snapshot shows zero attribution
 * (`clicks === 0 AND conversions === 0`).
 *
 * Read-only. Does NOT pause anything — caller (or operator) decides whether
 * to act on the list, per NEVER list rule 4 in SYN-839.
 */
export async function getRetreatCandidates(
  opts: KpiOptions = {}
): Promise<RetreatCandidate[]> {
  const repo = resolveRepository(opts);
  const latest = await repo.listLatestNinetyDayPerCoverage();
  return latest
    .filter(s => s.clicks === 0 && s.conversions === 0)
    .map(s => ({
      serviceAreaCoverageId: s.serviceAreaCoverageId,
      latestNinetyDaySnapshot: s,
    }));
}

// ─── VALIDATION ──────────────────────────────────────────────────────────

function validateRecordInput(input: RecordKpiInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('recordKpiSnapshot: input required');
  }
  if (!input.serviceAreaCoverageId) {
    throw new Error('recordKpiSnapshot: serviceAreaCoverageId required');
  }
  if (!VALID_PERIODS.has(input.periodDays)) {
    throw new Error(
      `recordKpiSnapshot: periodDays must be 7, 30, or 90 (got ${input.periodDays})`
    );
  }
  for (const [key, value] of [
    ['impressions', input.impressions],
    ['clicks', input.clicks],
    ['conversions', input.conversions],
    ['revenueAud', input.revenueAud],
  ] as const) {
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(
        `recordKpiSnapshot: ${key} must be a non-negative finite number (got ${value})`
      );
    }
  }
}
