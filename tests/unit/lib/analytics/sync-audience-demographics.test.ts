/**
 * Unit tests for lib/analytics/sync-audience-demographics.ts
 *
 * Locks:
 *  - a supported platform (instagram) whose service returns REAL demographics
 *    is MERGED into metadata.demographics WITHOUT clobbering metadata.followers;
 *  - an account that returns no demographics persists an honest EMPTY payload
 *    (hasData=false) — no fabrication;
 *  - an unsupported platform (e.g. linkedin) is a no-op (never writes);
 *  - a missing/undecryptable token is skipped gracefully.
 */

const mockPrisma = {
  platformConnection: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockDecrypt = jest.fn();
jest.mock('@/lib/security/field-encryption', () => ({
  decryptFieldSafe: (...args: unknown[]) => mockDecrypt(...args),
}));

const mockSyncAudience = jest.fn();
const mockCreatePlatformService = jest.fn();
jest.mock('@/lib/social', () => ({
  createPlatformService: (...args: unknown[]) =>
    mockCreatePlatformService(...args),
  isPlatformSupported: (p: string) =>
    ['instagram', 'facebook', 'linkedin', 'twitter'].includes(p),
}));

import { syncConnectionAudienceDemographics } from '@/lib/analytics/sync-audience-demographics';

function conn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    platform: 'instagram',
    accessToken: 'enc-token',
    refreshToken: null,
    expiresAt: null,
    profileId: 'ig-1',
    profileName: 'acct',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDecrypt.mockReturnValue('plain-token');
  mockCreatePlatformService.mockReturnValue({ syncAudience: mockSyncAudience });
  mockPrisma.platformConnection.findUnique.mockResolvedValue({
    metadata: { followers: 1234 },
  });
  mockPrisma.platformConnection.update.mockResolvedValue({});
});

describe('syncConnectionAudienceDemographics — real data, merge', () => {
  it('merges real demographics into metadata without clobbering followers', async () => {
    mockSyncAudience.mockResolvedValue({
      success: true,
      data: {
        demographics: {
          ageRanges: [{ range: '25-34', percentage: 60, count: 600 }],
          genderSplit: [{ gender: 'Female', percentage: 100, count: 600 }],
          topLocations: [
            { location: 'Australia', country: 'AU', percentage: 100, count: 600 },
          ],
        },
        behavior: { bestPostingTimes: [], activeHours: [] },
      },
    });

    const result = await syncConnectionAudienceDemographics(conn());

    expect(result).toMatchObject({ fetched: true, stored: true, hasData: true });

    expect(mockPrisma.platformConnection.update).toHaveBeenCalledTimes(1);
    const writtenData =
      mockPrisma.platformConnection.update.mock.calls[0][0].data;
    // followers preserved
    expect(writtenData.metadata.followers).toBe(1234);
    // demographics written
    expect(writtenData.metadata.demographics.ageRanges[0].range).toBe('25-34');
    expect(writtenData.metadata.demographics.topLocations[0].country).toBe('AU');
    expect(typeof writtenData.metadata.demographics.syncedAt).toBe('string');
  });
});

describe('syncConnectionAudienceDemographics — honest empty (no fabrication)', () => {
  it('persists empty payload + hasData:false when account exposes nothing', async () => {
    mockSyncAudience.mockResolvedValue({
      success: true,
      data: {
        demographics: { ageRanges: [], genderSplit: [], topLocations: [] },
        behavior: { bestPostingTimes: [], activeHours: [] },
      },
    });

    const result = await syncConnectionAudienceDemographics(conn());

    expect(result).toMatchObject({ fetched: true, stored: true, hasData: false });
    const writtenData =
      mockPrisma.platformConnection.update.mock.calls[0][0].data;
    expect(writtenData.metadata.demographics.ageRanges).toEqual([]);
    expect(writtenData.metadata.followers).toBe(1234);
  });
});

describe('syncConnectionAudienceDemographics — skips', () => {
  it('no-ops for an unsupported platform (never writes)', async () => {
    const result = await syncConnectionAudienceDemographics(
      conn({ platform: 'linkedin' })
    );
    expect(result).toMatchObject({
      fetched: false,
      stored: false,
      skippedReason: 'unsupported-platform',
    });
    expect(mockCreatePlatformService).not.toHaveBeenCalled();
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('skips gracefully when the token cannot be decrypted', async () => {
    mockDecrypt.mockReturnValue(null);
    const result = await syncConnectionAudienceDemographics(conn());
    expect(result).toMatchObject({
      fetched: true,
      stored: false,
      skippedReason: 'no-token',
    });
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });

  it('treats a thrown syncAudience as honest no-data, never throws', async () => {
    mockSyncAudience.mockRejectedValue(new Error('graph 400'));
    const result = await syncConnectionAudienceDemographics(conn());
    expect(result).toMatchObject({ fetched: true, stored: false, hasData: false });
    expect(mockPrisma.platformConnection.update).not.toHaveBeenCalled();
  });
});
