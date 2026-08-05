/**
 * loadAgencyBrandMetrics — Lead-proxied Tier-1 brand canaries (AT-005).
 */
const mockOrgFindUnique = jest.fn();
const mockLeadFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: (...args: unknown[]) => mockOrgFindUnique(...args),
    },
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
    },
  },
}));

import {
  loadAgencyBrandMetrics,
  resolveTier1BrandOrgIds,
} from '@/lib/agency/load-agency-brand-metrics';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveTier1BrandOrgIds', () => {
  it('maps workspace children to brand slots', async () => {
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'ws-1',
      slug: 'unite-group',
      children: [
        { id: 'dr-1', slug: 'disaster-recovery' },
        { id: 'nrpg-1', slug: 'nrpg' },
        { id: 'carsi-1', slug: 'carsi' },
      ],
    });

    await expect(resolveTier1BrandOrgIds('ws-1')).resolves.toEqual({
      dr: 'dr-1',
      nrpg: 'nrpg-1',
      carsi: 'carsi-1',
    });
  });

  it('maps a brand org to only its own slot', async () => {
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'dr-1',
      slug: 'disaster-recovery',
      children: [],
    });

    await expect(resolveTier1BrandOrgIds('dr-1')).resolves.toEqual({
      dr: 'dr-1',
    });
  });
});

describe('loadAgencyBrandMetrics', () => {
  it('summarises DR / NRPG / CARSI Lead canaries and leaves CCW null', async () => {
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'ws-1',
      slug: 'unite-group',
      children: [
        { id: 'dr-1', slug: 'disaster-recovery' },
        { id: 'nrpg-1', slug: 'nrpg' },
        { id: 'carsi-1', slug: 'carsi' },
      ],
    });

    mockLeadFindMany
      .mockResolvedValueOnce([
        { stage: 'qualified', contactMethod: 'form_submission' },
        { stage: 'enquiry', contactMethod: 'form_submission' },
        { stage: 'converted', contactMethod: 'phone_call' },
      ])
      .mockResolvedValueOnce([
        { stage: 'enquiry', contactMethod: 'form_submission' },
        { stage: 'qualified', contactMethod: 'form_submission' },
      ])
      .mockResolvedValueOnce([
        { stage: 'enquiry', contactMethod: 'form_submission' },
        { stage: 'converted', contactMethod: 'form_submission' },
      ]);

    const metrics = await loadAgencyBrandMetrics('ws-1');

    expect(metrics.dr).toEqual({ d3Events: 2, qualificationRate: 67 });
    expect(metrics.nrpg).toEqual({ n2Applications: 2, n3Acceptance: 50 });
    expect(metrics.carsi).toEqual({
      snapshotCompletion: 50,
      firmActivations: 1,
    });
    expect(metrics.ccw.hubToCart).toBeNull();
    expect(mockLeadFindMany).toHaveBeenCalledTimes(3);
  });

  it('returns null brand slots when no portfolio orgs resolve', async () => {
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'solo',
      slug: 'random-client',
      children: [],
    });

    await expect(loadAgencyBrandMetrics('solo')).resolves.toEqual({
      dr: { d3Events: null, qualificationRate: null },
      nrpg: { n2Applications: null, n3Acceptance: null },
      carsi: { snapshotCompletion: null, firmActivations: null },
      ccw: { hubToCart: null },
    });
    expect(mockLeadFindMany).not.toHaveBeenCalled();
  });

  it('returns verified zeros when a brand org has no leads', async () => {
    mockOrgFindUnique.mockResolvedValueOnce({
      id: 'dr-1',
      slug: 'disaster-recovery',
      children: [],
    });
    mockLeadFindMany.mockResolvedValueOnce([]);

    await expect(loadAgencyBrandMetrics('dr-1')).resolves.toEqual({
      dr: { d3Events: 0, qualificationRate: null },
      nrpg: { n2Applications: null, n3Acceptance: null },
      carsi: { snapshotCompletion: null, firmActivations: null },
      ccw: { hubToCart: null },
    });
  });
});
