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
const mockHasDirectAccess = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  hasDirectOrganizationAccess: (...a: unknown[]) => mockHasDirectAccess(...a),
}));

import { loadRenderBrandKitForUser } from '@/lib/brand/render-brand-kit';

describe('loadRenderBrandKitForUser() with the cut organisation', () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: 'org-home',
    });
    mockPrisma.brandPreset.findFirst.mockImplementation(
      async ({ where }: { where: { organizationId: string } }) =>
        where.organizationId === 'org-client-b'
          ? { primaryColor: '#B91C1C' }
          : { primaryColor: '#1D4ED8' }
    );
  });

  it('uses the cut organisation the user may act for', async () => {
    mockHasDirectAccess.mockResolvedValue(true);
    const kit = await loadRenderBrandKitForUser('user-1', 'org-client-b');
    expect(mockHasDirectAccess).toHaveBeenCalledWith('user-1', 'org-client-b');
    expect(kit).toEqual({ primaryColor: '#b91c1c', source: 'preset' });
  });

  it('renders unbranded, never the home colour, when access is refused', async () => {
    mockHasDirectAccess.mockResolvedValue(false);
    const kit = await loadRenderBrandKitForUser('user-1', 'org-client-b');
    expect(kit).toBeNull();
    expect(mockPrisma.brandPreset.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('renders unbranded when the access check throws', async () => {
    mockHasDirectAccess.mockRejectedValue(new Error('db down'));
    expect(
      await loadRenderBrandKitForUser('user-1', 'org-client-b')
    ).toBeNull();
  });

  it('falls back to the home organisation only when no cut organisation is given', async () => {
    const kit = await loadRenderBrandKitForUser('user-1', null);
    expect(mockHasDirectAccess).not.toHaveBeenCalled();
    expect(kit).toEqual({ primaryColor: '#1d4ed8', source: 'preset' });
  });
});

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
