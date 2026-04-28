/**
 * lib/budget — public entry point.
 *
 * SYN-839 per-location budget ledger for the SYN-834 NRPG → DR pipeline.
 * Gates new openings: $55/mo per location, monthly cap, per-contractor cap,
 * pause/resume + reporting.
 *
 * @see SYN-839 (parent: SYN-834 epic)
 * @see lib/budget/README.md
 */

export { MONTHLY_AMOUNT_AUD_DEFAULT } from './types';

export type {
  BudgetLedgerRepository,
  CapCheckResult,
  CommitLocationInput,
  CommitLocationResult,
  LedgerEntry,
  LedgerEntryStatus,
  LedgerOptions,
  MonthlyUtilisation,
} from './types';

export { supabaseBudgetLedgerRepository } from './supabase-repository';

export {
  canCommitMonthlyBudget,
  canCommitForContractor,
  commitLocation,
  pauseLocation,
  resumeLocation,
  getMonthlyBudgetUtilisation,
  getActiveLocationCount,
  getLedgerForContractor,
} from './per-location-ledger';
