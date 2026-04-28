/**
 * Per-location budget ledger — main API for SYN-839.
 *
 * Gates the SYN-834 trigger pipeline: every new opened location commits a
 * $55/mo ledger entry (configurable). Refuses to commit when monthly cap
 * exceeded. Per-contractor cap enforced separately.
 *
 * @see SYN-839 (parent: SYN-834 epic)
 * @see lib/budget/README.md
 */

import { logger } from '@/lib/logger';
import { supabaseBudgetLedgerRepository } from './supabase-repository';
import {
  MONTHLY_AMOUNT_AUD_DEFAULT,
  type BudgetLedgerRepository,
  type CapCheckResult,
  type CommitLocationInput,
  type CommitLocationResult,
  type LedgerEntry,
  type LedgerOptions,
  type MonthlyUtilisation,
} from './types';

const DEFAULT_MONTHLY_CAP_AUD = 10_000;
const DEFAULT_PER_CONTRACTOR_CAP_AUD = 3_000;

function resolveRepository(opts: LedgerOptions = {}): BudgetLedgerRepository {
  return opts.repository ?? supabaseBudgetLedgerRepository;
}

function resolveMonthlyCap(opts: LedgerOptions = {}): number {
  if (typeof opts.monthlyCapAud === 'number') return opts.monthlyCapAud;
  const env = process.env.NRPG_LOCATION_BUDGET_CAP_AUD;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MONTHLY_CAP_AUD;
}

function resolvePerContractorCap(opts: LedgerOptions = {}): number {
  if (typeof opts.perContractorCapAud === 'number')
    return opts.perContractorCapAud;
  const env = process.env.NRPG_PER_CONTRACTOR_BUDGET_CAP_AUD;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_PER_CONTRACTOR_CAP_AUD;
}

// ─── HEADROOM CHECKS ─────────────────────────────────────────────────────

/**
 * Read-only check: is there room in the monthly cap for `amountAud` more?
 */
export async function canCommitMonthlyBudget(
  amountAud: number,
  opts: LedgerOptions = {}
): Promise<CapCheckResult> {
  if (!Number.isFinite(amountAud) || amountAud <= 0) {
    return { ok: false, remainingAud: 0, reason: 'amountAud must be > 0' };
  }
  const repo = resolveRepository(opts);
  const cap = resolveMonthlyCap(opts);
  const committed = await repo.sumActiveMonthlyAud();
  const remainingAud = cap - committed;
  if (remainingAud < amountAud) {
    return {
      ok: false,
      remainingAud,
      reason: `monthly cap exceeded — cap=${cap} committed=${committed} requesting=${amountAud} remaining=${remainingAud}`,
    };
  }
  return { ok: true, remainingAud };
}

/**
 * Read-only check: is there room in this contractor's cap for `amountAud` more?
 */
export async function canCommitForContractor(
  contractorId: string,
  amountAud: number,
  opts: LedgerOptions = {}
): Promise<CapCheckResult> {
  if (!contractorId) {
    return { ok: false, remainingAud: 0, reason: 'contractorId required' };
  }
  if (!Number.isFinite(amountAud) || amountAud <= 0) {
    return { ok: false, remainingAud: 0, reason: 'amountAud must be > 0' };
  }
  const repo = resolveRepository(opts);
  const cap = resolvePerContractorCap(opts);
  const committed = await repo.sumActiveMonthlyAudForContractor(contractorId);
  const remainingAud = cap - committed;
  if (remainingAud < amountAud) {
    return {
      ok: false,
      remainingAud,
      reason: `per-contractor cap exceeded for ${contractorId} — cap=${cap} committed=${committed} requesting=${amountAud} remaining=${remainingAud}`,
    };
  }
  return { ok: true, remainingAud };
}

// ─── COMMIT ──────────────────────────────────────────────────────────────

/**
 * Commit a new ledger entry for an opened location. Idempotent on
 * `serviceAreaCoverageId` — repeat calls with the same coverage ID return
 * the existing entry and do NOT double-charge the cap.
 *
 * Refuses to commit if the monthly cap or per-contractor cap is exceeded.
 *
 * @throws Error on validation failure (input rejected before any DB call).
 */
export async function commitLocation(
  input: CommitLocationInput,
  opts: LedgerOptions = {}
): Promise<CommitLocationResult> {
  validateCommitInput(input);
  const monthlyAmountAud = input.monthlyAmountAud ?? MONTHLY_AMOUNT_AUD_DEFAULT;
  if (!Number.isFinite(monthlyAmountAud) || monthlyAmountAud <= 0) {
    throw new Error(
      `commitLocation: monthlyAmountAud must be > 0 (got ${monthlyAmountAud})`
    );
  }
  const repo = resolveRepository(opts);

  // 1) Idempotency — if active row already exists for this coverage, return it
  const existing = await repo.findActiveByCoverage(input.serviceAreaCoverageId);
  if (existing) {
    logger.info('[budget.ledger] idempotent re-commit, returning existing', {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      serviceAreaCoverageId: input.serviceAreaCoverageId,
      contractorId: input.contractorId,
    });
    const utilisation = await getMonthlyBudgetUtilisation(opts);
    return {
      committed: true,
      inserted: false,
      remainingMonthlyAud: utilisation.capAud - utilisation.totalCommittedAud,
      entry: existing,
    };
  }

  // 2) Monthly cap headroom check
  const monthlyCheck = await canCommitMonthlyBudget(monthlyAmountAud, opts);
  if (!monthlyCheck.ok) {
    logger.warn('[budget.ledger] commit refused — monthly cap exceeded', {
      sourceOfTruthJobId: input.sourceOfTruthJobId,
      serviceAreaCoverageId: input.serviceAreaCoverageId,
      contractorId: input.contractorId,
      reason: monthlyCheck.reason,
    });
    return {
      committed: false,
      inserted: false,
      remainingMonthlyAud: monthlyCheck.remainingAud,
      reason: monthlyCheck.reason,
    };
  }

  // 3) Per-contractor cap headroom check
  const contractorCheck = await canCommitForContractor(
    input.contractorId,
    monthlyAmountAud,
    opts
  );
  if (!contractorCheck.ok) {
    logger.warn(
      '[budget.ledger] commit refused — per-contractor cap exceeded',
      {
        sourceOfTruthJobId: input.sourceOfTruthJobId,
        serviceAreaCoverageId: input.serviceAreaCoverageId,
        contractorId: input.contractorId,
        reason: contractorCheck.reason,
      }
    );
    return {
      committed: false,
      inserted: false,
      remainingMonthlyAud: monthlyCheck.remainingAud, // monthly room exists, contractor doesn't
      reason: contractorCheck.reason,
    };
  }

  // 4) Insert ledger row
  const entry = await repo.insert({ ...input, monthlyAmountAud });
  logger.info('[budget.ledger] committed', {
    sourceOfTruthJobId: entry.sourceOfTruthJobId,
    serviceAreaCoverageId: entry.serviceAreaCoverageId,
    contractorId: entry.contractorId,
    suburb: entry.suburb,
    postcode: entry.postcode,
    monthlyAmountAud: entry.monthlyAmountAud,
  });

  return {
    committed: true,
    inserted: true,
    remainingMonthlyAud: monthlyCheck.remainingAud - monthlyAmountAud,
    entry,
  };
}

// ─── PAUSE / RESUME ──────────────────────────────────────────────────────

/**
 * Mark a location's ledger entry as paused. Frees its monthly amount from
 * the cap calculation. Returns the updated entry, or null if no active
 * entry was found for that coverage.
 *
 * Per SYN-839 NEVER list rule 4: callers SHOULD notify
 * performance-attribution-lead before auto-pausing — that's the caller's
 * responsibility, not enforced here.
 */
export async function pauseLocation(
  serviceAreaCoverageId: string,
  reason: string,
  opts: LedgerOptions = {}
): Promise<LedgerEntry | null> {
  if (!serviceAreaCoverageId) {
    throw new Error('pauseLocation: serviceAreaCoverageId required');
  }
  if (!reason || typeof reason !== 'string') {
    throw new Error('pauseLocation: reason required');
  }
  const repo = resolveRepository(opts);
  const updated = await repo.pause(serviceAreaCoverageId, reason);
  if (updated) {
    logger.info('[budget.ledger] paused', {
      serviceAreaCoverageId,
      reason,
    });
  }
  return updated;
}

/**
 * Move a paused entry back to active. Returns the updated entry, or null if
 * no paused entry was found for that coverage. Re-checks the monthly cap
 * before resume — if cap is now exceeded, throws.
 */
export async function resumeLocation(
  serviceAreaCoverageId: string,
  opts: LedgerOptions = {}
): Promise<LedgerEntry | null> {
  if (!serviceAreaCoverageId) {
    throw new Error('resumeLocation: serviceAreaCoverageId required');
  }
  const repo = resolveRepository(opts);
  const updated = await repo.resume(serviceAreaCoverageId);
  if (updated) {
    logger.info('[budget.ledger] resumed', {
      serviceAreaCoverageId,
    });
  }
  return updated;
}

// ─── REPORTING ───────────────────────────────────────────────────────────

/**
 * Snapshot of monthly budget utilisation across the whole portfolio.
 */
export async function getMonthlyBudgetUtilisation(
  opts: LedgerOptions = {}
): Promise<MonthlyUtilisation> {
  const repo = resolveRepository(opts);
  const cap = resolveMonthlyCap(opts);
  const [totalCommittedAud, activeLocationCount] = await Promise.all([
    repo.sumActiveMonthlyAud(),
    repo.countActive(),
  ]);
  const utilisationPct = cap > 0 ? (totalCommittedAud / cap) * 100 : 0;
  return {
    totalCommittedAud,
    capAud: cap,
    utilisationPct,
    activeLocationCount,
  };
}

/**
 * Count of active opened locations (any contractor, any state).
 */
export async function getActiveLocationCount(
  opts: LedgerOptions = {}
): Promise<number> {
  const repo = resolveRepository(opts);
  return repo.countActive();
}

/**
 * All ledger entries for a contractor, newest first. Useful for admin
 * dashboard or per-contractor billing.
 */
export async function getLedgerForContractor(
  contractorId: string,
  opts: LedgerOptions = {}
): Promise<LedgerEntry[]> {
  if (!contractorId) {
    throw new Error('getLedgerForContractor: contractorId required');
  }
  const repo = resolveRepository(opts);
  return repo.findByContractor(contractorId);
}

// ─── VALIDATION ──────────────────────────────────────────────────────────

function validateCommitInput(input: CommitLocationInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('commitLocation: input required');
  }
  if (!input.serviceAreaCoverageId) {
    throw new Error('commitLocation: serviceAreaCoverageId required');
  }
  if (!input.sourceOfTruthJobId) {
    throw new Error('commitLocation: sourceOfTruthJobId required (Q3.2.4 H8)');
  }
  if (!input.contractorId) {
    throw new Error('commitLocation: contractorId required');
  }
  if (!input.suburb || !input.postcode) {
    throw new Error('commitLocation: suburb + postcode required');
  }
}
