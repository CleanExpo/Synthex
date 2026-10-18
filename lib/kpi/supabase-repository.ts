/**
 * Default {@link KpiRepository} — NOT PROVISIONED.
 *
 * This repository used to read and write the Supabase `location_kpi` table
 * through the retired noop client stub. That table has no Prisma model in
 * prisma/schema.prisma, so there is no real store behind it. Every method
 * now throws {@link KpiNotProvisionedError} instead of pretending to write or
 * returning fabricated empty reads.
 *
 * Callers that need working KPI storage must inject their own repository via
 * `KpiOptions.repository` (tests already do).
 *
 * @see SYN-842 (parent: SYN-834 epic)
 */

import type { KpiRepository } from './types';

export const KPI_TABLE = 'location_kpi' as const;

export class KpiNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = KPI_TABLE;

  constructor(operation: string) {
    super(
      `[kpi.repository] ${operation} unavailable: the "${KPI_TABLE}" table is not provisioned ` +
        `(no Prisma model). KPI snapshots cannot be stored or read.`
    );
    this.name = 'KpiNotProvisionedError';
  }
}

export const platformKpiRepository: KpiRepository = {
  async insert() {
    throw new KpiNotProvisionedError('insert');
  },

  async findLatestForCoverage() {
    throw new KpiNotProvisionedError('findLatestForCoverage');
  },

  async findAllForCoverage() {
    throw new KpiNotProvisionedError('findAllForCoverage');
  },

  async listLatestNinetyDayPerCoverage() {
    throw new KpiNotProvisionedError('listLatestNinetyDayPerCoverage');
  },
};
