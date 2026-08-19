/**
 * Regression: cross-tenant credential injection (SYN-1112 F7).
 *
 * POST /api/onboarding/api-credentials accepts a client-supplied organizationId
 * and scopes (and vault-mirrors) the stored credential to it. Before the fix
 * there was NO check that the caller belongs to that org, so a user could write
 * a credential into an arbitrary tenant's namespace. The route now rejects with
 * 403 when `hasOrganizationAccess` is false, before any DB write.
 */

import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockGetUserId = jest.fn();
const mockHasOrganizationAccess = jest.fn();
const mockValidateAPIKey = jest.fn();
const mockCredentialFindFirst = jest.fn();
const mockCredentialCreate = jest.fn();
const mockSeedSingleCredential = jest.fn();

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
  unauthorizedResponse: () => ({
    status: 401,
    json: async () => ({ error: 'Unauthorized' }),
  }),
}));

jest.mock('@/lib/multi-business', () => ({
  hasOrganizationAccess: (...args: unknown[]) =>
    mockHasOrganizationAccess(...args),
}));

jest.mock('@/lib/encryption/api-key-encryption', () => ({
  encryptApiKey: () => 'enc',
  maskApiKey: () => 'sk-...abcd',
}));

jest.mock('@/lib/encryption/api-key-validator', () => ({
  validateAPIKey: (...args: unknown[]) => mockValidateAPIKey(...args),
  APIProvider: {},
}));

jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (_req: unknown, cb: () => unknown) => cb(),
}));

jest.mock('@/lib/vault/onboarding-seeder', () => ({
  seedSingleCredential: (...args: unknown[]) =>
    mockSeedSingleCredential(...args),
}));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    aPICredential: {
      findFirst: (...args: unknown[]) => mockCredentialFindFirst(...args),
      create: (...args: unknown[]) => mockCredentialCreate(...args),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { POST } from '@/app/api/onboarding/api-credentials/route';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserId.mockResolvedValue('attacker');
  mockValidateAPIKey.mockResolvedValue({ isValid: true });
  mockCredentialFindFirst.mockResolvedValue(null);
  mockCredentialCreate.mockResolvedValue({ id: 'cred-1', provider: 'openai' });
});

describe('POST /api/onboarding/api-credentials — org access (SYN-1112 F7)', () => {
  const body = {
    provider: 'openai',
    apiKey: 'test-key-denied-org',
    organizationId: 'victim-org',
  };

  it('returns 403 and writes nothing when caller lacks access to the target org', async () => {
    mockHasOrganizationAccess.mockResolvedValue(false);

    const req = createMockNextRequest({ method: 'POST', body });
    const res = await POST(req as never);

    expect(res.status).toBe(403);
    expect(mockHasOrganizationAccess).toHaveBeenCalledWith(
      'attacker',
      'victim-org'
    );
    expect(mockCredentialCreate).not.toHaveBeenCalled();
    expect(mockSeedSingleCredential).not.toHaveBeenCalled();
  });

  it('proceeds past the org guard when caller has access to the supplied org', async () => {
    mockHasOrganizationAccess.mockResolvedValue(true);

    const req = createMockNextRequest({ method: 'POST', body });
    const res = await POST(req as never);

    expect(res.status).not.toBe(403);
    // Reached the write path: the credential was stored.
    expect(mockCredentialCreate).toHaveBeenCalled();
  });

  it('does not gate the personal (no organizationId) path', async () => {
    const req = createMockNextRequest({
      method: 'POST',
      body: { provider: 'openai', apiKey: 'test-key-self-org' },
    });
    const res = await POST(req as never);

    expect(res.status).not.toBe(403);
    expect(mockHasOrganizationAccess).not.toHaveBeenCalled();
    expect(mockCredentialCreate).toHaveBeenCalled();
  });
});
