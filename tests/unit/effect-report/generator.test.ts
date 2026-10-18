/**
 * Unit tests — effect-report/generator.ts — SYN-674 / P2 truth
 *
 * `effect_reports` has no Prisma model. Generation and reads must throw
 * EffectReportNotProvisionedError — no fake report id, no false "not found",
 * and no section/AI work for a report that cannot be stored. The cold-start
 * guard still reads the caller's own organisation via Prisma.
 */

import { prisma } from '@/lib/prisma';
import {
  generateEffectReport,
  getEffectReport,
  getEffectReportByPeriod,
  EffectReportNotProvisionedError,
} from '@/lib/effect-report/generator';

jest.mock('@/lib/prisma', () => ({
  prisma: { organization: { findUnique: jest.fn() } },
}));

const findUnique = (
  prisma as unknown as {
    organization: { findUnique: jest.Mock };
  }
).organization.findUnique;

const periodStart = new Date('2026-07-01T00:00:00Z');
const periodEnd = new Date('2026-09-30T23:59:59Z');

describe('generateEffectReport', () => {
  it('reads only the caller organisation, then throws not provisioned', async () => {
    findUnique.mockResolvedValue({
      name: 'Acme',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });

    const err = await generateEffectReport(
      { organizationId: 'org-1', periodStart, periodEnd },
      undefined,
      'https://app.test'
    ).catch(e => e);

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { name: true, createdAt: true },
    });
    expect(err).toBeInstanceOf(EffectReportNotProvisionedError);
    expect(err).toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'effect_reports',
    });
  });

  it('still returns null for a cold-start organisation', async () => {
    findUnique.mockResolvedValue({
      name: 'New Co',
      createdAt: new Date('2026-06-20T00:00:00Z'),
    });

    await expect(
      generateEffectReport(
        { organizationId: 'org-new', periodStart, periodEnd },
        undefined,
        'https://app.test'
      )
    ).resolves.toBeNull();
  });
});

describe('effect report reads', () => {
  it('getEffectReport throws not provisioned (never a false not-found)', async () => {
    await expect(getEffectReport(undefined, 'rep-1')).rejects.toBeInstanceOf(
      EffectReportNotProvisionedError
    );
  });

  it('getEffectReportByPeriod throws not provisioned', async () => {
    await expect(
      getEffectReportByPeriod(undefined, 'org-1', 'Q3 2026')
    ).rejects.toBeInstanceOf(EffectReportNotProvisionedError);
  });
});
