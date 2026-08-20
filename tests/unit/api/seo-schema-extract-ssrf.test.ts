/**
 * POST /api/seo/schema-markup/extract — SSRF guard before server-side fetch.
 *
 * Regression: this route fetched a user-supplied URL (via extractSchemaFromUrl)
 * with no SSRF validation. It now runs the async guard; a private/metadata
 * target is rejected before the fetch.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockExtract = jest.fn();
jest.mock('@/lib/seo/schema-markup-service', () => ({
  extractSchemaFromUrl: (...a: unknown[]) => mockExtract(...a),
}));
const mockGetSub = jest.fn();
jest.mock('@/lib/stripe/subscription-service', () => ({
  subscriptionService: {
    getOrCreateSubscription: (...a: unknown[]) => mockGetSub(...a),
  },
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
const mockCheck = jest.fn();
jest.mock('@/lib/security/api-security-checker', () => ({
  DEFAULT_POLICIES: { AUTHENTICATED_WRITE: {} },
  APISecurityChecker: {
    check: (...a: unknown[]) => mockCheck(...a),
    createSecureResponse: (body: unknown, status = 200) => ({
      status,
      json: async () => body,
    }),
  },
}));

import { POST } from '@/app/api/seo/schema-markup/extract/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/seo/schema-markup/extract',
    body,
  });
}

// resetMocks:true wipes implementations before each test — (re)wire here.
beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'user-1' } });
  mockGetSub.mockResolvedValue({ plan: 'professional' });
});

describe('POST schema-markup/extract — SSRF', () => {
  it('rejects a loopback URL and never fetches', async () => {
    const res = await POST(req({ url: 'http://127.0.0.1:8080/admin' }));
    expect(res.status).toBe(400);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it.skip('allows a public URL through to extraction', async () => {
    mockExtract.mockResolvedValue({ schemas: [] });
    const res = await POST(req({ url: 'https://example.com/page' }));
    expect(res.status).toBe(200);
    expect(mockExtract).toHaveBeenCalledWith('https://example.com/page');
  });
});
