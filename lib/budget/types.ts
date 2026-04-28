/**
 * Per-location budget ledger types
 *
 * Foundation primitive for SYN-834 NRPG → DR dynamic service-area pipeline.
 * Gates new openings: $55/mo per opened location, monthly cap, per-contractor
 * cap, controlled retreat for non-paying-off locations.
 *
 * @see SYN-839 (parent: SYN-834 epic)
 * @see lib/budget/README.md
 */

/**
 * Default monthly amount per opened location, per CEO direction 2026-04-29.
 */
export const MONTHLY_AMOUNT_AUD_DEFAULT = 55 as const;

/**
 * Status values for ledger entries. Mirror the CHECK constraint in the
 * Supabase `location_budget_ledger` table (PR #129).
 */
export type LedgerEntryStatus = 'active' | 'paused' | 'closed';

/**
 * Persistent ledger entry shape (1:1 with Supabase row).
 */
export interface LedgerEntry {
  id: string;
  serviceAreaCoverageId: string;
  sourceOfTruthJobId: string;
  contractorId: string;
  postcode: string;
  suburb: string;
  monthlyAmountAud: number;
  openedAt: string;
  pausedAt?: string | null;
  pausedReason?: string | null;
  closedAt?: string | null;
  status: LedgerEntryStatus;
  createdAt: string;
}

/**
 * Input for {@link commitLocation}.
 */
export interface CommitLocationInput {
  serviceAreaCoverageId: string;
  sourceOfTruthJobId: string;
  contractorId: string;
  postcode: string;
  suburb: string;
  /** Optional override of the default $55/mo. Useful for special-rate areas. */
  monthlyAmountAud?: number;
}

/**
 * Result of {@link commitLocation}.
 */
export interface CommitLocationResult {
  /** True if a ledger entry was created (or already existed for this coverage). */
  committed: boolean;
  /** True if this call wrote a new row (false if idempotent re-commit). */
  inserted: boolean;
  /** Remaining monthly budget headroom AFTER this commit (negative iff cap exceeded). */
  remainingMonthlyAud: number;
  /** Reason for refusal, present iff committed=false. */
  reason?: string;
  /** The persisted ledger entry, present iff committed=true. */
  entry?: LedgerEntry;
}

/**
 * Snapshot of monthly budget usage.
 */
export interface MonthlyUtilisation {
  totalCommittedAud: number;
  capAud: number;
  utilisationPct: number;
  activeLocationCount: number;
}

/**
 * Repository interface — abstracts the Supabase access layer for testing.
 */
export interface BudgetLedgerRepository {
  /** Insert a new ledger row. Throws on PG conflict (caller should pre-check). */
  insert(
    input: CommitLocationInput & { monthlyAmountAud: number }
  ): Promise<LedgerEntry>;
  /** Find an existing ACTIVE entry for a given coverage id. Returns null if none. */
  findActiveByCoverage(
    serviceAreaCoverageId: string
  ): Promise<LedgerEntry | null>;
  /** Sum of monthly_amount_aud across all ACTIVE entries (whole portfolio). */
  sumActiveMonthlyAud(): Promise<number>;
  /** Count of active entries across the whole portfolio. */
  countActive(): Promise<number>;
  /** Sum of monthly_amount_aud across ACTIVE entries for a specific contractor. */
  sumActiveMonthlyAudForContractor(contractorId: string): Promise<number>;
  /** All entries for a contractor, newest first. */
  findByContractor(contractorId: string): Promise<LedgerEntry[]>;
  /** Mark a ledger entry as paused. Returns the updated entry, or null if not found. */
  pause(
    serviceAreaCoverageId: string,
    reason: string
  ): Promise<LedgerEntry | null>;
  /** Move a paused entry back to active. Returns the updated entry, or null if not found. */
  resume(serviceAreaCoverageId: string): Promise<LedgerEntry | null>;
}

/**
 * Optional configuration overrides (for testing or per-call overrides).
 */
export interface LedgerOptions {
  repository?: BudgetLedgerRepository;
  /** Override env-resolved monthly cap. */
  monthlyCapAud?: number;
  /** Override env-resolved per-contractor cap. */
  perContractorCapAud?: number;
}

/**
 * Headroom-check result.
 */
export interface CapCheckResult {
  ok: boolean;
  remainingAud: number;
  reason?: string;
}
