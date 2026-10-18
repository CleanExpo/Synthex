/**
 * P2 u05 — /api/media/generate/voice without user_voices / media_assets.
 * Clone and delete answer 501 before touching the provider; the voice list
 * reports userVoices as unavailable; speech saves report `library`.
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

const mockClone = jest.fn();
const mockDelete = jest.fn();
const mockGenerateSpeech = jest.fn();
jest.mock('@/lib/services/ai/voice-generation', () => ({
  generateSpeech: (...a: unknown[]) => mockGenerateSpeech(...a),
  generateSpeechStream: jest.fn(),
  cloneVoice: (...a: unknown[]) => mockClone(...a),
  getVoices: async () => [{ voiceId: 'v1', name: 'Rachel' }],
  getCustomVoices: async () => [],
  deleteVoice: (...a: unknown[]) => mockDelete(...a),
  getVoiceSettings: jest.fn(),
  getCharacterQuota: async () => ({
    characterCount: 10,
    characterLimit: 100,
    canExtendCharacterLimit: false,
  }),
  DEFAULT_VOICES: { rachel: 'v1' },
}));

import { POST, GET, DELETE } from '@/app/api/media/generate/voice/route';
import { createMockNextRequest } from '../../../helpers/mock-request';

const URL_BASE = 'https://synthex.example/api/media/generate/voice';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheck.mockResolvedValue({ allowed: true, context: { userId: 'u1' } });
});

it('clone answers 501 naming user_voices and never calls the provider', async () => {
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: `${URL_BASE}?action=clone`,
      body: { name: 'Me', audioFiles: ['https://cdn.example/a.mp3'] },
    })
  );
  expect(res.status).toBe(501);
  const json = await res.json();
  expect(json.error).toBe('FEATURE_NOT_PROVISIONED');
  expect(json.message).toContain('user_voices');
  expect(mockClone).not.toHaveBeenCalled();
});

it('delete answers 501 and never deletes at the provider', async () => {
  const res = await DELETE(
    createMockNextRequest({
      method: 'DELETE',
      url: URL_BASE,
      body: { voiceId: 'abc123' },
    })
  );
  expect(res.status).toBe(501);
  expect((await res.json()).message).toContain('user_voices');
  expect(mockDelete).not.toHaveBeenCalled();
});

it('voice list reports userVoices unavailable instead of an empty array', async () => {
  const res = await GET(createMockNextRequest({ url: URL_BASE }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.voices).toHaveLength(1);
  expect(json.userVoices.available).toBe(false);
  expect(json.userVoices.reason).toContain('user_voices');
});

it('speech generation reports the media library save as unavailable', async () => {
  mockGenerateSpeech.mockResolvedValue({
    success: true,
    audioBase64: 'AAAA',
    contentType: 'audio/mpeg',
    voiceId: 'v1',
    characterCount: 5,
  });
  const res = await POST(
    createMockNextRequest({
      method: 'POST',
      url: URL_BASE,
      body: { text: 'hello' },
    })
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.audioBase64).toBe('AAAA');
  expect(json.mediaAssetId).toBeUndefined();
  expect(json.library).toEqual({
    available: false,
    reason: expect.stringContaining('media_assets'),
  });
});
