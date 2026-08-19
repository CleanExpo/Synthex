/**
 * Unit test — SYN-43 / SYN-48 caller handles an unconfigured video provider
 * without a 500.
 *
 * With no RUNWAY/SYNTHESIA/DID key set, the real video-generation service returns
 * `not_configured`; the route MUST reply 422 with a clear `{ error, details }`
 * and never 500 / never fabricate or persist a video.
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

jest.mock('@/lib/security/service-token-validator', () => ({
  validateServiceToken: () => ({ valid: false }),
}));

const mockAudit = jest.fn();
jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: (...a: unknown[]) => mockAudit(...a) },
}));

const mockInsert = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: (...a: unknown[]) => {
        mockInsert(...a);
        return {
          select: () => ({ single: () => ({ data: null, error: null }) }),
        };
      },
    }),
  }),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Central entitlement gate (SYN-1106) — grant Business so this test stays
// focused on unconfigured-provider handling, not the subscription gate.
jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({
    allowed: true,
    effectivePlan: 'business',
    requiredPlan: 'business',
    subscription: { plan: 'business', status: 'active' },
  }),
}));

import { POST } from '@/app/api/media/generate/video/route';
import { createMockNextRequest } from '../../helpers/mock-request';

const post = (body: object) =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/media/generate/video',
      body,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.RUNWAY_API_KEY;
  delete process.env.SYNTHESIA_API_KEY;
  delete process.env.DID_API_KEY;
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

describe('POST /api/media/generate/video with an unconfigured provider', () => {
  it('returns 422 (not 500) and a clear error, persisting nothing', async () => {
    const res = await post({
      type: 'text-to-video',
      prompt: 'a moisture meter drying a wall',
    });

    expect(res.status).toBe(422);
    expect(res.status).not.toBe(500);

    const json = await res.json();
    expect(json.error).toMatch(/not configured|Artlist|substrate/i);
    expect(json.details).toEqual({ provider: 'runway' });

    // No fabricated asset written to the media library.
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
