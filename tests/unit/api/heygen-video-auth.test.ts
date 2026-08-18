/**
 * POST /api/heygen/video — no-service-token fallback requires a real user.
 *
 * Regression: when the service token was invalid the route fell back to the
 * SERVICE_WRITE policy (requireAuth:false), so `allowed` was always true and
 * auth was a no-op on a paid pipeline. It now falls back to AUTHENTICATED_WRITE
 * and rejects an unauthenticated caller.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockValidateServiceToken = jest.fn();
jest.mock('@/lib/security/service-token-validator', () => ({
  validateServiceToken: (...a: unknown[]) => mockValidateServiceToken(...a),
}));
jest.mock('@/lib/rate-limit/rate-limiter', () => ({
  withRateLimit: (_req: unknown, fn: () => unknown) => fn(),
}));

const AUTHENTICATED_WRITE = { __policy: 'AUTHENTICATED_WRITE' };
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE,
    SERVICE_WRITE: { __policy: 'SERVICE_WRITE' },
  },
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: unknown, status = 200) => ({
      status,
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/marketing-agency/heygen/client', () => ({
  createHeyGenClient: jest.fn(),
}));
jest.mock('@/lib/services/ai/voice-generation', () => ({
  generateSpeech: jest.fn(),
}));
jest.mock('@/lib/storage/platform-storage', () => ({
  uploadToStorage: jest.fn(),
}));

import { POST } from '@/app/api/heygen/video/route';

beforeEach(() => jest.clearAllMocks());

describe('POST /api/heygen/video — auth fallback', () => {
  it('rejects when no service token and no authenticated user', async () => {
    mockValidateServiceToken.mockReturnValue({ valid: false });
    mockCheck.mockResolvedValue({
      allowed: false,
      error: 'Authentication required',
    });

    const res = await POST(
      createMockNextRequest({
        method: 'POST',
        url: 'http://localhost/api/heygen/video',
        body: { script: 'hi', avatarId: 'a1' },
      })
    );

    expect(res.status).toBe(403);
    // The fallback must use the auth-enforcing policy, never SERVICE_WRITE.
    expect(mockCheck).toHaveBeenCalledWith(
      expect.anything(),
      AUTHENTICATED_WRITE
    );
  });
});
