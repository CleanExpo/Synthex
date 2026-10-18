/**
 * P2 u05 — /api/media/generate/video without media_assets: library saves
 * and status sync report `library: { available: false }` instead of a
 * silently dropped write.
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

jest.mock('@/lib/security/audit-logger', () => ({
  auditLogger: { logData: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/billing/require-entitlement', () => ({
  requireEntitlement: async () => ({ allowed: true }),
}));

const mockGenerateVideo = jest.fn();
const mockCheckStatus = jest.fn();
jest.mock('@/lib/services/ai/video-generation', () => ({
  generateVideo: (...a: unknown[]) => mockGenerateVideo(...a),
  generateScriptVideo: jest.fn(),
  animateImage: jest.fn(),
  checkVideoStatus: (...a: unknown[]) => mockCheckStatus(...a),
}));

import { POST, GET } from '@/app/api/media/generate/video/route';
import { createMockNextRequest } from '../../../helpers/mock-request';

const URL_BASE = 'https://synthex.example/api/media/generate/video';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

it('generation reports the library save as unavailable', async () => {
  mockGenerateVideo.mockResolvedValue({
    success: true,
    provider: 'runway',
    videoId: 'vid-1',
    status: 'processing',
  });
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_BASE,
      body: { type: 'text-to-video', prompt: 'a boat' },
    })
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.videoId).toBe('vid-1');
  expect(json.mediaAssetId).toBeUndefined();
  expect(json.library.available).toBe(false);
  expect(json.library.reason).toContain('media_assets');
});

it('omits library when the caller opted out of saving', async () => {
  mockGenerateVideo.mockResolvedValue({
    success: true,
    provider: 'runway',
    videoId: 'vid-2',
    status: 'processing',
  });
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_BASE,
      body: { type: 'text-to-video', prompt: 'a boat', saveToLibrary: false },
    })
  );
  expect((await res.json()).library).toBeUndefined();
});

it('status check with a finished video reports the sync as unavailable', async () => {
  mockCheckStatus.mockResolvedValue({
    videoId: 'vid-1',
    provider: 'runway',
    status: 'completed',
    videoUrl: 'https://cdn.example/v.mp4',
  });
  const res = await GET(
    createMockNextRequest({ url: `${URL_BASE}?videoId=vid-1&provider=runway` })
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.videoUrl).toBe('https://cdn.example/v.mp4');
  expect(json.library.available).toBe(false);
});
