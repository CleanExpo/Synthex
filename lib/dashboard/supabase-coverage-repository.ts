/**
 * Default {@link CoverageRepository} for the DR service-area dashboard.
 *
 * The `service_area_coverage` table is not provisioned (no Prisma model), so
 * the default repository throws {@link CoverageNotProvisionedError} rather
 * than returning an empty list. Tests inject a fake.
 *
 * Phase 3.4: a real store must hard-filter `brand='DR'` at the query level
 * (defence in depth on top of the DB CHECK constraint).
 *
 * @see SYN-843 (parent: SYN-834 epic)
 */

import type { CoverageRepository } from './types';

/**
 * Thrown by {@link platformCoverageRepository}: the `service_area_coverage`
 * table has no Prisma model, so coverage cannot be read. Inject
 * `opts.coverageRepo` to supply a real store.
 */
export class CoverageNotProvisionedError extends Error {
  readonly code = 'FEATURE_NOT_PROVISIONED' as const;
  readonly table = 'service_area_coverage';

  constructor() {
    super(
      '[dashboard.coverage] service_area_coverage is not provisioned: no table in prisma/schema.prisma'
    );
    this.name = 'CoverageNotProvisionedError';
  }
}

export const platformCoverageRepository: CoverageRepository = {
  async findAllForDr() {
    throw new CoverageNotProvisionedError();
  },
};
