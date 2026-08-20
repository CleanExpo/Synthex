/**
 * SYN-1119 — bind the legacy video service-token exemption to RestoreAssist.
 *
 * These tests intentionally use the real service-token validator and source
 * allowlist with fixture request headers. Provider, persistence, entitlement,
 * and user-auth dependencies are isolated so the assertions exercise the
 * route's actual service-auth boundary without external calls.
 */

/** @jest-environment node */
const TEST_SERVICE_TOKEN = 'syn-1119-test-service-token';
const mockCheck = jest.fn();
const mockGenerateVideo = jest.fn();
const mockCheckVideoStatus = jest.fn();
const mockRequireEntitlement = jest.fn();

jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: {
    check: (...args: unknown[]) => mockCheck(...args),
    createSecureResponse: (body: object, status = 200) =>
      new Response(JSON.stringify(body), { status }),
  },
  DEFAULT_POLICIES: {
    AUTHENTICATED_WRITE: 'AUTHENTICATED_WRITE',
    AUTHENTICATED_READ: 'AUTHENTICATED_READ',
  },
}));

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/services/ai/video-generation', () => ({
  generateVideo: (...args: unknown[]) => mockGenerateVideo(...args),
  generateScriptVideo: jest.fn(),
  animateImage: jest.fn(),
  checkVideoStatus: (...args: unknown[]) => mockCheckVideoStatus(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/platform/noop-client', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: (...args: unknown[]) => mockRequireEntitlement(...args),
}));

import { createMockNextRequest } from '../../helpers/mock-request';

type VideoRoute = typeof import('@/app/api/media/generate/video/route');
let POST: VideoRoute['POST'];
let GET: VideoRoute['GET'];
let originalServiceToken: string | undefined;

const serviceHeaders = (sourceApp?: string, token = TEST_SERVICE_TOKEN) => ({
  'x-service-token': token,
  ...(sourceApp ? { 'x-source-app': sourceApp } : {}),
});

const post = (headers: Record<string, string>) =>
  POST(
    createMockNextRequest({
      method: 'POST',
      url: 'https://synthex.example/api/media/generate/video',
      headers,
      body: {
        type: 'text-to-video',
        prompt: 'fixture generation request',
      },
    })
  );

const get = (headers: Record<string, string>) =>
  GET(
    createMockNextRequest({
      method: 'GET',
      url: 'https://synthex.example/api/media/generate/video',
      headers,
    })
  );

beforeAll(async () => {
  originalServiceToken = process.env.SYNTHEX_SERVICE_TOKEN;
  process.env.SYNTHEX_SERVICE_TOKEN = TEST_SERVICE_TOKEN;
  ({ POST, GET } = await import('@/app/api/media/generate/video/route'));
});

afterAll(() => {
  if (originalServiceToken === undefined) {
    delete process.env.SYNTHEX_SERVICE_TOKEN;
  } else {
    process.env.SYNTHEX_SERVICE_TOKEN = originalServiceToken;
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({
    allowed: false,
    error: 'Authentication required',
  });
  mockRequireEntitlement.mockResolvedValue({ allowed: true });
  mockGenerateVideo.mockResolvedValue({
    success: false,
    status: 'not_configured',
    provider: 'runway',
    reason: 'Video provider not configured',
  });
});

describe('POST /api/media/generate/video service-token scope', () => {
  it('rejects a valid token claiming a non-allowed service source', async () => {
    const response = await post(serviceHeaders('unite-nexus'));

    expect(response.status).toBe(403);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.anything(),
      'AUTHENTICATED_WRITE'
    );
    expect(mockGenerateVideo).not.toHaveBeenCalled();
    expect(mockRequireEntitlement).not.toHaveBeenCalled();
  });

  it('rejects a valid token with no declared service source', async () => {
    const response = await post(serviceHeaders());

    expect(response.status).toBe(403);
    expect(mockGenerateVideo).not.toHaveBeenCalled();
  });

  it('rejects an invalid token even when it claims RestoreAssist', async () => {
    const response = await post(
      serviceHeaders('restoreassist', 'wrong-test-service-token')
    );

    expect(response.status).toBe(403);
    expect(mockGenerateVideo).not.toHaveBeenCalled();
  });

  it('preserves the intended RestoreAssist service-token exemption', async () => {
    const response = await post(serviceHeaders('restoreassist'));

    expect(response.status).toBe(422);
    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockRequireEntitlement).not.toHaveBeenCalled();
    expect(mockGenerateVideo).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/media/generate/video service-token scope', () => {
  it('rejects a valid token claiming a non-allowed service source', async () => {
    const response = await get(serviceHeaders('unite-nexus'));

    expect(response.status).toBe(403);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.anything(),
      'AUTHENTICATED_READ'
    );
    expect(mockCheckVideoStatus).not.toHaveBeenCalled();
  });

  it('rejects a valid token with no declared service source', async () => {
    const response = await get(serviceHeaders());

    expect(response.status).toBe(403);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.anything(),
      'AUTHENTICATED_READ'
    );
    expect(mockCheckVideoStatus).not.toHaveBeenCalled();
  });

  it('preserves status access for the intended RestoreAssist service token', async () => {
    const response = await get(serviceHeaders('restoreassist'));

    expect(response.status).toBe(200);
    expect(mockCheck).not.toHaveBeenCalled();
  });
});
