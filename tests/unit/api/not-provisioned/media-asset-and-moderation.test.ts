/**
 * P2 u05 — honest status where the backing table has no Prisma model.
 *   GET /api/media/assets/[id]/image  → 503 (media_assets not provisioned)
 *   PUT /api/moderation/check         → 503 (brand_guidelines not provisioned)
 */

/** @jest-environment node */

const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

const mockAudit = jest.fn();
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: (...a: unknown[]) => mockAudit(...a) },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { GET as getAssetImage } from '@/app/api/media/assets/[id]/image/route';
import { PUT as putGuidelines } from '@/app/api/moderation/check/route';
import { createMockNextRequest } from '../../../helpers/mock-request';

const ASSET_ID = '3f2b8c1e-7a4d-4e1b-9c2a-5d6e7f8a9b0c';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

describe('GET /api/media/assets/[id]/image', () => {
  const get = (id: string) =>
    getAssetImage(
      createMockNextRequest({
        url: `https://synthex.example/api/media/assets/${id}/image`,
      }),
      { params: Promise.resolve({ id }) }
    );

  it('answers 503 FEATURE_NOT_PROVISIONED naming media_assets', async () => {
    const res = await get(ASSET_ID);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(json.message).toContain('media_assets');
  });

  it('still refuses an unauthenticated caller with 403', async () => {
    mockCheck.mockResolvedValue({ allowed: false, error: 'Unauthorized' });
    const res = await get(ASSET_ID);
    expect(res.status).toBe(403);
  });

  it('still rejects a malformed id with 400', async () => {
    const res = await get('not-a-uuid');
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/moderation/check', () => {
  const put = (body: object) =>
    putGuidelines(
      createMockNextRequest({
        method: 'PUT',
        url: 'https://synthex.example/api/moderation/check',
        body,
      })
    );

  it('answers 503 naming brand_guidelines and never claims a save', async () => {
    const res = await put({ companyName: 'Acme' });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
    expect(json.message).toContain('brand_guidelines');
    expect(json.success).toBeUndefined();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('keeps validation: missing companyName is 400', async () => {
    const res = await put({});
    expect(res.status).toBe(400);
  });

  it('keeps auth: refused caller is 403', async () => {
    mockCheck.mockResolvedValue({ allowed: false, error: 'Unauthorized' });
    const res = await put({ companyName: 'Acme' });
    expect(res.status).toBe(403);
  });
});
