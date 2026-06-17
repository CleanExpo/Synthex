/**
 * Unit test for GET /api/credential-coverage (SYN-1023 slice 2).
 *
 * Verifies the per-org, secret-free credential-coverage endpoint:
 *   - 401 when unauthenticated,
 *   - 200 with a coverage report scoped to the caller's org,
 *   - only platform/slug metadata is read (selects carry no token/value field).
 */
const orgFindUnique = jest.fn();
const platformConnFindMany = jest.fn();
const vaultSecretFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    organization: { findUnique: (...a: unknown[]) => orgFindUnique(...a) },
    platformConnection: { findMany: (...a: unknown[]) => platformConnFindMany(...a) },
    vaultSecret: { findMany: (...a: unknown[]) => vaultSecretFindMany(...a) },
  },
}));

const getUserIdMock = jest.fn();
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => getUserIdMock(...a),
}));

const getEffectiveOrgMock = jest.fn();
jest.mock('@/lib/multi-business', () => ({
  getEffectiveOrganizationId: (...a: unknown[]) => getEffectiveOrgMock(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { GET } from '@/app/api/credential-coverage/route';

const req = {} as unknown as Parameters<typeof GET>[0];

beforeEach(() => {
  jest.clearAllMocks();
  getUserIdMock.mockResolvedValue('user-1');
  getEffectiveOrgMock.mockResolvedValue('org-1');
  orgFindUnique.mockResolvedValue({ slug: 'carsi' });
  platformConnFindMany.mockResolvedValue([{ platform: 'instagram' }]);
  vaultSecretFindMany.mockResolvedValue([{ slug: 'onepassword-carsi-linkedin' }]);
});

describe('GET /api/credentials/coverage', () => {
  it('returns 401 when unauthenticated', async () => {
    getUserIdMock.mockResolvedValue(null);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when the user has no active organization', async () => {
    getEffectiveOrgMock.mockResolvedValue(null);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns a coverage report scoped to the caller org', async () => {
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // carsi facebook (platforms include instagram) → connected via instagram;
    // carsi linkedin has a stored reference → reference_only; carsi youtube → missing.
    const statuses = body.report.rows.map((r: { status: string }) => r.status).sort();
    expect(statuses).toEqual(['connected_oauth', 'missing', 'reference_only']);
    expect(body.report.totals.connected_oauth).toBe(1);
    expect(body.report.totals.reference_only).toBe(1);
  });

  it('reads only secret-free metadata (no token/value selects)', async () => {
    await GET(req);
    const connSelect = platformConnFindMany.mock.calls[0][0].select;
    const vaultSelect = vaultSecretFindMany.mock.calls[0][0].select;
    expect(connSelect).toEqual({ platform: true });
    expect(vaultSelect).toEqual({ slug: true });
    // Defensive: ensure no secret-bearing fields were requested.
    expect(Object.keys(connSelect)).not.toContain('accessToken');
    expect(Object.keys(vaultSelect)).not.toContain('encryptedValue');
  });

  it('returns an empty report when the org has no slug', async () => {
    orgFindUnique.mockResolvedValue({ slug: null });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.report.rows).toEqual([]);
  });
});
