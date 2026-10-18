/**
 * P2 u12: `location_kpi` has no Prisma model, so the default KPI repository
 * must fail honestly instead of faking writes or empty reads.
 */
import {
  KpiNotProvisionedError,
  platformKpiRepository,
} from '@/lib/kpi/supabase-repository';
import { getLatestSnapshot, recordKpiSnapshot } from '@/lib/kpi';

describe('platformKpiRepository (NOT_PROVISIONED: location_kpi)', () => {
  it('rejects every operation with a typed FEATURE_NOT_PROVISIONED error', async () => {
    const calls = [
      platformKpiRepository.insert({
        serviceAreaCoverageId: 'cov-1',
        periodDays: 30,
        verificationState: 'directional',
        verifiedAt: null,
      }),
      platformKpiRepository.findLatestForCoverage('cov-1', 30),
      platformKpiRepository.findAllForCoverage('cov-1'),
      platformKpiRepository.listLatestNinetyDayPerCoverage(),
    ];
    for (const call of calls) {
      await expect(call).rejects.toBeInstanceOf(KpiNotProvisionedError);
      await expect(call).rejects.toMatchObject({
        code: 'FEATURE_NOT_PROVISIONED',
        table: 'location_kpi',
      });
    }
  });

  it('surfaces through the public KPI API rather than reporting success', async () => {
    await expect(
      recordKpiSnapshot({
        serviceAreaCoverageId: 'cov-1',
        periodDays: 30,
        conversions: 40,
      })
    ).rejects.toBeInstanceOf(KpiNotProvisionedError);
    await expect(getLatestSnapshot('cov-1')).rejects.toBeInstanceOf(
      KpiNotProvisionedError
    );
  });
});
