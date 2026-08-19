/**
 * Unit tests for the master-admin mirror (lib/auth/master-admin-mirror.ts).
 *
 * The mirror reconciles a configured pair of master-admin accounts to the
 * UNION of their access on every trigger. Grant-only: it must never revoke.
 */

const userFindMany = jest.fn();
const userUpdateMany = jest.fn();
const ownershipFindMany = jest.fn();
const ownershipCreateMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findMany: (...args: unknown[]) => userFindMany(...args),
      updateMany: (...args: unknown[]) => userUpdateMany(...args),
    },
    businessOwnership: {
      findMany: (...args: unknown[]) => ownershipFindMany(...args),
      createMany: (...args: unknown[]) => ownershipCreateMany(...args),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  getMasterAdminMirrorPair,
  syncMasterAdminPair,
} from '@/lib/auth/master-admin-mirror';

const PAIR = 'owner-a@example.com,owner-b@example.com';

const ownership = (ownerId: string, organizationId: string) => ({
  ownerId,
  organizationId,
  displayName: null,
  isActive: true,
  billingStatus: 'active',
  monthlyRate: 249.0,
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.MASTER_ADMIN_MIRROR;
});

describe('getMasterAdminMirrorPair', () => {
  test('returns [] when env unset', () => {
    expect(getMasterAdminMirrorPair()).toEqual([]);
  });

  test('returns [] for a single email or duplicate pair', () => {
    process.env.MASTER_ADMIN_MIRROR = 'a@x.com';
    expect(getMasterAdminMirrorPair()).toEqual([]);
    process.env.MASTER_ADMIN_MIRROR = 'a@x.com,A@X.com';
    expect(getMasterAdminMirrorPair()).toEqual([]);
  });

  test('normalises to trimmed lowercase pair', () => {
    process.env.MASTER_ADMIN_MIRROR =
      ' Owner-A@EXAMPLE.com , owner-b@example.com ';
    expect(getMasterAdminMirrorPair()).toEqual([
      'owner-a@example.com',
      'owner-b@example.com',
    ]);
  });
});

describe('syncMasterAdminPair', () => {
  test('no-op when env unset', async () => {
    await syncMasterAdminPair('owner-a@example.com');
    expect(userFindMany).not.toHaveBeenCalled();
  });

  test('no-op when trigger email is not in the pair', async () => {
    process.env.MASTER_ADMIN_MIRROR = PAIR;
    await syncMasterAdminPair('someone-else@example.com');
    expect(userFindMany).not.toHaveBeenCalled();
  });

  test('no-op when only one account exists', async () => {
    process.env.MASTER_ADMIN_MIRROR = PAIR;
    userFindMany.mockResolvedValue([
      { id: 'u1', email: 'owner-a@example.com' },
    ]);
    await syncMasterAdminPair('owner-a@example.com');
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });

  test('unions flags and cross-grants missing ownerships both ways', async () => {
    process.env.MASTER_ADMIN_MIRROR = PAIR;
    userFindMany.mockResolvedValue([
      { id: 'u1', email: 'owner-a@example.com' },
      { id: 'u2', email: 'owner-b@example.com' },
    ]);
    userUpdateMany.mockResolvedValue({ count: 2 });
    // u1 owns orgA; u2 owns orgB — each must be granted the other's org.
    ownershipFindMany.mockResolvedValue([
      ownership('u1', 'orgA'),
      ownership('u2', 'orgB'),
    ]);
    ownershipCreateMany.mockResolvedValue({ count: 2 });

    await syncMasterAdminPair('owner-b@example.com');

    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2'] } },
      data: {
        isMultiBusinessOwner: true,
        onboardingComplete: true,
        apiKeyConfigured: true,
      },
    });
    const created = ownershipCreateMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(created.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerId: 'u1', organizationId: 'orgB' }),
        expect.objectContaining({ ownerId: 'u2', organizationId: 'orgA' }),
      ])
    );
    expect(created.data).toHaveLength(2);
  });

  test('creates nothing when ownerships already identical', async () => {
    process.env.MASTER_ADMIN_MIRROR = PAIR;
    userFindMany.mockResolvedValue([
      { id: 'u1', email: 'owner-a@example.com' },
      { id: 'u2', email: 'owner-b@example.com' },
    ]);
    userUpdateMany.mockResolvedValue({ count: 2 });
    ownershipFindMany.mockResolvedValue([
      ownership('u1', 'orgA'),
      ownership('u2', 'orgA'),
    ]);

    await syncMasterAdminPair();

    expect(ownershipCreateMany).not.toHaveBeenCalled();
  });

  test('swallows DB errors — must never break the triggering flow', async () => {
    process.env.MASTER_ADMIN_MIRROR = PAIR;
    userFindMany.mockRejectedValue(new Error('connection refused'));
    await expect(syncMasterAdminPair()).resolves.toBeUndefined();
  });
});
