/**
 * Unit tests for the render brand kit — lib/brand/render-brand-kit.ts
 *
 * The kit resolves a founder's organisation colour for burned-in video
 * graphics: default brand preset, then BrandDNA, then Organization.primaryColor.
 * Any lookup failure must return null (unbranded), never throw.
 */
const mockPrisma = {
  user: { findUnique: jest.fn() },
  brandPreset: { findFirst: jest.fn() },
  brandDNA: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { loadRenderBrandKitForUser } from '@/lib/brand/render-brand-kit';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ organizationId: 'org-001' });
  mockPrisma.brandPreset.findFirst.mockResolvedValue(null);
  mockPrisma.brandDNA.findUnique.mockResolvedValue(null);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
});

describe('loadRenderBrandKitForUser()', () => {
  it('uses the default brand preset first, scoped to the founder org', async () => {
    mockPrisma.brandPreset.findFirst.mockResolvedValue({
      primaryColor: '#1D4ED8',
    });
    mockPrisma.brandDNA.findUnique.mockResolvedValue({
      primaryColour: '#ff0000',
    });

    await expect(loadRenderBrandKitForUser('user-001')).resolves.toEqual({
      primaryColor: '#1d4ed8',
      source: 'preset',
    });
    const query = mockPrisma.brandPreset.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ organizationId: 'org-001' });
    expect(query.orderBy[0]).toEqual({ isDefault: 'desc' });
  });

  it('falls back to BrandDNA when there is no usable preset colour', async () => {
    mockPrisma.brandPreset.findFirst.mockResolvedValue({
      primaryColor: 'blue',
    });
    mockPrisma.brandDNA.findUnique.mockResolvedValue({
      primaryColour: '#0F172A',
    });

    await expect(loadRenderBrandKitForUser('user-001')).resolves.toEqual({
      primaryColor: '#0f172a',
      source: 'dna',
    });
  });

  it('falls back to Organization.primaryColor after BrandDNA', async () => {
    mockPrisma.brandDNA.findUnique.mockResolvedValue({ primaryColour: '#fff' });
    mockPrisma.organization.findUnique.mockResolvedValue({
      primaryColor: '#ff6b35',
    });

    await expect(loadRenderBrandKitForUser('user-001')).resolves.toEqual({
      primaryColor: '#ff6b35',
      source: 'organization',
    });
    expect(mockPrisma.organization.findUnique.mock.calls[0][0].where).toEqual({
      id: 'org-001',
    });
  });

  it('returns null when no source has a valid colour', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      primaryColor: '#gggggg',
    });
    await expect(loadRenderBrandKitForUser('user-001')).resolves.toBeNull();
  });

  it('returns null without querying brand tables when the founder has no org', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
    await expect(loadRenderBrandKitForUser('user-001')).resolves.toBeNull();
    expect(mockPrisma.brandPreset.findFirst).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when a lookup fails', async () => {
    mockPrisma.brandPreset.findFirst.mockRejectedValue(new Error('db down'));
    await expect(loadRenderBrandKitForUser('user-001')).resolves.toBeNull();
  });
});
