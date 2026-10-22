/**
 * Honest status for two settings reads (JEV goal sweep G4.C3).
 *
 * SEAM: the exported GET handlers of /api/settings/api-credentials and
 * /api/user/profile, called with a request; the data layer (@/lib/prisma) and
 * request auth are the mocked boundaries.
 * Catches: a failed or unavailable read answered 2xx with an empty list or a
 * blank default profile. Misses: client-side rendering of the error, non-GET
 * handlers, the profile "no row" path (a successful read, kept at 200).
 */

import type { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCheck = jest.fn();
const mockCredFindMany = jest.fn();
const mockUserFindUnique = jest.fn();
const mockGetUserId = jest.fn();
const prismaState: { client: unknown } = { client: null };

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: (...a: unknown[]) => mockCheck(...a) },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: { requireAuth: true } },
}));

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return prismaState.client;
  },
}));

jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...a: unknown[]) => mockGetUserId(...a),
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET as credentialsGET } from '@/app/api/settings/api-credentials/route';
import { GET as profileGET } from '@/app/api/user/profile/route';

function request(path: string): NextRequest {
  return {
    url: `http://localhost:3000${path}`,
    method: 'GET',
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

const DB_DOWN = new Error("Can't reach database server at db:5432");

describe('GET /api/settings/api-credentials — a failed read is never an empty list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheck.mockResolvedValue({
      allowed: true,
      context: { userId: 'user-1' },
    });
    prismaState.client = {
      aPICredential: { findMany: (...a: unknown[]) => mockCredFindMany(...a) },
    };
  });

  it('answers 500 with an error, not { credentials: [] }, when the query fails', async () => {
    mockCredFindMany.mockRejectedValue(DB_DOWN);

    const res = await credentialsGET(request('/api/settings/api-credentials'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('credentials');
  });

  it('answers 503 FEATURE_NOT_PROVISIONED when the api_credentials table is missing', async () => {
    mockCredFindMany.mockRejectedValue(
      new Error('P2021: The table `public.api_credentials` does not exist')
    );

    const res = await credentialsGET(request('/api/settings/api-credentials'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(503);
    expect(body.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(body).not.toHaveProperty('credentials');
  });

  it('answers 503 with an error when the Prisma client is unavailable', async () => {
    prismaState.client = null;

    const res = await credentialsGET(request('/api/settings/api-credentials'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(503);
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('credentials');
  });

  it('still answers 200 with the rows when the read succeeds', async () => {
    mockCredFindMany.mockResolvedValue([{ id: 'cred-1', provider: 'openai' }]);

    const res = await credentialsGET(request('/api/settings/api-credentials'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.credentials).toEqual([{ id: 'cred-1', provider: 'openai' }]);
  });
});

describe('GET /api/user/profile — a failed read is never a blank profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockResolvedValue('user-1');
    prismaState.client = {
      user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    };
  });

  it('answers 500 { error: "Failed to fetch profile" }, not a default profile, when the query fails', async () => {
    mockUserFindUnique.mockRejectedValue(DB_DOWN);

    const res = await profileGET(request('/api/user/profile'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to fetch profile');
    expect(body).not.toHaveProperty('profile');
  });
});
