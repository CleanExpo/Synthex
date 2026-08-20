/**
 * Unit tests — onboarding persistence helpers
 */

const findUniqueUser = jest.fn();
const updateUser = jest.fn();
const updateManyPlatform = jest.fn();
const updateManyCredential = jest.fn();
const findFirstOrg = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueUser(...args),
      update: (...args: unknown[]) => updateUser(...args),
    },
    platformConnection: {
      updateMany: (...args: unknown[]) => updateManyPlatform(...args),
    },
    aPICredential: {
      updateMany: (...args: unknown[]) => updateManyCredential(...args),
    },
    organization: {
      findFirst: (...args: unknown[]) => findFirstOrg(...args),
    },
    onboardingProgress: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import {
  attachUserToOrganization,
  migrateOrphanRecordsToOrg,
  normalizeAiProvider,
} from '@/lib/onboarding/persist';

describe('onboarding persist helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findUniqueUser.mockResolvedValue({
      organizationId: null,
      onboardingComplete: false,
    });
    updateUser.mockResolvedValue({});
    updateManyPlatform.mockResolvedValue({ count: 2 });
    updateManyCredential.mockResolvedValue({ count: 1 });
  });

  it('normalizes gemini to google', () => {
    expect(normalizeAiProvider('gemini')).toBe('google');
    expect(normalizeAiProvider('openrouter')).toBe('openrouter');
  });

  it('attachUserToOrganization stamps org on user during onboarding', async () => {
    await attachUserToOrganization('user-1', 'org-1');
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        organizationId: 'org-1',
        activeOrganizationId: 'org-1',
      },
    });
  });

  it('migrateOrphanRecordsToOrg moves connections and credentials', async () => {
    const result = await migrateOrphanRecordsToOrg('user-1', 'org-1');
    expect(result).toEqual({ connections: 2, credentials: 1 });
    expect(updateManyPlatform).toHaveBeenCalled();
    expect(updateManyCredential).toHaveBeenCalled();
  });
});
