/**
 * Unit tests — supabase-coverage-repository.ts — SYN-843 / P2 truth
 *
 * `service_area_coverage` has no Prisma model, so the default repository must
 * throw a typed FEATURE_NOT_PROVISIONED error, never return an empty list.
 */

import {
  platformCoverageRepository,
  CoverageNotProvisionedError,
} from '@/lib/dashboard/supabase-coverage-repository';

describe('platformCoverageRepository — not provisioned', () => {
  it('findAllForDr throws CoverageNotProvisionedError instead of returning []', async () => {
    const err = await platformCoverageRepository.findAllForDr().catch(e => e);

    expect(err).toBeInstanceOf(CoverageNotProvisionedError);
    expect(err).toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'service_area_coverage',
    });
  });
});
