/**
 * Default {@link BudgetLedgerRepository}.
 *
 * NOT PROVISIONED: the `location_budget_ledger` table has no Prisma model in
 * `prisma/schema.prisma`, so there is nowhere real to read or write ledger
 * rows. Every method throws {@link BudgetLedgerNotProvisionedError} rather than
 * returning empty data — an empty ledger would read as "no spend committed" and
 * let the cap check pass. Callers that need a working ledger (tests, the NRPG
 * pipeline) inject their own repository via `LedgerOptions.repository`.
 *
 * @see SYN-839 (parent: SYN-834 epic)
 */

import type { BudgetLedgerRepository } from './types';

export class BudgetLedgerNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'location_budget_ledger' as const;

  constructor(operation: string) {
    super(
      `[budget.repository] ${operation} unavailable: the location_budget_ledger table is not provisioned`
    );
    this.name = 'BudgetLedgerNotProvisionedError';
  }
}

function notProvisioned(operation: string): never {
  throw new BudgetLedgerNotProvisionedError(operation);
}

export const platformBudgetLedgerRepository: BudgetLedgerRepository = {
  async insert() {
    return notProvisioned('insert');
  },
  async findActiveByCoverage() {
    return notProvisioned('findActiveByCoverage');
  },
  async sumActiveMonthlyAud() {
    return notProvisioned('sumActiveMonthlyAud');
  },
  async countActive() {
    return notProvisioned('countActive');
  },
  async sumActiveMonthlyAudForContractor() {
    return notProvisioned('sumActiveMonthlyAudForContractor');
  },
  async findByContractor() {
    return notProvisioned('findByContractor');
  },
  async pause() {
    return notProvisioned('pause');
  },
  async resume() {
    return notProvisioned('resume');
  },
};
