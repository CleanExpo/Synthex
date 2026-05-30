/**
 * Behavioral coverage for /api/admin/vault (SYN-1000).
 * The vault stores platform secrets — these routes are OWNER-ONLY via
 * requireOwner() (authenticated session AND isOwnerEmail). We prove the gate:
 *   - unauthenticated session → 401 (no owner lookup, no vault read)
 *   - authenticated non-owner → 403 (no vault read)
 *   - authenticated owner      → 200 (vault read runs)
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  vaultSecret: { findMany: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...args: unknown[]) => mockCheck(...args) },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: {} },
}));

const mockIsOwnerEmail = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  isOwnerEmail: (...args: unknown[]) => mockIsOwnerEmail(...args),
}));

const mockListSecrets = jest.fn();
const mockListQueryParse = jest.fn();
jest.mock('@/lib/vault', () => ({
  __esModule: true,
  VaultService: {
    listSecrets: (...args: unknown[]) => mockListSecrets(...args),
    createSecret: jest.fn(),
    rotateSecret: jest.fn(),
    deleteSecret: jest.fn(),
    prepareSecret: jest.fn(),
  },
  CreateSecretSchema: { safeParse: jest.fn() },
  RotateSecretSchema: { safeParse: jest.fn() },
  DeleteSecretSchema: { safeParse: jest.fn() },
  ListSecretsQuerySchema: { safeParse: (...args: unknown[]) => mockListQueryParse(...args) },
  slugify: (s: string) => s,
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from '@/app/api/admin/vault/route';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/admin/vault — owner gate (SYN-1000)', () => {
  it('returns 401 for an unauthenticated session and never looks up the owner', async () => {
    mockCheck.mockResolvedValue({ allowed: false, context: {} });
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/vault' }));
    expect(res.status).toBe(401);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockListSecrets).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-owner and never reads the vault', async () => {
    mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'user-1' } });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'staff@example.com' });
    mockIsOwnerEmail.mockReturnValue(false);
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/vault' }));
    expect(res.status).toBe(403);
    expect(mockListSecrets).not.toHaveBeenCalled();
  });

  it('returns 200 and reads the vault for the platform owner', async () => {
    mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'owner-1' } });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });
    mockIsOwnerEmail.mockReturnValue(true);
    mockListQueryParse.mockReturnValue({ success: true, data: { organizationId: '' } });
    mockListSecrets.mockResolvedValue([]);
    const res = await GET(createMockNextRequest({ url: 'http://localhost/api/admin/vault' }));
    expect(res.status).toBe(200);
    expect(mockListSecrets).toHaveBeenCalledTimes(1);
  });
});
